-- Adds: password auth on User, monthly InterestDue rows, per-group receipt
-- counters, month locking, year-end default decisions, and the cycle-close
-- FinalDistribution table.
--
-- Hand-written rather than generated because the String -> enum conversions on
-- FineRule.appliesTo and Fine.fineType must use USING casts. The generated
-- version dropped and recreated those columns, which destroys existing rows.

-- CreateEnum
CREATE TYPE "LoanStatus" AS ENUM ('ACTIVE', 'CLOSED', 'DEFAULTED', 'WRITTEN_OFF');

-- CreateEnum
CREATE TYPE "FineTarget" AS ENUM ('CONTRIBUTION', 'INTEREST');

-- CreateEnum
CREATE TYPE "DefaultDecision" AS ENUM ('PENDING', 'RETURN_FULL', 'RETURN_PARTIAL', 'RETURN_NONE', 'CARRY_FORWARD', 'CUSTOM');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "lastLoginAt" TIMESTAMP(3),
ADD COLUMN     "passwordHash" TEXT;

-- AlterTable
ALTER TABLE "Cycle" ADD COLUMN     "closedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "GroupMember" ADD COLUMN     "defaultDecidedAt" TIMESTAMP(3),
ADD COLUMN     "defaultDecision" "DefaultDecision" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "defaultNote" TEXT;

-- AlterTable
ALTER TABLE "Loan" ADD COLUMN     "closedOn" TIMESTAMP(3),
ADD COLUMN     "status" "LoanStatus" NOT NULL DEFAULT 'ACTIVE';

-- Existing loans that were already flagged as principal-closed keep that meaning.
UPDATE "Loan" SET "status" = 'CLOSED' WHERE "principalClosed" = true;

-- AlterTable
ALTER TABLE "LoanRepayment" ADD COLUMN     "fineAmount" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- AlterTable: convert FineRule.appliesTo from TEXT to the FineTarget enum in
-- place. Existing values are already 'CONTRIBUTION' / 'INTEREST'.
ALTER TABLE "FineRule" ALTER COLUMN "appliesTo" TYPE "FineTarget" USING "appliesTo"::"FineTarget";
ALTER TABLE "FineRule" ADD COLUMN     "maxFineDays" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "FineRule" ALTER COLUMN "graceDays" SET DEFAULT 0;

-- The agreed rule is that the 1st-10th window IS the grace: the per-day fine
-- starts on the 11th. The original seed encoded 10 extra grace days.
UPDATE "FineRule" SET "graceDays" = 0 WHERE "graceDays" = 10;

-- AlterTable: same in-place enum conversion for Fine.fineType.
ALTER TABLE "Fine" ALTER COLUMN "fineType" TYPE "FineTarget" USING "fineType"::"FineTarget";
ALTER TABLE "Fine" ADD COLUMN     "amountPaid" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "interestDueId" UUID,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "month" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "year" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Fine" ALTER COLUMN "month" DROP DEFAULT;
ALTER TABLE "Fine" ALTER COLUMN "year" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Receipt" ADD COLUMN     "distributionId" UUID;

-- CreateTable
CREATE TABLE "InterestDue" (
    "id" UUID NOT NULL,
    "cycleId" UUID NOT NULL,
    "loanId" UUID NOT NULL,
    "memberId" UUID NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "amountDue" DECIMAL(12,2) NOT NULL,
    "amountPaid" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "paidOn" TIMESTAMP(3),
    "notes" TEXT,

    CONSTRAINT "InterestDue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReceiptCounter" (
    "groupId" UUID NOT NULL,
    "nextNumber" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "ReceiptCounter_pkey" PRIMARY KEY ("groupId")
);

-- CreateTable
CREATE TABLE "PeriodLock" (
    "id" UUID NOT NULL,
    "groupId" UUID NOT NULL,
    "cycleId" UUID NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "note" TEXT,
    "lockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedById" UUID,

    CONSTRAINT "PeriodLock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinalDistribution" (
    "id" UUID NOT NULL,
    "cycleId" UUID NOT NULL,
    "memberId" UUID NOT NULL,
    "shareCount" INTEGER NOT NULL,
    "corpusContributed" DECIMAL(12,2) NOT NULL,
    "interestShare" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "fineShare" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "corpusReturned" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "deductions" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "payoutAmount" DECIMAL(12,2) NOT NULL,
    "notes" TEXT,
    "paidOn" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinalDistribution_pkey" PRIMARY KEY ("id")
);

-- Every existing group needs a receipt counter to mint from.
INSERT INTO "ReceiptCounter" ("groupId", "nextNumber")
SELECT "id", 1 FROM "Group"
ON CONFLICT ("groupId") DO NOTHING;

-- CreateIndex
CREATE INDEX "InterestDue_cycleId_year_month_idx" ON "InterestDue"("cycleId", "year", "month");

-- CreateIndex
CREATE INDEX "InterestDue_memberId_idx" ON "InterestDue"("memberId");

-- CreateIndex
CREATE UNIQUE INDEX "InterestDue_loanId_month_year_key" ON "InterestDue"("loanId", "month", "year");

-- CreateIndex
CREATE INDEX "PeriodLock_groupId_idx" ON "PeriodLock"("groupId");

-- CreateIndex
CREATE UNIQUE INDEX "PeriodLock_cycleId_month_year_key" ON "PeriodLock"("cycleId", "month", "year");

-- CreateIndex
CREATE INDEX "FinalDistribution_cycleId_idx" ON "FinalDistribution"("cycleId");

-- CreateIndex
CREATE UNIQUE INDEX "FinalDistribution_cycleId_memberId_key" ON "FinalDistribution"("cycleId", "memberId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "Contribution_cycleId_year_month_idx" ON "Contribution"("cycleId", "year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "Fine_contributionId_key" ON "Fine"("contributionId");

-- CreateIndex
CREATE UNIQUE INDEX "Fine_interestDueId_key" ON "Fine"("interestDueId");

-- CreateIndex
CREATE UNIQUE INDEX "FineRule_groupId_appliesTo_key" ON "FineRule"("groupId", "appliesTo");

-- CreateIndex
CREATE INDEX "Loan_status_idx" ON "Loan"("status");

-- CreateIndex
CREATE INDEX "Receipt_cycleId_idx" ON "Receipt"("cycleId");

-- AddForeignKey
ALTER TABLE "InterestDue" ADD CONSTRAINT "InterestDue_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "Cycle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterestDue" ADD CONSTRAINT "InterestDue_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "Loan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterestDue" ADD CONSTRAINT "InterestDue_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "GroupMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fine" ADD CONSTRAINT "Fine_interestDueId_fkey" FOREIGN KEY ("interestDueId") REFERENCES "InterestDue"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReceiptCounter" ADD CONSTRAINT "ReceiptCounter_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_distributionId_fkey" FOREIGN KEY ("distributionId") REFERENCES "FinalDistribution"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PeriodLock" ADD CONSTRAINT "PeriodLock_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PeriodLock" ADD CONSTRAINT "PeriodLock_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "Cycle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PeriodLock" ADD CONSTRAINT "PeriodLock_lockedById_fkey" FOREIGN KEY ("lockedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinalDistribution" ADD CONSTRAINT "FinalDistribution_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "Cycle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinalDistribution" ADD CONSTRAINT "FinalDistribution_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "GroupMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
