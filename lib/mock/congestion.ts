// 混雑度の5段階レベルと色スケール（モック UI 共通）
// 国交省 都市鉄道混雑率調査の目安に沿った推定値を 5 段階へマッピングする純関数群。
// 色は快適=緑系 → 激混み=赤系の直感スケール。色覚多様性に配慮し、UI 側で必ずテキストラベルを併記すること。

export type CongestionLevel = 1 | 2 | 3 | 4 | 5;

export interface CongestionLevelInfo {
  level: CongestionLevel;
  /** 短いラベル（色のみ依存を避けるため必ず併記する） */
  label: string;
  /** 混雑率の目安（国交省の体感目安） */
  hint: string;
  /** セル塗り色（HEX。Tailwind v4 の JIT を避けるため inline style で使う） */
  fill: string;
  /** 塗りの上に載せる文字色 */
  onFill: string;
}

// 快適 → 激混み の順。緑→黄緑→琥珀→橙→赤の連続スケール。
export const CONGESTION_LEVELS: readonly CongestionLevelInfo[] = [
  {
    level: 1,
    label: "快適",
    hint: "混雑率 100%未満／座席か余裕のある立ち",
    fill: "#2E9E5B",
    onFill: "#ffffff",
  },
  {
    level: 2,
    label: "やや混雑",
    hint: "混雑率 100〜139%／新聞を楽に読める程度",
    fill: "#8FB93B",
    onFill: "#1f2937",
  },
  {
    level: 3,
    label: "混雑",
    hint: "混雑率 140〜159%／折りたたむと新聞が読める",
    fill: "#E6A817",
    onFill: "#1f2937",
  },
  {
    level: 4,
    label: "かなり混雑",
    hint: "混雑率 160〜179%／体が触れ合い圧迫感がある",
    fill: "#E2703A",
    onFill: "#ffffff",
  },
  {
    level: 5,
    label: "激しい混雑",
    hint: "混雑率 180%以上／身動きが取りづらい",
    fill: "#CB2E2E",
    onFill: "#ffffff",
  },
] as const;

/** 推定混雑率(%) を 5 段階レベルに変換する純関数 */
export function rateToLevel(rate: number): CongestionLevel {
  if (rate < 100) return 1;
  if (rate < 140) return 2;
  if (rate < 160) return 3;
  if (rate < 180) return 4;
  return 5;
}

/** レベルのメタ情報を取得 */
export function levelInfo(level: CongestionLevel): CongestionLevelInfo {
  return CONGESTION_LEVELS[level - 1];
}

/** 混雑率(%) からセル塗り情報を取得（rateToLevel + levelInfo のショートカット） */
export function rateInfo(rate: number): CongestionLevelInfo {
  return levelInfo(rateToLevel(rate));
}
