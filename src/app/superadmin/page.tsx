import { Banknote, Building2, Gift, Users } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { DashboardPage } from "@/components/layout/dashboard-page";
import { requireSuperAdmin } from "@/lib/auth";
import { getMessages } from "@/lib/i18n";
import { formatPaise } from "@/lib/money";
import { getPlatformOverview } from "@/lib/repositories";
import { platform } from "@/lib/demo-data";

export default async function SuperadminPage() {
  await requireSuperAdmin();

  const [t, overview] = await Promise.all([getMessages(), getPlatformOverview()]);

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
            value: formatPaise(overview.corpusPaise, { whole: true }),
            icon: Banknote,
            hint: t.superadmin.haftaAcrossGroups,
          },
        ]}
        subtitle={t.superadmin.subtitle}
        title={t.superadmin.title}
      />
    </AppShell>
  );
}
