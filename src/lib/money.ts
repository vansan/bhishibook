/**
 * All money in BhishiBook is handled as an integer number of paise.
 *
 * Rupees are never represented as a JavaScript float: 0.1 + 0.2 !== 0.3, and a
 * ledger that drifts by a paise per row is worse than useless. Prisma stores
 * Decimal(12,2), which converts to and from paise exactly, so the boundary
 * helpers below are the only place a conversion is allowed to happen.
 *
 * Decimal(12,2) tops out at 9,999,999,999.99 which is 999_999_999_999 paise,
 * comfortably inside Number.MAX_SAFE_INTEGER (9_007_199_254_740_991).
 */

/** An integer count of paise. 100 paise = 1 rupee. */
export type Paise = number;

/** Anything Prisma hands back for a Decimal column. */
export type DecimalLike = { toFixed: (places: number) => string };

export function assertPaise(value: number, label = "amount"): Paise {
  if (!Number.isInteger(value)) {
    throw new Error(`${label} must be a whole number of paise, got ${value}`);
  }
  if (!Number.isSafeInteger(value)) {
    throw new Error(`${label} is outside the safe integer range: ${value}`);
  }
  return value;
}

/**
 * Parse a fixed 2-decimal string ("1000.50", "-25.00") into paise by string
 * surgery rather than multiplication, so no float ever touches the value.
 */
function parseFixed2(text: string): Paise {
  const match = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(text.trim());
  if (!match) {
    throw new Error(`Cannot read "${text}" as a rupee amount`);
  }
  const [, sign, whole, frac = ""] = match;
  const paise = Number(whole) * 100 + Number(frac.padEnd(2, "0"));
  return assertPaise(sign === "-" ? -paise : paise);
}

/** Prisma Decimal (or anything with toFixed) to paise. */
export function decimalToPaise(value: DecimalLike | null | undefined): Paise {
  if (value === null || value === undefined) return 0;
  return parseFixed2(value.toFixed(2));
}

/** Rupees as a number or string to paise. Strings are preferred and exact. */
export function rupeesToPaise(value: string | number): Paise {
  if (typeof value === "string") return parseFixed2(value);
  if (!Number.isFinite(value)) {
    throw new Error(`Cannot read ${value} as a rupee amount`);
  }
  // toFixed(2) rounds half-away-from-zero and hands us a clean string, which
  // parseFixed2 then reads exactly.
  return parseFixed2(value.toFixed(2));
}

/**
 * Paise back to the "1234.56" string Prisma accepts for a Decimal column.
 * Always write money to the database through this, never through a float.
 */
export function paiseToDecimalString(paise: Paise): string {
  assertPaise(paise);
  const negative = paise < 0;
  const absolute = Math.abs(paise);
  const rupees = Math.floor(absolute / 100);
  const remainder = absolute % 100;
  return `${negative ? "-" : ""}${rupees}.${String(remainder).padStart(2, "0")}`;
}

/** Percentage of an amount, rounded half-up to the nearest paise. */
export function percentOf(paise: Paise, ratePercent: DecimalLike | string | number): Paise {
  assertPaise(paise);
  const rateText =
    typeof ratePercent === "string" || typeof ratePercent === "number"
      ? String(ratePercent)
      : ratePercent.toFixed(4);
  // Rate is a small number with at most 4 decimals; scale both sides to
  // integers so the multiplication stays exact, then round once at the end.
  const rateScaled = Math.round(Number(rateText) * 10_000);
  const product = paise * rateScaled; // paise * percent * 10^4
  return roundHalfUp(product, 1_000_000); // divide by 100 (percent) * 10^4
}

/** Integer division rounded half-away-from-zero. */
export function roundHalfUp(numerator: number, denominator: number): Paise {
  if (denominator === 0) throw new Error("Cannot divide by zero");
  const sign = numerator < 0 !== denominator < 0 ? -1 : 1;
  const absolute = Math.abs(numerator);
  const divisor = Math.abs(denominator);
  return assertPaise(sign * Math.floor((absolute + divisor / 2) / divisor));
}

export function sumPaise(values: Paise[]): Paise {
  return values.reduce<Paise>((total, value) => total + assertPaise(value), 0);
}

/** Clamp to zero so an over-payment never produces a negative outstanding. */
export function atLeastZero(paise: Paise): Paise {
  return paise > 0 ? paise : 0;
}

const INR = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const INR_WHOLE = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

/** Display helper. Formatting is the only place paise become a float. */
export function formatPaise(paise: Paise, { whole = false } = {}): string {
  assertPaise(paise);
  const rupees = paise / 100;
  return whole && paise % 100 === 0 ? INR_WHOLE.format(rupees) : INR.format(rupees);
}
