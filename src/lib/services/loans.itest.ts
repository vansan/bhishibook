import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { utcDate } from "@/lib/finance";
import { decimalToPaise, rupeesToPaise } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { contributionFor, disconnect, resetDatabase, seedGroup } from "@/test/db";
import {
  generateContributionSchedule,
  recordContributionPayment,
  runFineAssessment,
} from "./contributions";
import {
  createLoan,
  generateInterestDues,
  getLoanPosition,
  recordLoanRepayment,
} from "./loans";

beforeEach(resetDatabase);
afterAll(disconnect);

/**
 * Give a member real corpus, because the borrowing limit is a multiple of what
 * they have actually paid in. Returns the member and their contributed total.
 */
async function withCorpus(rupeesPerMonth = "1000") {
  const seeded = await seedGroup();
  await generateContributionSchedule({
    groupId: seeded.group.id,
    cycleId: seeded.cycle.id,
    asOf: utcDate(2026, 3, 20),
  });

  // Everyone pays all three months on time, so the group has funds to lend.
  const rows = await prisma.contribution.findMany({ where: { cycleId: seeded.cycle.id } });
  for (const row of rows) {
    await recordContributionPayment({
      groupId: seeded.group.id,
      contributionId: row.id,
      amountPaise: decimalToPaise(row.amountDue),
      paidOn: utcDate(2026, row.month, 5),
    });
  }

  void rupeesPerMonth;
  return seeded;
}

describe("createLoan", () => {
  it("disburses within the 2x limit and posts an outflow to the ledger", async () => {
    const { group, cycle, members } = await withCorpus();

    // Member One paid 1000 x 3 = 3000, so the limit is 6000.
    const { loan, receiptNo } = await createLoan({
      groupId: group.id,
      cycleId: cycle.id,
      memberId: members[0].id,
      principalPaise: rupeesToPaise("6000"),
      disbursedOn: utcDate(2026, 3, 20),
    });

    expect(decimalToPaise(loan.principal)).toBe(rupeesToPaise("6000"));
    expect(loan.status).toBe("ACTIVE");
    // Six months from disbursement.
    expect(loan.dueOn.toISOString().slice(0, 10)).toBe("2026-09-20");
    expect(receiptNo).toMatch(/^\d{6}$/);

    const entry = await prisma.ledgerEntry.findFirstOrThrow({
      where: { entryType: "LOAN_DISBURSEMENT" },
    });
    expect(decimalToPaise(entry.amount)).toBe(rupeesToPaise("6000"));
  });

  it("refuses a rupee over the limit", async () => {
    const { group, cycle, members } = await withCorpus();

    await expect(
      createLoan({
        groupId: group.id,
        cycleId: cycle.id,
        memberId: members[0].id,
        principalPaise: rupeesToPaise("6001"),
        disbursedOn: utcDate(2026, 3, 20),
      })
    ).rejects.toThrow(/limit/i);

    expect(await prisma.loan.count()).toBe(0);
  });

  it("counts an existing loan against the limit", async () => {
    const { group, cycle, members } = await withCorpus();
    await createLoan({
      groupId: group.id,
      cycleId: cycle.id,
      memberId: members[0].id,
      principalPaise: rupeesToPaise("4000"),
      disbursedOn: utcDate(2026, 3, 20),
    });

    await expect(
      createLoan({
        groupId: group.id,
        cycleId: cycle.id,
        memberId: members[0].id,
        principalPaise: rupeesToPaise("2500"),
        disbursedOn: utcDate(2026, 3, 21),
      })
    ).rejects.toThrow(/limit/i);
  });

  it("refuses to lend money the group does not have", async () => {
    const { group, cycle, members } = await withCorpus();
    // Member Two paid 2000 x 3 = 6000, so their limit is 12000, but the whole
    // group has only collected 12000 and this asks for more than is available
    // after the limit check passes.
    await expect(
      createLoan({
        groupId: group.id,
        cycleId: cycle.id,
        memberId: members[1].id,
        principalPaise: rupeesToPaise("12000"),
        disbursedOn: utcDate(2026, 3, 20),
      })
    ).resolves.toBeDefined();

    // Now the corpus is empty, so nothing more can go out.
    await expect(
      createLoan({
        groupId: group.id,
        cycleId: cycle.id,
        memberId: members[0].id,
        principalPaise: rupeesToPaise("1000"),
        disbursedOn: utcDate(2026, 3, 21),
      })
    ).rejects.toThrow(/available funds/i);
  });

  it("refuses a member who is not active", async () => {
    const { group, cycle, members } = await withCorpus();
    await prisma.groupMember.update({
      where: { id: members[0].id },
      data: { status: "INACTIVE" },
    });

    await expect(
      createLoan({
        groupId: group.id,
        cycleId: cycle.id,
        memberId: members[0].id,
        principalPaise: rupeesToPaise("1000"),
        disbursedOn: utcDate(2026, 3, 20),
      })
    ).rejects.toThrow(/not an active member/i);
  });

  it("refuses a member from another group", async () => {
    const { group, cycle } = await withCorpus();
    const other = await seedGroup({ name: "Other Bhishi", adminEmail: "o1@x.test" });

    await expect(
      createLoan({
        groupId: group.id,
        cycleId: cycle.id,
        memberId: other.members[0].id,
        principalPaise: rupeesToPaise("1000"),
        disbursedOn: utcDate(2026, 3, 20),
      })
    ).rejects.toThrow();
  });
});

describe("generateInterestDues", () => {
  it("bills 3% of principal from the month after disbursement", async () => {
    const { group, cycle, members } = await withCorpus();
    await createLoan({
      groupId: group.id,
      cycleId: cycle.id,
      memberId: members[0].id,
      principalPaise: rupeesToPaise("6000"),
      disbursedOn: utcDate(2026, 3, 20),
    });

    const result = await generateInterestDues({
      groupId: group.id,
      cycleId: cycle.id,
      asOf: utcDate(2026, 5, 15),
    });

    // April and May.
    expect(result.created).toBe(2);
    const dues = await prisma.interestDue.findMany({ orderBy: { month: "asc" } });
    expect(dues.map((due) => due.month)).toEqual([4, 5]);
    expect(decimalToPaise(dues[0].amountDue)).toBe(rupeesToPaise("180"));
  });

  it("is idempotent, so a month is never billed twice", async () => {
    const { group, cycle, members } = await withCorpus();
    await createLoan({
      groupId: group.id,
      cycleId: cycle.id,
      memberId: members[0].id,
      principalPaise: rupeesToPaise("6000"),
      disbursedOn: utcDate(2026, 3, 20),
    });

    const options = { groupId: group.id, cycleId: cycle.id, asOf: utcDate(2026, 5, 15) };
    await generateInterestDues(options);
    const second = await generateInterestDues(options);

    expect(second.created).toBe(0);
    expect(await prisma.interestDue.count()).toBe(2);
  });

  it("stops at the six month repayment window", async () => {
    const { group, cycle, members } = await withCorpus();
    await createLoan({
      groupId: group.id,
      cycleId: cycle.id,
      memberId: members[0].id,
      principalPaise: rupeesToPaise("6000"),
      disbursedOn: utcDate(2026, 3, 20),
    });

    await generateInterestDues({
      groupId: group.id,
      cycleId: cycle.id,
      asOf: utcDate(2027, 6, 1),
    });

    expect(await prisma.interestDue.count()).toBe(6);
  });
});

describe("recordLoanRepayment", () => {
  async function lentGroup() {
    const seeded = await withCorpus();
    const { loan } = await createLoan({
      groupId: seeded.group.id,
      cycleId: seeded.cycle.id,
      memberId: seeded.members[0].id,
      principalPaise: rupeesToPaise("6000"),
      disbursedOn: utcDate(2026, 3, 20),
    });
    await generateInterestDues({
      groupId: seeded.group.id,
      cycleId: seeded.cycle.id,
      asOf: utcDate(2026, 4, 15),
    });
    return { ...seeded, loan };
  }

  it("clears interest before principal", async () => {
    const { group, loan } = await lentGroup();

    const { allocation } = await recordLoanRepayment({
      groupId: group.id,
      loanId: loan.id,
      amountPaise: rupeesToPaise("1180"),
      paidOn: utcDate(2026, 4, 8),
    });

    expect(allocation.toInterestPaise).toBe(rupeesToPaise("180"));
    expect(allocation.toPrincipalPaise).toBe(rupeesToPaise("1000"));
    expect(allocation.toFinePaise).toBe(0);

    const position = await getLoanPosition(group.id, loan.id);
    expect(position?.outstandingPrincipalPaise).toBe(rupeesToPaise("5000"));
    expect(position?.outstandingInterestPaise).toBe(0);
  });

  it("clears fines before anything else", async () => {
    const { group, cycle, loan } = await lentGroup();
    // Leave the April interest unpaid until the 20th so an interest fine lands.
    await runFineAssessment({
      groupId: group.id,
      cycleId: cycle.id,
      asOf: utcDate(2026, 4, 20),
    });

    const fine = await prisma.fine.findFirstOrThrow({
      where: { loanId: loan.id, fineType: "INTEREST" },
    });
    expect(decimalToPaise(fine.amount)).toBe(rupeesToPaise("100"));

    const { allocation } = await recordLoanRepayment({
      groupId: group.id,
      loanId: loan.id,
      amountPaise: rupeesToPaise("150"),
      paidOn: utcDate(2026, 4, 20),
    });

    expect(allocation.toFinePaise).toBe(rupeesToPaise("100"));
    expect(allocation.toInterestPaise).toBe(rupeesToPaise("50"));
    expect(allocation.toPrincipalPaise).toBe(0);
  });

  it("closes the loan when everything is cleared", async () => {
    const { group, loan } = await lentGroup();

    await recordLoanRepayment({
      groupId: group.id,
      loanId: loan.id,
      amountPaise: rupeesToPaise("6180"),
      paidOn: utcDate(2026, 4, 8),
    });

    const after = await prisma.loan.findUniqueOrThrow({ where: { id: loan.id } });
    expect(after.status).toBe("CLOSED");
    expect(after.principalClosed).toBe(true);
    expect(after.closedOn).not.toBeNull();
  });

  it("refuses more than the loan owes", async () => {
    const { group, loan } = await lentGroup();

    await expect(
      recordLoanRepayment({
        groupId: group.id,
        loanId: loan.id,
        amountPaise: rupeesToPaise("9999"),
        paidOn: utcDate(2026, 4, 8),
      })
    ).rejects.toThrow(/only owes/i);

    expect(await prisma.loanRepayment.count()).toBe(0);
  });

  it("refuses to touch a closed loan", async () => {
    const { group, loan } = await lentGroup();
    await recordLoanRepayment({
      groupId: group.id,
      loanId: loan.id,
      amountPaise: rupeesToPaise("6180"),
      paidOn: utcDate(2026, 4, 8),
    });

    await expect(
      recordLoanRepayment({
        groupId: group.id,
        loanId: loan.id,
        amountPaise: rupeesToPaise("100"),
        paidOn: utcDate(2026, 4, 9),
      })
    ).rejects.toThrow(/already closed/i);
  });

  it("refuses a loan belonging to another group", async () => {
    const { loan } = await lentGroup();
    const other = await seedGroup({ name: "Other Bhishi", adminEmail: "o2@x.test" });

    await expect(
      recordLoanRepayment({
        groupId: other.group.id,
        loanId: loan.id,
        amountPaise: rupeesToPaise("100"),
        paidOn: utcDate(2026, 4, 8),
      })
    ).rejects.toThrow();
  });

  it("posts each leg to the ledger under its own type", async () => {
    const { group, loan } = await lentGroup();
    await recordLoanRepayment({
      groupId: group.id,
      loanId: loan.id,
      amountPaise: rupeesToPaise("1180"),
      paidOn: utcDate(2026, 4, 8),
    });

    const entries = await prisma.ledgerEntry.findMany({
      where: { referenceType: "LoanRepayment" },
      select: { entryType: true, amount: true },
    });
    const byType = Object.fromEntries(
      entries.map((entry) => [entry.entryType, decimalToPaise(entry.amount)])
    );
    expect(byType.INTEREST_PAYMENT).toBe(rupeesToPaise("180"));
    expect(byType.PRINCIPAL_REPAYMENT).toBe(rupeesToPaise("1000"));
  });

  it("spreads interest across the oldest months first", async () => {
    const { group, cycle, loan } = await lentGroup();
    await generateInterestDues({
      groupId: group.id,
      cycleId: cycle.id,
      asOf: utcDate(2026, 5, 15),
    });

    // Two months billed at 180; pay only one month's worth.
    await recordLoanRepayment({
      groupId: group.id,
      loanId: loan.id,
      amountPaise: rupeesToPaise("180"),
      paidOn: utcDate(2026, 5, 8),
    });

    const dues = await prisma.interestDue.findMany({ orderBy: { month: "asc" } });
    expect(decimalToPaise(dues[0].amountPaid)).toBe(rupeesToPaise("180"));
    expect(dues[0].paidOn).not.toBeNull();
    expect(decimalToPaise(dues[1].amountPaid)).toBe(0);
  });
});

void contributionFor;
