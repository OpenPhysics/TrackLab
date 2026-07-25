import { describe, expect, it } from "vitest";
import GraphDataManager from "../../../src/track-lab/graph/GraphDataManager.js";

/** True for values of the form (1|2|5) x 10^k, the "nice number" sequence. */
function isNiceNumber(value: number): boolean {
  const decade = 10 ** Math.floor(Math.log10(value));
  const mantissa = value / decade;
  return [1, 2, 5, 10].some((nice) => Math.abs(mantissa - nice) < 1e-9);
}

describe("GraphDataManager.calculateTickSpacing", () => {
  it("falls back to 1 for degenerate ranges", () => {
    expect(GraphDataManager.calculateTickSpacing(0)).toBe(1);
    expect(GraphDataManager.calculateTickSpacing(-5)).toBe(1);
    expect(GraphDataManager.calculateTickSpacing(Number.NaN)).toBe(1);
    expect(GraphDataManager.calculateTickSpacing(Number.POSITIVE_INFINITY)).toBe(1);
  });

  it("returns round numbers at the default tick target", () => {
    for (const range of [1, 3, 7, 10, 47, 100, 250, 1000, 0.05]) {
      expect(isNiceNumber(GraphDataManager.calculateTickSpacing(range))).toBe(true);
    }
  });

  it("returns round numbers at the scrubber's 15-tick target", () => {
    // Regression: the old rangeLength / 20 floor could override the nice value
    // here and hand back arbitrary spacing like 15.35.
    for (const totalFrames of [21, 33, 44, 52, 62, 176, 191, 249, 307, 328, 1000]) {
      const spacing = GraphDataManager.calculateTickSpacing(totalFrames, 15);
      expect(isNiceNumber(spacing)).toBe(true);
    }
  });

  it("never produces more than 20 ticks", () => {
    for (const targetTicks of [5, 10, 15, 20]) {
      for (const range of [1, 17, 33, 99, 250, 1234]) {
        const spacing = GraphDataManager.calculateTickSpacing(range, targetTicks);
        expect(range / spacing).toBeLessThanOrEqual(20 + 1e-9);
      }
    }
  });

  it("stays near the requested tick count", () => {
    const spacing = GraphDataManager.calculateTickSpacing(100, 5);
    expect(100 / spacing).toBeGreaterThanOrEqual(2);
    expect(100 / spacing).toBeLessThanOrEqual(10);
  });
});
