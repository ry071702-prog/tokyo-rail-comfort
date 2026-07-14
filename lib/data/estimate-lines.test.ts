import { describe, it, expect, vi } from "vitest";
import type { StationPassengers } from "./segment-weight";

// 乗降人員データはまだ未取得（passengers.ts は空）。
// 取得後の挙動も検証したいので getPassengers をモックし、テスト内で差し替える。
const state = vi.hoisted(() => ({
  passengers: null as StationPassengers[] | null,
}));

vi.mock("./passengers", () => ({
  getPassengers: (lineId: string): StationPassengers[] | null =>
    lineId === "yamanote" ? state.passengers : null,
}));

const { buildEstimatedLine, buildEstimatedLines, topComfortableHours } =
  await import("./estimate-lines");
const { getLine, MOCK_LINES } = await import("../mock/lines");

const yamanote = getLine("yamanote")!;

describe("buildEstimatedLine（乗降人員なし＝現行の暫定按分）", () => {
  it("weightSource は provisional", () => {
    state.passengers = null;
    for (const line of buildEstimatedLines({ dayKind: "weekday" })) {
      expect(line.weightSource).toBe("provisional");
    }
  });

  it("区間ウェイトはモック peakRate 比（最混雑区間=1.0）のまま", () => {
    state.passengers = null;
    const line = buildEstimatedLine(yamanote, { dayKind: "weekday" });
    const maxPeak = Math.max(...yamanote.segments.map((s) => s.peakRate));
    line.segments.forEach((seg, i) => {
      expect(seg.weight).toBeCloseTo(yamanote.segments[i].peakRate / maxPeak, 6);
    });
    expect(Math.max(...line.segments.map((s) => s.weight))).toBe(1);
  });

  it("路線ベースは国交省の路線最大値（山手線 139%）", () => {
    state.passengers = null;
    const line = buildEstimatedLine(yamanote, { dayKind: "weekday" });
    expect(line.baselineRatePct).toBe(139);
    // 最混雑区間（weight=1.0）のベース混雑率は路線ベースと一致
    const busiest = line.segments.find((s) => s.weight === 1);
    expect(busiest?.baselineRatePct).toBe(139);
  });

  it("区間は 0〜23 時の 24 セルを持ち、peakRate は hourly の最大値", () => {
    state.passengers = null;
    const line = buildEstimatedLine(yamanote, { dayKind: "weekday" });
    for (const seg of line.segments) {
      expect(seg.hourly).toHaveLength(24);
      expect(seg.peakRate).toBe(Math.max(...seg.hourly));
    }
  });

  it("3路線とも生成でき、区間数はモック定義と一致する", () => {
    state.passengers = null;
    const lines = buildEstimatedLines({ dayKind: "weekday" });
    expect(lines).toHaveLength(MOCK_LINES.length);
    lines.forEach((line, i) => {
      expect(line.segments).toHaveLength(MOCK_LINES[i].segments.length);
    });
  });

  it("休日は平日より空いている", () => {
    state.passengers = null;
    const weekday = buildEstimatedLine(yamanote, { dayKind: "weekday" });
    const holiday = buildEstimatedLine(yamanote, { dayKind: "holiday" });
    expect(holiday.segments[0].peakRate).toBeLessThan(
      weekday.segments[0].peakRate
    );
  });

  it("遅延補正は nowHour のセルにだけ効く", () => {
    state.passengers = null;
    const base = buildEstimatedLine(yamanote, { dayKind: "weekday" });
    const delayed = buildEstimatedLine(yamanote, {
      dayKind: "weekday",
      nowHour: 8,
      delayMinutes: 10,
    });
    expect(delayed.segments[0].hourly[8]).toBeGreaterThan(
      base.segments[0].hourly[8]
    );
    expect(delayed.segments[0].hourly[9]).toBe(base.segments[0].hourly[9]);
  });
});

describe("buildEstimatedLine（乗降人員あり＝幾何平均モデル）", () => {
  // 山手線の駅（大崎〜池袋）を全部埋めた仮データ。池袋・新宿を大きくする
  const yamanotePassengers: StationPassengers[] = [
    { name: "大崎", dailyPassengers: 160_000 },
    { name: "五反田", dailyPassengers: 130_000 },
    { name: "目黒", dailyPassengers: 110_000 },
    { name: "恵比寿", dailyPassengers: 130_000 },
    { name: "渋谷", dailyPassengers: 300_000 },
    { name: "原宿", dailyPassengers: 70_000 },
    { name: "代々木", dailyPassengers: 70_000 },
    { name: "新宿", dailyPassengers: 600_000 },
    { name: "新大久保", dailyPassengers: 40_000 },
    { name: "高田馬場", dailyPassengers: 180_000 },
    { name: "池袋", dailyPassengers: 500_000 },
  ];

  it("全駅そろえば weightSource は passengers", () => {
    state.passengers = yamanotePassengers;
    const line = buildEstimatedLine(yamanote, { dayKind: "weekday" });
    expect(line.weightSource).toBe("passengers");
  });

  it("最混雑区間は 高田馬場→池袋（両端が大きい）で weight=1.0", () => {
    state.passengers = yamanotePassengers;
    const line = buildEstimatedLine(yamanote, { dayKind: "weekday" });
    const top = [...line.segments].sort((a, b) => b.weight - a.weight)[0];
    expect(top.fromStation).toBe("高田馬場");
    expect(top.toStation).toBe("池袋");
    expect(top.weight).toBe(1);
  });

  it("片側が小さい駅（新大久保）の区間はウェイトが下がる", () => {
    state.passengers = yamanotePassengers;
    const line = buildEstimatedLine(yamanote, { dayKind: "weekday" });
    const shinOkubo = line.segments.find((s) => s.toStation === "新大久保")!;
    const busiest = line.segments.find((s) => s.weight === 1)!;
    expect(shinOkubo.weight).toBeLessThan(busiest.weight);
  });

  it("1駅でも欠ければ provisional にフォールバックする", () => {
    state.passengers = yamanotePassengers.filter((s) => s.name !== "池袋");
    const line = buildEstimatedLine(yamanote, { dayKind: "weekday" });
    expect(line.weightSource).toBe("provisional");
  });

  it("他路線（乗降人員なし）は provisional のまま", () => {
    state.passengers = yamanotePassengers;
    const lines = buildEstimatedLines({ dayKind: "weekday" });
    const sources = Object.fromEntries(
      lines.map((l) => [l.id, l.weightSource])
    );
    expect(sources).toEqual({
      yamanote: "passengers",
      chuo: "provisional",
      tozai: "provisional",
    });
  });
});

describe("topComfortableHours", () => {
  it("深夜早朝を除いた空いている時間帯を昇順で返す", () => {
    state.passengers = null;
    const line = buildEstimatedLine(yamanote, { dayKind: "weekday" });
    const hours = topComfortableHours(line.segments[0], 3);
    expect(hours).toHaveLength(3);
    expect(hours.every((h) => h.hour >= 5 && h.hour <= 23)).toBe(true);
    expect(hours[0].rate).toBeLessThanOrEqual(hours[1].rate);
    expect(hours[1].rate).toBeLessThanOrEqual(hours[2].rate);
  });
});
