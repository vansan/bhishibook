import "server-only";
import type { DistributionBase, GroupStatus, PlanStatus } from "@prisma/client";
import { monthsBetween } from "@/lib/finance";
import { decimalToPaise, paiseToDecimalString, type Paise } from "@/lib/money";
import { hashPassword, MIN_PASSWORD_LENGTH } from "@/lib/password";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "./ledger";

/**
 * Onboarding a group, and the cycle settings that drive every calculation.
 *
 * A group is only usable once it has an admin who can sign in, a receipt
 * counter to mint from, and fine rules for both contribution and interest.
 * Creating those separately would leave a half-built group that fails in
 * confusing ways later, so createGroup does all of it in one transaction.
 */

export type CreateGroupInput = {
  name: string;
  defaultLang: string;
  currency: string;
  adminName: string;
  adminEmail: string;
  adminPassword: string;
  /** Default per-day late fine for both fine types, in paise. */
  finePerDayPaise: Paise;
  actorUserId?: string | null;
};

export async function createGroup(input: CreateGroupInput) {
  const name = input.name.trim();
  const adminEmail = input.adminEmail.trim().toLowerCase();
  const adminName = input.adminName.trim();

  if (!name) throw new Error("Group name is required");
  if (!adminName) throw new Error("Admin name is required");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(adminEmail)) {
    throw new Error("Enter a valid admin email address");
  }
  if (input.adminPassword.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
  }
  if (input.finePerDayPaise < 0) throw new Error("Fine per day cannot be negative");

  const existing = await prisma.user.findUnique({
    where: { email: adminEmail },
    select: { id: true },
  });
  if (existing) throw new Error("A user with that email already exists");

  // Hashing is deliberately outside the transaction: scrypt takes ~100ms and
  // holding a database transaction open for it wastes a connection.
  const passwordHash = await hashPassword(input.adminPassword);

  return prisma.$transaction(async (tx) => {
    const group = await tx.group.create({
      data: {
        name,
        platformName: "BhishiBook",
        status: "ACTIVE",
        planStatus: "FREE",
        defaultLang: input.defaultLang === "mr" ? "mr" : "en",
        currency: input.currency.trim().toUpperCase() || "INR",
      },
    });

    const admin = await tx.user.create({
      data: {
        email: adminEmail,
        name: adminName,
        role: "GROUP_ADMIN",
        preferredLang: group.defaultLang,
        passwordHash,
      },
    });

    // The admin is a member of their own group, so they have a passbook too.
    await tx.groupMember.create({
      data: {
        groupId: group.id,
        userId: admin.id,
        displayName: adminName,
        email: adminEmail,
        shareCount: 1,
        monthlyHafta: "0.00",
        status: "ACTIVE",
      },
    });

    await tx.receiptCounter.create({ data: { groupId: group.id, nextNumber: 1 } });

    // Contribution and interest fines are separate rules, as the group rules
    // require, but both start from the same default.
    await tx.fineRule.createMany({
      data: (["CONTRIBUTION", "INTEREST"] as const).map((appliesTo) => ({
        groupId: group.id,
        name:
          appliesTo === "CONTRIBUTION"
            ? "Contribution late fine"
            : "Interest late fine",
        appliesTo,
        fixedPerDay: paiseToDecimalString(input.finePerDayPaise),
        graceDays: 0,
        maxFineDays: 0,
        distributeFine: true,
      })),
    });

    await writeAudit(tx, {
      groupId: group.id,
      actorUserId: input.actorUserId,
      action: "CREATE_GROUP",
      entityType: "Group",
      entityId: group.id,
      newValue: { name: group.name, adminEmail, defaultLang: group.defaultLang },
    });

    return { group, admin };
  });
}

export async function updateGroupStatus(input: {
  groupId: string;
  status: GroupStatus;
  planStatus: PlanStatus;
  actorUserId?: string | null;
}) {
  return prisma.$transaction(async (tx) => {
    const before = await tx.group.findUniqueOrThrow({
      where: { id: input.groupId },
      select: { status: true, planStatus: true, name: true },
    });

    const group = await tx.group.update({
      where: { id: input.groupId },
      data: { status: input.status, planStatus: input.planStatus },
    });

    await writeAudit(tx, {
      groupId: group.id,
      actorUserId: input.actorUserId,
      action: "UPDATE_GROUP_STATUS",
      entityType: "Group",
      entityId: group.id,
      oldValue: { status: before.status, planStatus: before.planStatus },
      newValue: { status: group.status, planStatus: group.planStatus },
    });

    return group;
  });
}

/** Rename a group, or change the language and branding it shows members. */
export async function updateGroupSettings(input: {
  groupId: string;
  name: string;
  defaultLang: string;
  poweredByEnabled: boolean;
  actorUserId?: string | null;
}) {
  const name = input.name.trim();
  if (!name) throw new Error("Group name is required");

  return prisma.$transaction(async (tx) => {
    const before = await tx.group.findUniqueOrThrow({
      where: { id: input.groupId },
      select: { name: true, defaultLang: true, poweredByEnabled: true },
    });

    const group = await tx.group.update({
      where: { id: input.groupId },
      data: {
        name,
        defaultLang: input.defaultLang === "mr" ? "mr" : "en",
        poweredByEnabled: input.poweredByEnabled,
      },
    });

    await writeAudit(tx, {
      groupId: group.id,
      actorUserId: input.actorUserId,
      action: "UPDATE_GROUP_SETTINGS",
      entityType: "Group",
      entityId: group.id,
      oldValue: { ...before },
      newValue: { name: group.name, defaultLang: group.defaultLang },
    });

    return group;
  });
}

export type CycleInput = {
  name: string;
  startsOn: Date;
  endsOn: Date;
  contributionDueDay: number;
  monthlyInterestRate: string;
  maxRepaymentMonths: number;
  maxLoanCorpusMultiple: string;
  distributionBase: DistributionBase;
  distributeFines: boolean;
};

function validateCycle(input: CycleInput): void {
  if (!input.name.trim()) throw new Error("Cycle name is required");
  if (input.endsOn <= input.startsOn) throw new Error("The end date must be after the start date");
  if (input.contributionDueDay < 1 || input.contributionDueDay > 28) {
    // Capped at 28 so the due day exists in every month, February included.
    throw new Error("The due day must be between 1 and 28");
  }
  if (Number(input.monthlyInterestRate) < 0 || Number(input.monthlyInterestRate) > 100) {
    throw new Error("Interest rate must be between 0 and 100 percent");
  }
  if (input.maxRepaymentMonths < 1 || input.maxRepaymentMonths > 60) {
    throw new Error("The repayment window must be between 1 and 60 months");
  }
  if (Number(input.maxLoanCorpusMultiple) <= 0) {
    throw new Error("The borrowing limit must be more than zero");
  }
  if (monthsBetween(input.startsOn, input.endsOn).length > 120) {
    throw new Error("A cycle cannot run longer than 10 years");
  }
}

export async function createCycle(input: CycleInput & {
  groupId: string;
  actorUserId?: string | null;
}) {
  validateCycle(input);

  return prisma.$transaction(async (tx) => {
    // Only one cycle can be taking money at a time, or a payment would not
    // know which cycle it belongs to.
    const open = await tx.cycle.findFirst({
      where: { groupId: input.groupId, status: { in: ["ACTIVE", "DRAFT", "CLOSING"] } },
      select: { id: true, name: true },
    });
    if (open) {
      throw new Error(`"${open.name}" is still open. Close it before starting a new cycle.`);
    }

    const cycle = await tx.cycle.create({
      data: {
        groupId: input.groupId,
        name: input.name.trim(),
        startsOn: input.startsOn,
        endsOn: input.endsOn,
        status: "ACTIVE",
        contributionDueDay: input.contributionDueDay,
        monthlyInterestRate: input.monthlyInterestRate,
        maxRepaymentMonths: input.maxRepaymentMonths,
        maxLoanCorpusMultiple: input.maxLoanCorpusMultiple,
        distributionBase: input.distributionBase,
        distributeFines: input.distributeFines,
      },
    });

    await writeAudit(tx, {
      groupId: input.groupId,
      actorUserId: input.actorUserId,
      action: "CREATE_CYCLE",
      entityType: "Cycle",
      entityId: cycle.id,
      newValue: {
        name: cycle.name,
        startsOn: cycle.startsOn.toISOString(),
        endsOn: cycle.endsOn.toISOString(),
        rate: input.monthlyInterestRate,
      },
    });

    return cycle;
  });
}

export async function updateCycle(input: CycleInput & {
  groupId: string;
  cycleId: string;
  actorUserId?: string | null;
}) {
  validateCycle(input);

  return prisma.$transaction(async (tx) => {
    const before = await tx.cycle.findFirstOrThrow({
      where: { id: input.cycleId, groupId: input.groupId },
      select: {
        name: true,
        status: true,
        contributionDueDay: true,
        monthlyInterestRate: true,
        maxRepaymentMonths: true,
        maxLoanCorpusMultiple: true,
        distributionBase: true,
        distributeFines: true,
      },
    });

    if (before.status === "CLOSED") {
      throw new Error("A closed cycle cannot be changed");
    }

    const cycle = await tx.cycle.update({
      where: { id: input.cycleId },
      data: {
        name: input.name.trim(),
        startsOn: input.startsOn,
        endsOn: input.endsOn,
        contributionDueDay: input.contributionDueDay,
        monthlyInterestRate: input.monthlyInterestRate,
        maxRepaymentMonths: input.maxRepaymentMonths,
        maxLoanCorpusMultiple: input.maxLoanCorpusMultiple,
        distributionBase: input.distributionBase,
        distributeFines: input.distributeFines,
      },
    });

    await writeAudit(tx, {
      groupId: input.groupId,
      actorUserId: input.actorUserId,
      action: "UPDATE_CYCLE",
      entityType: "Cycle",
      entityId: cycle.id,
      oldValue: {
        ...before,
        monthlyInterestRate: before.monthlyInterestRate.toFixed(2),
        maxLoanCorpusMultiple: before.maxLoanCorpusMultiple.toFixed(2),
      },
      newValue: {
        name: cycle.name,
        rate: input.monthlyInterestRate,
        dueDay: input.contributionDueDay,
      },
    });

    return cycle;
  });
}

/**
 * Change a fine rule.
 *
 * Existing Fine rows are not recalculated here. They move when the admin next
 * runs the fine assessment, which keeps the change visible and deliberate
 * rather than silently rewriting history the moment a setting is saved.
 */
export async function updateFineRule(input: {
  groupId: string;
  fineRuleId: string;
  fixedPerDayPaise: Paise;
  graceDays: number;
  maxFineDays: number;
  distributeFine: boolean;
  active: boolean;
  actorUserId?: string | null;
}) {
  if (input.fixedPerDayPaise < 0) throw new Error("Fine per day cannot be negative");
  if (input.graceDays < 0 || input.graceDays > 90) {
    throw new Error("Grace days must be between 0 and 90");
  }
  if (input.maxFineDays < 0 || input.maxFineDays > 3650) {
    throw new Error("The fine cap must be between 0 and 3650 days");
  }

  return prisma.$transaction(async (tx) => {
    const before = await tx.fineRule.findFirstOrThrow({
      where: { id: input.fineRuleId, groupId: input.groupId },
      select: {
        appliesTo: true,
        fixedPerDay: true,
        graceDays: true,
        maxFineDays: true,
        distributeFine: true,
        active: true,
      },
    });

    const rule = await tx.fineRule.update({
      where: { id: input.fineRuleId },
      data: {
        fixedPerDay: paiseToDecimalString(input.fixedPerDayPaise),
        graceDays: input.graceDays,
        maxFineDays: input.maxFineDays,
        distributeFine: input.distributeFine,
        active: input.active,
      },
    });

    await writeAudit(tx, {
      groupId: input.groupId,
      actorUserId: input.actorUserId,
      action: "UPDATE_FINE_RULE",
      entityType: "FineRule",
      entityId: rule.id,
      oldValue: {
        fixedPerDay: decimalToPaise(before.fixedPerDay),
        graceDays: before.graceDays,
        maxFineDays: before.maxFineDays,
        active: before.active,
      },
      newValue: {
        fixedPerDay: input.fixedPerDayPaise,
        graceDays: input.graceDays,
        maxFineDays: input.maxFineDays,
        active: input.active,
      },
    });

    return rule;
  });
}
