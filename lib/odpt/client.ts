// ODPT fetch クライアント。consumerKey を使うためサーバ側 (Route Handler / scripts) 専用。
// クライアントコンポーネントから import しないこと。

const ODPT_BASE_URL = "https://api.odpt.org/api/v4";

export class OdptError extends Error {
  constructor(
    message: string,
    public readonly status?: number
  ) {
    super(message);
    this.name = "OdptError";
  }
}

/**
 * ODPT API からデータ型 `rdfType` のリソース一覧を取得する。
 * @param rdfType 例: "odpt:Railway", "odpt:Station", "odpt:TrainInformation"
 * @param params  追加クエリ 例: { "odpt:operator": "odpt.Operator:JR-East" }
 * @param init    fetch オプション（Route Handler では next.revalidate を渡す）
 */
export async function odptFetch<T>(
  rdfType: string,
  params: Record<string, string> = {},
  init?: RequestInit
): Promise<T[]> {
  const consumerKey = process.env.ODPT_CONSUMER_KEY;
  if (!consumerKey) {
    throw new OdptError("ODPT_CONSUMER_KEY が未設定です (.env.local を確認)");
  }

  const query = new URLSearchParams({
    ...params,
    "acl:consumerKey": consumerKey,
  });
  const url = `${ODPT_BASE_URL}/${rdfType}?${query}`;

  const res = await fetch(url, init);
  if (!res.ok) {
    throw new OdptError(
      `ODPT API エラー: ${rdfType} → HTTP ${res.status}`,
      res.status
    );
  }
  return (await res.json()) as T[];
}
