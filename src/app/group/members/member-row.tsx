"use client";

import { useState } from "react";
import { Gavel, KeyRound, Pencil, ShieldAlert, ShieldCheck, X } from "lucide-react";
import { ActionForm, Field, SelectField } from "@/components/ui/action-form";
import { cn } from "@/lib/utils";
import {
  inviteMemberLoginAction,
  recordDefaultDecisionAction,
  resetMemberPasswordAction,
  toggleMemberAdminAction,
  updateMemberAction,
} from "../actions";

type Panel = "none" | "edit" | "login" | "decision";

type MemberRowProps = {
  member: {
    id: string;
    displayName: string;
    phone: string | null;
    email: string | null;
    shareCount: number;
    monthlyHafta: string;
    status: string;
    hasLogin: boolean;
    isAdmin: boolean;
    decision: string;
    contributedLabel: string;
    haftaLabel: string;
  };
  labels: {
    adminBadge: string;
    makeAdmin: string;
    removeAdmin: string;
    edit: string;
    update: string;
    name: string;
    phone: string;
    shares: string;
    hafta: string;
    status: string;
    active: string;
    inactive: string;
    login: string;
    hasLogin: string;
    noLogin: string;
    inviteLogin: string;
    inviteHint: string;
    resetPassword: string;
    newPassword: string;
    email: string;
    password: string;
    yearEndDecision: string;
    decision: string;
    decisionNote: string;
    recordDecision: string;
    decisionOptions: Array<{ value: string; label: string }>;
  };
};

export function MemberRow({ member, labels }: MemberRowProps) {
  const [panel, setPanel] = useState<Panel>("none");
  const isInactive = member.status === "INACTIVE";
  const close = () => setPanel("none");

  const toggle = (next: Panel) => setPanel((current) => (current === next ? "none" : next));

  return (
    <>
      <tr className="border-b border-[var(--line)]">
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="font-medium">{member.displayName}</span>
            {member.isAdmin ? (
              <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-[var(--primary)]">
                {labels.adminBadge}
              </span>
            ) : null}
          </div>
          {member.phone ? (
            <span className="block text-xs text-[var(--muted)]">{member.phone}</span>
          ) : null}
        </td>
        <td className="px-4 py-3">{member.shareCount}</td>
        <td className="px-4 py-3 text-right">{member.haftaLabel}</td>
        <td className="px-4 py-3 text-right">{member.contributedLabel}</td>
        <td className="px-4 py-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className={cn(
                "inline-block rounded-full px-2 py-0.5 text-xs font-medium",
                member.hasLogin
                  ? "bg-blue-50 text-[var(--primary)]"
                  : "bg-gray-100 text-[var(--muted)]"
              )}
            >
              {member.hasLogin ? labels.hasLogin : labels.noLogin}
            </span>
            {isInactive ? (
              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-[var(--warn)]">
                {labels.inactive}
              </span>
            ) : null}
          </div>
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center justify-start gap-2 whitespace-nowrap">
            <RowButton icon={Pencil} label={labels.edit} onClick={() => toggle("edit")} />
            <RowButton
              icon={KeyRound}
              label={member.hasLogin ? labels.resetPassword : labels.inviteLogin}
              onClick={() => toggle("login")}
            />
            <ActionForm
              action={toggleMemberAdminAction}
              hidden={{ memberId: member.id, makeAdmin: member.isAdmin ? "0" : "1" }}
              icon={member.isAdmin ? ShieldAlert : ShieldCheck}
              pendingLabel="..."
              submitLabel={member.isAdmin ? labels.removeAdmin : labels.makeAdmin}
              variant={member.isAdmin ? "danger-link" : "link"}
            />
            <RowButton
              icon={Gavel}
              label={labels.yearEndDecision}
              onClick={() => toggle("decision")}
            />
          </div>
        </td>
      </tr>

      {panel !== "none" ? (
        <tr className="border-b border-[var(--line)] bg-emerald-50/40">
          <td className="px-4 py-4" colSpan={6}>
            {panel === "edit" ? (
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
            ) : null}

            {panel === "login" ? (
              member.hasLogin ? (
                <ActionForm
                  action={resetMemberPasswordAction}
                  hidden={{ memberId: member.id }}
                  submitLabel={labels.resetPassword}
                  variant="secondary"
                >
                  <div className="grid max-w-md gap-4">
                    <Field label={labels.newPassword} name="password" required />
                  </div>
                </ActionForm>
              ) : (
                <ActionForm
                  action={inviteMemberLoginAction}
                  hidden={{ memberId: member.id }}
                  submitLabel={labels.inviteLogin}
                >
                  <p className="text-xs text-[var(--muted)]">{labels.inviteHint}</p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field
                      defaultValue={member.email ?? ""}
                      label={labels.email}
                      name="email"
                      required
                      type="email"
                    />
                    <Field label={labels.password} name="password" required />
                  </div>
                </ActionForm>
              )
            ) : null}

            {panel === "decision" ? (
              <ActionForm
                action={recordDefaultDecisionAction}
                hidden={{ memberId: member.id }}
                submitLabel={labels.recordDecision}
                variant="secondary"
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <SelectField
                    defaultValue={member.decision}
                    label={labels.decision}
                    name="decision"
                    options={labels.decisionOptions}
                  />
                  <Field label={labels.decisionNote} name="note" />
                </div>
              </ActionForm>
            ) : null}

            <button
              className="focus-ring mt-2 inline-flex items-center gap-1.5 rounded px-2 py-1 text-sm text-[var(--muted)] hover:text-[var(--foreground)]"
              onClick={close}
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

function RowButton({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof Pencil;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className="focus-ring inline-flex items-center gap-1.5 rounded px-2 py-1 text-sm font-medium text-[var(--primary)] hover:underline"
      onClick={onClick}
      type="button"
    >
      <Icon size={14} />
      {label}
    </button>
  );
}
