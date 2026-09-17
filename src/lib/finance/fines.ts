import { atLeastZero, type Paise } from "@/lib/money";
import { addDays, daysBetween, dueDateFor, type YearMonth } from "./dates";

/**
 * Fine rules, as agreed for MaitriNidhi:
 *
 *   The hafta (and each month of loan interest) is payable from the 1st to the
 *   10th. The 1st-10th window IS the grace period, so a fixed per-day fine
 *   starts on the 11th: paid on the 10th costs nothing, paid on the 15th is
 *   5 days late.
 *
 * `graceDays` shifts the start of the fine further out and is a per-group
 * setting, so a group that wants 10 extra days can have them without a code
 * change. `maxFineDays` caps the billable days; 0 means uncapped.
 *
 * Contribution fines and interest fines use separate rules and are tracked as
 * separate Fine rows, which is why every function here takes the rule it
 * should apply rather than reaching for a global.
 */

export type FineRuleInput = {
  fixedPerDayPaise: Paise;
  graceDays: number;
  /** 0 means no cap. */
  maxFineDays: number;
  active: boolean;
};

export type FineAssessment = {
  /** Calendar days past the end of the grace period. Never negative. */
  daysLate: number;
  /** Days actually charged for, after applying `maxFineDays`. */
  billableDays: number;
  amountPaise: Paise;
  /** First day the fine starts counting; the day after the grace period ends. */
  fineStartsOn: Date;
};

const NO_FINE = (fineStartsOn: Date): FineAssessment => ({
  daysLate: 0,
  billableDays: 0,
  amountPaise: 0,
  fineStartsOn,
});

/**
 * How late a payment is, relative to the due date plus any grace days.
 *
 * With dueDate = the 10th and graceDays = 0, settling on the 10th gives 0 and
 * settling on the 11th gives 1.
 */
export function lateDays(dueDate: Date, settledOn: Date, graceDays = 0): number {
  const lastFreeDay = addDays(dueDate, Math.max(graceDays, 0));
  return atLeastZero(daysBetween(lastFreeDay, settledOn));
}

/**
 * Assess a fine for one due row.
 *
 * `settledOn` is the payment date for something already paid, or today for
 * something still outstanding, which is what makes an unpaid fine keep growing.
 */
export function assessFine(
  dueDate: Date,
  settledOn: Date,
  rule: FineRuleInput
): FineAssessment {
  const fineStartsOn = addDays(dueDate, Math.max(rule.graceDays, 0) + 1);
  if (!rule.active || rule.fixedPerDayPaise <= 0) return NO_FINE(fineStartsOn);

  const daysLate = lateDays(dueDate, settledOn, rule.graceDays);
  if (daysLate <= 0) return NO_FINE(fineStartsOn);

  const billableDays =
    rule.maxFineDays > 0 ? Math.min(daysLate, rule.maxFineDays) : daysLate;

  return {
    daysLate,
    billableDays,
    amountPaise: billableDays * rule.fixedPerDayPaise,
    fineStartsOn,
  };
}

/**
 * Assess the fine on a monthly due row.
 *
 * A row that is fully paid is judged on the day it was paid and then stops
 * growing. A row still short is judged on `asOf`, so it keeps accruing until
 * the member actually clears it.
 */
export function assessMonthlyFine(input: {
  period: YearMonth;
  dueDay: number;
  amountDuePaise: Paise;
  amountPaidPaise: Paise;
  paidOn: Date | null;
  asOf: Date;
  rule: FineRuleInput;
}): FineAssessment {
  const dueDate = dueDateFor(input.period, input.dueDay);
  const settled =
    input.amountPaidPaise >= input.amountDuePaise && input.paidOn ? input.paidOn : input.asOf;
  return assessFine(dueDate, settled, input.rule);
}

/** What is still collectable on a fine after payments and waivers. */
export function fineOutstanding(fine: {
  amountPaise: Paise;
  amountPaidPaise: Paise;
  waivedPaise: Paise;
}): Paise {
  return atLeastZero(fine.amountPaise - fine.amountPaidPaise - fine.waivedPaise);
}
