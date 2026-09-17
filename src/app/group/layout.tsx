import { AppShell } from "@/components/layout/app-shell";
import { GroupTabs } from "@/components/layout/group-tabs";
import { requireGroupAdmin } from "@/lib/auth";
import { getMessages } from "@/lib/i18n";
import { prisma } from "@/lib/prisma";

/**
 * Wraps every group admin screen, so the auth check and the group branding
 * happen once rather than being repeated (and possibly forgotten) per page.
 */
export default async function GroupLayout({ children }: { children: React.ReactNode }) {
  const scope = await requireGroupAdmin();

  const [t, group] = await Promise.all([
    getMessages(),
    prisma.group.findUnique({
      where: { id: scope.groupId },
      select: { name: true },
    }),
  ]);

  return (
    <AppShell groupName={group?.name}>
      <GroupTabs
        tabs={[
          { href: "/group", label: t.tabs.dashboard },
          { href: "/group/members", label: t.tabs.members },
          { href: "/group/contributions", label: t.tabs.contributions },
          { href: "/group/loans", label: t.tabs.loans },
          { href: "/group/fines", label: t.tabs.fines },
          { href: "/group/ledger", label: t.tabs.ledger },
          { href: "/group/receipts", label: t.tabs.receipts },
          { href: "/group/distribution", label: t.tabs.distribution },
        ]}
      />
      {children}
    </AppShell>
  );
}
