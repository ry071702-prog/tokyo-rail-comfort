// 駅別乗降人員から「区間ウェイト」を作る純関数（副作用なし・DB/ネットワークに触れない）。
// 区間ウェイトは estimate-lines.ts で 路線ベース混雑率(国交省) の按分に使う
//   区間ベース混雑率 = 路線ベース混雑率 × 区間ウェイト
//
// モデル（素朴なルールベース・MVP）
//   1. 区間の需要代理値 = 両端駅の乗降人員の幾何平均 sqrt(P_from × P_to)
//      → 大きな駅同士を結ぶ区間ほど需要が大きい、という直感を最小の式で表す
//        （算術平均だと片側の巨大ターミナルだけで持ち上がる  幾何平均は両端が大きい時だけ大きくなる）
//   2. 路線内の最大値で正規化して 0〜1 のウェイトにする（最混雑区間 = 1.0）
//   3. anchorSegmentIndex（= 国交省の実測最混雑区間）が渡されたら、その区間が 1.0 になるよう
//      スケールし直す（実測とのつじつま合わせ  路線全体のスケールを実測側に寄せる）
//
// 限界（重要・UI や資料でも誠実に書くこと）
//   - 乗降人員は「その駅で乗り降りした人数」であって「その区間を通過した人数」ではない
//     真の通過需要は OD（出発地-目的地）データで按分すべきだが、OD はオープンデータに無いため
//     MVP では幾何平均で近似する
//   - 方向別（上り/下り）の非対称性は表現できない  朝の都心方向だけ混む、は再現できない
//   - 乗り入れ・優等列車・車両数の差も無視している
//   - 国交省の実測最混雑区間をアンカーにすることで、路線全体のスケールだけは実測に合わせる

/** 駅ごとの1日平均乗降人員（passengers.ts / Supabase stations.daily_passengers 由来）。 */
export interface StationPassengers {
  /** 表示名（日本語）  区間の駅名と突き合わせるキー。 */
  name: string;
  /** 1日平均乗降人員（人）  未取得・欠損は 0 とする。 */
  dailyPassengers: number;
}

/** 区間の両端（lib/mock/lines.ts の MockSegment 等が満たす最小形）。 */
export interface SegmentEndpoints {
  fromStation: string;
  toStation: string;
}

/** 小数第3位で丸める（浮動小数の微差を抑える）。 */
function roundTo3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

/** 有効な乗降人員（有限かつ正）か。 */
function isValidPassengers(value: number | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

/** 駅名 → 乗降人員 の Map を作る。 */
function toPassengerMap(stations: readonly StationPassengers[]): Map<string, number> {
  return new Map(stations.map((s) => [s.name, s.dailyPassengers]));
}

/**
 * 全区間の両端駅について有効な乗降人員が揃っているか。
 * segmentWeightsFromPassengers は「揃っている前提」の関数なので、
 * 呼び出し側はこれで判定してから使い、揃っていなければ別の按分にフォールバックする。
 */
export function hasPassengerData(
  stations: readonly StationPassengers[],
  segments: readonly SegmentEndpoints[]
): boolean {
  if (segments.length === 0) return false;
  const map = toPassengerMap(stations);
  return segments.every(
    (seg) =>
      isValidPassengers(map.get(seg.fromStation)) &&
      isValidPassengers(map.get(seg.toStation))
  );
}

/**
 * 駅別乗降人員から区間ウェイト（0〜1  最混雑区間=1.0）を返す。
 * 全駅の乗降人員が揃っている前提（欠損判定は hasPassengerData で呼び出し側が行う）。
 * 欠損している駅を含む区間の代理値は 0 になり、そのウェイトも 0 になる。
 *
 * @param anchorSegmentIndex 実測（国交省）の最混雑区間の index。
 *   渡すとその区間のウェイトが 1.0 になるようスケールする。
 *   代理値のうえで他区間が上回る場合、そのウェイトは 1.0 を超えうる（実測アンカー基準のため意図的）。
 */
export function segmentWeightsFromPassengers(
  stations: readonly StationPassengers[],
  segments: readonly SegmentEndpoints[],
  anchorSegmentIndex?: number
): number[] {
  if (segments.length === 0) return [];

  const map = toPassengerMap(stations);

  // 需要代理値 = 両端駅の乗降人員の幾何平均
  const proxies = segments.map((seg) => {
    const from = map.get(seg.fromStation);
    const to = map.get(seg.toStation);
    if (!isValidPassengers(from) || !isValidPassengers(to)) return 0;
    return Math.sqrt(from * to);
  });

  // スケールの基準：アンカー指定があればその代理値、無ければ路線内の最大値
  const anchorProxy =
    anchorSegmentIndex !== undefined &&
    anchorSegmentIndex >= 0 &&
    anchorSegmentIndex < proxies.length
      ? proxies[anchorSegmentIndex]
      : 0;
  const maxProxy = Math.max(...proxies);
  const divisor = anchorProxy > 0 ? anchorProxy : maxProxy;

  // 全区間が欠損（代理値が全部0）なら按分できない → 一律 1.0（呼び出し側は hasPassengerData で弾く想定）
  if (divisor <= 0) return segments.map(() => 1);

  return proxies.map((p) => roundTo3(p / divisor));
}
