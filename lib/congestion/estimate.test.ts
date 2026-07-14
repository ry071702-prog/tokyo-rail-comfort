import { describe, it, expect } from "vitest";
import {
  estimateCongestion,
  delayCorrectionFactor,
  normalizeIndex,
  levelFromRate,
  CONGESTION_LEVELS,
  type CongestionEstimateInput,
} from "./estimate";

// 平日・時間帯係数1.0・遅延0 のベース入力（baselineRatePct だけ変えて使う）
function baseInput(
  overrides: Partial<CongestionEstimateInput> = {}
): CongestionEstimateInput {
  return {
    baselineRatePct: 100,
    timebandFactor: 1.0,
    dayKind: "weekday",
    delayMinutes: 0,
    ...overrides,
  };
}

describe("levelFromRate（レベル境界）", () => {
  it("100%未満は快適", () => {
    expect(levelFromRate(0)).toBe("快適");
    expect(levelFromRate(99.9)).toBe("快適");
  });
  it("境界ちょうど 100% はやや混雑", () => {
    expect(levelFromRate(100)).toBe("やや混雑");
  });
  it("境界ちょうど 150% は混雑", () => {
    expect(levelFromRate(149.9)).toBe("やや混雑");
    expect(levelFromRate(150)).toBe("混雑");
  });
  it("境界ちょうど 180% はかなり混雑", () => {
    expect(levelFromRate(179.9)).toBe("混雑");
    expect(levelFromRate(180)).toBe("かなり混雑");
  });
  it("境界ちょうど 200% は激しい混雑", () => {
    expect(levelFromRate(199.9)).toBe("かなり混雑");
    expect(levelFromRate(200)).toBe("激しい混雑");
    expect(levelFromRate(300)).toBe("激しい混雑");
  });
  it("負数・NaN は快適に丸める", () => {
    expect(levelFromRate(-10)).toBe("快適");
    expect(levelFromRate(Number.NaN)).toBe("快適");
  });
});

describe("normalizeIndex（0–1 正規化）", () => {
  it("0% は 0", () => {
    expect(normalizeIndex(0)).toBe(0);
  });
  it("100% は 0.5", () => {
    expect(normalizeIndex(100)).toBe(0.5);
  });
  it("200% は 1.0", () => {
    expect(normalizeIndex(200)).toBe(1);
  });
  it("200% 超は 1.0 でクランプ", () => {
    expect(normalizeIndex(250)).toBe(1);
    expect(normalizeIndex(1000)).toBe(1);
  });
  it("負数・NaN は 0", () => {
    expect(normalizeIndex(-50)).toBe(0);
    expect(normalizeIndex(Number.NaN)).toBe(0);
  });
});

describe("delayCorrectionFactor（遅延補正）", () => {
  it("0分は 1.0", () => {
    expect(delayCorrectionFactor(0)).toBe(1);
  });
  it("1分あたり +2%", () => {
    expect(delayCorrectionFactor(10)).toBeCloseTo(1.2, 10);
  });
  it("上限 +50%（25分）でキャップ", () => {
    expect(delayCorrectionFactor(25)).toBeCloseTo(1.5, 10);
    expect(delayCorrectionFactor(60)).toBeCloseTo(1.5, 10);
    expect(delayCorrectionFactor(1000)).toBeCloseTo(1.5, 10);
  });
  it("負数・NaN・Infinity は 0分扱い（1.0）", () => {
    expect(delayCorrectionFactor(-5)).toBe(1);
    expect(delayCorrectionFactor(Number.NaN)).toBe(1);
    expect(delayCorrectionFactor(Number.POSITIVE_INFINITY)).toBe(1);
  });
});

describe("estimateCongestion（統合）", () => {
  it("平日・係数1.0・遅延0・ベース150% → そのまま150%・混雑", () => {
    const r = estimateCongestion(baseInput({ baselineRatePct: 150 }));
    expect(r.ratePct).toBe(150);
    expect(r.level).toBe("混雑");
    expect(r.index).toBe(0.75);
  });

  it("時間帯係数を掛ける（180% × 0.5 = 90% → 快適）", () => {
    const r = estimateCongestion(
      baseInput({ baselineRatePct: 180, timebandFactor: 0.5 })
    );
    expect(r.ratePct).toBe(90);
    expect(r.level).toBe("快適");
  });

  it("holiday は weekday より低い（0.7倍）", () => {
    const wd = estimateCongestion(baseInput({ baselineRatePct: 200 }));
    const hd = estimateCongestion(
      baseInput({ baselineRatePct: 200, dayKind: "holiday" })
    );
    expect(wd.ratePct).toBe(200);
    expect(hd.ratePct).toBe(140);
    expect(hd.ratePct).toBeLessThan(wd.ratePct);
    expect(hd.level).toBe("やや混雑");
  });

  it("遅延で上昇する（100% + 10分遅延 → 120%）", () => {
    const r = estimateCongestion(
      baseInput({ baselineRatePct: 100, delayMinutes: 10 })
    );
    expect(r.ratePct).toBe(120);
    expect(r.level).toBe("やや混雑");
  });

  it("遅延補正はキャップされる（100% + 大遅延 → 150% 止まり）", () => {
    const r = estimateCongestion(
      baseInput({ baselineRatePct: 100, delayMinutes: 999 })
    );
    expect(r.ratePct).toBe(150);
    expect(r.level).toBe("混雑");
  });

  it("全係数の合成（150% × 0.8 × weekday × 5分遅延）", () => {
    // 150 * 0.8 * 1.0 * (1 + 0.1) = 132
    const r = estimateCongestion(
      baseInput({
        baselineRatePct: 150,
        timebandFactor: 0.8,
        delayMinutes: 5,
      })
    );
    expect(r.ratePct).toBe(132);
    expect(r.level).toBe("やや混雑");
  });

  it("ベース0% は快適・index 0", () => {
    const r = estimateCongestion(baseInput({ baselineRatePct: 0 }));
    expect(r.ratePct).toBe(0);
    expect(r.index).toBe(0);
    expect(r.level).toBe("快適");
  });

  it("不正入力（負数ベース）は 0 に丸めて快適", () => {
    const r = estimateCongestion(baseInput({ baselineRatePct: -100 }));
    expect(r.ratePct).toBe(0);
    expect(r.level).toBe("快適");
  });

  it("不正入力（NaN 係数）は 0 に丸めて快適", () => {
    const r = estimateCongestion(
      baseInput({ baselineRatePct: 150, timebandFactor: Number.NaN })
    );
    expect(r.ratePct).toBe(0);
    expect(r.level).toBe("快適");
  });

  it("負の遅延は 0分扱い（補正なし）", () => {
    const r = estimateCongestion(
      baseInput({ baselineRatePct: 120, delayMinutes: -30 })
    );
    expect(r.ratePct).toBe(120);
  });

  it("index は常に 0–1 に収まる", () => {
    for (const rate of [0, 50, 100, 200, 400, 1000]) {
      const r = estimateCongestion(baseInput({ baselineRatePct: rate }));
      expect(r.index).toBeGreaterThanOrEqual(0);
      expect(r.index).toBeLessThanOrEqual(1);
    }
  });

  it("level は必ず定義済みの5段階のいずれか", () => {
    for (const rate of [0, 100, 150, 180, 200, 500]) {
      const r = estimateCongestion(baseInput({ baselineRatePct: rate }));
      expect(CONGESTION_LEVELS).toContain(r.level);
    }
  });
});
