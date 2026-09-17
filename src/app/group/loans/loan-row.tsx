"use client";

import { useState } from "react";
import { IndianRupee, X } from "lucide-react";
import { ActionForm, Field } from "@/components/ui/action-form";
import { recordRepaymentAction } from "../actions";

type LoanRowProps = {
  loan: {
    id: string;
    memberName: string;
    principalLabel: string;
    outstandingPrincipalLabel: string;
    totalOwedLabel: string;
    totalOwedRupees: string;
    interestLabel: string;
    fineLabel: string;
    dueOn: string;
    isClosed: boolean;
    isOverdue: boolean;
  };
  labels: {
    repay: string;
    repayHint: string;
    amount: string;
    paidOn: string;
    notes: string;
    closed: string;
    overdue: string;
    interest: string;
    fines: string;
  };
};

const today = () => new Date().toISOString().slice(0, 10);

export function LoanRow({ loan, labels }: LoanRowProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <tr className="border-b border-[var(--line)]">
        <td className="px-4 py-3">
          <span className="font-medium">{loan.memberName}</span>
          {loan.isClosed ? (
            <span className="ml-2 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-[var(--primary)]">
              {labels.closed}
            </span>
          ) : loan.isOverdue ? (
            <span className="ml-2 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
              {labels.overdue}
            </span>
          ) : null}
        </td>
        <td className="px-4 py-3 text-right">{loan.principalLabel}</td>
        <td className="px-4 py-3 text-right">{loan.outstandingPrincipalLabel}</td>
        <td className="px-4 py-3 text-right">
          <span className="font-medium">{loan.totalOwedLabel}</span>
          <span className="block text-xs text-[var(--muted)]">
            {labels.interest} {loan.interestLabel} · {labels.fines} {loan.fineLabel}
          </span>
        </td>
        <td className="px-4 py-3 text-[var(--muted)]">{loan.dueOn}</td>
        <td className="px-4 py-3 text-right">
          {loan.isClosed ? null : (
            <button
              className="focus-ring inline-flex items-center gap-1.5 rounded px-2 py-1 text-sm font-medium text-[var(--primary)] hover:underline"
              onClick={() => setOpen((value) => !value)}
              type="button"
            >
              <IndianRupee size={14} />
              {labels.repay}
            </button>
          )}
        </td>
      </tr>

      {open && !loan.isClosed ? (
        <tr className="border-b border-[var(--line)] bg-emerald-50/40">
          <td className="px-4 py-4" colSpan={6}>
            <ActionForm
              action={recordRepaymentAction}
              hidden={{ loanId: loan.id }}
              submitLabel={labels.repay}
            >
              <p className="text-xs text-[var(--muted)]">{labels.repayHint}</p>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field
                  defaultValue={loan.totalOwedRupees}
                  label={labels.amount}
                  name="amount"
                  required
                />
                <Field
                  defaultValue={today()}
                  label={labels.paidOn}
                  name="paidOn"
                  required
                  type="date"
                />
                <Field label={labels.notes} name="notes" />
              </div>
            </ActionForm>

            <button
              className="focus-ring mt-2 inline-flex items-center gap-1.5 rounded px-2 py-1 text-sm text-[var(--muted)] hover:text-[var(--foreground)]"
              onClick={() => setOpen(false)}
              type="button"
            >
              <X size={14} />
              Cancel
            </button>
          </td>
        </tr>
      ) : null}
    </>
  );
}
