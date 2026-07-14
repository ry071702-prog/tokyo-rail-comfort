// M3: 国交省 混雑率調査 (令和6年度) を congestion_baseline に投入する
// 元データ: data/mlit-congestion-2024-*.pdf (手動DL済) から対象路線分を
// supabase/seed/congestion_baseline_2024.csv に構造化済み (取得日 2026-07-14)
// 実行: npm run seed:congestion  (要 .env.local: SUPABASE_SERVICE_ROLE_KEY)
import { config } from "dotenv";
config({ path: ".env.local" });

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createAdminClient } from "../lib/supabase/admin";

interface BaselineRow {
  railway_id: string;
  segment_label: string;
  dir: "inbound" | "outbound" | "both";
  peak_time_band: string;
  capacity: number;
  ridership: number;
  congestion_rate: number;
  fiscal_year: number;
  source_url: string;
}

function parseCsv(csv: string): BaselineRow[] {
  const [header, ...lines] = csv.trim().split("\n");
  const cols = header.split(",");
  return lines.map((line) => {
    const values = line.split(",");
    const record = Object.fromEntries(cols.map((c, i) => [c, values[i]]));
    return {
      railway_id: record.railway_id,
      segment_label: record.segment_label,
      dir: record.dir as BaselineRow["dir"],
      peak_time_band: record.peak_time_band,
      capacity: Number(record.capacity),
      ridership: Number(record.ridership),
      congestion_rate: Number(record.congestion_rate),
      fiscal_year: Number(record.fiscal_year),
      source_url: record.source_url,
    };
  });
}

async function main() {
  const csvPath = join(
    process.cwd(),
    "supabase/seed/congestion_baseline_2024.csv"
  );
  const rows = parseCsv(readFileSync(csvPath, "utf-8"));

  const supabase = createAdminClient();

  // 冪等にするため同年度分を消してから入れ直す
  const { error: deleteError } = await supabase
    .from("congestion_baseline")
    .delete()
    .eq("fiscal_year", rows[0].fiscal_year);
  if (deleteError) throw new Error(`delete 失敗: ${deleteError.message}`);

  const { error } = await supabase.from("congestion_baseline").insert(rows);
  if (error) throw new Error(`insert 失敗: ${error.message}`);

  console.log(`congestion_baseline に ${rows.length} 件投入 (令和6年度)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
