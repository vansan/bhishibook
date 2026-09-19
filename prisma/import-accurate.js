const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const GROUP_ID = "00000000-0000-0000-0000-000000000111";
const CYCLE_ID = "00000000-0000-0000-0000-000000000222";

const memberId = (index) =>
  `00000000-0000-0000-0000-${String(index + 1).padStart(12, "0")}`;

// All 33 members with verified English, Marathi, Standardized Mobile & Shares
const MEMBERS = [
  { index: 0, en: "Sampat Desai", mr: "संपत देसाई", phone: "+91 90757 01955", shares: 1 },
  { index: 1, en: "Ravindra Swami", mr: "रविंद्र स्वामी", phone: "+91 83788 12542", shares: 1 },
  { index: 2, en: "Pandurang Patil (Lic Nitavade)", mr: "पांडुरंग पाटील (एलआयसी नितवडे)", phone: "+91 95033 35339", shares: 1 },
  { index: 3, en: "Satish Jadhav", mr: "सतीश जाधव", phone: "+91 92700 91799", shares: 1 },
  { index: 4, en: "Sanjay Gurav (Kadgaon)", mr: "संजय गुरव (कडगांव)", phone: "+91 82080 59375", shares: 2, isAdmin: true },
  { index: 5, en: "Dasharath Jadhav", mr: "दशरथ जाधव", phone: "+91 78752 52140", shares: 1 },
  { index: 6, en: "Sunil Nalawade", mr: "सुनील नलवडे", phone: "+91 99707 51691", shares: 1 },
  { index: 7, en: "Suresh Misalkar", mr: "सुरेश मिसाळकर", phone: "+91 91680 56898", shares: 1 },
  { index: 8, en: "Ambadas Desai", mr: "अंबादास देसाई", phone: "+91 75075 16999", shares: 1 },
  { index: 9, en: "Santosh Teli", mr: "संतोष तेली", phone: "+91 96899 94994", shares: 2 },
  { index: 10, en: "Deepak Desai (Munim)", mr: "दीपक देसाई (मुनीम)", phone: "+91 98905 99539", shares: 1 },
  { index: 11, en: "Ramesh Bhat", mr: "रमेश भट", phone: "+91 98196 30717", shares: 1 },
  { index: 12, en: "Dr. Vijay Kumbhar", mr: "डॉ. विजय कुंभार", phone: "+91 97650 24303", shares: 1 },
  { index: 13, en: "Pandu Gurav", mr: "पांडू गुरव", phone: "+91 80071 51381", shares: 1 },
  { index: 14, en: "Datta Shinde", mr: "दत्ता शिंदे", phone: "+91 95520 74803", shares: 1 },
  { index: 15, en: "Ravindra Bharmal", mr: "रविंद्र भारमल", phone: "+91 99709 90316", shares: 1 },
  { index: 16, en: "Satappa Sutar", mr: "सताप्पा सुतार", phone: "+91 99608 04737", shares: 1 },
  { index: 17, en: "Tanaji Daware (Nivruti Daware)", mr: "तानाजी डावरे (निवृत्ती डावरे)", phone: "+91 88059 98606", shares: 1 },
  { index: 18, en: "Santosh Mengane (President)", mr: "संतोष मेंगणे (अध्यक्ष)", phone: "+91 77439 28181", shares: 1 },
  { index: 19, en: "Sunil Desai", mr: "सुनील देसाई", phone: "+91 99225 69822", shares: 1 },
  { index: 20, en: "Tanaji Sandugade", mr: "तानाजी संदुगडे", phone: "+91 88059 98606", shares: 1 },
  { index: 21, en: "Anand More", mr: "आनंद मोरे", phone: "+91 99705 17997", shares: 1 },
  { index: 22, en: "Sarjerav Kalambekar", mr: "सर्जेराव कळंबेकर", phone: "+91 96733 61211", shares: 1 },
  { index: 23, en: "Santaji Desai", mr: "संताजी देसाई", phone: "+91 94212 00654", shares: 1 },
  { index: 24, en: "Murad Shaikh", mr: "मुराद शेख", phone: "+971 52 662 1431", shares: 1 },
  { index: 25, en: "Amar Chavan", mr: "अमर चव्हाण", phone: "+91 98237 45382", shares: 1 },
  { index: 26, en: "Pandurang Patil Nandolikar", mr: "पांडुरंग पाटील नांदोलीकर", phone: "+91 98905 95113", shares: 1 },
  { index: 27, en: "Bhikaji Madhav", mr: "भिकाजी माधव", phone: "+91 98226 99645", shares: 1 },
  { index: 28, en: "Ravi Gurav Akurde", mr: "रवी गुरव आकुर्डे", phone: "+91 95450 64659", shares: 1 },
  { index: 29, en: "Vijay Patil", mr: "विजय पाटील", phone: "+91 77439 11477", shares: 1 },
  { index: 30, en: "Madhukar Powar", mr: "मधुकर पोवार", phone: "+91 80077 20583", shares: 1 },
  { index: 31, en: "Raju Kalyankar", mr: "राजू कल्याणकर", phone: "+91 84839 85110", shares: 1 },
  { index: 32, en: "Tukaram Karval", mr: "तुकाराम कारवळ", phone: "+91 77963 16078", shares: 1 },
];

// Months list (Nov 2025 to Sep 2026 = 11 months)
const MONTHS = [
  { month: 11, year: 2025 },
  { month: 12, year: 2025 },
  { month: 1, year: 2026 },
  { month: 2, year: 2026 },
  { month: 3, year: 2026 },
  { month: 4, year: 2026 },
  { month: 5, year: 2026 },
  { month: 6, year: 2026 },
  { month: 7, year: 2026 },
  { month: 8, year: 2026 },
  { month: 9, year: 2026 },
];

// Verified Loans from Excel "Loan Jamin" sheet
const LOANS = [
  { memberEn: "Deepak Desai (Munim)", amount: 15000, date: "2025-11-28", jamin: "Self", repaid: 15000 },
  { memberEn: "Satappa Sutar", amount: 50000, date: "2025-12-20", jamin: "Not stated", repaid: 50000 },
  { memberEn: "Sampat Desai", amount: 30000, date: "2026-01-06", jamin: "Not stated", repaid: 0 },
  { memberEn: "Pandurang Patil Nandolikar", amount: 49000, date: "2026-02-16", jamin: "Not stated", repaid: 0 },
  { memberEn: "Bhikaji Madhav", amount: 39000, date: "2026-03-13", jamin: "Santosh Teli, Madhukar Powar", repaid: 0 },
  { memberEn: "Pandu Gurav", amount: 40000, date: "2026-03-18", jamin: "2 guarantors", repaid: 35000 },
  { memberEn: "Datta Shinde", amount: 10000, date: "2026-04-08", jamin: "Satish Jadhav, Ambadas Desai", repaid: 0 },
  { memberEn: "Santosh Mengane (President)", amount: 50000, date: "2026-04-09", jamin: "Cheque given", repaid: 0 },
  { memberEn: "Anand More", amount: 56000, date: "2026-05-14", jamin: "R. Swami, S. Misalkar, D. Desai, S. Teli", repaid: 0 },
  { memberEn: "Ravindra Swami", amount: 12000, date: "2026-05-20", jamin: "Self", repaid: 0 },
  { memberEn: "Sanjay Gurav (Kadgaon)", amount: 40000, date: "2026-06-06", jamin: "Self", repaid: 0 },
  { memberEn: "Madhukar Powar", amount: 20000, date: "2026-07-07", jamin: "Self", repaid: 0 },
];

async function main() {
  console.log("=== STARTING ACCURATE MIGRATION FOR 96/97 KH भिशी - MaitriNidhi ===");

  // 1. Group Admin User (Sanjay Gurav)
  const { hashPassword } = require("../src/lib/password.ts");
  const passwordHash = await hashPassword("bhishi1234");

  const adminUser = await prisma.user.upsert({
    where: { email: "admin@maitrinidhi.local" },
    update: {
      name: "Sanjay Gurav (Kadgaon)",
      role: "GROUP_ADMIN",
      isActive: true,
      preferredLang: "mr",
      passwordHash,
    },
    create: {
      email: "admin@maitrinidhi.local",
      name: "Sanjay Gurav (Kadgaon)",
      role: "GROUP_ADMIN",
      preferredLang: "mr",
      passwordHash,
      isActive: true,
    },
  });
  console.log("Admin User setup:", adminUser.email, adminUser.name);

  // 2. Ensure Group exists
  const group = await prisma.group.upsert({
    where: { id: GROUP_ID },
    update: {
      name: "96/97 KH भिशी - MaitriNidhi",
      defaultLang: "mr",
      status: "ACTIVE",
    },
    create: {
      id: GROUP_ID,
      name: "96/97 KH भिशी - MaitriNidhi",
      platformName: "BhishiBook",
      defaultLang: "mr",
      currency: "INR",
      status: "ACTIVE",
    },
  });

  // 3. Ensure Cycle exists
  const cycle = await prisma.cycle.upsert({
    where: { id: CYCLE_ID },
    update: {
      name: "2025-2026 Cycle",
      startsOn: new Date("2025-11-01T00:00:00.000Z"),
      endsOn: new Date("2026-10-31T23:59:59.000Z"),
      status: "ACTIVE",
      monthlyInterestRate: 3.0,
    },
    create: {
      id: CYCLE_ID,
      groupId: GROUP_ID,
      name: "2025-2026 Cycle",
      startsOn: new Date("2025-11-01T00:00:00.000Z"),
      endsOn: new Date("2026-10-31T23:59:59.000Z"),
      status: "ACTIVE",
      contributionDueDay: 10,
      monthlyInterestRate: 3.0,
      maxRepaymentMonths: 6,
      maxLoanCorpusMultiple: 2.0,
    },
  });

  // 4. Clean previous child data for this cycle so receipt counters and relations stay 100% consistent
  console.log("Clearing existing receipts, ledger, repayments, loans, and contributions...");
  await prisma.receipt.deleteMany({ where: { cycleId: CYCLE_ID } });
  await prisma.ledgerEntry.deleteMany({ where: { cycleId: CYCLE_ID } });
  await prisma.interestDue.deleteMany({ where: { cycleId: CYCLE_ID } });
  await prisma.loanRepayment.deleteMany({ where: { loan: { cycleId: CYCLE_ID } } });
  await prisma.loan.deleteMany({ where: { cycleId: CYCLE_ID } });
  await prisma.contribution.deleteMany({ where: { cycleId: CYCLE_ID } });
  await prisma.groupMember.deleteMany({ where: { groupId: GROUP_ID } });

  // 5. Re-create Receipt Counter
  await prisma.receiptCounter.upsert({
    where: { groupId: GROUP_ID },
    update: { nextNumber: 1 },
    create: { groupId: GROUP_ID, nextNumber: 1 },
  });

  let receiptNum = 1;
  function nextReceiptNumber() {
    const num = String(receiptNum).padStart(5, "0");
    receiptNum++;
    return `REC-${num}`;
  }

  // 6. Insert all 33 members with exact IDs
  console.log("Inserting all 33 members with Marathi names and standardized phone numbers...");
  const memberMap = new Map();

  for (const m of MEMBERS) {
    const id = memberId(m.index);
    const created = await prisma.groupMember.create({
      data: {
        id,
        groupId: GROUP_ID,
        displayName: m.en,
        displayNameMr: m.mr,
        phone: m.phone,
        shareCount: m.shares,
        monthlyHafta: m.shares * 1000,
        status: "ACTIVE",
        userId: m.isAdmin ? adminUser.id : null,
        email: m.isAdmin ? adminUser.email : null,
      },
    });
    memberMap.set(m.en, created);
    console.log(`[${m.index + 1}] ID: ${id.slice(-4)} | ${created.displayName} | ${created.displayNameMr} | ${created.phone} | Shares: ${created.shareCount} ${m.isAdmin ? "(ADMIN)" : ""}`);
  }

  // 7. Insert 363 Contributions (33 members × 11 months = ₹3,85,000)
  console.log("Generating 363 contributions, ledger entries, and receipts...");
  let totalContribAmount = 0;

  for (const m of MEMBERS) {
    const mem = memberMap.get(m.en);
    const monthlyDue = m.shares * 1000;

    for (const mo of MONTHS) {
      const contrib = await prisma.contribution.create({
        data: {
          cycleId: CYCLE_ID,
          memberId: mem.id,
          month: mo.month,
          year: mo.year,
          amountDue: monthlyDue,
          amountPaid: monthlyDue,
          paidOn: new Date(mo.year, mo.month - 1, 5),
          notes: `Hafta for ${mo.month}/${mo.year}`,
        },
      });

      totalContribAmount += monthlyDue;

      // Receipt
      await prisma.receipt.create({
        data: {
          receiptNo: nextReceiptNumber(),
          groupId: GROUP_ID,
          cycleId: CYCLE_ID,
          memberId: mem.id,
          contributionId: contrib.id,
          receiptType: "CONTRIBUTION",
          amount: monthlyDue,
          issuedAt: new Date(mo.year, mo.month - 1, 5),
          whatsappText: `पावती: ${mem.displayNameMr || mem.displayName} यांच्याकडून ₹${monthlyDue} हप्ता जमा.`,
        },
      });

      // Double-entry Ledger
      await prisma.ledgerEntry.create({
        data: {
          groupId: GROUP_ID,
          cycleId: CYCLE_ID,
          entryType: "CONTRIBUTION",
          amount: monthlyDue,
          entryDate: new Date(mo.year, mo.month - 1, 5),
          referenceType: "CONTRIBUTION",
          referenceId: contrib.id,
          description: `Hafta: ${mem.displayName} (${mo.month}/${mo.year})`,
        },
      });
    }
  }
  console.log(`Total Contributions Created: 363 (₹${totalContribAmount.toLocaleString()})`);

  // 8. Insert 12 Loans
  console.log("Inserting 12 loans with exact members and dates...");
  let totalLoanDisbursed = 0;
  let totalLoanRepaid = 0;

  for (let i = 0; i < LOANS.length; i++) {
    const lData = LOANS[i];
    const mem = memberMap.get(lData.memberEn);
    if (!mem) throw new Error(`Member not found: ${lData.memberEn}`);

    const isClosed = lData.repaid >= lData.amount;
    const loan = await prisma.loan.create({
      data: {
        cycleId: CYCLE_ID,
        memberId: mem.id,
        principal: lData.amount,
        disbursedOn: new Date(`${lData.date}T00:00:00.000Z`),
        dueOn: new Date(new Date(`${lData.date}T00:00:00.000Z`).getTime() + 180 * 24 * 3600 * 1000), // 6 months
        interestRate: 3.0,
        status: isClosed ? "CLOSED" : "ACTIVE",
        principalClosed: isClosed,
        closedOn: isClosed ? new Date("2026-08-31T00:00:00.000Z") : null,
        notes: `Jamin / Guarantor: ${lData.jamin}`,
      },
    });

    totalLoanDisbursed += lData.amount;

    // Loan Disbursement Receipt
    await prisma.receipt.create({
      data: {
        receiptNo: nextReceiptNumber(),
        groupId: GROUP_ID,
        cycleId: CYCLE_ID,
        memberId: mem.id,
        loanId: loan.id,
        receiptType: "LOAN",
        amount: lData.amount,
        issuedAt: new Date(`${lData.date}T00:00:00.000Z`),
        whatsappText: `कर्ज वितरण पावती: ${mem.displayNameMr || mem.displayName} यांना ₹${lData.amount.toLocaleString()} कर्ज वितरित केले. जामीनदार: ${lData.jamin}`,
      },
    });

    // Ledger for Loan Disbursement
    await prisma.ledgerEntry.create({
      data: {
        groupId: GROUP_ID,
        cycleId: CYCLE_ID,
        entryType: "LOAN_DISBURSEMENT",
        amount: lData.amount,
        entryDate: new Date(`${lData.date}T00:00:00.000Z`),
        referenceType: "LOAN",
        referenceId: loan.id,
        description: `Loan disbursed to ${mem.displayName} (Jamin: ${lData.jamin})`,
      },
    });

    // If repaid, record repayment
    if (lData.repaid > 0) {
      const repay = await prisma.loanRepayment.create({
        data: {
          loanId: loan.id,
          memberId: mem.id,
          principalAmount: lData.repaid,
          interestAmount: 0,
          fineAmount: 0,
          paidOn: new Date("2026-08-31T00:00:00.000Z"),
          notes: `Principal repayment: ₹${lData.repaid.toLocaleString()}`,
        },
      });

      totalLoanRepaid += lData.repaid;

      // Receipt for repayment
      await prisma.receipt.create({
        data: {
          receiptNo: nextReceiptNumber(),
          groupId: GROUP_ID,
          cycleId: CYCLE_ID,
          memberId: mem.id,
          repaymentId: repay.id,
          receiptType: "REPAYMENT",
          amount: lData.repaid,
          issuedAt: new Date("2026-08-31T00:00:00.000Z"),
          whatsappText: `कर्ज परतफेड पावती: ${mem.displayNameMr || mem.displayName} यांच्याकडून मुद्दल परतफेड ₹${lData.repaid.toLocaleString()} जमा.`,
        },
      });

      // Ledger for Repayment
      await prisma.ledgerEntry.create({
        data: {
          groupId: GROUP_ID,
          cycleId: CYCLE_ID,
          entryType: "PRINCIPAL_REPAYMENT",
          amount: lData.repaid,
          entryDate: new Date("2026-08-31T00:00:00.000Z"),
          referenceType: "REPAYMENT",
          referenceId: repay.id,
          description: `Principal repayment by ${mem.displayName}`,
        },
      });
    }

    console.log(`Loan #${i + 1}: ${mem.displayName} | Disbursed: ₹${lData.amount.toLocaleString()} | Repaid: ₹${lData.repaid.toLocaleString()} | Jamin: ${lData.jamin}`);
  }

  // Update Receipt Counter
  await prisma.receiptCounter.update({
    where: { groupId: GROUP_ID },
    data: { nextNumber: receiptNum },
  });

  console.log("\n=== MIGRATION COMPLETE ===");
  console.log(`Members: 33`);
  console.log(`Contributions: 363 (₹${totalContribAmount.toLocaleString()})`);
  console.log(`Loans Disbursed: 12 (₹${totalLoanDisbursed.toLocaleString()})`);
  console.log(`Loans Repaid: 3 (₹${totalLoanRepaid.toLocaleString()})`);
  console.log(`Active Loan Principal: ₹${(totalLoanDisbursed - totalLoanRepaid).toLocaleString()}`);
  console.log(`Total Receipts Minted: ${receiptNum - 1}`);
  console.log(`Sanjay Gurav (कडगांव) [8208059375] is active Group Admin!`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
