import { describe, expect, it } from "vitest";
import { rupeesToPaise } from "@/lib/money";
import { utcDate } from "./dates";
import {
  allocateRepayment,
  checkLoanEligibility,
  effectiveBorrowerRate,
  interestSchedule,
  loanStanding,
  maxLoanFor,
  monthlyInterest,
} from "./loans";

describe("monthly interest", () => {
  it("charges a flat 3% of the original principal", () => {
    expect(
      monthlyInterest({ principalPaise: rupeesToPaise("10000"), monthlyInterestRate: 3 })
    ).toBe(rupeesToPaise("300"));
    expect(
      monthlyInterest({ principalPaise: rupeesToPaise("25000"), monthlyInterestRate: "3.00" })
    ).toBe(rupeesToPaise("750"));
  });

  it("does not reduce as principal is repaid", () => {
    // The group agreed a flat charge on the original principal, so a part
    // repayment must not shrink the monthly interest.
    const terms = { principalPaise: rupeesToPaise("20000"), monthlyInterestRate: 3 };
    expect(monthlyInterest(terms)).toBe(rupeesToPaise("600"));
  });
});

describe("the 2x corpus borrowing limit", () => {
  it("allows twice what the member has contributed", () => {
    expect(maxLoanFor(rupeesToPaise("10000"), 2)).toBe(rupeesToPaise("20000"));
    expect(maxLoanFor(rupeesToPaise("12000"), "2.00")).toBe(rupeesToPaise("24000"));
  });

  it("floors rather than rounds, because a cap is a limit", () => {
    expect(maxLoanFor(rupeesToPaise("0.01"), 1.5)).toBe(1);
  });

  it("gives a member with no corpus no borrowing room", () => {
    expect(maxLoanFor(0, 2)).toBe(0);
  });

  const eligibility = (overrides: Partial<Parameters<typeof checkLoanEligibility>[0]> = {}) =>
    checkLoanEligibility({
      requestedPaise: rupeesToPaise("20000"),
      corpusContributedPaise: rupeesToPaise("10000"),
      outstandingPrincipalPaise: 0,
      multiple: 2,
      groupAvailableFundsPaise: rupeesToPaise("500000"),
      ...overrides,
    });

  it("approves a loan exactly at the limit", () => {
    expect(eligibility().allowed).toBe(true);
  });

  it("rejects a rupee over the limit", () => {
    const result = eligibility({ requestedPaise: rupeesToPaise("20001") });
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/limit/i);
  });

  it("counts an existing loan against the limit", () => {
    const result = eligibility({
      requestedPaise: rupeesToPaise("15000"),
      outstandingPrincipalPaise: rupeesToPaise("8000"),
    });
    expect(result.availablePaise).toBe(rupeesToPaise("12000"));
    expect(result.allowed).toBe(false);
  });

  it("rejects a loan the group cannot fund", () => {
    const result = eligibility({ groupAvailableFundsPaise: rupeesToPaise("5000") });
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/available funds/i);
  });

  it("rejects a zero or negative amount", () => {
    expect(eligibility({ requestedPaise: 0 }).allowed).toBe(false);
  });
});

describe("interest schedule", () => {
  it("starts the month after disbursement", () => {
    const months = interestSchedule({
      disbursedOn: utcDate(2026, 9, 20),
      closedOn: null,
      asOf: utcDate(2026, 12, 15),
      maxRepaymentMonths: 6,
    });
    expect(months).toEqual([
      { year: 2026, month: 10 },
      { year: 2026, month: 11 },
      { year: 2026, month: 12 },
    ]);
  });

  it("owes nothing in the month the loan was taken", () => {
    const months = interestSchedule({
      disbursedOn: utcDate(2026, 9, 1),
      closedOn: null,
      asOf: utcDate(2026, 9, 30),
      maxRepaymentMonths: 6,
    });
    expect(months).toEqual([]);
  });

  it("stops at the month the loan closed", () => {
    const months = interestSchedule({
      disbursedOn: utcDate(2026, 9, 10),
      closedOn: utcDate(2026, 11, 5),
      asOf: utcDate(2027, 6, 1),
      maxRepaymentMonths: 6,
    });
    expect(months).toEqual([
      { year: 2026, month: 10 },
      { year: 2026, month: 11 },
    ]);
  });

  it("never runs past the 6 month repayment window", () => {
    const months = interestSchedule({
      disbursedOn: utcDate(2026, 9, 10),
      closedOn: null,
      asOf: utcDate(2028, 1, 1),
      maxRepaymentMonths: 6,
    });
    expect(months).toHaveLength(6);
    expect(months.at(-1)).toEqual({ year: 2027, month: 3 });
  });

  it("rolls the year over correctly", () => {
    const months = interestSchedule({
      disbursedOn: utcDate(2026, 11, 15),
      closedOn: null,
      asOf: utcDate(2027, 2, 1),
      maxRepaymentMonths: 6,
    });
    expect(months).toEqual([
      { year: 2026, month: 12 },
      { year: 2027, month: 1 },
      { year: 2027, month: 2 },
    ]);
  });
});

describe("repayment allocation", () => {
  const owed = {
    finePaise: rupeesToPaise("50"),
    interestPaise: rupeesToPaise("300"),
    principalPaise: rupeesToPaise("10000"),
  };

  it("pays fine, then interest, then principal", () => {
    expect(allocateRepayment(rupeesToPaise("1000"), owed)).toEqual({
      toFinePaise: rupeesToPaise("50"),
      toInterestPaise: rupeesToPaise("300"),
      toPrincipalPaise: rupeesToPaise("650"),
      unappliedPaise: 0,
    });
  });

  it("stops at the fine when that is all the money covers", () => {
    expect(allocateRepayment(rupeesToPaise("30"), owed)).toEqual({
      toFinePaise: rupeesToPaise("30"),
      toInterestPaise: 0,
      toPrincipalPaise: 0,
      unappliedPaise: 0,
    });
  });

  it("reports the excess when someone overpays", () => {
    const result = allocateRepayment(rupeesToPaise("11000"), owed);
    expect(result.toPrincipalPaise).toBe(rupeesToPaise("10000"));
    expect(result.unappliedPaise).toBe(rupeesToPaise("650"));
  });

  it("never allocates more than the payment", () => {
    const result = allocateRepayment(rupeesToPaise("100"), owed);
    const total = result.toFinePaise + result.toInterestPaise + result.toPrincipalPaise;
    expect(total + result.unappliedPaise).toBe(rupeesToPaise("100"));
  });

  it("handles a zero payment", () => {
    expect(allocateRepayment(0, owed).toFinePaise).toBe(0);
  });
});

describe("loan standing", () => {
  it("tracks what is still outstanding", () => {
    const standing = loanStanding({
      principalPaise: rupeesToPaise("10000"),
      repayments: [
        { principalPaise: rupeesToPaise("3000"), interestPaise: rupeesToPaise("300") },
        { principalPaise: rupeesToPaise("2000"), interestPaise: rupeesToPaise("300") },
      ],
      interestDuePaise: rupeesToPaise("900"),
      dueOn: utcDate(2027, 3, 10),
      asOf: utcDate(2026, 12, 1),
    });
    expect(standing.outstandingPrincipalPaise).toBe(rupeesToPaise("5000"));
    expect(standing.outstandingInterestPaise).toBe(rupeesToPaise("300"));
    expect(standing.isPrincipalClosed).toBe(false);
    expect(standing.isOverdue).toBe(false);
  });

  it("flags a loan past its due date", () => {
    const standing = loanStanding({
      principalPaise: rupeesToPaise("10000"),
      repayments: [],
      interestDuePaise: 0,
      dueOn: utcDate(2027, 3, 10),
      asOf: utcDate(2027, 4, 1),
    });
    expect(standing.isOverdue).toBe(true);
  });

  it("closes a fully repaid loan and is not overdue", () => {
    const standing = loanStanding({
      principalPaise: rupeesToPaise("10000"),
      repayments: [{ principalPaise: rupeesToPaise("10000"), interestPaise: 0 }],
      interestDuePaise: 0,
      dueOn: utcDate(2027, 3, 10),
      asOf: utcDate(2027, 4, 1),
    });
    expect(standing.isPrincipalClosed).toBe(true);
    expect(standing.isOverdue).toBe(false);
  });
});

describe("effective borrower rate", () => {
  it("nets the final distribution off what the borrower paid", () => {
    // Paid ₹1,800 interest on ₹10,000, got ₹800 back at distribution.
    expect(
      effectiveBorrowerRate({
        interestPaidPaise: rupeesToPaise("1800"),
        finesPaidPaise: 0,
        distributionReceivedPaise: rupeesToPaise("800"),
        principalPaise: rupeesToPaise("10000"),
      })
    ).toBe(10);
  });

  it("returns zero for a member who never borrowed", () => {
    expect(
      effectiveBorrowerRate({
        interestPaidPaise: 0,
        finesPaidPaise: 0,
        distributionReceivedPaise: rupeesToPaise("500"),
        principalPaise: 0,
      })
    ).toBe(0);
  });
});
