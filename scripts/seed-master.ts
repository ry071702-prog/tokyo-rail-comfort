// M1: ODPT の路線・駅マスタを取得して Supabase に投入する
// 実行: npm run seed:master  (要 .env.local: ODPT_CONSUMER_KEY / SUPABASE_SERVICE_ROLE_KEY)
import { config } from "dotenv";
config({ path: ".env.local" });

import { createAdminClient } from "../lib/supabase/admin";
import { odptFetch } from "../lib/odpt/client";
import type { OdptRailway, OdptStation } from "../lib/odpt/types";

// 対象3路線 (TASKS.md M1 推奨)
const TARGET_RAILWAYS = [
  "odpt.Railway:JR-East.Yamanote",
  "odpt.Railway:JR-East.ChuoRapid",
  "odpt.Railway:TokyoMetro.Tozai",
];

async function main() {
  const supabase = createAdminClient();

  for (const [railwayIndex, railwayId] of TARGET_RAILWAYS.entries()) {
    console.log(`\n== ${railwayId}`);

    const railways = await odptFetch<OdptRailway>("odpt:Railway", {
      "owl:sameAs": railwayId,
    });
    const railway = railways[0];
    if (!railway) {
      console.warn(`  路線が見つからない: ${railwayId} → スキップ`);
      continue;
    }

    const { error: railwayError } = await supabase.from("railways").upsert({
      id: railway["owl:sameAs"],
      operator: railway["odpt:operator"],
      name_ja: railway["odpt:railwayTitle"]?.ja ?? railway["dc:title"],
      name_en: railway["odpt:railwayTitle"]?.en ?? null,
      color: railway["odpt:color"] ?? null,
      order_index: railwayIndex,
    });
    if (railwayError) throw new Error(`railways upsert 失敗: ${railwayError.message}`);

    // 駅マスタ（座標付き）を路線単位で取得し、駅順は stationOrder を正とする
    const stations = await odptFetch<OdptStation>("odpt:Station", {
      "odpt:railway": railwayId,
    });
    const stationById = new Map(stations.map((s) => [s["owl:sameAs"], s]));

    const stationOrder = [...railway["odpt:stationOrder"]].sort(
      (a, b) => a["odpt:index"] - b["odpt:index"]
    );

    const stationRows = stationOrder.map((entry, i) => {
      const station = stationById.get(entry["odpt:station"]);
      return {
        id: entry["odpt:station"],
        railway_id: railway["owl:sameAs"],
        name_ja:
          entry["odpt:stationTitle"]?.ja ??
          station?.["odpt:stationTitle"]?.ja ??
          station?.["dc:title"] ??
          entry["odpt:station"],
        name_en:
          entry["odpt:stationTitle"]?.en ??
          station?.["odpt:stationTitle"]?.en ??
          null,
        lat: station?.["geo:lat"] ?? null,
        lng: station?.["geo:long"] ?? null,
        order_index: i,
      };
    });
    const { error: stationError } = await supabase
      .from("stations")
      .upsert(stationRows);
    if (stationError) throw new Error(`stations upsert 失敗: ${stationError.message}`);
    console.log(`  駅 ${stationRows.length} 件投入`);

    // 区間 = 隣接駅ペア
    const segmentRows = stationRows.slice(0, -1).map((from, i) => ({
      railway_id: railway["owl:sameAs"],
      from_station_id: from.id,
      to_station_id: stationRows[i + 1].id,
      order_index: i,
    }));
    const { error: segmentError } = await supabase
      .from("segments")
      .upsert(segmentRows, {
        onConflict: "railway_id,from_station_id,to_station_id",
        ignoreDuplicates: true,
      });
    if (segmentError) throw new Error(`segments upsert 失敗: ${segmentError.message}`);
    console.log(`  区間 ${segmentRows.length} 件投入`);
  }

  console.log("\n完了");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
