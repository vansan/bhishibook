import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { utcDate } from "@/lib/finance";
import { decimalToPaise, rupeesToPaise, sumPaise } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { disconnect, resetDatabase, seedGroup } from "@/test/db";
import { generateContributionSchedule, recordContributionPayment } from "./contributions";
import { createLoan, generateInterestDues, recordLoanRepayment } from "./loans";
import { closeCycleWithDistribution, previewDistribution } from "./distribution";

beforeEach(resetDatabase);
afterAll(disconnect);

/**
 * A cycle where everyone paid, one member borrowed, and the interest came back
 * in. That interest is what there is to share out.
 */
async function cycleWithEarnings(options?: {
  distributionBase?: "INTEREST_ONLY" | "CORPUS_PLUS_INTEREST";
  distributeFines?: boolean;
}) {
  const seeded = await seedGroup({
    cycle: {
      distributionBase: options?.distributionBase ?? "INTEREST_ONLY",
      distributeFines: options?.distributeFines ?? true,
    },
  });

  await generateContributionSchedule({
    groupId: seeded.group.id,
    cycleId: seeded.cycle.id,
    asOf: utcDate(2026, 3, 20),
  });

  const rows = await prisma.contribution.findMany({ where: { cycleId: seeded.cycle.id } });
  for (const row of rows) {
    await recordContributionPayment({
      groupId: seeded.group.id,
      contributionId: row.id,
      amountPaise: decimalToPaise(row.amountDue),
      paidOn: utcDate(2026, row.month, 5),
    });
  }

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

  // Repay everything, so the books are clean and nothing is netted off.
  await recordLoanRepayment({
    groupId: seeded.group.id,
    loanId: loan.id,
    amountPaise: rupeesToPaise("6180"),
    paidOn: utcDate(2026, 4, 8),
  });

  return { ...seeded, loan };
}

describe("previewDistribution", () => {
  it("shares the interest collected by shares, losing nothing", async () => {
    const { group } = await cycleWithEarnings();

    const preview = await previewDistribution(group.id);

    expect(preview).not.toBeNull();
    // Admin 1 share + Member One 1 share + Member Two 2 shares.
    expect(preview!.totalShares).toBe(4);
    expect(preview!.interestCollectedPaise).toBe(rupeesToPaise("180"));
    expect(preview!.distributablePaise).toBe(rupeesToPaise("180"));

    const shared = sumPaise(preview!.rows.map((row) => row.interestSharePaise));
    expect(shared).toBe(rupeesToPaise("180"));

    const twoShares = preview!.rows.find((row) => row.shareCount === 2);
    expect(twoShares!.interestSharePaise).toBe(rupeesToPaise("90"));
  });

  it("gives the borrower a share too", async () => {
    const { group, members } = await cycleWithEarnings();

    const preview = await previewDistribution(group.id);
    const borrower = preview!.rows.find((row) => row.memberId === members[0].id);

    expect(borrower!.interestSharePaise).toBe(rupeesToPaise("45"));
    expect(borrower!.payoutPaise).toBeGreaterThan(0);
  });

  it("returns the corpus as well when the group chooses that base", async () => {
    const { group, members } = await cycleWithEarnings({
      distributionBase: "CORPUS_PLUS_INTEREST",
    });

    const preview = await previewDistribution(group.id);
    const member = preview!.rows.find((row) => row.memberId === members[0].id);

    // Paid in 1000 x 3 months.
    expect(member!.corpusReturnedPaise).toBe(rupeesToPaise("3000"));
    expect(member!.payoutPaise).toBe(rupeesToPaise("3045"));
  });

  it("keeps fines in the corpus when fine sharing is off", async () => {
    const { group } = await cycleWithEarnings({ distributeFines: false });

    const preview = await previewDistribution(group.id);

    expect(preview!.rows.every((row) => row.fineSharePaise === 0)).toBe(true);
  });

  it("nets a member's outstanding dues off their payout", async () => {
    const { group, cycle, members } = await cycleWithEarnings();

    // Add an unpaid April hafta for one member.
    await prisma.contribution.create({
      data: {
        cycleId: cycle.id,
        memberId: members[1].id,
        month: 4,
        year: 2026,
        amountDue: "2000.00",
        amountPaid: "0.00",
      },
    });

    const preview = await previewDistribution(group.id);
    const debtor = preview!.rows.find((row) => row.memberId === members[1].id);

    // Their 90 share is entirely swallowed by the 2000 they owe.
    expect(debtor!.deductionsPaise).toBe(rupeesToPaise("90"));
    expect(debtor!.payoutPaise).toBe(0);
  });
});

describe("closeCycleWithDistribution", () => {
  it("writes a settlement per member, a ledger entry and a receipt", async () => {
    const { group, cycle } = await cycleWithEarnings();

    const result = await closeCycleWithDistribution({
      groupId: group.id,
      cycleId: cycle.id,
      closedOn: utcDate(2026, 12, 31),
    });

    expect(result.members).toBe(3);
    expect(result.totalPayoutPaise).toBe(rupeesToPaise("180"));

    const settlements = await prisma.finalDistribution.findMany({
      where: { cycleId: cycle.id },
    });
    expect(settlements).toHaveLength(3);
    expect(sumPaise(settlements.map((row) => decimalToPaise(row.payoutAmount)))).toBe(
      rupeesToPaise("180")
    );

    const entries = await prisma.ledgerEntry.findMany({
      where: { cycleId: cycle.id, entryType: "DISTRIBUTION" },
    });
    expect(entries).toHaveLength(3);

    const receipts = await prisma.receipt.findMany({
      where: { cycleId: cycle.id, receiptType: "DISTRIBUTION" },
    });
    expect(receipts).toHaveLength(3);
    expect(receipts[0].whatsappText).toContain("Interest share");
  });

  it("closes the cycle", async () => {
    const { group, cycle } = await cycleWithEarnings();
    await closeCycleWithDistribution({ groupId: group.id, cycleId: cycle.id });

    const after = await prisma.cycle.findUniqueOrThrow({ where: { id: cycle.id } });
    expect(after.status).toBe("CLOSED");
    expect(after.closedAt).not.toBeNull();
  });

  it("refuses to distribute the same cycle twice", async () => {
    const { group, cycle } = await cycleWithEarnings();
    await closeCycleWithDistribution({ groupId: group.id, cycleId: cycle.id });

    await expect(
      closeCycleWithDistribution({ groupId: group.id, cycleId: cycle.id })
    ).rejects.toThrow(/already closed/i);

    expect(await prisma.finalDistribution.count({ where: { cycleId: cycle.id } })).toBe(3);
  });

  it("preview and commit agree exactly", async () => {
    const { group, cycle } = await cycleWithEarnings();

    const preview = await previewDistribution(group.id, cycle.id);
    await closeCycleWithDistribution({ groupId: group.id, cycleId: cycle.id });

    const stored = await prisma.finalDistribution.findMany({ where: { cycleId: cycle.id } });

    for (const row of preview!.rows) {
      const saved = stored.find((entry) => entry.memberId === row.memberId);
      expect(decimalToPaise(saved!.payoutAmount)).toBe(row.payoutPaise);
      expect(decimalToPaise(saved!.interestShare)).toBe(row.interestSharePaise);
    }
  });

  it("refuses a cycle belonging to another group", async () => {
    const { cycle } = await cycleWithEarnings();
    const other = await seedGroup({ name: "Other Bhishi", adminEmail: "d1@x.test" });

    await expect(
      closeCycleWithDistribution({ groupId: other.group.id, cycleId: cycle.id })
    ).rejects.toThrow();

    expect(await prisma.finalDistribution.count()).toBe(0);
  });

  it("stops new loans once the cycle is closed", async () => {
    const { group, cycle, members } = await cycleWithEarnings();
    await closeCycleWithDistribution({ groupId: group.id, cycleId: cycle.id });

    await expect(
      createLoan({
        groupId: group.id,
        cycleId: cycle.id,
        memberId: members[1].id,
        principalPaise: rupeesToPaise("1000"),
        disbursedOn: utcDate(2026, 12, 31),
      })
    ).rejects.toThrow(/closed/i);
  });
});
