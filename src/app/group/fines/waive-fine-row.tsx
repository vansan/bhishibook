"use client";

import { useState } from "react";
import { ShieldOff, X } from "lucide-react";
import { ActionForm, Field } from "@/components/ui/action-form";
import { waiveFineAction } from "../actions";

type WaiveFineRowProps = {
  fine: {
    id: string;
    memberName: string;
    period: string;
    typeLabel: string;
    daysLate: number;
    outstandingLabel: string;
    outstandingRupees: string;
    waivedLabel: string | null;
  };
  labels: {
    waive: string;
    waiveAmount: string;
    reason: string;
    waived: string;
  };
};

export function WaiveFineRow({ fine, labels }: WaiveFineRowProps) {
  const [open, setOpen] = useState(false);
  const settled = fine.outstandingRupees === "0.00";

  return (
    <>
      <tr className="border-b border-[var(--line)]">
        <td className="px-4 py-3 font-medium">{fine.memberName}</td>
        <td className="px-4 py-3 text-[var(--muted)]">{fine.period}</td>
        <td className="px-4 py-3">{fine.typeLabel}</td>
        <td className="px-4 py-3 text-right">{fine.daysLate}</td>
        <td className="px-4 py-3 text-right">
          {fine.outstandingLabel}
          {fine.waivedLabel ? (
            <span className="block text-xs text-[var(--muted)]">
              {labels.waived} {fine.waivedLabel}
            </span>
          ) : null}
        </td>
        <td className="px-4 py-3 text-right">
          {settled ? null : (
            <button
              className="focus-ring inline-flex items-center gap-1.5 rounded px-2 py-1 text-sm font-medium text-[var(--warn)] hover:underline"
              onClick={() => setOpen((value) => !value)}
              type="button"
            >
              <ShieldOff size={14} />
              {labels.waive}
            </button>
          )}
        </td>
      </tr>

      {open && !settled ? (
        <tr className="border-b border-[var(--line)] bg-amber-50/40">
          <td className="px-4 py-4" colSpan={6}>
            <ActionForm
              action={waiveFineAction}
              hidden={{ fineId: fine.id }}
              submitLabel={labels.waive}
              variant="secondary"
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  defaultValue={fine.outstandingRupees}
                  label={labels.waiveAmount}
                  name="waiveAmount"
                  required
                />
                <Field label={labels.reason} name="reason" required />
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
