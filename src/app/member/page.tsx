import { Banknote, CalendarDays, ShieldCheck, Users } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { DashboardPage } from "@/components/layout/dashboard-page";
import { demoStats, platform } from "@/lib/demo-data";
import { getMessages } from "@/lib/i18n";
import { getPrimaryGroupOverview } from "@/lib/repositories";
import { formatInr } from "@/lib/utils";

export default async function MemberPage() {
  const t = await getMessages();
  const overview = await getPrimaryGroupOverview();
  const groupName = overview?.groupName ?? platform.defaultGroupName;
  const stats = overview
    ? [
        { label: "Group members", value: String(overview.memberCount), icon: Users },
        { label: "Total shares", value: String(overview.totalShares), icon: ShieldCheck },
        {
          label: "Monthly group collection",
          value: formatInr(overview.monthlyCollection),
          icon: Banknote
        },
        {
          label: "Hafta window",
          value: overview.contributionDueDay
            ? `1-${overview.contributionDueDay}`
            : "1-10",
          icon: CalendarDays
        }
      ]
    : demoStats.member;

  return (
    <AppShell groupName={groupName}>
      <DashboardPage
        actions={t.member.actions}
        eyebrow="Member"
        stats={stats}
        subtitle={t.member.subtitle}
        title={t.member.title}
      />
    </AppShell>
  );
}
