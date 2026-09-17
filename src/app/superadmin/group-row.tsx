"use client";

import { useState } from "react";
import { ArrowRight, Settings2, X } from "lucide-react";
import { ActionForm, SelectField } from "@/components/ui/action-form";
import { cn } from "@/lib/utils";
import { selectGroupAction, setGroupStatusAction } from "./actions";

type GroupRowProps = {
  group: {
    id: string;
    name: string;
    status: string;
    planStatus: string;
    lang: string;
    memberCount: number;
    cycleLabel: string;
    corpusLabel: string;
  };
  labels: {
    open: string;
    manage: string;
    status: string;
    plan: string;
    save: string;
  };
};

const STATUS_STYLES: Record<string, string> = {
  ACTIVE: "bg-emerald-50 text-[var(--primary)]",
  PAUSED: "bg-amber-50 text-[var(--warn)]",
  CLOSED: "bg-red-50 text-red-700",
};

export function GroupRow({ group, labels }: GroupRowProps) {
  const [editing, setEditing] = useState(false);

  return (
    <>
      <tr className="border-b border-[var(--line)]">
        <td className="px-4 py-3">
          <span className="font-medium">{group.name}</span>
          <span className="block text-xs uppercase text-[var(--muted)]">{group.lang}</span>
        </td>
        <td className="px-4 py-3 text-[var(--muted)]">{group.cycleLabel}</td>
        <td className="px-4 py-3 text-right tabular-nums">{group.memberCount}</td>
        <td className="px-4 py-3 text-right tabular-nums">{group.corpusLabel}</td>
        <td className="px-4 py-3">
          <span
            className={cn(
              "inline-block rounded-full px-2 py-0.5 text-xs font-medium",
              STATUS_STYLES[group.status] ?? "bg-gray-100 text-gray-700"
            )}
          >
            {group.status}
          </span>
          <span className="ml-1 text-xs text-[var(--muted)]">{group.planStatus}</span>
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center justify-end gap-3">
            <button
              className="focus-ring inline-flex items-center gap-1.5 rounded px-2 py-1 text-sm font-medium text-[var(--muted)] hover:text-[var(--foreground)]"
              onClick={() => setEditing((value) => !value)}
              type="button"
            >
              <Settings2 size={14} />
              {labels.manage}
            </button>

            {/*
              Switching group is a POST, not a link, because it writes the
              superadmin's working-group cookie before redirecting.
            */}
            <form action={selectGroupAction}>
              <input name="groupId" type="hidden" value={group.id} />
              <button
                className="focus-ring inline-flex items-center gap-1.5 rounded px-2 py-1 text-sm font-medium text-[var(--primary)] hover:underline"
                type="submit"
              >
                {labels.open}
                <ArrowRight size={14} />
              </button>
            </form>
          </div>
        </td>
      </tr>

      {editing ? (
        <tr className="border-b border-[var(--line)] bg-emerald-50/40">
          <td className="px-4 py-4" colSpan={6}>
            <ActionForm
              action={setGroupStatusAction}
              hidden={{ groupId: group.id }}
              submitLabel={labels.save}
              variant="secondary"
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <SelectField
                  defaultValue={group.status}
                  label={labels.status}
                  name="status"
                  options={[
                    { value: "ACTIVE", label: "Active" },
                    { value: "PAUSED", label: "Paused" },
                    { value: "CLOSED", label: "Closed" },
                  ]}
                />
                <SelectField
                  defaultValue={group.planStatus}
                  label={labels.plan}
                  name="planStatus"
                  options={[
                    { value: "FREE", label: "Free" },
                    { value: "TRIAL", label: "Trial" },
                    { value: "PAID", label: "Paid" },
                    { value: "SUSPENDED", label: "Suspended" },
                  ]}
                />
              </div>
            </ActionForm>

            <button
              className="focus-ring mt-2 inline-flex items-center gap-1.5 rounded px-2 py-1 text-sm text-[var(--muted)] hover:text-[var(--foreground)]"
              onClick={() => setEditing(false)}
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
