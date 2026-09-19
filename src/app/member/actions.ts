"use server";

import { revalidatePath } from "next/cache";
import type { ActionState } from "@/lib/action-state";
import { requireMemberScope } from "@/lib/auth";
import { rupeesToPaise } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import {
  createLoanApplication,
  respondGuarantor,
  voteOnApplication,
} from "@/lib/services/loan-applications";

const ok = (message: string): ActionState => ({ success: message });

function failure(error: unknown): ActionState {
  const message = error instanceof Error ? error.message : "Something went wrong";
  if (message.includes("prisma") || message.includes("Invalid `")) {
    return { error: "That could not be saved. Please check the values and try again." };
  }
  return { error: message };
}

function text(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function money(formData: FormData, key: string): number {
  const raw = text(formData, key).replace(/[₹,\s]/g, "");
  if (!raw) return 0;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function applyForLoanAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    const scope = await requireMemberScope();
    const amountRupees = money(formData, "amount");
    if (amountRupees <= 0) {
      return { error: "Please enter a valid loan amount greater than zero." };
    }

    const termMonths = parseInt(text(formData, "termMonths") || "6", 10);
    const purpose = text(formData, "purpose");
    const guarantorMemberIds = formData
      .getAll("guarantorMemberIds")
      .map((v) => String(v).trim())
      .filter(Boolean);

    if (guarantorMemberIds.length < 2) {
      return { error: "Minimum 2 Jamin (guarantors) are mandatory." };
    }

    if (guarantorMemberIds.includes(scope.memberId)) {
      return { error: "You cannot select yourself as a guarantor." };
    }

    const cycle = await prisma.cycle.findFirst({
      where: { groupId: scope.groupId, status: { in: ["ACTIVE", "DRAFT", "CLOSING"] } },
      orderBy: { startsOn: "desc" },
      select: { id: true },
    });

    if (!cycle) {
      return { error: "No active cycle found for this group." };
    }

    await createLoanApplication({
      groupId: scope.groupId,
      cycleId: cycle.id,
      applicantId: scope.memberId,
      amountPaise: rupeesToPaise(amountRupees),
      termMonths,
      purpose,
      guarantorMemberIds,
    });

    revalidatePath("/member");
    revalidatePath("/group/loans");
    return ok("Loan application submitted successfully!");
  } catch (error) {
    return failure(error);
  }
}

export async function respondGuarantorAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    const scope = await requireMemberScope();
    const applicationId = text(formData, "applicationId");
    const decision = text(formData, "decision") as "ACCEPTED" | "DECLINED";

    if (!applicationId || !["ACCEPTED", "DECLINED"].includes(decision)) {
      return { error: "Invalid response." };
    }

    await respondGuarantor({
      applicationId,
      guarantorMemberId: scope.memberId,
      decision,
    });

    revalidatePath("/member");
    revalidatePath("/group/loans");
    return ok(decision === "ACCEPTED" ? "Accepted as guarantor." : "Declined guarantor request.");
  } catch (error) {
    return failure(error);
  }
}

export async function voteLoanApplicationAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    const scope = await requireMemberScope();
    const applicationId = text(formData, "applicationId");
    const decision = text(formData, "decision") as "APPROVE" | "REJECT";

    if (!applicationId || !["APPROVE", "REJECT"].includes(decision)) {
      return { error: "Invalid vote choice." };
    }

    await voteOnApplication({
      applicationId,
      memberId: scope.memberId,
      decision,
    });

    revalidatePath("/member");
    revalidatePath("/group/loans");
    return ok(decision === "APPROVE" ? "Voted to approve." : "Voted to reject.");
  } catch (error) {
    return failure(error);
  }
}
