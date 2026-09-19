"use client";

import { useState } from "react";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Clock,
  HandCoins,
  PlusCircle,
  Users,
  X,
  XCircle,
} from "lucide-react";
import { ActionForm, Field } from "@/components/ui/action-form";
import { cn } from "@/lib/utils";
import { formatPaise } from "@/lib/money";
import type { LoanApplicationItem } from "@/lib/services/loan-applications";
import {
  applyForLoanAction,
  respondGuarantorAction,
  voteLoanApplicationAction,
} from "./actions";

type MemberOption = {
  id: string;
  name: string;
  phone: string;
};

export function ApplyLoanModal({
  members,
  currentMemberId,
  labels,
}: {
  members: MemberOption[];
  currentMemberId: string;
  labels: {
    applyBtn: string;
    modalTitle: string;
    amountLabel: string;
    termLabel: string;
    purposeLabel: string;
    selectJaminLabel: string;
    minJaminHint: string;
    submittingLabel: string;
    close: string;
  };
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedGuarantors, setSelectedGuarantors] = useState<string[]>([]);

  const eligibleGuarantors = members.filter((m) => m.id !== currentMemberId);

  const toggleGuarantor = (id: string) => {
    setSelectedGuarantors((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  return (
    <div>
      <button
        className="focus-ring inline-flex items-center gap-2 rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--primary-strong)]"
        onClick={() => setIsOpen(true)}
        type="button"
      >
        <PlusCircle size={16} />
        {labels.applyBtn}
      </button>

      {isOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-[var(--line)] bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[var(--line)] pb-4">
              <h2 className="flex items-center gap-2 text-lg font-bold text-[var(--foreground)]">
                <HandCoins className="text-[var(--primary)]" size={20} />
                {labels.modalTitle}
              </h2>
              <button
                className="rounded-md p-1 text-[var(--muted)] hover:bg-slate-100 hover:text-[var(--foreground)]"
                onClick={() => setIsOpen(false)}
                type="button"
              >
                <X size={20} />
                <span className="sr-only">{labels.close}</span>
              </button>
            </div>

            <ActionForm
              action={applyForLoanAction}
              className="mt-4 space-y-4"
              pendingLabel={labels.submittingLabel}
              submitLabel={labels.applyBtn}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label={labels.amountLabel}
                  name="amount"
                  placeholder="e.g. 50000"
                  required
                />
                <Field
                  defaultValue="6"
                  label={labels.termLabel}
                  name="termMonths"
                  required
                  type="number"
                />
              </div>

              <Field
                label={labels.purposeLabel}
                name="purpose"
                placeholder="Business, Medical, Agriculture, etc."
              />

              <div className="space-y-2">
                <label className="block text-sm font-medium text-[var(--foreground)]">
                  {labels.selectJaminLabel}
                </label>
                <p className="text-xs text-[var(--muted)]">
                  {labels.minJaminHint} (
                  <span
                    className={
                      selectedGuarantors.length >= 2
                        ? "font-semibold text-emerald-700"
                        : "font-semibold text-[var(--warn)]"
                    }
                  >
                    {selectedGuarantors.length} selected
                  </span>
                  )
                </p>

                <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-[var(--line)] p-2">
                  {eligibleGuarantors.map((member) => {
                    const isChecked = selectedGuarantors.includes(member.id);
                    return (
                      <label
                        className={cn(
                          "flex cursor-pointer items-center justify-between rounded-md p-2 text-xs transition",
                          isChecked
                            ? "bg-indigo-50 font-medium text-[var(--primary)]"
                            : "hover:bg-slate-50 text-[var(--foreground)]"
                        )}
                        key={member.id}
                      >
                        <div className="flex items-center gap-2">
                          <input
                            checked={isChecked}
                            name="guarantorMemberIds"
                            onChange={() => toggleGuarantor(member.id)}
                            type="checkbox"
                            value={member.id}
                          />
                          <span>{member.name}</span>
                        </div>
                        {member.phone ? (
                          <span className="text-[var(--muted)]">{member.phone}</span>
                        ) : null}
                      </label>
                    );
                  })}
                </div>
              </div>
            </ActionForm>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function GuarantorRequestsList({
  requests,
  labels,
}: {
  requests: LoanApplicationItem[];
  labels: {
    title: string;
    from: string;
    amount: string;
    purpose: string;
    accept: string;
    decline: string;
    statusAccepted: string;
    statusDeclined: string;
  };
}) {
  if (requests.length === 0) return null;

  return (
    <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50/50 p-5">
      <h3 className="flex items-center gap-2 text-base font-semibold text-amber-900">
        <Users className="text-amber-700" size={18} />
        {labels.title}
      </h3>

      <div className="grid gap-3 sm:grid-cols-2">
        {requests.map((req) => {
          const whole = { whole: true } as const;
          const isPending = req.currentUserGuarantorStatus === "PENDING";
          const isAccepted = req.currentUserGuarantorStatus === "ACCEPTED";
          const isDeclined = req.currentUserGuarantorStatus === "DECLINED";

          return (
            <div
              className="rounded-lg border border-amber-200 bg-white p-4 shadow-xs"
              key={req.id}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-semibold text-[var(--foreground)]">
                    {req.applicant.displayName}
                  </p>
                  <p className="text-xs text-[var(--muted)]">
                    {req.appliedAt.toISOString().slice(0, 10)}
                  </p>
                </div>
                <span className="text-sm font-bold text-[var(--primary)]">
                  {formatPaise(req.requestedAmountPaise, whole)}
                </span>
              </div>

              {req.purpose ? (
                <p className="mt-2 text-xs text-[var(--muted)] italic">
                  "{req.purpose}"
                </p>
              ) : null}

              <div className="mt-4 flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
                {isPending ? (
                  <>
                    <ActionForm
                      action={respondGuarantorAction}
                      compact
                      hidden={{ applicationId: req.id, decision: "ACCEPTED" }}
                      submitLabel={labels.accept}
                      variant="primary"
                    />
                    <ActionForm
                      action={respondGuarantorAction}
                      compact
                      hidden={{ applicationId: req.id, decision: "DECLINED" }}
                      submitLabel={labels.decline}
                      variant="danger"
                    />
                  </>
                ) : (
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
                      isAccepted
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-red-100 text-red-800"
                    )}
                  >
                    {isAccepted ? <Check size={12} /> : <X size={12} />}
                    {isAccepted ? labels.statusAccepted : labels.statusDeclined}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function MemberVotingList({
  applications,
  labels,
}: {
  applications: LoanApplicationItem[];
  labels: {
    title: string;
    applicant: string;
    amount: string;
    jaminStatus: string;
    approvalStatus: string;
    approve: string;
    reject: string;
    youApproved: string;
    youRejected: string;
    notVoted: string;
  };
}) {
  const whole = { whole: true } as const;
  const pendingApps = applications.filter((app) => app.status === "PENDING_APPROVAL");

  if (pendingApps.length === 0) return null;

  return (
    <div className="rounded-lg border border-[var(--line)] bg-white p-5">
      <h3 className="flex items-center gap-2 text-base font-semibold text-[var(--foreground)]">
        <Users className="text-[var(--primary)]" size={18} />
        {labels.title}
      </h3>

      <div className="mt-4 divide-y divide-[var(--line)]">
        {pendingApps.map((app) => {
          const hasVoted = app.currentUserVote !== null && app.currentUserVote !== undefined;
          const voteApprove = app.currentUserVote === "APPROVE";

          return (
            <div
              className="flex flex-col justify-between gap-4 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center"
              key={app.id}
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-[var(--foreground)]">
                    {app.applicant.displayName}
                  </span>
                  <span className="text-sm font-bold text-[var(--primary)]">
                    {formatPaise(app.requestedAmountPaise, whole)}
                  </span>
                </div>
                {app.purpose ? (
                  <p className="mt-1 text-xs text-[var(--muted)]">Note: {app.purpose}</p>
                ) : null}
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium",
                      app.hasMinGuarantors
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-amber-50 text-amber-700"
                    )}
                  >
                    {labels.jaminStatus}: {app.acceptedGuarantorsCount}/{app.totalGuarantorsCount}
                  </span>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium",
                      app.hasMinApprovals
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-blue-50 text-blue-700"
                    )}
                  >
                    {labels.approvalStatus}: {app.approvedVotesCount}/
                    {app.requiredVotesCount} ({app.totalMembersCount} total)
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {hasVoted ? (
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold",
                      voteApprove
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-red-100 text-red-800"
                    )}
                  >
                    {voteApprove ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
                    {voteApprove ? labels.youApproved : labels.youRejected}
                  </span>
                ) : null}

                <ActionForm
                  action={voteLoanApplicationAction}
                  compact
                  hidden={{ applicationId: app.id, decision: "APPROVE" }}
                  submitLabel={labels.approve}
                  variant={voteApprove ? "secondary" : "primary"}
                />
                <ActionForm
                  action={voteLoanApplicationAction}
                  compact
                  hidden={{ applicationId: app.id, decision: "REJECT" }}
                  submitLabel={labels.reject}
                  variant="danger"
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function MyApplicationsList({
  applications,
  labels,
}: {
  applications: LoanApplicationItem[];
  labels: {
    title: string;
    amount: string;
    date: string;
    status: string;
    jamin: string;
    votes: string;
    pending: string;
    ready: string;
    disbursed: string;
  };
}) {
  const whole = { whole: true } as const;
  const myApps = applications.filter((app) => app.isCurrentUserApplicant);

  if (myApps.length === 0) return null;

  return (
    <div className="rounded-lg border border-[var(--line)] bg-white p-5">
      <h3 className="flex items-center gap-2 text-base font-semibold text-[var(--foreground)]">
        <Clock className="text-[var(--primary)]" size={18} />
        {labels.title}
      </h3>

      <div className="mt-4 divide-y divide-[var(--line)]">
        {myApps.map((app) => {
          const isDisbursed = app.status === "DISBURSED";
          const isReady = app.status === "READY_FOR_DISBURSEMENT";

          return (
            <div className="py-3 first:pt-0 last:pb-0" key={app.id}>
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-base font-bold text-[var(--foreground)]">
                    {formatPaise(app.requestedAmountPaise, whole)}
                  </span>
                  <span className="ml-2 text-xs text-[var(--muted)]">
                    ({app.termMonths} months) · {app.appliedAt.toISOString().slice(0, 10)}
                  </span>
                </div>
                <span
                  className={cn(
                    "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
                    isDisbursed && "bg-blue-100 text-blue-800",
                    isReady && "bg-emerald-100 text-emerald-800",
                    !isDisbursed && !isReady && "bg-amber-100 text-amber-800"
                  )}
                >
                  {isDisbursed
                    ? labels.disbursed
                    : isReady
                    ? labels.ready
                    : labels.pending}
                </span>
              </div>

              <div className="mt-2 flex flex-wrap gap-3 text-xs text-[var(--muted)]">
                <span>
                  <strong>{labels.jamin}:</strong> {app.acceptedGuarantorsCount}/
                  {app.totalGuarantorsCount} accepted
                </span>
                <span>
                  <strong>{labels.votes}:</strong> {app.approvedVotesCount}/
                  {app.requiredVotesCount} approved
                </span>
                {app.purpose ? <span><strong>Note:</strong> {app.purpose}</span> : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
