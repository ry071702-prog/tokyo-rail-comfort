// Phase2 向け: 運行情報（遅延・運休）の履歴を train_information_log に蓄積する。
// odpt:TrainInformation を JR-East / TokyoMetro で取得し upsert する。
// 同一 (operator, railway, dc:date) は重複挿入しない（重複エラー 23505 は握りつぶす）。
// 実行: npm run collect:train-info  (要 env: ODPT_CONSUMER_KEY / NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)
// GitHub Actions では env が直接注入される。.env.local は存在すれば読む（無ければ何もしない）。
import { config } from "dotenv";
config({ path: ".env.local" });

import { createAdminClient } from "../lib/supabase/admin";
import { odptFetch } from "../lib/odpt/client";
import type { OdptTrainInformation } from "../lib/odpt/types";

// 取得対象の事業者（本文の言語は ja のみ保存する MVP 方針）
const TARGET_OPERATORS = [
  "odpt.Operator:JR-East",
  "odpt.Operator:TokyoMetro",
];

interface TrainInformationLogRow {
  operator: string;
  railway: string | null;
  status_ja: string | null;
  text_ja: string | null;
  dc_date: string;
}

function toRow(info: OdptTrainInformation): TrainInformationLogRow {
  return {
    operator: info["odpt:operator"],
    railway: info["odpt:railway"] ?? null,
    status_ja: info["odpt:trainInformationStatus"]?.ja ?? null,
    text_ja: info["odpt:trainInformationText"]?.ja ?? null,
    dc_date: info["dc:date"],
  };
}

async function main() {
  const supabase = createAdminClient();

  let fetchedTotal = 0;
  let insertedTotal = 0;

  for (const operator of TARGET_OPERATORS) {
    const infos = await odptFetch<OdptTrainInformation>(
      "odpt:TrainInformation",
      { "odpt:operator": operator }
    );
    fetchedTotal += infos.length;

    // 1 行ずつ挿入し、重複 (unique index 違反 23505) は新規カウントに含めない。
    // 式インデックス (coalesce(railway,'')) のため upsert の onConflict では狙えず、
    // insert + 重複握りつぶし方式を採用する。
    for (const info of infos) {
      const row = toRow(info);
      const { error } = await supabase
        .from("train_information_log")
        .insert(row);
      if (!error) {
        insertedTotal += 1;
        continue;
      }
      if (error.code === "23505") continue; // 既存 dc:date → スキップ
      throw new Error(`train_information_log insert 失敗: ${error.message}`);
    }

    console.log(`${operator}: 取得 ${infos.length} 件`);
  }

  console.log(`完了: 取得 ${fetchedTotal} 件 / 新規挿入 ${insertedTotal} 件`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
