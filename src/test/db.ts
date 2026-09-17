import { prisma } from "@/lib/prisma";
import { rupeesToPaise } from "@/lib/money";
import { createGroup } from "@/lib/services/groups";
import { utcDate } from "@/lib/finance";

/**
 * Helpers for the integration tests.
 *
 * A guard runs before anything is truncated: these tests wipe every table, so
 * pointing them at the development database by accident would destroy real
 * group data. Better to refuse loudly than to be careful by convention.
 */

const TABLES = [
  "AuditLog",
  "FinalDistribution",
  "PeriodLock",
  "Receipt",
  "ReceiptCounter",
  "LedgerEntry",
  "Fine",
  "FineRule",
  "LoanRepayment",
  "InterestDue",
  "Loan",
  "Contribution",
  "Cycle",
  "GroupMember",
  "Group",
  "User",
];

function assertTestDatabase(): void {
  const url = process.env.DATABASE_URL ?? "";
  if (!/_test(\?|$)/.test(url)) {
    throw new Error(
      `Refusing to truncate: DATABASE_URL must point at a database ending in "_test", got "${url}"`
    );
  }
}

export async function resetDatabase(): Promise<void> {
  assertTestDatabase();
  const list = TABLES.map((table) => `"${table}"`).join(", ");
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE;`);
}

export async function disconnect(): Promise<void> {
  await prisma.$disconnect();
}

/**
 * A group with an admin, a cycle, and some members, which is the starting
 * point for nearly every test.
 */
export async function seedGroup(options?: {
  name?: string;
  adminEmail?: string;
  finePerDay?: string;
  members?: Array<{ name: string; shares: number; hafta: string }>;
  cycle?: {
    startsOn?: Date;
    endsOn?: Date;
    contributionDueDay?: number;
    monthlyInterestRate?: string;
    maxRepaymentMonths?: number;
    maxLoanCorpusMultiple?: string;
    distributionBase?: "INTEREST_ONLY" | "CORPUS_PLUS_INTEREST";
    distributeFines?: boolean;
  };
}) {
  const name = options?.name ?? "Test Bhishi";
  const { group, admin } = await createGroup({
    name,
    defaultLang: "en",
    currency: "INR",
    adminName: `${name} Admin`,
    adminEmail: options?.adminEmail ?? `admin@${name.toLowerCase().replace(/\W+/g, "")}.test`,
    adminPassword: "testing1234",
    finePerDayPaise: rupeesToPaise(options?.finePerDay ?? "10"),
  });

  const cycle = await prisma.cycle.create({
    data: {
      groupId: group.id,
      name: "Test Cycle",
      startsOn: options?.cycle?.startsOn ?? utcDate(2026, 1, 1),
      endsOn: options?.cycle?.endsOn ?? utcDate(2026, 12, 31),
      status: "ACTIVE",
      contributionDueDay: options?.cycle?.contributionDueDay ?? 10,
      monthlyInterestRate: options?.cycle?.monthlyInterestRate ?? "3.00",
      maxRepaymentMonths: options?.cycle?.maxRepaymentMonths ?? 6,
      maxLoanCorpusMultiple: options?.cycle?.maxLoanCorpusMultiple ?? "2.00",
      distributionBase: options?.cycle?.distributionBase ?? "INTEREST_ONLY",
      distributeFines: options?.cycle?.distributeFines ?? true,
    },
  });

  // The admin's own member row is created by createGroup with a zero hafta;
  // give it a real one so it behaves like an ordinary member.
  await prisma.groupMember.updateMany({
    where: { groupId: group.id, userId: admin.id },
    data: { monthlyHafta: "1000.00", joinedAt: utcDate(2026, 1, 1) },
  });

  const requested = options?.members ?? [
    { name: "Member One", shares: 1, hafta: "1000.00" },
    { name: "Member Two", shares: 2, hafta: "2000.00" },
  ];

  const members = await Promise.all(
    requested.map((member) =>
      prisma.groupMember.create({
        data: {
          groupId: group.id,
          displayName: member.name,
          shareCount: member.shares,
          monthlyHafta: member.hafta,
          status: "ACTIVE",
          joinedAt: options?.cycle?.startsOn ?? utcDate(2026, 1, 1),
        },
      })
    )
  );

  return { group, admin, cycle, members };
}

/** The contribution row for one member in one month. */
export async function contributionFor(
  cycleId: string,
  memberId: string,
  year: number,
  month: number
) {
  return prisma.contribution.findFirstOrThrow({
    where: { cycleId, memberId, year, month },
  });
}
