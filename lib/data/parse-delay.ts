// 運行情報テキスト → 遅延分数の抽出（純関数）。
// ODPT `odpt:trainInformationText`（例:「約10分の遅れ」）から推定の遅延補正に渡す分数を得る。
// この値を estimateCongestion の delayMinutes に渡して「今」の時間帯の推定を補正する。

const DELAY_MINUTES_PATTERN = /(\d+)\s*分/;
// 遅延を示すが分数が書かれていない場合の既定値（分）。
const DEFAULT_DELAY_MINUTES = 10;

/**
 * 運行情報テキストから遅延分数を抽出する。
 * - 「約10分」「10分程度の遅れ」等 (\d+)分 があればその数値
 * - 平常運転（「平常」を含む）は 0
 * - 遅延・見合わせ等のテキストだが分数が無い場合は 10 分とみなす
 * - undefined / 空文字は 0
 */
export function parseDelayMinutes(text: string | undefined): number {
  if (!text) return 0;
  if (text.includes("平常")) return 0;

  const match = text.match(DELAY_MINUTES_PATTERN);
  if (match) {
    const minutes = Number(match[1]);
    return Number.isFinite(minutes) ? minutes : DEFAULT_DELAY_MINUTES;
  }

  // 分数の明記が無い異常時（遅延・運転見合わせ等）は既定値で補正する。
  return DEFAULT_DELAY_MINUTES;
}
