import { describe, it, expect } from "vitest";
import {
  hasPassengerData,
  segmentWeightsFromPassengers,
  type SegmentEndpoints,
  type StationPassengers,
} from "./segment-weight";

// A(10万) - B(40万) - C(90万) の3駅2区間
const stations: StationPassengers[] = [
  { name: "A", dailyPassengers: 100_000 },
  { name: "B", dailyPassengers: 400_000 },
  { name: "C", dailyPassengers: 900_000 },
];
const segments: SegmentEndpoints[] = [
  { fromStation: "A", toStation: "B" }, // 幾何平均 = 200,000
  { fromStation: "B", toStation: "C" }, // 幾何平均 = 600,000
];

describe("hasPassengerData（欠損判定）", () => {
  it("全駅そろっていれば true", () => {
    expect(hasPassengerData(stations, segments)).toBe(true);
  });
  it("区間の端の駅が欠けていれば false", () => {
    const missing = stations.filter((s) => s.name !== "C");
    expect(hasPassengerData(missing, segments)).toBe(false);
  });
  it("乗降人員が 0（未取得）の駅を含めば false", () => {
    const zero: StationPassengers[] = [
      ...stations.slice(0, 2),
      { name: "C", dailyPassengers: 0 },
    ];
    expect(hasPassengerData(zero, segments)).toBe(false);
  });
  it("区間が空なら false（按分できない）", () => {
    expect(hasPassengerData(stations, [])).toBe(false);
  });
});

describe("segmentWeightsFromPassengers（幾何平均・正規化）", () => {
  it("両端駅の幾何平均を路線内最大値で正規化する", () => {
    const weights = segmentWeightsFromPassengers(stations, segments);
    // 200,000 / 600,000 = 0.333、600,000 / 600,000 = 1.0
    expect(weights).toEqual([0.333, 1]);
  });

  it("最混雑区間のウェイトは 1.0", () => {
    const weights = segmentWeightsFromPassengers(stations, segments);
    expect(Math.max(...weights)).toBe(1);
  });

  it("全駅の乗降人員が同じなら全区間 1.0", () => {
    const flat: StationPassengers[] = [
      { name: "A", dailyPassengers: 250_000 },
      { name: "B", dailyPassengers: 250_000 },
      { name: "C", dailyPassengers: 250_000 },
    ];
    expect(segmentWeightsFromPassengers(flat, segments)).toEqual([1, 1]);
  });

  it("区間が無ければ空配列（駅1つだけのケースを含む）", () => {
    expect(
      segmentWeightsFromPassengers([{ name: "A", dailyPassengers: 100 }], [])
    ).toEqual([]);
  });

  it("欠損駅を含む区間のウェイトは 0（呼び出し側が hasPassengerData で弾く前提）", () => {
    const missing = stations.filter((s) => s.name !== "A");
    expect(segmentWeightsFromPassengers(missing, segments)).toEqual([0, 1]);
  });

  it("全区間が欠損なら一律 1.0（ゼロ除算しない）", () => {
    expect(segmentWeightsFromPassengers([], segments)).toEqual([1, 1]);
  });
});

describe("segmentWeightsFromPassengers（アンカー指定）", () => {
  it("アンカー区間のウェイトが 1.0 になるようスケールする", () => {
    // index 0（A-B, 幾何平均 200,000）をアンカーにすると B-C は 3.0
    const weights = segmentWeightsFromPassengers(stations, segments, 0);
    expect(weights[0]).toBe(1);
    expect(weights[1]).toBe(3);
  });

  it("アンカーが最混雑区間なら最大値正規化と一致する", () => {
    expect(segmentWeightsFromPassengers(stations, segments, 1)).toEqual(
      segmentWeightsFromPassengers(stations, segments)
    );
  });

  it("範囲外のアンカーは無視して最大値正規化にフォールバックする", () => {
    expect(segmentWeightsFromPassengers(stations, segments, 99)).toEqual([
      0.333, 1,
    ]);
  });

  it("アンカー区間が欠損（代理値0）なら最大値正規化にフォールバックする", () => {
    const missing = stations.filter((s) => s.name !== "A");
    expect(segmentWeightsFromPassengers(missing, segments, 0)).toEqual([0, 1]);
  });
});
