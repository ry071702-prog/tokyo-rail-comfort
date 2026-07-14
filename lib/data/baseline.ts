// 国交省 混雑率のベースライン（TypeScript ミラー）。
// ⚠️ 正本は supabase/seed/congestion_baseline_2024.csv。変更時は必ずこの定数と同期する。
//    fs で CSV を読まないのは、Vercel のファイルトレース（本番ビルドに同梱されない）を避けるため。
// 出典: 国土交通省 令和6年度 三大都市圏の主要区間の混雑率調査結果
//   資料2: https://www.mlit.go.jp/report/press/content/001904497.pdf
//   資料3: https://www.mlit.go.jp/report/press/content/001902900.pdf

/** 進行方向。CSV の dir 列（inbound=上り/都心方向, outbound=下り）と整合。 */
export type BaselineDirection = "inbound" | "outbound";

/** 国交省 区間別混雑率の 1 行。CSV の 1 レコードに対応。 */
export interface CongestionBaselineRow {
  /** ODPT 路線コード（例: odpt.Railway:JR-East.Yamanote）。 */
  railwayId: string;
  /** 最混雑区間ラベル（例: 新大久保→新宿 (内回り)）。 */
  segmentLabel: string;
  dir: BaselineDirection;
  /** 最混雑時間帯（例: 7:41-8:41）。 */
  peakTimeBand: string;
  /** 輸送力（人）。 */
  capacity: number;
  /** 輸送人員（人）。 */
  ridership: number;
  /** 混雑率(%)。ridership / capacity ×100 に相当。 */
  congestionRatePct: number;
  /** 調査年度。 */
  fiscalYear: number;
  /** 出典 URL。 */
  sourceUrl: string;
}

const MLIT_URL_2 = "https://www.mlit.go.jp/report/press/content/001904497.pdf";
const MLIT_URL_3 = "https://www.mlit.go.jp/report/press/content/001902900.pdf";

/** supabase/seed/congestion_baseline_2024.csv のミラー（令和6年度・対象3路線分）。 */
export const CONGESTION_BASELINE_2024: readonly CongestionBaselineRow[] = [
  {
    railwayId: "odpt.Railway:JR-East.Yamanote",
    segmentLabel: "上野→御徒町 (外回り)",
    dir: "outbound",
    peakTimeBand: "7:47-8:47",
    capacity: 26032,
    ridership: 34940,
    congestionRatePct: 134,
    fiscalYear: 2024,
    sourceUrl: MLIT_URL_2,
  },
  {
    railwayId: "odpt.Railway:JR-East.Yamanote",
    segmentLabel: "新大久保→新宿 (内回り)",
    dir: "inbound",
    peakTimeBand: "7:41-8:41",
    capacity: 32540,
    ridership: 45160,
    congestionRatePct: 139,
    fiscalYear: 2024,
    sourceUrl: MLIT_URL_2,
  },
  {
    railwayId: "odpt.Railway:JR-East.ChuoRapid",
    segmentLabel: "中野→新宿",
    dir: "inbound",
    peakTimeBand: "7:35-8:35",
    capacity: 41440,
    ridership: 66720,
    congestionRatePct: 161,
    fiscalYear: 2024,
    sourceUrl: MLIT_URL_3,
  },
  {
    railwayId: "odpt.Railway:TokyoMetro.Tozai",
    segmentLabel: "木場→門前仲町",
    dir: "inbound",
    peakTimeBand: "7:50-8:50",
    capacity: 40500,
    ridership: 60750,
    congestionRatePct: 150,
    fiscalYear: 2024,
    sourceUrl: MLIT_URL_3,
  },
  {
    railwayId: "odpt.Railway:TokyoMetro.Tozai",
    segmentLabel: "高田馬場→早稲田",
    dir: "outbound",
    peakTimeBand: "8:00-9:00",
    capacity: 34500,
    ridership: 37950,
    congestionRatePct: 110,
    fiscalYear: 2024,
    sourceUrl: MLIT_URL_2,
  },
] as const;

/**
 * 路線ごとのベース混雑率(%)を返す（国交省の路線最大値）。
 * 該当行が無ければ undefined。
 */
export function baselineRateForRailway(railwayId: string): number | undefined {
  const rates = CONGESTION_BASELINE_2024.filter(
    (r) => r.railwayId === railwayId
  ).map((r) => r.congestionRatePct);
  return rates.length > 0 ? Math.max(...rates) : undefined;
}
