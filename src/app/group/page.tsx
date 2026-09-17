import { Banknote, CalendarDays, Settings2, Users } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { DashboardPage } from "@/components/layout/dashboard-page";
import { demoStats, platform } from "@/lib/demo-data";
import { getMessages } from "@/lib/i18n";
import { getPrimaryGroupOverview } from "@/lib/repositories";
import { formatInr } from "@/lib/utils";

export default async function GroupPage() {
  const t = await getMessages();
  const overview = await getPrimaryGroupOverview();
  const groupName = overview?.groupName ?? platform.defaultGroupName;
  const stats = overview
    ? [
        { label: "Members", value: String(overview.memberCount), icon: Users },
        {
          label: "Monthly collection",
          value: formatInr(overview.monthlyCollection),
          icon: Banknote
        },
        {
          label: "Due day",
          value: overview.contributionDueDay
            ? `1-${overview.contributionDueDay}`
            : "1-10",
          icon: CalendarDays
        },
        {
          label: "Distribution",
          value:
            overview.distributionBase === "CORPUS_PLUS_INTEREST"
              ? "Corpus + Interest"
              : "Interest",
          icon: Settings2
        }
      ]
    : demoStats.group;

  return (
    <AppShell groupName={groupName}>
      <DashboardPage
        actions={t.group.actions}
        eyebrow="Group workspace"
        stats={stats}
        subtitle={t.group.subtitle}
        title={groupName}
      />
    </AppShell>
  );
}
