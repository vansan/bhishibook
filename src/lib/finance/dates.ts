/**
 * Every date in the finance engine is a UTC calendar date at midnight.
 *
 * Fines are counted in whole days, so "how many days late" must not change
 * because the server is in a different timezone than the admin entering the
 * payment. Normalising everything to UTC midnight makes day arithmetic exact
 * and reproducible.
 */

export const MS_PER_DAY = 86_400_000;

/** A calendar month, 1-indexed so `month: 1` is January. */
export type YearMonth = { year: number; month: number };

export function utcDate(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
}

/** Drop the time component, keeping the UTC calendar day. */
export function startOfUtcDay(value: Date): Date {
  return new Date(
    Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate(), 0, 0, 0, 0)
  );
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * The date the monthly hafta (or loan interest) is due.
 * A due day past the end of a short month falls back to the last day, so a
 * due day of 31 means the 28th in February rather than spilling into March.
 */
export function dueDateFor({ year, month }: YearMonth, dueDay: number): Date {
  const day = Math.min(Math.max(dueDay, 1), daysInMonth(year, month));
  return utcDate(year, month, day);
}

/** Whole days from `from` to `to`. Negative when `to` is earlier. */
export function daysBetween(from: Date, to: Date): number {
  return Math.round((startOfUtcDay(to).getTime() - startOfUtcDay(from).getTime()) / MS_PER_DAY);
}

export function addDays(value: Date, days: number): Date {
  return new Date(startOfUtcDay(value).getTime() + days * MS_PER_DAY);
}

export function addMonths({ year, month }: YearMonth, count: number): YearMonth {
  const zeroBased = year * 12 + (month - 1) + count;
  return { year: Math.floor(zeroBased / 12), month: (zeroBased % 12) + 1 };
}

export function yearMonthOf(value: Date): YearMonth {
  return { year: value.getUTCFullYear(), month: value.getUTCMonth() + 1 };
}

export function compareYearMonth(a: YearMonth, b: YearMonth): number {
  return a.year !== b.year ? a.year - b.year : a.month - b.month;
}

export function sameYearMonth(a: YearMonth, b: YearMonth): boolean {
  return compareYearMonth(a, b) === 0;
}

/**
 * Every month touched by [from, to], inclusive on both ends.
 * Used to generate the contribution schedule for a cycle and the monthly
 * interest rows for a loan.
 */
export function monthsBetween(from: Date, to: Date): YearMonth[] {
  const start = yearMonthOf(from);
  const end = yearMonthOf(to);
  if (compareYearMonth(start, end) > 0) return [];

  const months: YearMonth[] = [];
  let cursor = start;
  while (compareYearMonth(cursor, end) <= 0) {
    months.push(cursor);
    cursor = addMonths(cursor, 1);
    if (months.length > 1200) throw new Error("Refusing to generate over 100 years of months");
  }
  return months;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function formatYearMonth({ year, month }: YearMonth): string {
  return `${MONTH_NAMES[month - 1]} ${year}`;
}

/** "2026-09", the sortable key used for grouping rows in the UI. */
export function yearMonthKey({ year, month }: YearMonth): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}
