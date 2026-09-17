import { Banknote, Building2, Gift, PlusCircle, Users } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { DashboardPage } from "@/components/layout/dashboard-page";
import { ActionForm, Field, SelectField } from "@/components/ui/action-form";
import { requireSuperAdmin } from "@/lib/auth";
import { getMessages } from "@/lib/i18n";
import { decimalToPaise, formatPaise, sumPaise } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { getPlatformOverview } from "@/lib/repositories";
import { platform } from "@/lib/demo-data";
import { createGroupAction } from "./actions";
import { GroupRow } from "./group-row";

export default async function SuperadminPage() {
  await requireSuperAdmin();

  const [t, overview, groups] = await Promise.all([
    getMessages(),
    getPlatformOverview(),
    prisma.group.findMany({
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        name: true,
        status: true,
        planStatus: true,
        defaultLang: true,
        createdAt: true,
        members: { where: { status: { not: "INACTIVE" } }, select: { id: true } },
        cycles: {
          orderBy: { startsOn: "desc" },
          take: 1,
          select: { name: true, status: true },
        },
        _count: { select: { members: true } },
      },
    }),
  ]);

  const whole = { whole: true } as const;

  // Corpus per group, so the platform view shows where the money actually is.
  const corpusRows = await prisma.contribution.groupBy({
    by: ["cycleId"],
    _sum: { amountPaid: true },
  });
  const cycleOwners = await prisma.cycle.findMany({
    select: { id: true, groupId: true },
  });
  const corpusByGroup = new Map<string, number>();
  for (const row of corpusRows) {
    const groupId = cycleOwners.find((cycle) => cycle.id === row.cycleId)?.groupId;
    if (!groupId) continue;
    corpusByGroup.set(
      groupId,
      (corpusByGroup.get(groupId) ?? 0) + decimalToPaise(row._sum.amountPaid)
    );
  }

  return (
    <AppShell groupName={platform.name}>
      <DashboardPage
        eyebrow="Platform"
        stats={[
          { label: t.superadmin.groups, value: String(overview.groupCount), icon: Building2 },
          {
            label: t.superadmin.activeGroups,
            value: String(overview.activeGroupCount),
            icon: Users,
            hint: `${overview.freeGroupCount} ${t.superadmin.onFreePlan}`,
          },
          { label: t.superadmin.members, value: String(overview.memberCount), icon: Gift },
          {
            label: t.superadmin.corpusManaged,
            value: formatPaise(overview.corpusPaise, whole),
            icon: Banknote,
            hint: t.superadmin.haftaAcrossGroups,
          },
        ]}
        subtitle={t.superadmin.subtitle}
        title={t.superadmin.title}
      >
        <div className="overflow-x-auto rounded-lg border border-[var(--line)] bg-white">
          <table className="w-full min-w-[860px] text-sm">
            <caption className="border-b border-[var(--line)] px-5 py-4 text-left text-base font-semibold">
              {t.superadmin.groups}
            </caption>
            <thead>
              <tr className="border-b border-[var(--line)] text-left text-[var(--muted)]">
                <th className="px-4 py-3 font-medium" scope="col">
                  {t.superadmin.groupName}
                </th>
                <th className="px-4 py-3 font-medium" scope="col">
                  {t.superadmin.currentCycle}
                </th>
                <th className="px-4 py-3 text-right font-medium" scope="col">
                  {t.superadmin.members}
                </th>
                <th className="px-4 py-3 text-right font-medium" scope="col">
                  {t.superadmin.corpusManaged}
                </th>
                <th className="px-4 py-3 font-medium" scope="col">
                  {t.common.status}
                </th>
                <th className="px-4 py-3 text-right font-medium" scope="col">
                  <span className="sr-only">{t.superadmin.openGroup}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {groups.map((group) => (
                <GroupRow
                  group={{
                    id: group.id,
                    name: group.name,
                    status: group.status,
                    planStatus: group.planStatus,
                    lang: group.defaultLang,
                    memberCount: group.members.length,
                    cycleLabel: group.cycles[0]
                      ? `${group.cycles[0].name} (${group.cycles[0].status})`
                      : t.superadmin.noCycleYet,
                    corpusLabel: formatPaise(corpusByGroup.get(group.id) ?? 0, whole),
                  }}
                  key={group.id}
                  labels={{
                    open: t.superadmin.openGroup,
                    manage: t.superadmin.manage,
                    status: t.common.status,
                    plan: t.superadmin.plan,
                    save: t.common.save,
                  }}
                />
              ))}
            </tbody>
          </table>
        </div>

        <div className="rounded-lg border border-[var(--line)] bg-white p-5">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <PlusCircle size={18} />
            {t.superadmin.createGroup}
          </h2>
          <p className="mt-1 text-sm text-[var(--muted)]">{t.superadmin.createGroupHint}</p>

          <ActionForm
            action={createGroupAction}
            className="mt-4"
            pendingLabel={t.superadmin.creating}
            submitLabel={t.superadmin.createGroup}
          >
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field
                hint={t.superadmin.groupNameHint}
                label={t.superadmin.groupName}
                name="name"
                placeholder="MaitriNidhi"
                required
              />
              <SelectField
                defaultValue="en"
                label={t.app.language}
                name="defaultLang"
                options={[
                  { value: "en", label: "English" },
                  { value: "mr", label: "मराठी" },
                ]}
              />
              <Field
                defaultValue="10"
                hint={t.superadmin.finePerDayHint}
                label={t.superadmin.finePerDay}
                name="finePerDay"
                required
              />
              <Field label={t.superadmin.adminName} name="adminName" required />
              <Field
                label={t.superadmin.adminEmail}
                name="adminEmail"
                required
                type="email"
              />
              <Field
                hint={t.superadmin.adminPasswordHint}
                label={t.superadmin.adminPassword}
                name="adminPassword"
                required
              />
            </div>
          </ActionForm>
        </div>
      </DashboardPage>
    </AppShell>
  );
}
