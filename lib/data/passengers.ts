// 駅別乗降人員（1日平均）の静的ミラー。
// ⚠️ 正本は Supabase の stations.daily_passengers
//    取得は scripts/seed-passengers.ts（ODPT odpt:PassengerSurvey  最新年度を採用）
//    出典: 公共交通オープンデータセンター（https://www.odpt.org/）
//    fs で外部ファイルを読まないのは、Vercel のファイルトレース（本番ビルドに同梱されない）を避けるため。
//
// 現状は **未取得（空）**  ODPT_CONSUMER_KEY が未設定のため実データが無い。
// seed:passengers 実行後、その出力をここへ流し込む（駅名は lib/mock/lines.ts の表示名と一致させる）。
// データが無い間は estimate-lines.ts が暫定按分（モックの peakRate 比）にフォールバックする。

// 相対 import：vitest（alias 設定なし）から直接テストできるようにするため
import type { StationPassengers } from "./segment-weight";

export type { StationPassengers };

/**
 * 路線 id（lib/mock/lines.ts の MockLine.id）→ 駅別乗降人員。
 * 空 or 未定義 = 未取得（フォールバック対象）。
 */
export const STATION_PASSENGERS: Readonly<
  Record<string, readonly StationPassengers[]>
> = {
  // 未取得（seed:passengers で取得後にここへ追記する）
  // yamanote: [{ name: "新宿", dailyPassengers: 1_400_000 }, ...],
  yamanote: [],
  chuo: [],
  tozai: [],
};

/** 指定路線の駅別乗降人員を返す（未取得なら null）。 */
export function getPassengers(lineId: string): StationPassengers[] | null {
  const rows = STATION_PASSENGERS[lineId];
  if (!rows || rows.length === 0) return null;
  return rows.map((r) => ({ ...r }));
}
