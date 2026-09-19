import "server-only";
import { prisma } from "@/lib/prisma";
import {
  atLeastZero,
  decimalToPaise,
  paiseToDecimalString,
  type Paise,
} from "@/lib/money";
import { createLoan, getGroupAvailableFunds } from "./loans";

export type ApplicationGuarantorSummary = {
  id: string;
  memberId: string;
  displayName: string;
  displayNameMr: string | null;
  phone: string | null;
  status: "PENDING" | "ACCEPTED" | "DECLINED";
  respondedAt: Date | null;
};

export type ApplicationVoteSummary = {
  id: string;
  memberId: string;
  decision: "APPROVE" | "REJECT";
  votedAt: Date;
};

export type LoanApplicationItem = {
  id: string;
  cycleId: string;
  applicantId: string;
  applicant: {
    id: string;
    displayName: string;
    displayNameMr: string | null;
    phone: string | null;
  };
  requestedAmountPaise: Paise;
  termMonths: number;
  purpose: string | null;
  status: "PENDING_APPROVAL" | "READY_FOR_DISBURSEMENT" | "DISBURSED" | "REJECTED" | "CANCELLED";
  appliedAt: Date;
  disbursedLoanId: string | null;
  guarantors: ApplicationGuarantorSummary[];
  acceptedGuarantorsCount: number;
  totalGuarantorsCount: number;
  hasMinGuarantors: boolean; // >= 2 accepted
  votes: ApplicationVoteSummary[];
  approvedVotesCount: number;
  rejectedVotesCount: number;
  totalMembersCount: number;
  requiredVotesCount: number; // 50% of active members
  hasMinApprovals: boolean; // approvedVotesCount >= requiredVotesCount
  availableTreasuryPaise: Paise;
  hasSufficientFunds: boolean; // availableTreasuryPaise >= requestedAmountPaise
  isReadyForDisbursement: boolean;
  currentUserGuarantorStatus?: "PENDING" | "ACCEPTED" | "DECLINED" | null;
  currentUserVote?: "APPROVE" | "REJECT" | null;
  isCurrentUserApplicant: boolean;
};

/**
 * Submit a new loan application.
 * Rules:
 * - Minimum 2 guarantors (Jamin) are mandatory.
 * - Applicant cannot select themselves as guarantor.
 * - Guarantor IDs must be unique and from the active group members.
 */
export async function createLoanApplication(input: {
  groupId: string;
  cycleId: string;
  applicantId: string;
  amountPaise: Paise;
  termMonths?: number;
  purpose?: string;
  guarantorMemberIds: string[];
}) {
  if (input.amountPaise <= 0) {
    throw new Error("Requested loan amount must be greater than zero.");
  }

  const uniqueGuarantors = Array.from(new Set(input.guarantorMemberIds.filter(Boolean)));
  if (uniqueGuarantors.length < 2) {
    throw new Error("Minimum 2 Jamin (guarantors) are mandatory.");
  }

  if (uniqueGuarantors.includes(input.applicantId)) {
    throw new Error("You cannot select yourself as a guarantor (Jamin).");
  }

  // Verify cycle
  const cycle = await prisma.cycle.findFirst({
    where: { id: input.cycleId, groupId: input.groupId, status: { in: ["ACTIVE", "DRAFT", "CLOSING"] } },
  });
  if (!cycle) {
    throw new Error("Active cycle not found for this group.");
  }

  // Verify applicant
  const applicant = await prisma.groupMember.findFirst({
    where: { id: input.applicantId, groupId: input.groupId, status: "ACTIVE" },
  });
  if (!applicant) {
    throw new Error("Applicant member not found or is inactive.");
  }

  // Verify all guarantors belong to this group and are active
  const validGuarantors = await prisma.groupMember.findMany({
    where: {
      groupId: input.groupId,
      id: { in: uniqueGuarantors },
      status: "ACTIVE",
    },
    select: { id: true },
  });

  if (validGuarantors.length < 2) {
    throw new Error("At least 2 active members from this group must be selected as guarantors.");
  }

  return prisma.$transaction(async (tx) => {
    const application = await tx.loanApplication.create({
      data: {
        cycleId: cycle.id,
        applicantId: applicant.id,
        requestedAmount: paiseToDecimalString(input.amountPaise),
        termMonths: input.termMonths ?? cycle.maxRepaymentMonths ?? 6,
        purpose: input.purpose || null,
        status: "PENDING_APPROVAL",
      },
    });

    await tx.loanGuarantor.createMany({
      data: validGuarantors.map((g) => ({
        applicationId: application.id,
        memberId: g.id,
        status: "PENDING",
      })),
    });

    return application;
  });
}

/**
 * Guarantor responds to a request: Accept or Decline.
 */
export async function respondGuarantor(input: {
  applicationId: string;
  guarantorMemberId: string;
  decision: "ACCEPTED" | "DECLINED";
}) {
  const guarantorRecord = await prisma.loanGuarantor.findUnique({
    where: {
      applicationId_memberId: {
        applicationId: input.applicationId,
        memberId: input.guarantorMemberId,
      },
    },
    include: {
      application: true,
    },
  });

  if (!guarantorRecord) {
    throw new Error("You are not listed as a guarantor for this application.");
  }

  if (guarantorRecord.application.status !== "PENDING_APPROVAL") {
    throw new Error("This loan application is no longer pending.");
  }

  return prisma.loanGuarantor.update({
    where: { id: guarantorRecord.id },
    data: {
      status: input.decision,
      respondedAt: new Date(),
    },
  });
}

/**
 * Cast a vote on a loan application.
 * Any active member can vote APPROVE or REJECT.
 */
export async function voteOnApplication(input: {
  applicationId: string;
  memberId: string;
  decision: "APPROVE" | "REJECT";
}) {
  const application = await prisma.loanApplication.findUnique({
    where: { id: input.applicationId },
  });

  if (!application) {
    throw new Error("Loan application not found.");
  }

  if (application.status !== "PENDING_APPROVAL") {
    throw new Error("This loan application is no longer open for voting.");
  }

  return prisma.loanApplicationVote.upsert({
    where: {
      applicationId_memberId: {
        applicationId: input.applicationId,
        memberId: input.memberId,
      },
    },
    update: {
      decision: input.decision,
      votedAt: new Date(),
    },
    create: {
      applicationId: input.applicationId,
      memberId: input.memberId,
      decision: input.decision,
    },
  });
}

/**
 * Fetch all loan applications for a group (or cycle) with full approval & treasury calculations.
 */
export async function getGroupLoanApplications(
  groupId: string,
  currentMemberId?: string
): Promise<LoanApplicationItem[]> {
  const [applications, totalMembers, availableTreasury] = await Promise.all([
    prisma.loanApplication.findMany({
      where: {
        cycle: { groupId },
      },
      orderBy: { appliedAt: "desc" },
      include: {
        applicant: {
          select: {
            id: true,
            displayName: true,
            displayNameMr: true,
            phone: true,
          },
        },
        guarantors: {
          include: {
            member: {
              select: {
                id: true,
                displayName: true,
                displayNameMr: true,
                phone: true,
              },
            },
          },
        },
        votes: {
          select: {
            id: true,
            memberId: true,
            decision: true,
            votedAt: true,
          },
        },
      },
    }),
    prisma.groupMember.count({
      where: { groupId, status: "ACTIVE" },
    }),
    getGroupAvailableFunds(groupId),
  ]);

  const requiredVotes = Math.ceil(totalMembers * 0.5);

  return applications.map((app) => {
    const requestedPaise = decimalToPaise(app.requestedAmount);
    const acceptedGuarantors = app.guarantors.filter((g) => g.status === "ACCEPTED");
    const approvedVotes = app.votes.filter((v) => v.decision === "APPROVE");
    const rejectedVotes = app.votes.filter((v) => v.decision === "REJECT");

    const hasMinGuarantors = acceptedGuarantors.length >= 2;
    const hasMinApprovals = approvedVotes.length >= requiredVotes;
    const hasSufficientFunds = availableTreasury >= requestedPaise;

    const isPending = app.status === "PENDING_APPROVAL";
    const isReady = isPending && hasMinGuarantors && hasMinApprovals && hasSufficientFunds;

    const currentGuarantor = currentMemberId
      ? app.guarantors.find((g) => g.memberId === currentMemberId)
      : null;
    const currentVote = currentMemberId
      ? app.votes.find((v) => v.memberId === currentMemberId)
      : null;

    return {
      id: app.id,
      cycleId: app.cycleId,
      applicantId: app.applicantId,
      applicant: app.applicant,
      requestedAmountPaise: requestedPaise,
      termMonths: app.termMonths,
      purpose: app.purpose,
      status: isReady ? "READY_FOR_DISBURSEMENT" : app.status,
      appliedAt: app.appliedAt,
      disbursedLoanId: app.disbursedLoanId,
      guarantors: app.guarantors.map((g) => ({
        id: g.id,
        memberId: g.memberId,
        displayName: g.member.displayName,
        displayNameMr: g.member.displayNameMr,
        phone: g.member.phone,
        status: g.status,
        respondedAt: g.respondedAt,
      })),
      acceptedGuarantorsCount: acceptedGuarantors.length,
      totalGuarantorsCount: app.guarantors.length,
      hasMinGuarantors,
      votes: app.votes,
      approvedVotesCount: approvedVotes.length,
      rejectedVotesCount: rejectedVotes.length,
      totalMembersCount: totalMembers,
      requiredVotesCount: requiredVotes,
      hasMinApprovals,
      availableTreasuryPaise: availableTreasury,
      hasSufficientFunds,
      isReadyForDisbursement: isReady,
      currentUserGuarantorStatus: currentGuarantor ? currentGuarantor.status : null,
      currentUserVote: currentVote ? currentVote.decision : null,
      isCurrentUserApplicant: currentMemberId === app.applicantId,
    };
  });
}

/**
 * Disburse loan for an approved application.
 * Checks all 3 mandatory conditions:
 * 1. Min 2 accepted guarantors
 * 2. Min 50% member approvals
 * 3. Sufficient group treasury cash
 */
export async function disburseApplicationLoan(input: {
  applicationId: string;
  groupId: string;
  actorUserId?: string | null;
  disbursedOn?: Date;
}) {
  const application = await prisma.loanApplication.findFirst({
    where: { id: input.applicationId, cycle: { groupId: input.groupId } },
    include: {
      cycle: true,
      applicant: true,
      guarantors: true,
      votes: true,
    },
  });

  if (!application) {
    throw new Error("Loan application not found in this group.");
  }

  if (application.status === "DISBURSED") {
    throw new Error("This loan application has already been disbursed.");
  }

  // 1. Min 2 accepted Jamin
  const acceptedGuarantors = application.guarantors.filter((g) => g.status === "ACCEPTED");
  if (acceptedGuarantors.length < 2) {
    throw new Error(
      `Cannot disburse: Minimum 2 accepted Jamin (guarantors) required. Currently ${acceptedGuarantors.length} accepted.`
    );
  }

  // 2. Min 50% approvals
  const totalActiveMembers = await prisma.groupMember.count({
    where: { groupId: input.groupId, status: "ACTIVE" },
  });
  const requiredVotes = Math.ceil(totalActiveMembers * 0.5);
  const approvedVotes = application.votes.filter((v) => v.decision === "APPROVE");
  if (approvedVotes.length < requiredVotes) {
    throw new Error(
      `Cannot disburse: Minimum 50% member approval required (${requiredVotes}/${totalActiveMembers}). Currently ${approvedVotes.length} approved.`
    );
  }

  // 3. Sufficient funds
  const principalPaise = decimalToPaise(application.requestedAmount);
  const treasuryFunds = await getGroupAvailableFunds(input.groupId);
  if (treasuryFunds < principalPaise) {
    throw new Error(
      `Cannot disburse: Insufficient group funds available in treasury. Available: ₹${(treasuryFunds / 100).toFixed(2)}, Needed: ₹${(principalPaise / 100).toFixed(2)}.`
    );
  }

  // Disburse via core createLoan
  const disbursedDate = input.disbursedOn ?? new Date();
  const { loan, receiptNo, whatsappText } = await createLoan({
    groupId: input.groupId,
    cycleId: application.cycleId,
    memberId: application.applicantId,
    principalPaise,
    disbursedOn: disbursedDate,
    notes: application.purpose
      ? `Application approved (Jamin: ${acceptedGuarantors.length}, Votes: ${approvedVotes.length}/${totalActiveMembers}) - ${application.purpose}`
      : `Application approved (Jamin: ${acceptedGuarantors.length}, Votes: ${approvedVotes.length}/${totalActiveMembers})`,
    actorUserId: input.actorUserId,
  });

  // Update application status
  await prisma.loanApplication.update({
    where: { id: application.id },
    data: {
      status: "DISBURSED",
      disbursedLoanId: loan.id,
    },
  });

  return { loan, receiptNo, whatsappText };
}
