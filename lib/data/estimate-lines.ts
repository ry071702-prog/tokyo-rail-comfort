// 実データ由来の推定ライン。
// 国交省の実混雑率（baseline.ts）× 推定エンジン（lib/congestion/estimate.ts）で
// 区間×時間帯の推定混雑率を生成する。モックの作り物 peakRate は「区間ごとの相対差」
// を表す暫定按分ウェイトとしてのみ流用する。
//
// 推定混雑率(%) = ベース混雑率(路線, 国交省) × 区間ウェイト × 時間帯係数 × 曜日係数 × 遅延補正
//   ベース混雑率  … baseline.ts（国交省 令和6年度 混雑率調査の路線最大値）
//   区間ウェイト  … 現行モックの区間 peakRate 比（最混雑区間=1.0 に正規化）※暫定
//   時間帯係数    … HOURLY_FACTOR（暫定カーブ）※ODPT時刻表で置換予定
//   曜日係数/遅延 … estimateCongestion 内部（lib/congestion/estimate.ts）

import {
  estimateCongestion,
  type DayKind,
} from "@/lib/congestion/estimate";
import { MOCK_LINES, type MockLine } from "@/lib/mock/lines";
import { baselineRateForRailway } from "@/lib/data/baseline";

// 時間帯係数：ピーク(朝8時)=1.00 を基準にした相対カーブ。index = 時(0〜23)。
// ⚠️ 暫定カーブ。ODPT `odpt:StationTimetable` 由来の timeband_factor（時間帯別本数）で
//    置換予定（M3 の seed:timeband）。それまでの現実的な通勤カーブの近似。
const HOURLY_FACTOR: readonly number[] = [
  0.2, 0.15, 0.12, 0.14, 0.22, 0.42, // 0〜5 時（終電〜始発前後）
  0.72, 0.94, 1.0, 0.86, 0.6, 0.54, // 6〜11 時（朝ピーク）
  0.56, 0.53, 0.5, 0.54, 0.66, 0.86, // 12〜17 時（昼の谷 → 夕方立ち上がり）
  0.95, 0.78, 0.6, 0.46, 0.36, 0.26, // 18〜23 時（夕ピーク → 減衰）
];

// 路線 id → ODPT 路線コード（baseline.ts / CSV の railway_id と突き合わせる）。
const LINE_RAILWAY_ID: Record<string, string> = {
  yamanote: "odpt.Railway:JR-East.Yamanote",
  chuo: "odpt.Railway:JR-East.ChuoRapid",
  tozai: "odpt.Railway:TokyoMetro.Tozai",
};

// baseline.ts に該当行が無い路線の保険値（%）。基本は国交省値を使う。
const FALLBACK_BASELINE_RATE = 150;

/** 推定済みの区間（区間×時間帯の推定混雑率を持つ）。 */
export interface EstimatedSegment {
  id: string;
  fromStation: string;
  toStation: string;
  /** 暫定按分ウェイト（最混雑区間=1.0）。ODPT時刻表・実測が入るまでの暫定値。 */
  weight: number;
  /** この区間のベース混雑率(%) = 路線ベース × weight。 */
  baselineRatePct: number;
  /** ピーク時の推定混雑率(%)（hourly の最大値）。 */
  peakRate: number;
  /** 0〜23 時の推定混雑率(%)。index = 時。 */
  hourly: number[];
}

/** 推定済みのライン。 */
export interface EstimatedLine {
  id: string;
  name: string;
  operator: string;
  operatorLabel: string;
  color: string;
  stations: readonly { name: string }[];
  /** 路線ベース混雑率(%) = 国交省 baseline.ts の路線最大値。 */
  baselineRatePct: number;
  segments: EstimatedSegment[];
}

/** 推定オプション。曜日・現在時刻・遅延を差し込む。 */
export interface EstimateOptions {
  /** 曜日種別。省略時は JST の現在日付から判定。 */
  dayKind?: DayKind;
  /** 「今」の JST 時（0〜23）。この時間帯のセルにのみ遅延補正を反映する。 */
  nowHour?: number | null;
  /** 遅延（分）。nowHour のセルにのみ適用（他の時間帯は 0）。 */
  delayMinutes?: number;
}

/**
 * JST の現在日付から曜日種別を返す。土日 → holiday、平日 → weekday。
 * TODO: 日本の祝日は未対応（将来 holiday 判定ライブラリ or マスタで置換）。
 */
export function currentDayKind(now: Date = new Date()): DayKind {
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Tokyo",
    weekday: "short",
  }).format(now);
  return weekday === "Sat" || weekday === "Sun" ? "holiday" : "weekday";
}

/** 1 区間の 0〜23 時の推定混雑率(%)を生成する。遅延補正は nowHour のセルのみ。 */
function buildHourly(
  baselineRatePct: number,
  dayKind: DayKind,
  nowHour: number | null,
  delayMinutes: number
): number[] {
  return HOURLY_FACTOR.map(
    (factor, hour) =>
      estimateCongestion({
        baselineRatePct,
        timebandFactor: factor,
        dayKind,
        delayMinutes: hour === nowHour ? delayMinutes : 0,
      }).ratePct
  );
}

/** 1 路線分の推定ラインを生成する（純関数・与えたオプションに対して決定的）。 */
export function buildEstimatedLine(
  line: MockLine,
  opts: EstimateOptions = {}
): EstimatedLine {
  const dayKind = opts.dayKind ?? currentDayKind();
  const nowHour = opts.nowHour ?? null;
  const delayMinutes = opts.delayMinutes ?? 0;

  const routeBase =
    baselineRateForRailway(LINE_RAILWAY_ID[line.id] ?? "") ??
    FALLBACK_BASELINE_RATE;

  // 区間ウェイト：モックの区間 peakRate 比を最混雑区間=1.0 に正規化（暫定按分）。
  const maxPeak = Math.max(...line.segments.map((s) => s.peakRate));

  const segments: EstimatedSegment[] = line.segments.map((s) => {
    const weight = maxPeak > 0 ? s.peakRate / maxPeak : 1;
    const baselineRatePct = routeBase * weight;
    const hourly = buildHourly(baselineRatePct, dayKind, nowHour, delayMinutes);
    return {
      id: s.id,
      fromStation: s.fromStation,
      toStation: s.toStation,
      weight,
      baselineRatePct,
      peakRate: Math.max(...hourly),
      hourly,
    };
  });

  return {
    id: line.id,
    name: line.name,
    operator: line.operator,
    operatorLabel: line.operatorLabel,
    color: line.color,
    stations: line.stations,
    baselineRatePct: routeBase,
    segments,
  };
}

/** 全路線の推定ラインを生成する。 */
export function buildEstimatedLines(opts: EstimateOptions = {}): EstimatedLine[] {
  return MOCK_LINES.map((line) => buildEstimatedLine(line, opts));
}

/** 指定 id の推定ラインを生成する（無ければ undefined）。 */
export function getEstimatedLine(
  lineId: string,
  opts: EstimateOptions = {}
): EstimatedLine | undefined {
  const line = MOCK_LINES.find((l) => l.id === lineId);
  return line ? buildEstimatedLine(line, opts) : undefined;
}

// 遅延・曜日なしの静的な推定ライン（路線ボタン・初期状態・メタ情報用）。
// 表示値は曜日係数のみ反映（現在日付基準）、遅延補正は含まない。
export const ESTIMATED_LINES: readonly EstimatedLine[] = buildEstimatedLines();

export interface ComfortableHour {
  hour: number;
  rate: number;
}

/**
 * 指定区間で「空いている時間帯 トップ N」を返す（純関数）。
 * 深夜早朝（0〜4時）は実用的な通勤時間ではないため除外し、始発以降の快適な時間帯を提案する。
 */
export function topComfortableHours(
  segment: EstimatedSegment,
  count = 3,
  fromHour = 5,
  toHour = 23
): ComfortableHour[] {
  return segment.hourly
    .map((rate, hour) => ({ hour, rate }))
    .filter((h) => h.hour >= fromHour && h.hour <= toHour)
    .sort((a, b) => a.rate - b.rate)
    .slice(0, count);
}
