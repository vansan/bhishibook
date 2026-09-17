import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { utcDate } from "@/lib/finance";
import { decimalToPaise, rupeesToPaise } from "@/lib/money";
import { verifyPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";
import { disconnect, resetDatabase, seedGroup } from "@/test/db";
import { createCycle, createGroup, updateCycle, updateFineRule } from "./groups";

beforeEach(resetDatabase);
afterAll(disconnect);

const validGroup = {
  name: "Shivneri Mitra Mandal",
  defaultLang: "mr",
  currency: "INR",
  adminName: "Pooja Deshpande",
  adminEmail: "pooja@shivneri.test",
  adminPassword: "shivneri2026",
  finePerDayPaise: rupeesToPaise("20"),
};

describe("createGroup", () => {
  it("builds a usable tenant in one go", async () => {
    const { group, admin } = await createGroup(validGroup);

    expect(group.name).toBe("Shivneri Mitra Mandal");
    expect(group.defaultLang).toBe("mr");
    expect(group.status).toBe("ACTIVE");
    expect(group.planStatus).toBe("FREE");

    expect(admin.role).toBe("GROUP_ADMIN");
    expect(await verifyPassword("shivneri2026", admin.passwordHash)).toBe(true);

    // The admin is also a member, so they have a passbook.
    const membership = await prisma.groupMember.findFirstOrThrow({
      where: { groupId: group.id, userId: admin.id },
    });
    expect(membership.status).toBe("ACTIVE");

    // Receipts can be minted from day one.
    const counter = await prisma.receiptCounter.findUniqueOrThrow({
      where: { groupId: group.id },
    });
    expect(counter.nextNumber).toBe(1);

    // Both fine types exist, separately, at the requested rate.
    const rules = await prisma.fineRule.findMany({
      where: { groupId: group.id },
      orderBy: { appliesTo: "asc" },
    });
    expect(rules.map((rule) => rule.appliesTo)).toEqual(["CONTRIBUTION", "INTEREST"]);
    expect(decimalToPaise(rules[0].fixedPerDay)).toBe(rupeesToPaise("20"));
    expect(rules[0].graceDays).toBe(0);
  });

  it("refuses an email that already has an account", async () => {
    await createGroup(validGroup);

    await expect(
      createGroup({ ...validGroup, name: "Another Group" })
    ).rejects.toThrow(/already exists/i);

    expect(await prisma.group.count()).toBe(1);
  });

  it("leaves nothing behind when creation fails", async () => {
    await expect(createGroup({ ...validGroup, adminPassword: "short" })).rejects.toThrow();

    expect(await prisma.group.count()).toBe(0);
    expect(await prisma.user.count()).toBe(0);
    expect(await prisma.fineRule.count()).toBe(0);
  });

  it("rejects a bad email and a blank name", async () => {
    await expect(createGroup({ ...validGroup, adminEmail: "nope" })).rejects.toThrow(/email/i);
    await expect(createGroup({ ...validGroup, name: "   " })).rejects.toThrow(/name/i);
  });

  it("keeps each tenant's books entirely separate", async () => {
    const first = await createGroup(validGroup);
    const second = await createGroup({
      ...validGroup,
      name: "Second Group",
      adminEmail: "second@x.test",
    });

    const firstMembers = await prisma.groupMember.count({
      where: { groupId: first.group.id },
    });
    const secondMembers = await prisma.groupMember.count({
      where: { groupId: second.group.id },
    });

    expect(firstMembers).toBe(1);
    expect(secondMembers).toBe(1);
    expect(first.group.id).not.toBe(second.group.id);
  });
});

describe("createCycle", () => {
  it("starts a cycle with the group's own rules", async () => {
    const { group } = await createGroup(validGroup);

    const cycle = await createCycle({
      groupId: group.id,
      name: "2026-27",
      startsOn: utcDate(2026, 4, 1),
      endsOn: utcDate(2027, 3, 31),
      contributionDueDay: 5,
      monthlyInterestRate: "2.50",
      maxRepaymentMonths: 6,
      maxLoanCorpusMultiple: "3.00",
      distributionBase: "CORPUS_PLUS_INTEREST",
      distributeFines: false,
    });

    expect(cycle.status).toBe("ACTIVE");
    expect(cycle.contributionDueDay).toBe(5);
    expect(cycle.monthlyInterestRate.toFixed(2)).toBe("2.50");
    expect(cycle.maxLoanCorpusMultiple.toFixed(2)).toBe("3.00");
    expect(cycle.distributionBase).toBe("CORPUS_PLUS_INTEREST");
    expect(cycle.distributeFines).toBe(false);
  });

  it("refuses a second open cycle, so a payment always has one home", async () => {
    const seeded = await seedGroup();

    await expect(
      createCycle({
        groupId: seeded.group.id,
        name: "Overlapping",
        startsOn: utcDate(2026, 6, 1),
        endsOn: utcDate(2027, 5, 31),
        contributionDueDay: 10,
        monthlyInterestRate: "3.00",
        maxRepaymentMonths: 6,
        maxLoanCorpusMultiple: "2.00",
        distributionBase: "INTEREST_ONLY",
        distributeFines: true,
      })
    ).rejects.toThrow(/still open/i);
  });

  it("rejects settings that would break the calculations", async () => {
    const { group } = await createGroup(validGroup);
    const base = {
      groupId: group.id,
      name: "Bad",
      startsOn: utcDate(2026, 4, 1),
      endsOn: utcDate(2027, 3, 31),
      contributionDueDay: 10,
      monthlyInterestRate: "3.00",
      maxRepaymentMonths: 6,
      maxLoanCorpusMultiple: "2.00",
      distributionBase: "INTEREST_ONLY" as const,
      distributeFines: true,
    };

    // A due day of 30 does not exist in February.
    await expect(createCycle({ ...base, contributionDueDay: 30 })).rejects.toThrow(/due day/i);
    await expect(createCycle({ ...base, endsOn: utcDate(2026, 3, 1) })).rejects.toThrow(/end date/i);
    await expect(createCycle({ ...base, monthlyInterestRate: "-1" })).rejects.toThrow(/interest/i);
    await expect(createCycle({ ...base, maxLoanCorpusMultiple: "0" })).rejects.toThrow(/limit/i);
  });
});

describe("updateCycle", () => {
  it("changes the rules for an open cycle", async () => {
    const seeded = await seedGroup();

    const updated = await updateCycle({
      groupId: seeded.group.id,
      cycleId: seeded.cycle.id,
      name: "Renamed",
      startsOn: utcDate(2026, 1, 1),
      endsOn: utcDate(2026, 12, 31),
      contributionDueDay: 7,
      monthlyInterestRate: "4.00",
      maxRepaymentMonths: 9,
      maxLoanCorpusMultiple: "2.50",
      distributionBase: "INTEREST_ONLY",
      distributeFines: true,
    });

    expect(updated.name).toBe("Renamed");
    expect(updated.contributionDueDay).toBe(7);
    expect(updated.monthlyInterestRate.toFixed(2)).toBe("4.00");
  });

  it("refuses to change a closed cycle", async () => {
    const seeded = await seedGroup();
    await prisma.cycle.update({
      where: { id: seeded.cycle.id },
      data: { status: "CLOSED" },
    });

    await expect(
      updateCycle({
        groupId: seeded.group.id,
        cycleId: seeded.cycle.id,
        name: "Too late",
        startsOn: utcDate(2026, 1, 1),
        endsOn: utcDate(2026, 12, 31),
        contributionDueDay: 10,
        monthlyInterestRate: "3.00",
        maxRepaymentMonths: 6,
        maxLoanCorpusMultiple: "2.00",
        distributionBase: "INTEREST_ONLY",
        distributeFines: true,
      })
    ).rejects.toThrow(/closed cycle/i);
  });

  it("refuses a cycle belonging to another group", async () => {
    const seeded = await seedGroup();
    const other = await seedGroup({ name: "Other", adminEmail: "g1@x.test" });

    await expect(
      updateCycle({
        groupId: other.group.id,
        cycleId: seeded.cycle.id,
        name: "Not mine",
        startsOn: utcDate(2026, 1, 1),
        endsOn: utcDate(2026, 12, 31),
        contributionDueDay: 10,
        monthlyInterestRate: "3.00",
        maxRepaymentMonths: 6,
        maxLoanCorpusMultiple: "2.00",
        distributionBase: "INTEREST_ONLY",
        distributeFines: true,
      })
    ).rejects.toThrow();
  });
});

describe("updateFineRule", () => {
  it("saves new settings without rewriting past months", async () => {
    const seeded = await seedGroup();
    const rule = await prisma.fineRule.findFirstOrThrow({
      where: { groupId: seeded.group.id, appliesTo: "CONTRIBUTION" },
    });

    await updateFineRule({
      groupId: seeded.group.id,
      fineRuleId: rule.id,
      fixedPerDayPaise: rupeesToPaise("25"),
      graceDays: 5,
      maxFineDays: 30,
      distributeFine: false,
      active: true,
    });

    const after = await prisma.fineRule.findUniqueOrThrow({ where: { id: rule.id } });
    expect(decimalToPaise(after.fixedPerDay)).toBe(rupeesToPaise("25"));
    expect(after.graceDays).toBe(5);
    expect(after.maxFineDays).toBe(30);
    expect(after.distributeFine).toBe(false);
  });

  it("rejects nonsense settings", async () => {
    const seeded = await seedGroup();
    const rule = await prisma.fineRule.findFirstOrThrow({
      where: { groupId: seeded.group.id, appliesTo: "CONTRIBUTION" },
    });
    const base = {
      groupId: seeded.group.id,
      fineRuleId: rule.id,
      fixedPerDayPaise: rupeesToPaise("10"),
      graceDays: 0,
      maxFineDays: 0,
      distributeFine: true,
      active: true,
    };

    await expect(updateFineRule({ ...base, fixedPerDayPaise: -100 })).rejects.toThrow(/negative/i);
    await expect(updateFineRule({ ...base, graceDays: -1 })).rejects.toThrow(/grace/i);
  });

  it("refuses a rule belonging to another group", async () => {
    const seeded = await seedGroup();
    const other = await seedGroup({ name: "Other", adminEmail: "g2@x.test" });
    const rule = await prisma.fineRule.findFirstOrThrow({
      where: { groupId: seeded.group.id, appliesTo: "CONTRIBUTION" },
    });

    await expect(
      updateFineRule({
        groupId: other.group.id,
        fineRuleId: rule.id,
        fixedPerDayPaise: rupeesToPaise("99"),
        graceDays: 0,
        maxFineDays: 0,
        distributeFine: true,
        active: true,
      })
    ).rejects.toThrow();
  });
});
