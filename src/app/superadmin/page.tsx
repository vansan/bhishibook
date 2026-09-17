import { Banknote, Building2, Gift, Users } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { DashboardPage } from "@/components/layout/dashboard-page";
import { demoStats, platform } from "@/lib/demo-data";
import { getMessages } from "@/lib/i18n";
import { getPlatformOverview } from "@/lib/repositories";

export default async function SuperadminPage() {
  const t = await getMessages();
  const overview = await getPlatformOverview();
  const stats = overview
    ? [
        { label: "Groups", value: String(overview.groupCount), icon: Building2 },
        {
          label: "Active groups",
          value: String(overview.activeGroupCount),
          icon: Users
        },
        {
          label: "Free groups",
          value: String(overview.freeGroupCount),
          icon: Gift
        },
        { label: "Members", value: String(overview.memberCount), icon: Banknote }
      ]
    : demoStats.platform;

  return (
    <AppShell groupName={platform.name}>
      <DashboardPage
        actions={t.superadmin.actions}
        eyebrow="Platform"
        stats={stats}
        subtitle={t.superadmin.subtitle}
        title={t.superadmin.title}
      />
    </AppShell>
  );
}
