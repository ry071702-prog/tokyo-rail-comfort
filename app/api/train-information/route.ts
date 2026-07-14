// M2: 運行情報 Route Handler
// odpt:TrainInformation を JR東日本・東京メトロ 分だけ取得し、30〜60 秒キャッシュして整形 JSON を返す。
// consumerKey はサーバ側（odptFetch）でのみ使い、クライアントには絶対に露出しない。
// ODPT_CONSUMER_KEY 未設定 or fetch 失敗時はモックにフォールバックし mock=true を付ける。

import { NextResponse } from "next/server";
import { odptFetch } from "@/lib/odpt/client";
import type { OdptTrainInformation } from "@/lib/odpt/types";
import {
  ATTRIBUTION,
  buildMockTrainInformation,
  type TrainInfoItem,
  type TrainInfoResponse,
} from "@/lib/mock/train-information";

// ルートセグメントのキャッシュ（秒）。ODPT 負荷を抑えるため 30〜60 秒に収める。
export const revalidate = 45;

const TARGET_OPERATORS: readonly {
  code: string;
  label: string;
}[] = [
  { code: "odpt.Operator:JR-East", label: "JR東日本" },
  { code: "odpt.Operator:TokyoMetro", label: "東京メトロ" },
];

// 主要路線コード → 日本語表示名（突き合わせ用の最小マップ）
const RAILWAY_LABELS: Record<string, string> = {
  "odpt.Railway:JR-East.Yamanote": "JR 山手線",
  "odpt.Railway:JR-East.ChuoRapid": "JR 中央快速線",
  "odpt.Railway:TokyoMetro.Tozai": "東京メトロ 東西線",
};

function pickJa(title?: { ja?: string; en?: string }): string | undefined {
  if (!title) return undefined;
  return title.ja ?? title.en;
}

function toItem(
  raw: OdptTrainInformation,
  operatorLabel: string
): TrainInfoItem {
  const status = pickJa(raw["odpt:trainInformationStatus"]);
  const text = pickJa(raw["odpt:trainInformationText"]);
  const railway = raw["odpt:railway"];
  // status が無い、または「平常」を含む場合は平常運転とみなす
  const normal = !status || status.includes("平常");
  return {
    id: raw["owl:sameAs"] ?? raw["@id"],
    operator: raw["odpt:operator"],
    operatorLabel,
    railway,
    railwayLabel: railway ? RAILWAY_LABELS[railway] : undefined,
    status,
    text,
    date: raw["dc:date"],
    normal,
  };
}

export async function GET(): Promise<NextResponse<TrainInfoResponse>> {
  if (!process.env.ODPT_CONSUMER_KEY) {
    return NextResponse.json(buildMockTrainInformation());
  }

  try {
    const results = await Promise.all(
      TARGET_OPERATORS.map(async (op) => {
        const raw = await odptFetch<OdptTrainInformation>(
          "odpt:TrainInformation",
          { "odpt:operator": op.code },
          { next: { revalidate } }
        );
        return raw.map((r) => toItem(r, op.label));
      })
    );

    const items = results.flat();
    // 最新の dc:date を代表の取得時刻とする（無ければ現在時刻）
    const latest = items
      .map((i) => i.date)
      .filter(Boolean)
      .sort()
      .at(-1);

    const response: TrainInfoResponse = {
      mock: false,
      fetchedAt: latest ?? new Date().toISOString(),
      attribution: ATTRIBUTION,
      items,
    };
    return NextResponse.json(response);
  } catch {
    // fetch 失敗時もアプリを止めず、デモデータで継続する
    return NextResponse.json(buildMockTrainInformation());
  }
}
