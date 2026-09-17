import { atLeastZero, percentOf, roundHalfUp, sumPaise, type Paise } from "@/lib/money";
import {
  addMonths,
  compareYearMonth,
  monthsBetween,
  yearMonthOf,
  type YearMonth,
} from "./dates";

/**
 * Loan rules, as agreed:
 *
 *   Interest is a flat monthly percentage of the original principal (3%/month
 *   by default), payable every month inside the 1st-10th window. Principal may
 *   be repaid partially or in full at any time, but must close within
 *   `maxRepaymentMonths` (6). A member may borrow up to
 *   `maxLoanCorpusMultiple` (2x) of the corpus they have contributed.
 *
 * Interest is deliberately NOT charged on the reducing balance: the group
 * agreed a flat monthly charge, which is how the hand-written register worked.
 */

export type LoanTerms = {
  principalPaise: Paise;
  /** Monthly rate as a percentage, e.g. 3 for 3% per month. */
  monthlyInterestRate: string | number;
};

/** One month of interest on the loan. */
export function monthlyInterest(terms: LoanTerms): Paise {
  return percentOf(terms.principalPaise, terms.monthlyInterestRate);
}

/**
 * The ceiling on what a member may borrow.
 * `corpusContributedPaise` is what the member has actually paid in so far.
 */
export function maxLoanFor(corpusContributedPaise: Paise, multiple: string | number): Paise {
  const scaled = Math.round(Number(multiple) * 10_000);
  // Floor rather than round: the cap is a limit, not a target.
  return atLeastZero(Math.floor((corpusContributedPaise * scaled) / 10_000));
}

export type LoanEligibility = {
  maxLoanPaise: Paise;
  alreadyBorrowedPaise: Paise;
  availablePaise: Paise;
  allowed: boolean;
  reason?: string;
};

export function checkLoanEligibility(input: {
  requestedPaise: Paise;
  corpusContributedPaise: Paise;
  outstandingPrincipalPaise: Paise;
  multiple: string | number;
  groupAvailableFundsPaise: Paise;
}): LoanEligibility {
  const maxLoanPaise = maxLoanFor(input.corpusContributedPaise, input.multiple);
  const availablePaise = atLeastZero(maxLoanPaise - input.outstandingPrincipalPaise);

  const base = {
    maxLoanPaise,
    alreadyBorrowedPaise: input.outstandingPrincipalPaise,
    availablePaise,
  };

  if (input.requestedPaise <= 0) {
    return { ...base, allowed: false, reason: "Loan amount must be more than zero" };
  }
  if (input.requestedPaise > availablePaise) {
    return {
      ...base,
      allowed: false,
      reason: `Limit is ${input.multiple}x of corpus contributed; only ${
        availablePaise / 100
      } is left`,
    };
  }
  if (input.requestedPaise > input.groupAvailableFundsPaise) {
    return { ...base, allowed: false, reason: "Group does not have enough available funds" };
  }
  return { ...base, allowed: true };
}

/**
 * The months a loan owes interest for, from the month after disbursement
 * through the month it closed (or `asOf` while it is still running).
 *
 * Interest starts the month AFTER disbursement: a loan taken on the 20th does
 * not owe a full month of interest ten days later.
 */
export function interestSchedule(input: {
  disbursedOn: Date;
  closedOn: Date | null;
  asOf: Date;
  maxRepaymentMonths: number;
}): YearMonth[] {
  const firstDueMonth = addMonths(yearMonthOf(input.disbursedOn), 1);
  const lastAllowed = addMonths(
    yearMonthOf(input.disbursedOn),
    Math.max(input.maxRepaymentMonths, 1)
  );

  const endDate = input.closedOn ?? input.asOf;
  let lastMonth = yearMonthOf(endDate);
  if (compareYearMonth(lastMonth, lastAllowed) > 0) lastMonth = lastAllowed;
  if (compareYearMonth(firstDueMonth, lastMonth) > 0) return [];

  return monthsBetween(
    new Date(Date.UTC(firstDueMonth.year, firstDueMonth.month - 1, 1)),
    new Date(Date.UTC(lastMonth.year, lastMonth.month - 1, 1))
  );
}

export type RepaymentAllocation = {
  toFinePaise: Paise;
  toInterestPaise: Paise;
  toPrincipalPaise: Paise;
  /** Money left over after everything owed is covered. */
  unappliedPaise: Paise;
};

/**
 * Split a payment across what is owed, oldest obligation first:
 * fines, then interest, then principal.
 *
 * Fines come first so a member cannot quietly pay down principal while leaving
 * a fine open; interest before principal keeps the flat monthly charge honest.
 */
export function allocateRepayment(
  amountPaise: Paise,
  owed: { finePaise: Paise; interestPaise: Paise; principalPaise: Paise }
): RepaymentAllocation {
  let remaining = atLeastZero(amountPaise);

  const toFinePaise = Math.min(remaining, atLeastZero(owed.finePaise));
  remaining -= toFinePaise;

  const toInterestPaise = Math.min(remaining, atLeastZero(owed.interestPaise));
  remaining -= toInterestPaise;

  const toPrincipalPaise = Math.min(remaining, atLeastZero(owed.principalPaise));
  remaining -= toPrincipalPaise;

  return { toFinePaise, toInterestPaise, toPrincipalPaise, unappliedPaise: remaining };
}

export type LoanStanding = {
  principalPaise: Paise;
  principalRepaidPaise: Paise;
  outstandingPrincipalPaise: Paise;
  interestDuePaise: Paise;
  interestPaidPaise: Paise;
  outstandingInterestPaise: Paise;
  isPrincipalClosed: boolean;
  isOverdue: boolean;
};

/** Where a loan stands right now, from its repayment history. */
export function loanStanding(input: {
  principalPaise: Paise;
  repayments: Array<{ principalPaise: Paise; interestPaise: Paise }>;
  interestDuePaise: Paise;
  dueOn: Date;
  asOf: Date;
}): LoanStanding {
  const principalRepaidPaise = sumPaise(input.repayments.map((r) => r.principalPaise));
  const interestPaidPaise = sumPaise(input.repayments.map((r) => r.interestPaise));
  const outstandingPrincipalPaise = atLeastZero(input.principalPaise - principalRepaidPaise);
  const outstandingInterestPaise = atLeastZero(input.interestDuePaise - interestPaidPaise);
  const isPrincipalClosed = outstandingPrincipalPaise === 0;

  return {
    principalPaise: input.principalPaise,
    principalRepaidPaise,
    outstandingPrincipalPaise,
    interestDuePaise: input.interestDuePaise,
    interestPaidPaise,
    outstandingInterestPaise,
    isPrincipalClosed,
    isOverdue: !isPrincipalClosed && input.asOf.getTime() > input.dueOn.getTime(),
  };
}

/**
 * What a borrower actually paid to use the money, as a percentage of principal.
 * Shown on the member passbook so borrowers can see their true cost after the
 * final distribution pays part of that interest back to them.
 */
export function effectiveBorrowerRate(input: {
  interestPaidPaise: Paise;
  finesPaidPaise: Paise;
  distributionReceivedPaise: Paise;
  principalPaise: Paise;
}): number {
  if (input.principalPaise <= 0) return 0;
  const netCost =
    input.interestPaidPaise + input.finesPaidPaise - input.distributionReceivedPaise;
  return roundHalfUp(netCost * 10_000, input.principalPaise) / 100;
}
