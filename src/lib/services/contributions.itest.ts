import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { utcDate } from "@/lib/finance";
import { decimalToPaise, rupeesToPaise } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { contributionFor, disconnect, resetDatabase, seedGroup } from "@/test/db";
import {
  generateContributionSchedule,
  recordContributionPayment,
  runFineAssessment,
  waiveFine,
} from "./contributions";

beforeEach(resetDatabase);
afterAll(disconnect);

const MARCH = { year: 2026, month: 3 };

async function schedule(groupId: string, cycleId: string, asOf = utcDate(2026, 3, 20)) {
  return generateContributionSchedule({ groupId, cycleId, asOf });
}

describe("generateContributionSchedule", () => {
  it("creates one row per member per month up to today", async () => {
    const { group, cycle, members } = await seedGroup();

    const result = await schedule(group.id, cycle.id);

    // 3 members (admin + 2) across January, February and March.
    expect(result.months).toBe(3);
    expect(result.created).toBe(9);

    const row = await contributionFor(cycle.id, members[1].id, 2026, 3);
    expect(decimalToPaise(row.amountDue)).toBe(rupeesToPaise("2000"));
  });

  it("does not create future months", async () => {
    const { group, cycle } = await seedGroup();
    await schedule(group.id, cycle.id, utcDate(2026, 2, 5));

    const future = await prisma.contribution.count({
      where: { cycleId: cycle.id, year: 2026, month: { gt: 2 } },
    });
    expect(future).toBe(0);
  });

  it("is idempotent, so running it twice creates nothing extra", async () => {
    const { group, cycle } = await seedGroup();
    await schedule(group.id, cycle.id);

    const second = await schedule(group.id, cycle.id);

    expect(second.created).toBe(0);
    expect(await prisma.contribution.count({ where: { cycleId: cycle.id } })).toBe(9);
  });

  it("charges a member nothing for months before they joined", async () => {
    const { group, cycle } = await seedGroup();
    const late = await prisma.groupMember.create({
      data: {
        groupId: group.id,
        displayName: "Joined In March",
        shareCount: 1,
        monthlyHafta: "1000.00",
        status: "ACTIVE",
        joinedAt: utcDate(2026, 3, 2),
      },
    });

    await schedule(group.id, cycle.id);

    const rows = await prisma.contribution.findMany({ where: { memberId: late.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0].month).toBe(3);
  });

  it("skips a month the group has locked", async () => {
    const { group, cycle } = await seedGroup();
    await prisma.periodLock.create({
      data: { groupId: group.id, cycleId: cycle.id, year: 2026, month: 2 },
    });

    await schedule(group.id, cycle.id);

    const february = await prisma.contribution.count({
      where: { cycleId: cycle.id, year: 2026, month: 2 },
    });
    expect(february).toBe(0);
  });
});

describe("recordContributionPayment", () => {
  async function setup() {
    const seeded = await seedGroup();
    await schedule(seeded.group.id, seeded.cycle.id);
    const row = await contributionFor(seeded.cycle.id, seeded.members[0].id, 2026, 3);
    return { ...seeded, contribution: row };
  }

  it("records an on-time payment with no fine, and posts to the ledger", async () => {
    const { group, contribution } = await setup();

    const result = await recordContributionPayment({
      groupId: group.id,
      contributionId: contribution.id,
      amountPaise: rupeesToPaise("1000"),
      paidOn: utcDate(2026, 3, 8),
    });

    expect(result.appliedPaise).toBe(rupeesToPaise("1000"));
    expect(result.receiptNo).toBe("000001");

    const after = await prisma.contribution.findUniqueOrThrow({ where: { id: contribution.id } });
    expect(decimalToPaise(after.amountPaid)).toBe(rupeesToPaise("1000"));
    expect(after.paidOn).not.toBeNull();

    expect(await prisma.fine.count({ where: { contributionId: contribution.id } })).toBe(0);

    const entries = await prisma.ledgerEntry.findMany({ where: { groupId: group.id } });
    expect(entries).toHaveLength(1);
    expect(entries[0].entryType).toBe("CONTRIBUTION");
    expect(decimalToPaise(entries[0].amount)).toBe(rupeesToPaise("1000"));
  });

  it("raises a fine for a late payment, at the agreed rate", async () => {
    const { group, contribution } = await setup();

    // Due the 10th, paid the 15th: 5 days at 10 a day.
    await recordContributionPayment({
      groupId: group.id,
      contributionId: contribution.id,
      amountPaise: rupeesToPaise("1000"),
      paidOn: utcDate(2026, 3, 15),
    });

    const fine = await prisma.fine.findUniqueOrThrow({
      where: { contributionId: contribution.id },
    });
    expect(fine.daysLate).toBe(5);
    expect(decimalToPaise(fine.amount)).toBe(rupeesToPaise("50"));
    expect(fine.fineType).toBe("CONTRIBUTION");
    expect(fine.month).toBe(3);
  });

  it("records fine money separately from hafta money", async () => {
    const { group, contribution } = await setup();

    const result = await recordContributionPayment({
      groupId: group.id,
      contributionId: contribution.id,
      amountPaise: rupeesToPaise("1000"),
      finePaidPaise: rupeesToPaise("50"),
      paidOn: utcDate(2026, 3, 15),
    });

    expect(result.finePaise).toBe(rupeesToPaise("50"));

    const types = await prisma.ledgerEntry.findMany({
      where: { groupId: group.id },
      select: { entryType: true, amount: true },
      orderBy: { entryType: "asc" },
    });
    expect(types.map((entry) => entry.entryType)).toEqual([
      "CONTRIBUTION",
      "CONTRIBUTION_FINE",
    ]);
  });

  it("never records more than the month's hafta", async () => {
    const { group, contribution } = await setup();

    const result = await recordContributionPayment({
      groupId: group.id,
      contributionId: contribution.id,
      amountPaise: rupeesToPaise("5000"),
      paidOn: utcDate(2026, 3, 8),
    });

    expect(result.appliedPaise).toBe(rupeesToPaise("1000"));
    const after = await prisma.contribution.findUniqueOrThrow({ where: { id: contribution.id } });
    expect(decimalToPaise(after.amountPaid)).toBe(rupeesToPaise("1000"));
  });

  it("accepts a part payment and leaves the month open", async () => {
    const { group, contribution } = await setup();

    await recordContributionPayment({
      groupId: group.id,
      contributionId: contribution.id,
      amountPaise: rupeesToPaise("600"),
      paidOn: utcDate(2026, 3, 8),
    });

    const after = await prisma.contribution.findUniqueOrThrow({ where: { id: contribution.id } });
    expect(decimalToPaise(after.amountPaid)).toBe(rupeesToPaise("600"));
    expect(after.paidOn).toBeNull();
  });

  it("refuses to write into a locked month", async () => {
    const { group, cycle, contribution } = await setup();
    await prisma.periodLock.create({
      data: { groupId: group.id, cycleId: cycle.id, year: 2026, month: 3 },
    });

    await expect(
      recordContributionPayment({
        groupId: group.id,
        contributionId: contribution.id,
        amountPaise: rupeesToPaise("1000"),
        paidOn: utcDate(2026, 3, 8),
      })
    ).rejects.toThrow(/closed and locked/i);

    const after = await prisma.contribution.findUniqueOrThrow({ where: { id: contribution.id } });
    expect(decimalToPaise(after.amountPaid)).toBe(0);
  });

  it("refuses a contribution belonging to another group", async () => {
    const { contribution } = await setup();
    const other = await seedGroup({ name: "Other Bhishi", adminEmail: "other@x.test" });

    await expect(
      recordContributionPayment({
        groupId: other.group.id,
        contributionId: contribution.id,
        amountPaise: rupeesToPaise("1000"),
        paidOn: utcDate(2026, 3, 8),
      })
    ).rejects.toThrow();

    const after = await prisma.contribution.findUniqueOrThrow({ where: { id: contribution.id } });
    expect(decimalToPaise(after.amountPaid)).toBe(0);
  });

  it("writes an audit row for every payment", async () => {
    const { group, contribution } = await setup();
    await recordContributionPayment({
      groupId: group.id,
      contributionId: contribution.id,
      amountPaise: rupeesToPaise("1000"),
      paidOn: utcDate(2026, 3, 8),
    });

    const audit = await prisma.auditLog.findFirst({
      where: { action: "RECORD_CONTRIBUTION_PAYMENT" },
    });
    expect(audit).not.toBeNull();
  });

  it("issues unique receipt numbers when payments race", async () => {
    const { group, cycle, members } = await seedGroup();
    await schedule(group.id, cycle.id);

    const rows = await prisma.contribution.findMany({
      where: { cycleId: cycle.id, year: 2026, month: 3 },
      select: { id: true },
    });
    expect(rows.length).toBeGreaterThanOrEqual(3);

    // Two admins recording at the same moment must not collide on receiptNo,
    // which is unique per group.
    await Promise.all(
      rows.map((row) =>
        recordContributionPayment({
          groupId: group.id,
          contributionId: row.id,
          amountPaise: rupeesToPaise("1000"),
          paidOn: utcDate(2026, 3, 8),
        })
      )
    );

    const receipts = await prisma.receipt.findMany({
      where: { groupId: group.id },
      select: { receiptNo: true },
    });
    expect(receipts).toHaveLength(rows.length);
    expect(new Set(receipts.map((r) => r.receiptNo)).size).toBe(rows.length);
    void members;
  });
});

describe("runFineAssessment", () => {
  it("fines every unpaid month up to today, and freezes one that was paid", async () => {
    const { group, cycle, members } = await seedGroup();
    await schedule(group.id, cycle.id);

    const paidRow = await contributionFor(cycle.id, members[0].id, 2026, 3);
    await recordContributionPayment({
      groupId: group.id,
      contributionId: paidRow.id,
      amountPaise: rupeesToPaise("1000"),
      paidOn: utcDate(2026, 3, 13),
    });

    const result = await runFineAssessment({
      groupId: group.id,
      cycleId: cycle.id,
      asOf: utcDate(2026, 3, 20),
    });

    // 9 rows: the paid one is frozen at 3 days, the rest are 10 days late
    // for January and February and 10 for March.
    expect(result.assessed).toBe(9);

    const frozen = await prisma.fine.findUniqueOrThrow({
      where: { contributionId: paidRow.id },
    });
    expect(frozen.daysLate).toBe(3);
    expect(decimalToPaise(frozen.amount)).toBe(rupeesToPaise("30"));
  });

  it("keeps growing an unpaid fine as time passes", async () => {
    const { group, cycle, members } = await seedGroup();
    await schedule(group.id, cycle.id);

    await runFineAssessment({ groupId: group.id, cycleId: cycle.id, asOf: utcDate(2026, 3, 15) });
    const first = await prisma.fine.findFirstOrThrow({
      where: { memberId: members[0].id, month: 3 },
    });
    expect(decimalToPaise(first.amount)).toBe(rupeesToPaise("50"));

    await runFineAssessment({ groupId: group.id, cycleId: cycle.id, asOf: utcDate(2026, 3, 25) });
    const later = await prisma.fine.findFirstOrThrow({
      where: { memberId: members[0].id, month: 3 },
    });
    expect(decimalToPaise(later.amount)).toBe(rupeesToPaise("150"));
    // The same row is updated, not duplicated.
    expect(later.id).toBe(first.id);
  });

  it("honours a cap when the group sets one", async () => {
    const { group, cycle, members } = await seedGroup();
    await schedule(group.id, cycle.id);
    await prisma.fineRule.updateMany({
      where: { groupId: group.id, appliesTo: "CONTRIBUTION" },
      data: { maxFineDays: 5 },
    });

    await runFineAssessment({ groupId: group.id, cycleId: cycle.id, asOf: utcDate(2026, 3, 25) });

    const fine = await prisma.fine.findFirstOrThrow({
      where: { memberId: members[0].id, month: 3 },
    });
    expect(fine.daysLate).toBe(15);
    expect(decimalToPaise(fine.amount)).toBe(rupeesToPaise("50"));
  });

  it("charges nothing while the rule is switched off", async () => {
    const { group, cycle } = await seedGroup();
    await schedule(group.id, cycle.id);
    await prisma.fineRule.updateMany({
      where: { groupId: group.id, appliesTo: "CONTRIBUTION" },
      data: { active: false },
    });

    const result = await runFineAssessment({
      groupId: group.id,
      cycleId: cycle.id,
      asOf: utcDate(2026, 3, 25),
    });
    expect(result.assessed).toBe(0);
  });

  it("leaves locked months alone", async () => {
    const { group, cycle } = await seedGroup();
    await schedule(group.id, cycle.id);
    await prisma.periodLock.create({
      data: { groupId: group.id, cycleId: cycle.id, year: 2026, month: 1 },
    });

    await runFineAssessment({ groupId: group.id, cycleId: cycle.id, asOf: utcDate(2026, 3, 25) });

    expect(await prisma.fine.count({ where: { cycleId: cycle.id, month: 1 } })).toBe(0);
  });
});

describe("waiveFine", () => {
  it("reduces what is collectable without deleting the fine", async () => {
    const { group, cycle, members } = await seedGroup();
    await schedule(group.id, cycle.id);
    await runFineAssessment({ groupId: group.id, cycleId: cycle.id, asOf: utcDate(2026, 3, 20) });

    const fine = await prisma.fine.findFirstOrThrow({
      where: { memberId: members[0].id, month: 3 },
    });

    await waiveFine({
      groupId: group.id,
      fineId: fine.id,
      waivePaise: rupeesToPaise("40"),
      reason: "Hospital",
    });

    const after = await prisma.fine.findUniqueOrThrow({ where: { id: fine.id } });
    expect(decimalToPaise(after.waivedAmount)).toBe(rupeesToPaise("40"));
    expect(decimalToPaise(after.amount)).toBe(rupeesToPaise("100"));
    expect(after.notes).toContain("Hospital");
  });

  it("refuses to waive more than is outstanding", async () => {
    const { group, cycle, members } = await seedGroup();
    await schedule(group.id, cycle.id);
    await runFineAssessment({ groupId: group.id, cycleId: cycle.id, asOf: utcDate(2026, 3, 20) });

    const fine = await prisma.fine.findFirstOrThrow({
      where: { memberId: members[0].id, month: 3 },
    });
    await waiveFine({
      groupId: group.id,
      fineId: fine.id,
      waivePaise: rupeesToPaise("100"),
      reason: "All of it",
    });

    await expect(
      waiveFine({
        groupId: group.id,
        fineId: fine.id,
        waivePaise: rupeesToPaise("10"),
        reason: "Again",
      })
    ).rejects.toThrow(/nothing left/i);
  });

  it("refuses a fine belonging to another group", async () => {
    const { group, cycle, members } = await seedGroup();
    await schedule(group.id, cycle.id);
    await runFineAssessment({ groupId: group.id, cycleId: cycle.id, asOf: utcDate(2026, 3, 20) });
    const fine = await prisma.fine.findFirstOrThrow({ where: { memberId: members[0].id } });

    const other = await seedGroup({ name: "Other Bhishi", adminEmail: "other2@x.test" });

    await expect(
      waiveFine({
        groupId: other.group.id,
        fineId: fine.id,
        waivePaise: rupeesToPaise("10"),
        reason: "Not mine",
      })
    ).rejects.toThrow();
  });
});

void MARCH;
