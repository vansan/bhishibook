"use client";

import { useState } from "react";
import { Undo2, X } from "lucide-react";
import { ActionForm, Field } from "@/components/ui/action-form";
import { cn } from "@/lib/utils";
import { reverseLedgerEntryAction } from "../actions";

type LedgerRowProps = {
  entry: {
    id: string;
    date: string;
    typeLabel: string;
    description: string;
    amountLabel: string;
    isOutflow: boolean;
    isReversal: boolean;
    /** True once a reversal has been posted against this entry. */
    isReversed: boolean;
  };
  labels: {
    reverse: string;
    reverseReason: string;
    reverseHint: string;
    reversed: string;
  };
};

export function LedgerRow({ entry, labels }: LedgerRowProps) {
  const [open, setOpen] = useState(false);

  // A reversal cannot itself be reversed, and nothing is reversed twice.
  const canReverse = !entry.isReversal && !entry.isReversed;

  return (
    <>
      <tr className="border-b border-[var(--line)] last:border-0">
        <td className="px-4 py-3 text-[var(--muted)]">{entry.date}</td>
        <td className="px-4 py-3">{entry.typeLabel}</td>
        <td className="px-4 py-3">
          {entry.description}
          {entry.isReversed ? (
            <span className="ml-2 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-[var(--warn)]">
              {labels.reversed}
            </span>
          ) : null}
        </td>
        <td
          className={cn(
            "px-4 py-3 text-right font-medium tabular-nums",
            entry.isReversal || entry.isReversed
              ? "text-[var(--muted)] line-through"
              : entry.isOutflow
                ? "text-[var(--warn)]"
                : "text-[var(--primary)]"
          )}
        >
          {entry.isOutflow ? "-" : "+"}
          {entry.amountLabel}
        </td>
        <td className="px-4 py-3 text-right">
          {canReverse ? (
            <button
              className="focus-ring inline-flex items-center gap-1.5 rounded px-2 py-1 text-sm font-medium text-[var(--muted)] hover:text-[var(--foreground)]"
              onClick={() => setOpen((value) => !value)}
              type="button"
            >
              <Undo2 size={14} />
              {labels.reverse}
            </button>
          ) : null}
        </td>
      </tr>

      {open && canReverse ? (
        <tr className="border-b border-[var(--line)] bg-amber-50/40">
          <td className="px-4 py-4" colSpan={5}>
            <ActionForm
              action={reverseLedgerEntryAction}
              hidden={{ entryId: entry.id }}
              submitLabel={labels.reverse}
              variant="danger"
            >
              <p className="text-xs text-[var(--muted)]">{labels.reverseHint}</p>
              <div className="max-w-md">
                <Field label={labels.reverseReason} name="reason" required />
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
