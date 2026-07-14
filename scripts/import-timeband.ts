// M3: ODPT 駅時刻表から時間帯別本数を集計し timeband_factor に投入する
// 係数 = その時間帯の本数 / 最多時間帯の本数 (ピーク=1.0 の相対値)
// 路線内の全駅・全方向の発車時刻を集計する素朴な代理指標 (MVP)
// 実行: npm run seed:timeband  (要 .env.local: ODPT_CONSUMER_KEY / SUPABASE_SERVICE_ROLE_KEY)
import { config } from "dotenv";
config({ path: ".env.local" });

import { createAdminClient } from "../lib/supabase/admin";
import { odptFetch } from "../lib/odpt/client";

const TARGET_RAILWAYS = [
  "odpt.Railway:JR-East.Yamanote",
  "odpt.Railway:JR-East.ChuoRapid",
  "odpt.Railway:TokyoMetro.Tozai",
];

type DayKind = "weekday" | "holiday";

// ODPT カレンダー → day_type の対応。祝日ダイヤ等の細分は MVP では扱わない
const CALENDAR_TO_DAY_KIND: Record<string, DayKind> = {
  "odpt.Calendar:Weekday": "weekday",
  "odpt.Calendar:SaturdayHoliday": "holiday",
  "odpt.Calendar:Holiday": "holiday",
};

interface OdptStationTimetableObject {
  "odpt:departureTime"?: string; // "HH:MM" (深夜帯は "24:xx" 表記がありうる)
}

interface OdptStationTimetable {
  "owl:sameAs": string;
  "odpt:railway": string;
  "odpt:calendar"?: string;
  "odpt:stationTimetableObject"?: OdptStationTimetableObject[];
}

function hourOf(departureTime: string): number | null {
  const match = /^(\d{1,2}):\d{2}$/.exec(departureTime);
  if (!match) return null;
  const hour = Number(match[1]) % 24;
  return hour >= 0 && hour <= 23 ? hour : null;
}

async function main() {
  const supabase = createAdminClient();

  for (const railwayId of TARGET_RAILWAYS) {
    console.log(`\n== ${railwayId}`);

    const timetables = await odptFetch<OdptStationTimetable>(
      "odpt:StationTimetable",
      { "odpt:railway": railwayId }
    );

    // day_kind × hour → 本数
    const counts: Record<DayKind, number[]> = {
      weekday: Array.from({ length: 24 }, () => 0),
      holiday: Array.from({ length: 24 }, () => 0),
    };

    for (const timetable of timetables) {
      const calendar = timetable["odpt:calendar"];
      const dayKind = calendar ? CALENDAR_TO_DAY_KIND[calendar] : undefined;
      if (!dayKind) continue;
      for (const entry of timetable["odpt:stationTimetableObject"] ?? []) {
        const time = entry["odpt:departureTime"];
        if (!time) continue;
        const hour = hourOf(time);
        if (hour !== null) counts[dayKind][hour] += 1;
      }
    }

    for (const dayKind of ["weekday", "holiday"] as const) {
      const hourly = counts[dayKind];
      const peak = Math.max(...hourly);
      if (peak === 0) {
        console.warn(`  ${dayKind}: 時刻表データなし → スキップ`);
        continue;
      }
      const rows = hourly.map((trainCount, hour) => ({
        railway_id: railwayId,
        dir: "both" as const,
        day_kind: dayKind,
        hour,
        train_count: trainCount,
        factor: Number((trainCount / peak).toFixed(3)),
      }));
      const { error } = await supabase
        .from("timeband_factor")
        .upsert(rows, { onConflict: "railway_id,dir,day_kind,hour" });
      if (error) throw new Error(`timeband_factor upsert 失敗: ${error.message}`);
      console.log(`  ${dayKind}: 24時間分投入 (ピーク ${peak} 本/時)`);
    }
  }

  console.log("\n完了");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
