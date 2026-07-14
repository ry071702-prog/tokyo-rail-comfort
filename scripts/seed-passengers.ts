// 駅別乗降人員（ODPT odpt:PassengerSurvey）を取得して Supabase の stations に投入する
//   stations.daily_passengers … 最新年度の1日平均乗降人員（人）
//   stations.weight           … 路線内の最大値で正規化した 0〜1 の重み（区間按分の素材）
// 区間ウェイトの算出モデルは lib/data/segment-weight.ts（両端駅の幾何平均）を参照
//
// 前提: 先に npm run seed:master で railways / stations を投入しておくこと
// 実行: npm run seed:passengers  (要 .env.local: ODPT_CONSUMER_KEY / SUPABASE_SERVICE_ROLE_KEY)
// 出典: 公共交通オープンデータセンター（https://www.odpt.org/）
//
// 注意
//   - PassengerSurvey が提供されていない事業者・駅がある → 取れない駅はスキップしてログに出す（落とさない）
//   - 事業者により定義が異なる（JR東日本は「乗車人員」、東京メトロは「乗降人員」）
//     MVP では路線内の相対比較にしか使わないため、路線をまたぐ絶対値の比較はしない
import { config } from "dotenv";
config({ path: ".env.local" });

import { createAdminClient } from "../lib/supabase/admin";
import { odptFetch } from "../lib/odpt/client";
import type { OdptPassengerSurvey } from "../lib/odpt/types";

const TARGET_RAILWAYS = [
  "odpt.Railway:JR-East.Yamanote",
  "odpt.Railway:JR-East.ChuoRapid",
  "odpt.Railway:TokyoMetro.Tozai",
];

// 路線 → 事業者（PassengerSurvey は事業者単位でまとめて取得する）
const RAILWAY_OPERATOR: Record<string, string> = {
  "odpt.Railway:JR-East.Yamanote": "odpt.Operator:JR-East",
  "odpt.Railway:JR-East.ChuoRapid": "odpt.Operator:JR-East",
  "odpt.Railway:TokyoMetro.Tozai": "odpt.Operator:TokyoMetro",
};

interface StationRow {
  id: string;
  name_ja: string;
}

/** 最新年度の乗降人員を返す（年度別レコードが無ければ null）。 */
function latestJourneys(survey: OdptPassengerSurvey): number | null {
  const objects = survey["odpt:passengerSurveyObject"] ?? [];
  const valid = objects.filter(
    (o) =>
      typeof o["odpt:passengerJourneys"] === "number" &&
      Number.isFinite(o["odpt:passengerJourneys"]) &&
      o["odpt:passengerJourneys"] > 0
  );
  if (valid.length === 0) return null;
  const latest = valid.reduce((a, b) =>
    (b["odpt:surveyYear"] ?? 0) > (a["odpt:surveyYear"] ?? 0) ? b : a
  );
  return latest["odpt:passengerJourneys"];
}

/** 事業者単位で PassengerSurvey を取得し、駅ID → 最新年度の乗降人員 の Map を作る。 */
async function fetchPassengersByOperator(
  operator: string
): Promise<Map<string, number>> {
  const surveys = await odptFetch<OdptPassengerSurvey>("odpt:PassengerSurvey", {
    "odpt:operator": operator,
  });

  const byStation = new Map<string, number>();
  for (const survey of surveys) {
    const journeys = latestJourneys(survey);
    if (journeys === null) continue;
    for (const stationId of survey["odpt:station"] ?? []) {
      // 同一駅に複数レコードがある場合は大きい方（新しい調査・広い集計）を採用
      const current = byStation.get(stationId);
      if (current === undefined || journeys > current) {
        byStation.set(stationId, journeys);
      }
    }
  }
  return byStation;
}

async function main() {
  const supabase = createAdminClient();

  // 事業者ごとに1回だけ取得してキャッシュする
  const cache = new Map<string, Map<string, number>>();

  for (const railwayId of TARGET_RAILWAYS) {
    console.log(`\n== ${railwayId}`);

    const operator = RAILWAY_OPERATOR[railwayId];
    if (!operator) {
      console.warn(`  事業者が未定義: ${railwayId} → スキップ`);
      continue;
    }

    if (!cache.has(operator)) {
      cache.set(operator, await fetchPassengersByOperator(operator));
    }
    const passengersByStation = cache.get(operator)!;

    const { data: stations, error: stationError } = await supabase
      .from("stations")
      .select("id, name_ja")
      .eq("railway_id", railwayId)
      .order("order_index");
    if (stationError) {
      throw new Error(`stations 取得失敗: ${stationError.message}`);
    }
    const rows: StationRow[] = stations ?? [];
    if (rows.length === 0) {
      console.warn("  駅マスタが空 → 先に npm run seed:master を実行すること");
      continue;
    }

    // 取れた駅だけ集める（PassengerSurvey 未提供の駅はスキップ）
    const found: { id: string; name: string; journeys: number }[] = [];
    const missing: string[] = [];
    for (const station of rows) {
      const journeys = passengersByStation.get(station.id);
      if (journeys === undefined) {
        missing.push(station.name_ja);
        continue;
      }
      found.push({ id: station.id, name: station.name_ja, journeys });
    }

    if (found.length === 0) {
      console.warn("  乗降人員を取得できた駅なし → スキップ（DB は更新しない）");
      if (missing.length > 0) console.warn(`  未取得: ${missing.join(", ")}`);
      continue;
    }

    // 路線内の最大値で正規化した重み（0〜1）
    const maxJourneys = Math.max(...found.map((f) => f.journeys));
    for (const station of found) {
      const weight = Number((station.journeys / maxJourneys).toFixed(3));
      const { error } = await supabase
        .from("stations")
        .update({ daily_passengers: station.journeys, weight })
        .eq("id", station.id);
      if (error) {
        throw new Error(`stations update 失敗 (${station.id}): ${error.message}`);
      }
    }

    console.log(`  乗降人員を投入: ${found.length} 駅（最大 ${maxJourneys.toLocaleString()} 人/日）`);
    if (missing.length > 0) {
      console.warn(
        `  未提供でスキップ: ${missing.length} 駅 → ${missing.join(", ")}`
      );
    }

    // lib/data/passengers.ts へ貼れる形で出力（静的ミラーの更新用）
    console.log("  --- lib/data/passengers.ts 用 ---");
    console.log(
      `  ${JSON.stringify(
        found.map((f) => ({ name: f.name, dailyPassengers: f.journeys }))
      )}`
    );
  }

  console.log("\n完了");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
