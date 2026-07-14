// 運行情報 API のモックフォールバック。
// ODPT_CONSUMER_KEY 未設定 or fetch 失敗時に返す。UI では mock=true を「デモデータ」と表示する。

/** Route Handler が返す整形済み運行情報アイテム */
export interface TrainInfoItem {
  id: string;
  operator: string;
  operatorLabel: string;
  /** ODPT 路線コード（例: odpt.Railway:JR-East.Yamanote） */
  railway?: string;
  railwayLabel?: string;
  /** 運行状況（例: 平常運転 / 遅延） */
  status?: string;
  /** 運行情報の本文 */
  text?: string;
  /** データ生成時刻（ODPT dc:date）。ライセンス要件として UI に表示する */
  date: string;
  /** この 1 件が平常運転か（バナー強調の判定に使う） */
  normal: boolean;
}

/** Route Handler のレスポンス全体 */
export interface TrainInfoResponse {
  /** true ならモックデータ（デモ表示） */
  mock: boolean;
  /** サーバがレスポンスを組み立てた時刻（ISO8601） */
  fetchedAt: string;
  items: TrainInfoItem[];
  /** 出典表示（ライセンス遵守） */
  attribution: string;
}

const ATTRIBUTION =
  "本アプリは公共交通オープンデータセンターのデータを利用しています";

/** 現在時刻ベースのモック運行情報を生成する（dc:date が常に新しく見えるようにする） */
export function buildMockTrainInformation(): TrainInfoResponse {
  const now = new Date().toISOString();
  return {
    mock: true,
    fetchedAt: now,
    attribution: ATTRIBUTION,
    items: [
      {
        id: "mock.JR-East.Yamanote",
        operator: "odpt.Operator:JR-East",
        operatorLabel: "JR東日本",
        railway: "odpt.Railway:JR-East.Yamanote",
        railwayLabel: "JR 山手線",
        status: "平常運転",
        text: "現在、平常どおり運転しています",
        date: now,
        normal: true,
      },
      {
        id: "mock.JR-East.ChuoRapid",
        operator: "odpt.Operator:JR-East",
        operatorLabel: "JR東日本",
        railway: "odpt.Railway:JR-East.ChuoRapid",
        railwayLabel: "JR 中央快速線",
        status: "遅延",
        text: "人身事故の影響で、上下線に約10分の遅れがでています（デモ表示）",
        date: now,
        normal: false,
      },
      {
        id: "mock.TokyoMetro.Tozai",
        operator: "odpt.Operator:TokyoMetro",
        operatorLabel: "東京メトロ",
        railway: "odpt.Railway:TokyoMetro.Tozai",
        railwayLabel: "東京メトロ 東西線",
        status: "平常運転",
        text: "現在、平常どおり運転しています",
        date: now,
        normal: true,
      },
    ],
  };
}

export { ATTRIBUTION };
