const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

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
  "MaitriNidhi Admin"
];

async function main() {
  const superadmin = await prisma.user.upsert({
    where: { email: "superadmin@bhishibook.local" },
    update: {},
    create: {
      email: "superadmin@bhishibook.local",
      name: "BhishiBook Superadmin",
      role: "SUPER_ADMIN",
      preferredLang: "en"
    }
  });

  const groupAdmin = await prisma.user.upsert({
    where: { email: "admin@maitrinidhi.local" },
    update: {},
    create: {
      email: "admin@maitrinidhi.local",
      name: "MaitriNidhi Admin",
      role: "GROUP_ADMIN",
      preferredLang: "mr"
    }
  });

  const group = await prisma.group.upsert({
    where: { id: "00000000-0000-0000-0000-000000000111" },
    update: {
      name: "MaitriNidhi",
      platformName: "BhishiBook",
      status: "ACTIVE",
      planStatus: "FREE"
    },
    create: {
      id: "00000000-0000-0000-0000-000000000111",
      name: "MaitriNidhi",
      platformName: "BhishiBook",
      status: "ACTIVE",
      planStatus: "FREE",
      defaultLang: "mr",
      currency: "INR"
    }
  });

  await prisma.cycle.upsert({
    where: { id: "00000000-0000-0000-0000-000000000222" },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-000000000222",
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
      distributeFines: true
    }
  });

  await prisma.fineRule.createMany({
    data: [
      {
        groupId: group.id,
        name: "Contribution fine after 10th",
        appliesTo: "CONTRIBUTION",
        fixedPerDay: "10.00",
        graceDays: 10,
        distributeFine: true
      },
      {
        groupId: group.id,
        name: "Monthly interest fine after 10th",
        appliesTo: "INTEREST",
        fixedPerDay: "10.00",
        graceDays: 10,
        distributeFine: true
      }
    ],
    skipDuplicates: true
  });

  for (const [index, name] of classmates.entries()) {
    const isDoubleShare = index >= 31;
    await prisma.groupMember.upsert({
      where: {
        id: `00000000-0000-0000-0000-${String(index + 1).padStart(12, "0")}`
      },
      update: {},
      create: {
        id: `00000000-0000-0000-0000-${String(index + 1).padStart(12, "0")}`,
        groupId: group.id,
        userId: name === "MaitriNidhi Admin" ? groupAdmin.id : null,
        displayName: name,
        shareCount: isDoubleShare ? 2 : 1,
        monthlyHafta: isDoubleShare ? "2000.00" : "1000.00",
        status: "ACTIVE"
      }
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
        monthlyCollection: 35000
      }
    }
  });

  console.log("Seeded BhishiBook demo data for MaitriNidhi.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
