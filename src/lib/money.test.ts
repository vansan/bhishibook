import { describe, expect, it } from "vitest";
import {
  decimalToPaise,
  formatPaise,
  paiseToDecimalString,
  percentOf,
  roundHalfUp,
  rupeesToPaise,
  sumPaise,
} from "./money";

/** Stand-in for a Prisma Decimal, which is anything with toFixed(). */
const decimal = (text: string) => ({ toFixed: () => text });

describe("rupee <-> paise conversion", () => {
  it("reads whole and fractional rupees exactly", () => {
    expect(rupeesToPaise("1000")).toBe(100_000);
    expect(rupeesToPaise("1000.50")).toBe(100_050);
    expect(rupeesToPaise("0.01")).toBe(1);
    expect(rupeesToPaise("0.1")).toBe(10);
    expect(rupeesToPaise("-25.00")).toBe(-2500);
  });

  it("survives the classic float traps", () => {
    // 0.29 * 100 is 28.999999999999996 and 8.29 * 100 is 828.9999999999999,
    // so anything that multiplies its way to paise loses money here.
    expect(rupeesToPaise("0.29")).toBe(29);
    expect(rupeesToPaise("8.29")).toBe(829);
    expect(rupeesToPaise("0.07") * 3).toBe(21);
    // 0.1 + 0.2 !== 0.3 as floats, but the paise are exact.
    expect(rupeesToPaise("0.1") + rupeesToPaise("0.2")).toBe(rupeesToPaise("0.3"));
  });

  it("refuses sub-paise strings rather than silently rounding them", () => {
    // "1.005" is not a real rupee amount. Rounding it here would hide a bug in
    // whatever produced it, so the caller has to decide explicitly.
    expect(() => rupeesToPaise("1.005")).toThrow();
  });

  it("round-trips back to a Decimal string", () => {
    expect(paiseToDecimalString(100_050)).toBe("1000.50");
    expect(paiseToDecimalString(1)).toBe("0.01");
    expect(paiseToDecimalString(0)).toBe("0.00");
    expect(paiseToDecimalString(-2500)).toBe("-25.00");
  });

  it("reads Prisma Decimal values", () => {
    expect(decimalToPaise(decimal("35000.00"))).toBe(3_500_000);
    expect(decimalToPaise(null)).toBe(0);
  });

  it("rejects nonsense rather than guessing", () => {
    expect(() => rupeesToPaise("abc")).toThrow();
    expect(() => rupeesToPaise(Number.NaN)).toThrow();
  });
});

describe("percentOf", () => {
  it("computes the 3% monthly interest the group charges", () => {
    // 3% of 10,000 is exactly 300.
    expect(percentOf(rupeesToPaise("10000"), 3)).toBe(rupeesToPaise("300"));
    expect(percentOf(rupeesToPaise("25000"), "3.00")).toBe(rupeesToPaise("750"));
  });

  it("rounds half up to the nearest paise", () => {
    // 3% of 0.05 is 0.0015 rupees = 0.15 paise, which rounds to 0.
    expect(percentOf(5, 3)).toBe(0);
    // 3% of 0.17 is 0.51 paise, which rounds to 1.
    expect(percentOf(17, 3)).toBe(1);
  });

  it("returns zero for a zero rate or zero principal", () => {
    expect(percentOf(rupeesToPaise("10000"), 0)).toBe(0);
    expect(percentOf(0, 3)).toBe(0);
  });
});

describe("helpers", () => {
  it("rounds half away from zero", () => {
    expect(roundHalfUp(5, 2)).toBe(3);
    expect(roundHalfUp(-5, 2)).toBe(-3);
    expect(roundHalfUp(4, 2)).toBe(2);
  });

  it("sums exactly", () => {
    expect(sumPaise([100_000, 100_000, 200_000])).toBe(400_000);
    expect(sumPaise([])).toBe(0);
  });

  it("formats for display", () => {
    expect(formatPaise(3_500_000, { whole: true })).toContain("35,000");
    expect(formatPaise(100_050)).toContain("1,000.50");
  });
});
