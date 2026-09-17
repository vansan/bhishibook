const { PrismaClient } = require("@prisma/client");
// Node strips the types on require, so the app and the seed share exactly one
// password implementation rather than duplicating the scrypt parameters.
const { hashPassword } = require("../src/lib/password.ts");

const prisma = new PrismaClient();

const GROUP_ID = "00000000-0000-0000-0000-000000000111";
const CYCLE_ID = "00000000-0000-0000-0000-000000000222";

/** Development-only password for the demo logins. */
const DEMO_PASSWORD = "bhishi1234";

const classmates = [
  "Amit Patil",
  "Santosh Jadhav",
  "Rahul Shinde",
  "Sachin Pawar",
  "Nilesh More",
  "Pravin Kadam",
  "Mahesh Deshmukh",
  "Vikas Chavan",
  "Sandeep Gaikwad",
  "Ajay Bhosale",
  "Rohit Nikam",
  "Ganesh Salunkhe",
  "Kiran Mane",
  "Prasad Kulkarni",
  "Sunil Wagh",
  "Yogesh Kumbhar",
  "Deepak Sawant",
  "Ramesh Lokhande",
  "Anil Ghorpade",
  "Tushar Kale",
  "Vijay Rathod",
  "Mangesh Thorat",
  "Sagar Dhane",
  "Akshay Sonawane",
  "Swapnil Koli",
  "Pankaj Mahajan",
  "Rajesh Landge",
  "Bhushan Mali",
  "Atul Kamble",
  "Sameer Inamdar",
  "Omkar Joshi",
  "Sanjay Pawar",
  "MaitriNidhi Admin",
];

const memberId = (index) =>
  `00000000-0000-0000-0000-${String(index + 1).padStart(12, "0")}`;

async function main() {
  const passwordHash = await hashPassword(DEMO_PASSWORD);

  const superadmin = await prisma.user.upsert({
    where: { email: "superadmin@bhishibook.local" },
    update: { passwordHash, isActive: true },
    create: {
      email: "superadmin@bhishibook.local",
      name: "BhishiBook Superadmin",
      role: "SUPER_ADMIN",
      preferredLang: "en",
      passwordHash,
    },
  });

  const groupAdmin = await prisma.user.upsert({
    where: { email: "admin@maitrinidhi.local" },
    update: { passwordHash, isActive: true },
    create: {
      email: "admin@maitrinidhi.local",
      name: "MaitriNidhi Admin",
      role: "GROUP_ADMIN",
      preferredLang: "mr",
      passwordHash,
    },
  });

  // One ordinary member with a login, so the member view can be tried out.
  const memberUser = await prisma.user.upsert({
    where: { email: "amit.patil@maitrinidhi.local" },
    update: { passwordHash, isActive: true },
    create: {
      email: "amit.patil@maitrinidhi.local",
      name: "Amit Patil",
      role: "MEMBER",
      preferredLang: "mr",
      passwordHash,
    },
  });

  const group = await prisma.group.upsert({
    where: { id: GROUP_ID },
    update: {
      name: "MaitriNidhi",
      platformName: "BhishiBook",
      status: "ACTIVE",
      planStatus: "FREE",
    },
    create: {
      id: GROUP_ID,
      name: "MaitriNidhi",
      platformName: "BhishiBook",
      status: "ACTIVE",
      planStatus: "FREE",
      defaultLang: "mr",
      currency: "INR",
    },
  });

  // Receipt numbers are minted from this counter, so every group needs one.
  await prisma.receiptCounter.upsert({
    where: { groupId: group.id },
    update: {},
    create: { groupId: group.id, nextNumber: 1 },
  });

  await prisma.cycle.upsert({
    where: { id: CYCLE_ID },
    update: {},
    create: {
      id: CYCLE_ID,
      groupId: group.id,
      name: "2026-2027 Cycle",
      startsOn: new Date("2026-09-01T00:00:00.000Z"),
      endsOn: new Date("2027-08-31T00:00:00.000Z"),
      status: "ACTIVE",
      contributionDueDay: 10,
      monthlyInterestRate: "3.00",
      maxRepaymentMonths: 6,
      maxLoanCorpusMultiple: "2.00",
      distributionBase: "INTEREST_ONLY",
      distributeFines: true,
    },
  });

  // graceDays 0 means the fine starts the day after the due day: hafta is due
  // 1st-10th, so a late payment is charged from the 11th.
  const fineRules = [
    {
      name: "Contribution fine after the 10th",
      appliesTo: "CONTRIBUTION",
      fixedPerDay: "10.00",
    },
    {
      name: "Monthly interest fine after the 10th",
      appliesTo: "INTEREST",
      fixedPerDay: "10.00",
    },
  ];

  for (const rule of fineRules) {
    await prisma.fineRule.upsert({
      where: { groupId_appliesTo: { groupId: group.id, appliesTo: rule.appliesTo } },
      update: { fixedPerDay: rule.fixedPerDay, graceDays: 0, maxFineDays: 0, active: true },
      create: {
        groupId: group.id,
        name: rule.name,
        appliesTo: rule.appliesTo,
        fixedPerDay: rule.fixedPerDay,
        graceDays: 0,
        maxFineDays: 0,
        distributeFine: true,
      },
    });
  }

  for (const [index, name] of classmates.entries()) {
    // The last two members hold two shares each: 31 x 1000 + 2 x 2000 = 35,000.
    const isDoubleShare = index >= 31;

    let userId = null;
    if (name === "MaitriNidhi Admin") userId = groupAdmin.id;
    if (name === "Amit Patil") userId = memberUser.id;

    await prisma.groupMember.upsert({
      where: { id: memberId(index) },
      update: { userId, shareCount: isDoubleShare ? 2 : 1 },
      create: {
        id: memberId(index),
        groupId: group.id,
        userId,
        displayName: name,
        shareCount: isDoubleShare ? 2 : 1,
        monthlyHafta: isDoubleShare ? "2000.00" : "1000.00",
        status: "ACTIVE",
      },
    });
  }

  await prisma.auditLog.create({
    data: {
      actorUserId: superadmin.id,
      groupId: group.id,
      action: "SEED_DEMO_GROUP",
      entityType: "Group",
      entityId: group.id,
      newValue: {
        groupName: group.name,
        memberCount: classmates.length,
        monthlyCollection: 35000,
      },
    },
  });

  console.log("Seeded BhishiBook demo data for MaitriNidhi.");
  console.log(`Logins (password: ${DEMO_PASSWORD}):`);
  console.log("  superadmin@bhishibook.local     Superadmin");
  console.log("  admin@maitrinidhi.local         Group admin");
  console.log("  amit.patil@maitrinidhi.local    Member");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
