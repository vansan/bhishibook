"use client";

import {
  AlertCircle,
  Banknote,
  CheckCircle2,
  Clock,
  ExternalLink,
  ShieldCheck,
  Users,
  XCircle,
} from "lucide-react";
import { ActionForm } from "@/components/ui/action-form";
import { cn } from "@/lib/utils";
import { formatPaise } from "@/lib/money";
import type { LoanApplicationItem } from "@/lib/services/loan-applications";
import { disburseLoanApplicationAction } from "../actions";

export function LoanApplicationsAdmin({
  applications,
  labels,
}: {
  applications: LoanApplicationItem[];
  labels: {
    title: string;
    subtitle: string;
    applicant: string;
    amount: string;
    term: string;
    guarantors: string;
    approvals: string;
    treasuryCash: string;
    status: string;
    actions: string;
    disburseBtn: string;
    disbursingLabel: string;
    noApplications: string;
    pendingApproval: string;
    readyForDisbursement: string;
    disbursed: string;
    rejected: string;
    awaitingJamin: string;
    awaitingVotes: string;
    insufficientFunds: string;
  };
}) {
  const whole = { whole: true } as const;

  if (applications.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-[var(--line)] bg-white p-6 text-center text-sm text-[var(--muted)]">
        {labels.noApplications}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {applications.map((app) => {
        const isDisbursed = app.status === "DISBURSED";
        const isReady = app.isReadyForDisbursement;
        const isPending = !isDisbursed && !isReady;

        return (
          <div
            className={cn(
              "rounded-xl border p-5 transition shadow-xs",
              isReady
                ? "border-emerald-300 bg-emerald-50/30"
                : isDisbursed
                ? "border-[var(--line)] bg-slate-50/50"
                : "border-[var(--line)] bg-white"
            )}
            key={app.id}
          >
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--line)] pb-4">
              <div>
                <div className="flex items-center gap-3">
                  <h3 className="text-lg font-bold text-[var(--foreground)]">
                    {app.applicant.displayName}
                  </h3>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold",
                      isDisbursed && "bg-blue-100 text-blue-800",
                      isReady && "bg-emerald-100 text-emerald-800",
                      isPending && "bg-amber-100 text-amber-800"
                    )}
                  >
                    {isDisbursed ? (
                      <CheckCircle2 size={12} />
                    ) : isReady ? (
                      <CheckCircle2 size={12} />
                    ) : (
                      <Clock size={12} />
                    )}
                    {isDisbursed
                      ? labels.disbursed
                      : isReady
                      ? labels.readyForDisbursement
                      : labels.pendingApproval}
                  </span>
                </div>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  Applied on {app.appliedAt.toISOString().slice(0, 10)} · Term: {app.termMonths} months
                  {app.applicant.phone ? ` · ${app.applicant.phone}` : ""}
                </p>
                {app.purpose ? (
                  <p className="mt-1 text-xs italic text-[var(--muted)]">
                    Note: "{app.purpose}"
                  </p>
                ) : null}
              </div>

              <div className="text-right">
                <span className="text-xl font-extrabold text-[var(--primary)]">
                  {formatPaise(app.requestedAmountPaise, whole)}
                </span>
                <p className="text-xs text-[var(--muted)]">
                  Treasury Available: {formatPaise(app.availableTreasuryPaise, whole)}
                </p>
              </div>
            </div>

            {/* Approvals & Requirements Grid */}
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              {/* 1. Jamin (Guarantors) Status */}
              <div className="rounded-lg border border-[var(--line)] bg-white p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[var(--muted)]">
                    {labels.guarantors} (Min. 2)
                  </span>
                  <span
                    className={cn(
                      "text-xs font-bold",
                      app.hasMinGuarantors ? "text-emerald-700" : "text-[var(--warn)]"
                    )}
                  >
                    {app.acceptedGuarantorsCount}/{app.totalGuarantorsCount} Accepted
                  </span>
                </div>
                <div className="mt-2 space-y-1">
                  {app.guarantors.map((g) => (
                    <div
                      className="flex items-center justify-between text-xs"
                      key={g.id}
                    >
                      <span className="truncate">{g.displayName}</span>
                      <span
                        className={cn(
                          "rounded-full px-1.5 py-0.2 text-[10px] font-medium",
                          g.status === "ACCEPTED" && "bg-emerald-100 text-emerald-800",
                          g.status === "DECLINED" && "bg-red-100 text-red-800",
                          g.status === "PENDING" && "bg-slate-100 text-slate-700"
                        )}
                      >
                        {g.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* 2. Group Voting Status */}
              <div className="rounded-lg border border-[var(--line)] bg-white p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[var(--muted)]">
                    {labels.approvals} (Min. 50%)
                  </span>
                  <span
                    className={cn(
                      "text-xs font-bold",
                      app.hasMinApprovals ? "text-emerald-700" : "text-blue-700"
                    )}
                  >
                    {app.approvedVotesCount}/{app.requiredVotesCount} Approved
                  </span>
                </div>
                <p className="mt-2 text-xs text-[var(--muted)]">
                  {app.approvedVotesCount} approve · {app.rejectedVotesCount} reject ·{" "}
                  {app.totalMembersCount} members total
                </p>
                <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={cn(
                      "h-full transition-all",
                      app.hasMinApprovals ? "bg-emerald-500" : "bg-blue-500"
                    )}
                    style={{
                      width: `${Math.min(
                        100,
                        Math.round((app.approvedVotesCount / app.totalMembersCount) * 100)
                      )}%`,
                    }}
                  />
                </div>
              </div>

              {/* 3. Available Funds & Disburse Action */}
              <div className="flex flex-col justify-between rounded-lg border border-[var(--line)] bg-white p-3">
                <div>
                  <span className="text-xs font-semibold text-[var(--muted)]">
                    {labels.treasuryCash}
                  </span>
                  <div className="mt-1 flex items-center justify-between text-xs">
                    <span>Available:</span>
                    <span className="font-semibold">
                      {formatPaise(app.availableTreasuryPaise, whole)}
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center justify-between text-xs">
                    <span>Needed:</span>
                    <span
                      className={cn(
                        "font-semibold",
                        app.hasSufficientFunds ? "text-emerald-700" : "text-red-700"
                      )}
                    >
                      {formatPaise(app.requestedAmountPaise, whole)}
                    </span>
                  </div>
                </div>

                <div className="mt-3">
                  {isDisbursed ? (
                    <span className="inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-blue-50 py-2 text-xs font-semibold text-blue-700">
                      <CheckCircle2 size={14} />
                      {labels.disbursed}
                    </span>
                  ) : isReady ? (
                    <ActionForm
                      action={disburseLoanApplicationAction}
                      compact
                      hidden={{ applicationId: app.id }}
                      pendingLabel={labels.disbursingLabel}
                      submitLabel={labels.disburseBtn}
                      variant="primary"
                    />
                  ) : (
                    <div className="space-y-1">
                      <button
                        className="inline-flex w-full cursor-not-allowed items-center justify-center rounded-md bg-slate-100 py-2 text-xs font-semibold text-slate-400"
                        disabled
                        type="button"
                      >
                        {labels.disburseBtn}
                      </button>
                      <div className="text-[10px] text-[var(--muted)] space-y-0.5">
                        {!app.hasMinGuarantors ? (
                          <p className="text-amber-700">
                            • {labels.awaitingJamin} ({app.acceptedGuarantorsCount}/2)
                          </p>
                        ) : null}
                        {!app.hasMinApprovals ? (
                          <p className="text-blue-700">
                            • {labels.awaitingVotes} ({app.approvedVotesCount}/{app.requiredVotesCount})
                          </p>
                        ) : null}
                        {!app.hasSufficientFunds ? (
                          <p className="text-red-700">• {labels.insufficientFunds}</p>
                        ) : null}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
