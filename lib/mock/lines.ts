// 対象3路線の駅・区間定義（正本）。
// ⚠️ ここは「駅リスト・区間の並び・区間ごとの相対差（peakRate）」の定義に徹する。
//    時間帯別の推定混雑率は lib/data/estimate-lines.ts が国交省の実混雑率（baseline.ts）
//    × 推定エンジン（lib/congestion/estimate.ts）で算出する（この定義を素材として使う）。
//    peakRate は実測ではなく、区間ごとの相対差を表す暫定按分ウェイトの素材。

export interface MockStation {
  /** 表示名（日本語） */
  name: string;
}

export interface MockSegment {
  id: string;
  fromStation: string;
  toStation: string;
  /** 区間ごとの相対的な混雑度合い（%相当）。最混雑区間=1.0 に正規化して按分ウェイトに使う。 */
  peakRate: number;
}

export interface MockLine {
  id: string;
  name: string;
  /** ODPT 事業者コード（運行情報 API との突き合わせ用） */
  operator: string;
  operatorLabel: string;
  /** 路線カラー（アクセントに使う） */
  color: string;
  stations: MockStation[];
  segments: MockSegment[];
}

interface SegmentSeed {
  from: string;
  to: string;
  peakRate: number;
}

function buildSegments(lineId: string, seeds: SegmentSeed[]): MockSegment[] {
  return seeds.map((s, i) => ({
    id: `${lineId}-seg-${i}`,
    fromStation: s.from,
    toStation: s.to,
    peakRate: s.peakRate,
  }));
}

function stationsFromSeeds(seeds: SegmentSeed[]): MockStation[] {
  const names: string[] = [];
  seeds.forEach((s, i) => {
    if (i === 0) names.push(s.from);
    names.push(s.to);
  });
  return names.map((name) => ({ name }));
}

// --- JR 山手線（内回り想定・混雑上位区間を含む代表区間） ---
const yamanoteSeeds: SegmentSeed[] = [
  { from: "大崎", to: "五反田", peakRate: 138 },
  { from: "五反田", to: "目黒", peakRate: 145 },
  { from: "目黒", to: "恵比寿", peakRate: 150 },
  { from: "恵比寿", to: "渋谷", peakRate: 158 },
  { from: "渋谷", to: "原宿", peakRate: 149 },
  { from: "原宿", to: "代々木", peakRate: 143 },
  { from: "代々木", to: "新宿", peakRate: 156 },
  { from: "新宿", to: "新大久保", peakRate: 152 },
  { from: "新大久保", to: "高田馬場", peakRate: 160 },
  { from: "高田馬場", to: "池袋", peakRate: 164 },
];

// --- JR 中央快速線（東京 → 立川方面の代表区間） ---
const chuoSeeds: SegmentSeed[] = [
  { from: "東京", to: "神田", peakRate: 130 },
  { from: "神田", to: "御茶ノ水", peakRate: 148 },
  { from: "御茶ノ水", to: "四ツ谷", peakRate: 165 },
  { from: "四ツ谷", to: "新宿", peakRate: 172 },
  { from: "新宿", to: "中野", peakRate: 187 },
  { from: "中野", to: "荻窪", peakRate: 178 },
  { from: "荻窪", to: "吉祥寺", peakRate: 168 },
  { from: "吉祥寺", to: "三鷹", peakRate: 160 },
  { from: "三鷹", to: "国分寺", peakRate: 150 },
  { from: "国分寺", to: "立川", peakRate: 141 },
];

// --- 東京メトロ 東西線（西船橋 → 中野方面。木場→門前仲町は全国屈指の混雑区間） ---
const tozaiSeeds: SegmentSeed[] = [
  { from: "高田馬場", to: "早稲田", peakRate: 158 },
  { from: "早稲田", to: "神楽坂", peakRate: 162 },
  { from: "神楽坂", to: "飯田橋", peakRate: 170 },
  { from: "飯田橋", to: "九段下", peakRate: 176 },
  { from: "九段下", to: "竹橋", peakRate: 168 },
  { from: "竹橋", to: "大手町", peakRate: 172 },
  { from: "大手町", to: "日本橋", peakRate: 180 },
  { from: "日本橋", to: "茅場町", peakRate: 184 },
  { from: "茅場町", to: "門前仲町", peakRate: 190 },
  { from: "門前仲町", to: "木場", peakRate: 199 },
  { from: "木場", to: "東陽町", peakRate: 188 },
  { from: "東陽町", to: "南砂町", peakRate: 175 },
];

export const MOCK_LINES: readonly MockLine[] = [
  {
    id: "yamanote",
    name: "JR 山手線",
    operator: "odpt.Operator:JR-East",
    operatorLabel: "JR東日本",
    color: "#9ACD32",
    stations: stationsFromSeeds(yamanoteSeeds),
    segments: buildSegments("yamanote", yamanoteSeeds),
  },
  {
    id: "chuo",
    name: "JR 中央快速線",
    operator: "odpt.Operator:JR-East",
    operatorLabel: "JR東日本",
    color: "#F15A22",
    stations: stationsFromSeeds(chuoSeeds),
    segments: buildSegments("chuo", chuoSeeds),
  },
  {
    id: "tozai",
    name: "東京メトロ 東西線",
    operator: "odpt.Operator:TokyoMetro",
    operatorLabel: "東京メトロ",
    color: "#009BBF",
    stations: stationsFromSeeds(tozaiSeeds),
    segments: buildSegments("tozai", tozaiSeeds),
  },
] as const;

export function getLine(lineId: string): MockLine | undefined {
  return MOCK_LINES.find((l) => l.id === lineId);
}
