// ODPT API v4 レスポンス型（使用フィールドのみ定義）
// 参照: https://developer.odpt.org/

export interface OdptMultilingualTitle {
  ja?: string;
  en?: string;
}

export interface OdptStationOrder {
  "odpt:index": number;
  "odpt:station": string; // 例: odpt.Station:JR-East.Yamanote.Tokyo
  "odpt:stationTitle"?: OdptMultilingualTitle;
}

export interface OdptRailway {
  "@id": string;
  "owl:sameAs": string; // 例: odpt.Railway:JR-East.Yamanote
  "dc:title": string;
  "odpt:railwayTitle"?: OdptMultilingualTitle;
  "odpt:operator": string; // 例: odpt.Operator:JR-East
  "odpt:stationOrder": OdptStationOrder[];
  "odpt:color"?: string; // #RRGGBB
  "odpt:lineCode"?: string;
  "dc:date"?: string;
}

export interface OdptStation {
  "@id": string;
  "owl:sameAs": string; // 例: odpt.Station:JR-East.Yamanote.Tokyo
  "dc:title": string;
  "odpt:stationTitle"?: OdptMultilingualTitle;
  "odpt:railway": string;
  "odpt:operator": string;
  "geo:lat"?: number;
  "geo:long"?: number;
  "dc:date"?: string;
}

export interface OdptTrainInformation {
  "@id": string;
  "owl:sameAs": string;
  "dc:date": string; // データ生成時刻。UI に必ず表示する（ライセンス要件）
  "odpt:operator": string;
  "odpt:railway"?: string;
  "odpt:timeOfOrigin"?: string;
  "odpt:trainInformationStatus"?: OdptMultilingualTitle;
  "odpt:trainInformationText"?: OdptMultilingualTitle;
}
