"use client";

import { useState } from "react";
import { Pencil, X } from "lucide-react";
import { ActionForm, Field, SelectField } from "@/components/ui/action-form";
import { updateMemberAction } from "../actions";

type MemberRowProps = {
  member: {
    id: string;
    displayName: string;
    phone: string | null;
    email: string | null;
    shareCount: number;
    monthlyHafta: string;
    status: string;
    contributedLabel: string;
    haftaLabel: string;
  };
  editLabel: string;
  inactiveLabel: string;
  labels: {
    name: string;
    phone: string;
    shares: string;
    hafta: string;
    status: string;
    active: string;
    inactive: string;
    update: string;
  };
};

/**
 * One member, with the edit form revealed in place rather than on a separate
 * page, so an admin correcting a hafta amount does not lose their scroll
 * position in a 33 row table.
 */
export function MemberRow({ member, editLabel, inactiveLabel, labels }: MemberRowProps) {
  const [editing, setEditing] = useState(false);
  const isInactive = member.status === "INACTIVE";

  if (editing) {
    return (
      <tr className="border-b border-[var(--line)] bg-emerald-50/40">
        <td className="px-4 py-4" colSpan={6}>
          <ActionForm
            action={updateMemberAction}
            hidden={{ memberId: member.id }}
            submitLabel={labels.update}
          >
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <Field
                defaultValue={member.displayName}
                label={labels.name}
                name="displayName"
                required
              />
              <Field
                defaultValue={member.phone ?? ""}
                label={labels.phone}
                name="phone"
                type="tel"
              />
              <Field
                defaultValue={member.shareCount}
                label={labels.shares}
                min="1"
                name="shareCount"
                required
                type="number"
              />
              <Field
                defaultValue={member.monthlyHafta}
                label={labels.hafta}
                name="monthlyHafta"
                required
              />
              <SelectField
                defaultValue={member.status}
                label={labels.status}
                name="status"
                options={[
                  { value: "ACTIVE", label: labels.active },
                  { value: "INACTIVE", label: labels.inactive },
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
    );
  }

  return (
    <tr className="border-b border-[var(--line)] last:border-0">
      <td className="px-4 py-3">
        <span className="font-medium">{member.displayName}</span>
        {member.phone ? (
          <span className="block text-xs text-[var(--muted)]">{member.phone}</span>
        ) : null}
      </td>
      <td className="px-4 py-3">{member.shareCount}</td>
      <td className="px-4 py-3 text-right">{member.haftaLabel}</td>
      <td className="px-4 py-3 text-right">{member.contributedLabel}</td>
      <td className="px-4 py-3">
        {isInactive ? (
          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-[var(--warn)]">
            {inactiveLabel}
          </span>
        ) : null}
      </td>
      <td className="px-4 py-3 text-right">
        <button
          className="focus-ring inline-flex items-center gap-1.5 rounded px-2 py-1 text-sm font-medium text-[var(--primary)] hover:underline"
          onClick={() => setEditing(true)}
          type="button"
        >
          <Pencil size={14} />
          {editLabel}
        </button>
      </td>
    </tr>
  );
}
