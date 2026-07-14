// 混雑推定モデル（純関数）。副作用なし・DB/ネットワークに触れない。
// 推定混雑率(%) = ベース混雑率(区間) × 時間帯係数 × 曜日係数 × リアルタイム補正(遅延分)
// 入力はマスタ値（congestion_baseline / timeband_factor）＋曜日種別＋遅延分。
// これは「実測」ではなく「推定」であることに注意（UI では推定である旨を明示する）。
// 詳細は docs/CONCEPT.md「3. 混雑推定モデル」、境界の根拠は下記コメントを参照。

/** 曜日種別。supabase/schema.sql の day_type enum と整合。 */
export type DayKind = "weekday" | "holiday";

/** 5段階の混雑レベル（弱い順）。国交省の混雑率目安に対応。 */
export const CONGESTION_LEVELS = [
  "快適",
  "やや混雑",
  "混雑",
  "かなり混雑",
  "激しい混雑",
] as const;

export type CongestionLevel = (typeof CONGESTION_LEVELS)[number];

/** 推定の入力。数値はいずれも有限・非負を想定するが、不正値はガードする。 */
export interface CongestionEstimateInput {
  /** 区間のベース混雑率(%)。国交省 congestion_baseline.congestion_rate（例: 139.0）。 */
  baselineRatePct: number;
  /** 時間帯係数。timeband_factor.factor（ピーク=1.0 に対する相対値）。 */
  timebandFactor: number;
  /** 曜日種別。weekday=1.0 / holiday は需要が下がる。 */
  dayKind: DayKind;
  /** リアルタイム遅延（分）。ODPT 運行情報由来。0 なら補正なし。 */
  delayMinutes: number;
}

/** 推定の出力。 */
export interface CongestionEstimate {
  /** 推定混雑率(%)。小数第1位で丸め。 */
  ratePct: number;
  /** 0–1 に正規化した指数（200% を 1.0 とする）。 */
  index: number;
  /** 5段階レベル。 */
  level: CongestionLevel;
}

// --- 定数（根拠つき） -------------------------------------------------------

// 曜日係数。国交省のベース混雑率は「平日朝ピーク」の統計値なので weekday=1.0。
// 土休日は通勤需要が大きく減るため経験則で約3割減（0.7）とする。
// （時刻表由来の timebandFactor も day_kind 別に持てるが、それとは別に
//  日種別レベルの需要差をここで一段掛ける。）
const DAY_FACTOR: Record<DayKind, number> = {
  weekday: 1.0,
  holiday: 0.7,
};

// 遅延補正。遅延で運転間隔が開くと1本あたりの乗車が増えるため上昇方向に補正。
// 1分あたり +2%、上限 +50%（=係数1.5）でキャップ（非現実的な発散を防ぐ）。
// この設定だと 25 分でキャップに達する。
const DELAY_UPLIFT_PER_MIN = 0.02;
const DELAY_MAX_UPLIFT = 0.5;

// 指数正規化の基準。混雑率 200%（体が触れ合い相当の圧迫）を index=1.0 とみなす。
const INDEX_RATE_AT_ONE = 200;

// レベル境界（%の下限）。国交省の混雑率目安に基づく:
//   100% = 定員乗車（座席＋つり革・手すりが埋まる。ここまでは快適の範囲）
//   150% = 肩が触れ合う程度（新聞は折れば読める）
//   180% = 体が触れ合い相当の圧迫感
//   200% = 体が触れ合い相当の圧迫（週刊誌がなんとか読める）
const LEVEL_THRESHOLDS: ReadonlyArray<{ min: number; level: CongestionLevel }> =
  [
    { min: 200, level: "激しい混雑" },
    { min: 180, level: "かなり混雑" },
    { min: 150, level: "混雑" },
    { min: 100, level: "やや混雑" },
    { min: 0, level: "快適" },
  ];

// --- ヘルパ -----------------------------------------------------------------

/** 有限かつ非負の数のみ通す。NaN/Infinity/負数は fallback に落とす。 */
function safeNonNegative(value: number, fallback: number): number {
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

/** 小数第 n 位で丸める（浮動小数の境界ブレを抑える）。 */
function roundTo(value: number, digits: number): number {
  const p = 10 ** digits;
  return Math.round(value * p) / p;
}

// --- 公開関数 ---------------------------------------------------------------

/**
 * 遅延分から混雑補正係数を返す。0 分なら 1.0、上限 +50%（1.5）でキャップ。
 * 負値・NaN は 0 分として扱う。
 */
export function delayCorrectionFactor(delayMinutes: number): number {
  const min = safeNonNegative(delayMinutes, 0);
  return 1 + Math.min(min * DELAY_UPLIFT_PER_MIN, DELAY_MAX_UPLIFT);
}

/** 混雑率(%)を 0–1 の指数へ正規化（200% で 1.0、上限 1.0 でクランプ）。 */
export function normalizeIndex(ratePct: number): number {
  const rate = safeNonNegative(ratePct, 0);
  return roundTo(Math.min(rate / INDEX_RATE_AT_ONE, 1), 3);
}

/** 混雑率(%)を 5 段階レベルへマッピング。 */
export function levelFromRate(ratePct: number): CongestionLevel {
  const rate = safeNonNegative(ratePct, 0);
  for (const { min, level } of LEVEL_THRESHOLDS) {
    if (rate >= min) return level;
  }
  return "快適";
}

/**
 * 混雑を推定する純関数。
 * 推定混雑率(%) = ベース混雑率 × 時間帯係数 × 曜日係数 × 遅延補正。
 * 不正入力（NaN/Infinity/負数）は安全側（0 または 1.0）に丸める。
 */
export function estimateCongestion(
  input: CongestionEstimateInput
): CongestionEstimate {
  const baseline = safeNonNegative(input.baselineRatePct, 0);
  const timeband = safeNonNegative(input.timebandFactor, 0);
  const dayFactor = DAY_FACTOR[input.dayKind] ?? DAY_FACTOR.weekday;
  const delay = delayCorrectionFactor(input.delayMinutes);

  const ratePct = roundTo(baseline * timeband * dayFactor * delay, 1);

  return {
    ratePct,
    index: normalizeIndex(ratePct),
    level: levelFromRate(ratePct),
  };
}
