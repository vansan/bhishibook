"use client";

import { useState } from "react";
import { IndianRupee, MessageCircle, Pencil, Trash2, X } from "lucide-react";
import { ActionForm, Field } from "@/components/ui/action-form";
import { deleteLoanAction, recordRepaymentAction, updateLoanAction } from "../actions";
import { whatsappShareUrl } from "@/lib/receipt-text";

type LoanRowProps = {
  loan: {
    id: string;
    memberName: string;
    phone?: string | null;
    principalRaw: string;
    principalLabel: string;
    outstandingPrincipalLabel: string;
    interestRate: string;
    disbursedOnRaw: string;
    notes?: string | null;
    totalOwedLabel: string;
    totalOwedRupees: string;
    interestLabel: string;
    fineLabel: string;
    dueOn: string;
    isClosed: boolean;
    isOverdue: boolean;
    whatsappText?: string | null;
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
    edit: string;
    delete: string;
    principal: string;
    disbursedOn: string;
    interestRate: string;
    cancel?: string;
  };
};

const today = () => new Date().toISOString().slice(0, 10);

export function LoanRow({ loan, labels }: LoanRowProps) {
  const [panel, setPanel] = useState<"none" | "repay" | "edit">("none");

  return (
    <>
      <tr className="border-b border-[var(--line)]">
        <td className="px-4 py-3">
          <span className="font-medium">{loan.memberName}</span>
          {loan.isClosed ? (
            <span className="ml-2 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-[var(--primary)]">
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
          <div className="flex items-center justify-end gap-2 whitespace-nowrap">
            {loan.phone && loan.whatsappText ? (
              <a
                className="inline-flex items-center gap-1 rounded bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 transition"
                href={whatsappShareUrl(loan.whatsappText, loan.phone)}
                rel="noopener noreferrer"
                target="_blank"
                title="WhatsApp वर पावती पाठवा"
              >
                <MessageCircle className="text-emerald-600" size={14} />
                <span className="hidden sm:inline">WhatsApp</span>
              </a>
            ) : null}

            {loan.isClosed ? null : (
              <button
                className="focus-ring inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-semibold text-[var(--primary)] hover:bg-blue-50 transition"
                onClick={() => setPanel((v) => (v === "repay" ? "none" : "repay"))}
                type="button"
              >
                <IndianRupee size={13} />
                {labels.repay}
              </button>
            )}

            <button
              className="focus-ring inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 transition"
              onClick={() => setPanel((v) => (v === "edit" ? "none" : "edit"))}
              type="button"
            >
              <Pencil size={13} />
              {labels.edit}
            </button>

            <ActionForm
              action={deleteLoanAction}
              hidden={{ loanId: loan.id }}
              icon={Trash2}
              pendingLabel="..."
              submitLabel={labels.delete}
              variant="danger-link"
            />
          </div>
        </td>
      </tr>

      {panel === "repay" && !loan.isClosed ? (
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
              onClick={() => setPanel("none")}
              type="button"
            >
              <X size={14} />
              {labels.cancel || "Cancel"}
            </button>
          </td>
        </tr>
      ) : null}

      {panel === "edit" ? (
        <tr className="border-b border-[var(--line)] bg-blue-50/40">
          <td className="px-4 py-4" colSpan={6}>
            <ActionForm
              action={updateLoanAction}
              hidden={{ loanId: loan.id }}
              submitLabel={labels.edit}
            >
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Field
                  defaultValue={loan.principalRaw}
                  label={labels.principal}
                  name="principal"
                  required
                />
                <Field
                  defaultValue={loan.disbursedOnRaw}
                  label={labels.disbursedOn}
                  name="disbursedOn"
                  required
                  type="date"
                />
                <Field
                  defaultValue={loan.interestRate}
                  label={labels.interestRate}
                  name="interestRate"
                  required
                />
                <Field
                  defaultValue={loan.notes ?? ""}
                  label={labels.notes}
                  name="notes"
                />
              </div>
            </ActionForm>

            <button
              className="focus-ring mt-2 inline-flex items-center gap-1.5 rounded px-2 py-1 text-sm text-[var(--muted)] hover:text-[var(--foreground)]"
              onClick={() => setPanel("none")}
              type="button"
            >
              <X size={14} />
              {labels.cancel || "Cancel"}
            </button>
          </td>
        </tr>
      ) : null}
    </>
  );
}
