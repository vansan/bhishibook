const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  console.log("Starting correction for Santosh Teli and Tanaji Sandugade...");

  const result = await prisma.$transaction(async (tx) => {
    // 1. Fetch Santosh Teli and Tanaji Sandugade
    const santosh = await tx.groupMember.findFirstOrThrow({
      where: { displayName: "Santosh Teli" },
      include: { contributions: true },
    });

    const tanaji = await tx.groupMember.findFirstOrThrow({
      where: { displayName: "Tanaji Sandugade" },
      include: { contributions: true },
    });

    console.log(`Santosh Teli ID: ${santosh.id}, Current Shares: ${santosh.shareCount}, Hafta: ${santosh.monthlyHafta}`);
    console.log(`Tanaji Sandugade ID: ${tanaji.id}, Current Shares: ${tanaji.shareCount}, Hafta: ${tanaji.monthlyHafta}`);

    // 2. Ensure member records have correct shareCount & monthlyHafta
    await tx.groupMember.update({
      where: { id: santosh.id },
      data: {
        shareCount: 1,
        monthlyHafta: "1000.00",
      },
    });

    await tx.groupMember.update({
      where: { id: tanaji.id },
      data: {
        shareCount: 2,
        monthlyHafta: "2000.00",
      },
    });

    // 3. Update Santosh Teli contributions: 1000 due, 1000 paid
    const santoshContribIds = santosh.contributions.map((c) => c.id);
    await tx.contribution.updateMany({
      where: { id: { in: santoshContribIds } },
      data: {
        amountDue: "1000.00",
        amountPaid: "1000.00",
      },
    });

    // Update Santosh Teli receipts
    await tx.receipt.updateMany({
      where: { contributionId: { in: santoshContribIds } },
      data: {
        amount: "1000.00",
        whatsappText: "पावती: संतोष तेली यांच्याकडून ₹1000 हप्ता जमा.",
      },
    });

    // Update Santosh Teli ledger entries
    await tx.ledgerEntry.updateMany({
      where: { referenceId: { in: santoshContribIds } },
      data: {
        amount: "1000.00",
      },
    });

    // 4. Update Tanaji Sandugade contributions: 2000 due, 2000 paid
    const tanajiContribIds = tanaji.contributions.map((c) => c.id);
    await tx.contribution.updateMany({
      where: { id: { in: tanajiContribIds } },
      data: {
        amountDue: "2000.00",
        amountPaid: "2000.00",
      },
    });

    // Update Tanaji Sandugade receipts
    await tx.receipt.updateMany({
      where: { contributionId: { in: tanajiContribIds } },
      data: {
        amount: "2000.00",
        whatsappText: "पावती: तानाजी संदुगडे यांच्याकडून ₹2000 हप्ता जमा.",
      },
    });

    // Update Tanaji Sandugade ledger entries
    await tx.ledgerEntry.updateMany({
      where: { referenceId: { in: tanajiContribIds } },
      data: {
        amount: "2000.00",
      },
    });

    return {
      santoshContribsUpdated: santoshContribIds.length,
      tanajiContribsUpdated: tanajiContribIds.length,
    };
  });

  console.log("Database update successful!", result);

  // Verification query
  const santoshAfter = await prisma.groupMember.findFirst({
    where: { displayName: "Santosh Teli" },
    include: { contributions: true },
  });
  const tanajiAfter = await prisma.groupMember.findFirst({
    where: { displayName: "Tanaji Sandugade" },
    include: { contributions: true },
  });

  const santoshTotalPaid = santoshAfter.contributions.reduce((sum, c) => sum + Number(c.amountPaid), 0);
  const tanajiTotalPaid = tanajiAfter.contributions.reduce((sum, c) => sum + Number(c.amountPaid), 0);

  console.log(`Santosh Teli: Shares=${santoshAfter.shareCount}, Hafta=${santoshAfter.monthlyHafta}, Total Paid=₹${santoshTotalPaid}`);
  console.log(`Tanaji Sandugade: Shares=${tanajiAfter.shareCount}, Hafta=${tanajiAfter.monthlyHafta}, Total Paid=₹${tanajiTotalPaid}`);

  const allContribs = await prisma.contribution.findMany({ select: { amountPaid: true } });
  const totalGroupPaid = allContribs.reduce((sum, c) => sum + Number(c.amountPaid), 0);
  console.log(`Total Group Paid across all 33 members (11 months): ₹${totalGroupPaid.toLocaleString()}`);
}

main()
  .catch((err) => {
    console.error("Error executing fix:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
