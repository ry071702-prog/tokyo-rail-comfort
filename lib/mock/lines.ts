// 対象3路線のモックデータ（駅・区間・時間帯別 推定混雑率）
// ⚠️ これは実測ではなく「デモ用の推定値」。実データ（国交省 混雑率 × 時刻表係数 × 遅延補正）へ
//    差し替えるまでのプレースホルダ。UI では必ず「デモデータ」「推定です」と明示する。

export interface MockStation {
  /** 表示名（日本語） */
  name: string;
}

export interface MockSegment {
  id: string;
  fromStation: string;
  toStation: string;
  /** 朝ピーク時の推定混雑率(%)。この値を時間帯係数で按分して 24 時間分を生成する */
  peakRate: number;
  /** 0〜23 時の推定混雑率(%)。index = 時 */
  hourly: number[];
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

// 時間帯係数：ピーク(朝8時)=1.00 を基準にした相対カーブ。
// 朝 7〜9 時・夕 17〜19 時が山、深夜と昼が谷、という現実的な通勤カーブ。
// index = 時(0〜23)
const HOURLY_FACTOR: readonly number[] = [
  0.2, 0.15, 0.12, 0.14, 0.22, 0.42, // 0〜5 時（終電〜始発前後）
  0.72, 0.94, 1.0, 0.86, 0.6, 0.54, // 6〜11 時（朝ピーク）
  0.56, 0.53, 0.5, 0.54, 0.66, 0.86, // 12〜17 時（昼の谷 → 夕方立ち上がり）
  0.95, 0.78, 0.6, 0.46, 0.36, 0.26, // 18〜23 時（夕ピーク → 減衰）
];

/** ピーク混雑率から 24 時間分の推定カーブを生成（純関数・副作用なし） */
function buildHourly(peakRate: number): number[] {
  return HOURLY_FACTOR.map((f) => Math.round(peakRate * f));
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
    hourly: buildHourly(s.peakRate),
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

export interface ComfortableHour {
  hour: number;
  rate: number;
}

/**
 * 指定区間で「空いている時間帯 トップ N」を返す（純関数）。
 * 深夜早朝（0〜4時）は実用的な通勤時間ではないため除外し、始発以降の快適な時間帯を提案する。
 */
export function topComfortableHours(
  segment: MockSegment,
  count = 3,
  fromHour = 5,
  toHour = 23
): ComfortableHour[] {
  return segment.hourly
    .map((rate, hour) => ({ hour, rate }))
    .filter((h) => h.hour >= fromHour && h.hour <= toHour)
    .sort((a, b) => a.rate - b.rate)
    .slice(0, count);
}
