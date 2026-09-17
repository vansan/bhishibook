import { describe, expect, it } from "vitest";
import { rupeesToPaise } from "@/lib/money";
import { utcDate } from "./dates";
import { assessFine, assessMonthlyFine, fineOutstanding, lateDays } from "./fines";

/** The MaitriNidhi rule: ₹10 per day, fine starts on the 11th, no cap. */
const rule = {
  fixedPerDayPaise: rupeesToPaise("10"),
  graceDays: 0,
  maxFineDays: 0,
  active: true,
};

const SEPTEMBER = { year: 2026, month: 9 };
const due10th = utcDate(2026, 9, 10);

describe("the agreed fine schedule", () => {
  // These four rows are exactly the schedule that was signed off:
  //   paid 10th -> ₹0, 11th -> ₹10, 15th -> ₹50, 20th -> ₹100
  it.each([
    [10, "0"],
    [11, "10"],
    [15, "50"],
    [20, "100"],
  ])("paying on the %ith costs ₹%s", (day, expected) => {
    const assessment = assessFine(due10th, utcDate(2026, 9, day), rule);
    expect(assessment.amountPaise).toBe(rupeesToPaise(expected));
  });

  it("charges nothing for paying early or on the due day", () => {
    expect(assessFine(due10th, utcDate(2026, 9, 1), rule).amountPaise).toBe(0);
    expect(assessFine(due10th, utcDate(2026, 9, 10), rule).amountPaise).toBe(0);
  });

  it("starts counting on the 11th", () => {
    expect(assessFine(due10th, utcDate(2026, 9, 11), rule).fineStartsOn).toEqual(
      utcDate(2026, 9, 11)
    );
    expect(assessFine(due10th, utcDate(2026, 9, 11), rule).daysLate).toBe(1);
  });

  it("keeps counting across a month boundary", () => {
    // 20 days from the 10th of September lands on the 30th of September.
    expect(assessFine(due10th, utcDate(2026, 9, 30), rule).amountPaise).toBe(
      rupeesToPaise("200")
    );
    // The 10th of October is 30 days late.
    expect(assessFine(due10th, utcDate(2026, 10, 10), rule).amountPaise).toBe(
      rupeesToPaise("300")
    );
  });

  it("ignores the time of day the payment was entered", () => {
    const lateEvening = new Date(Date.UTC(2026, 8, 15, 23, 59, 59));
    const earlyMorning = new Date(Date.UTC(2026, 8, 15, 0, 0, 1));
    expect(assessFine(due10th, lateEvening, rule).daysLate).toBe(5);
    expect(assessFine(due10th, earlyMorning, rule).daysLate).toBe(5);
  });
});

describe("configurable grace and cap", () => {
  it("honours extra grace days when a group wants them", () => {
    const lenient = { ...rule, graceDays: 10 };
    // With 10 grace days nothing is owed until the 21st.
    expect(assessFine(due10th, utcDate(2026, 9, 20), lenient).amountPaise).toBe(0);
    expect(assessFine(due10th, utcDate(2026, 9, 21), lenient).amountPaise).toBe(
      rupeesToPaise("10")
    );
    expect(assessFine(due10th, utcDate(2026, 9, 25), lenient).amountPaise).toBe(
      rupeesToPaise("50")
    );
  });

  it("caps billable days when a cap is set, but still reports the real lateness", () => {
    const capped = { ...rule, maxFineDays: 30 };
    const assessment = assessFine(due10th, utcDate(2026, 12, 10), capped);
    expect(assessment.daysLate).toBe(91);
    expect(assessment.billableDays).toBe(30);
    expect(assessment.amountPaise).toBe(rupeesToPaise("300"));
  });

  it("treats a cap of zero as uncapped", () => {
    const assessment = assessFine(due10th, utcDate(2026, 12, 10), rule);
    expect(assessment.billableDays).toBe(91);
    expect(assessment.amountPaise).toBe(rupeesToPaise("910"));
  });

  it("charges nothing when the rule is switched off", () => {
    const off = { ...rule, active: false };
    expect(assessFine(due10th, utcDate(2026, 9, 30), off).amountPaise).toBe(0);
  });
});

describe("assessMonthlyFine", () => {
  const base = {
    period: SEPTEMBER,
    dueDay: 10,
    amountDuePaise: rupeesToPaise("1000"),
    rule,
  };

  it("stops the clock on the day a due row was fully paid", () => {
    const assessment = assessMonthlyFine({
      ...base,
      amountPaidPaise: rupeesToPaise("1000"),
      paidOn: utcDate(2026, 9, 15),
      asOf: utcDate(2026, 12, 31),
    });
    expect(assessment.amountPaise).toBe(rupeesToPaise("50"));
  });

  it("keeps an unpaid row growing up to today", () => {
    const assessment = assessMonthlyFine({
      ...base,
      amountPaidPaise: 0,
      paidOn: null,
      asOf: utcDate(2026, 9, 20),
    });
    expect(assessment.amountPaise).toBe(rupeesToPaise("100"));
  });

  it("treats a partial payment as still outstanding", () => {
    // ₹600 against a ₹1,000 hafta does not stop the fine.
    const assessment = assessMonthlyFine({
      ...base,
      amountPaidPaise: rupeesToPaise("600"),
      paidOn: utcDate(2026, 9, 12),
      asOf: utcDate(2026, 9, 20),
    });
    expect(assessment.amountPaise).toBe(rupeesToPaise("100"));
  });

  it("charges nothing on a month paid inside the window", () => {
    const assessment = assessMonthlyFine({
      ...base,
      amountPaidPaise: rupeesToPaise("1000"),
      paidOn: utcDate(2026, 9, 5),
      asOf: utcDate(2026, 12, 31),
    });
    expect(assessment.amountPaise).toBe(0);
  });

  it("clamps the due day to the end of a short month", () => {
    const february = assessMonthlyFine({
      ...base,
      period: { year: 2026, month: 2 },
      dueDay: 31,
      amountPaidPaise: 0,
      paidOn: null,
      asOf: utcDate(2026, 3, 1),
    });
    // February 2026 ends on the 28th, so the 1st of March is 1 day late.
    expect(february.daysLate).toBe(1);
  });
});

describe("lateDays and outstanding", () => {
  it("never reports negative lateness", () => {
    expect(lateDays(due10th, utcDate(2026, 9, 1))).toBe(0);
  });

  it("nets payments and waivers off a fine", () => {
    expect(
      fineOutstanding({
        amountPaise: rupeesToPaise("100"),
        amountPaidPaise: rupeesToPaise("30"),
        waivedPaise: rupeesToPaise("20"),
      })
    ).toBe(rupeesToPaise("50"));
  });

  it("floors at zero when a fine is fully waived", () => {
    expect(
      fineOutstanding({
        amountPaise: rupeesToPaise("100"),
        amountPaidPaise: 0,
        waivedPaise: rupeesToPaise("150"),
      })
    ).toBe(0);
  });
});
