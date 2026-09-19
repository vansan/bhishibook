"use client";

import { useState } from "react";
import { Check, IndianRupee, X } from "lucide-react";
import { ActionForm, Field } from "@/components/ui/action-form";
import { cn } from "@/lib/utils";
import { recordContributionAction } from "../actions";

type ContributionRowProps = {
  row: {
    id: string;
    memberName: string;
    dueLabel: string;
    paidLabel: string;
    /** Pre-filled into the amount box so the common case is one click. */
    outstandingRupees: string;
    fineLabel: string;
    fineRupees: string;
    daysLate: number;
    state: "paid" | "partial" | "unpaid";
    locked: boolean;
  };
  labels: {
    record: string;
    amount: string;
    finePaid: string;
    paidOn: string;
    notes: string;
    daysLate: string;
    fullyPaid: string;
    partiallyPaid: string;
    unpaid: string;
    locked: string;
  };
};

const today = () => new Date().toISOString().slice(0, 10);

export function ContributionRow({ row, labels }: ContributionRowProps) {
  const [open, setOpen] = useState(false);

  const badge =
    row.state === "paid"
      ? { text: labels.fullyPaid, className: "bg-emerald-50 text-emerald-700" }
      : row.state === "partial"
        ? { text: labels.partiallyPaid, className: "bg-amber-50 text-[var(--warn)]" }
        : { text: labels.unpaid, className: "bg-red-50 text-red-700" };

  return (
    <>
      <tr className="border-b border-[var(--line)]">
        <td className="px-4 py-3 font-medium">{row.memberName}</td>
        <td className="px-4 py-3 text-right">{row.dueLabel}</td>
        <td className="px-4 py-3 text-right">{row.paidLabel}</td>
        <td className="px-4 py-3 text-right">
          {row.fineLabel}
          {row.daysLate > 0 ? (
            <span className="block text-xs text-[var(--muted)]">
              {row.daysLate} {labels.daysLate}
            </span>
          ) : null}
        </td>
        <td className="px-4 py-3">
          <span
            className={cn(
              "inline-block rounded-full px-2 py-0.5 text-xs font-medium",
              badge.className
            )}
          >
            {badge.text}
          </span>
        </td>
        <td className="px-4 py-3 text-right">
          {row.locked ? (
            <span className="text-xs text-[var(--muted)]">{labels.locked}</span>
          ) : row.state === "paid" && row.fineRupees === "0.00" ? (
            <Check className="ml-auto text-[var(--primary)]" size={16} />
          ) : (
            <button
              className="focus-ring inline-flex items-center gap-1.5 rounded px-2 py-1 text-sm font-medium text-[var(--primary)] hover:underline"
              onClick={() => setOpen((value) => !value)}
              type="button"
            >
              <IndianRupee size={14} />
              {labels.record}
            </button>
          )}
        </td>
      </tr>

      {open && !row.locked ? (
        <tr className="border-b border-[var(--line)] bg-emerald-50/40">
          <td className="px-4 py-4" colSpan={6}>
            <ActionForm
              action={recordContributionAction}
              hidden={{ contributionId: row.id }}
              submitLabel={labels.record}
            >
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Field
                  defaultValue={row.outstandingRupees}
                  label={labels.amount}
                  name="amount"
                />
                <Field
                  defaultValue={row.fineRupees === "0.00" ? "" : row.fineRupees}
                  label={labels.finePaid}
                  name="finePaid"
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
