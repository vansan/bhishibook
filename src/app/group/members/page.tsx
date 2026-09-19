import { UserPlus } from "lucide-react";
import { ActionForm, Field } from "@/components/ui/action-form";
import { ExportButton } from "@/components/ui/export-button";
import { requireGroupAdmin } from "@/lib/auth";
import { getLocale, getMessages } from "@/lib/i18n";
import { formatMemberName, formatPhoneNumber } from "@/lib/members";
import { decimalToPaise, formatPaise } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { addMemberAction } from "../actions";
import { MemberRow } from "./member-row";

export default async function MembersPage() {
  const scope = await requireGroupAdmin();
  const [t, locale] = await Promise.all([getMessages(), getLocale()]);

  const members = await prisma.groupMember.findMany({
    where: { groupId: scope.groupId },
    orderBy: [{ status: "asc" }, { displayName: "asc" }],
    select: {
      id: true,
      displayName: true,
      displayNameMr: true,
      phone: true,
      email: true,
      shareCount: true,
      monthlyHafta: true,
      status: true,
      userId: true,
      user: { select: { role: true } },
      defaultDecision: true,
      contributions: { select: { amountPaid: true } },
    },
  });

  const whole = { whole: true } as const;

  const decisionOptions = [
    { value: "PENDING", label: t.members.decisionPending },
    { value: "RETURN_FULL", label: t.members.decisionReturnFull },
    { value: "RETURN_PARTIAL", label: t.members.decisionReturnPartial },
    { value: "RETURN_NONE", label: t.members.decisionReturnNone },
    { value: "CARRY_FORWARD", label: t.members.decisionCarryForward },
    { value: "CUSTOM", label: t.members.decisionCustom },
  ];

  return (
    <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">{t.members.title}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">
            {t.members.subtitle}
          </p>
        </div>
        <ExportButton hint={t.ledger.exportHint} label={t.ledger.export} report="members" />
      </div>

      <div className="mt-6 rounded-lg border border-[var(--line)] bg-white p-5">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <UserPlus size={18} />
          {t.members.addMember}
        </h2>
        <ActionForm
          action={addMemberAction}
          className="mt-4"
          pendingLabel={t.members.adding}
          submitLabel={t.members.addMember}
        >
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label={t.members.name} name="displayName" required />
            <Field label={t.members.phone} name="phone" type="tel" />
            <Field
              defaultValue="1"
              hint={t.members.sharesHint}
              label={t.members.shareCount}
              min="1"
              name="shareCount"
              required
              type="number"
            />
            <Field
              defaultValue="1000"
              hint={t.members.haftaHint}
              label={t.members.monthlyHafta}
              name="monthlyHafta"
              required
            />
          </div>
        </ActionForm>
      </div>

      <div className="mt-6 overflow-x-auto rounded-lg border border-[var(--line)] bg-white">
        <table className="w-full min-w-[1080px] text-sm">
          <caption className="sr-only">{t.members.title}</caption>
          <thead>
            <tr className="border-b border-[var(--line)] text-left text-[var(--muted)]">
              <th className="px-4 py-3 font-medium" scope="col">
                {t.members.name}
              </th>
              <th className="px-4 py-3 font-medium" scope="col">
                {t.members.shareCount}
              </th>
              <th className="px-4 py-3 text-right font-medium" scope="col">
                {t.members.monthlyHafta}
              </th>
              <th className="px-4 py-3 text-right font-medium" scope="col">
                {t.members.contributed}
              </th>
              <th className="px-4 py-3 font-medium" scope="col">
                {t.members.login}
              </th>
              <th className="px-4 py-3 text-left font-medium" scope="col">
                <span className="sr-only">{t.members.edit}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {members.map((member) => (
              <MemberRow
                key={member.id}
                labels={{
                  edit: t.members.edit,
                  update: t.members.update,
                  name: t.members.name,
                  phone: t.members.phone,
                  shares: t.members.shareCount,
                  hafta: t.members.monthlyHafta,
                  status: t.common.status,
                  active: t.common.active,
                  inactive: t.common.inactive,
                  adminBadge: t.common.adminBadge,
                  makeAdmin: t.members.makeAdmin,
                  removeAdmin: t.members.removeAdmin,
                  login: t.members.login,
                  hasLogin: t.members.hasLogin,
                  noLogin: t.members.noLogin,
                  inviteLogin: t.members.inviteLogin,
                  inviteHint: t.members.inviteHint,
                  resetPassword: t.members.resetPassword,
                  newPassword: t.members.newPassword,
                  email: t.login.email,
                  password: t.login.password,
                  yearEndDecision: t.members.yearEndDecision,
                  decision: t.members.decision,
                  decisionNote: t.members.decisionNote,
                  recordDecision: t.members.recordDecision,
                  decisionOptions,
                }}
                member={{
                  id: member.id,
                  displayName: formatMemberName(member, locale),
                  phone: formatPhoneNumber(member.phone),
                  email: member.email,
                  shareCount: member.shareCount,
                  monthlyHafta: member.monthlyHafta.toFixed(2),
                  status: member.status,
                  hasLogin: member.userId !== null,
                  isAdmin: member.user?.role === "GROUP_ADMIN" || member.user?.role === "SUPER_ADMIN",
                  decision: member.defaultDecision,
                  contributedLabel: formatPaise(
                    member.contributions.reduce(
                      (total, row) => total + decimalToPaise(row.amountPaid),
                      0
                    ),
                    whole
                  ),
                  haftaLabel: formatPaise(decimalToPaise(member.monthlyHafta), whole),
                }}
              />
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs text-[var(--muted)]">{t.members.markInactive}</p>
    </section>
  );
}
