import { LanguageToggle } from "@/components/layout/language-toggle";
import { NavHeader } from "@/components/layout/nav-header";
import { getAuth } from "@/lib/auth";
import { getMessages } from "@/lib/i18n";
import { platform } from "@/lib/demo-data";

type AppShellProps = {
  children: React.ReactNode;
  /** The group whose name brands the header. Falls back to the platform name. */
  groupName?: string;
  showNav?: boolean;
};

export async function AppShell({ children, groupName, showNav = true }: AppShellProps) {
  const [t, auth] = await Promise.all([getMessages(), getAuth()]);
  const heading = groupName ?? platform.defaultGroupName;

  // Nav follows the role: a member never sees a link into the admin area.
  const links =
    auth?.role === "SUPER_ADMIN"
      ? [
          { href: "/superadmin", label: t.nav.superadmin },
          { href: "/group", label: t.nav.group },
        ]
      : auth?.role === "GROUP_ADMIN"
        ? [
            { href: "/group", label: t.nav.group },
            { href: "/member", label: t.nav.member },
          ]
        : auth
          ? [{ href: "/member", label: t.nav.member }]
          : [];

  return (
    <div className="flex min-h-screen flex-col">
      <NavHeader
        auth={auth ? { role: auth.role, name: auth.name } : null}
        heading={heading}
        labels={{
          profile: t.nav.profile,
          login: t.nav.login,
          logout: t.nav.logout,
          installApp: t.nav.installApp,
          menu: t.nav.menu,
          close: t.nav.close,
        }}
        languageToggle={<LanguageToggle />}
        links={links}
        poweredBy={t.app.poweredBy}
        showNav={showNav}
      />

      <main className="flex-1">{children}</main>

      <footer className="border-t border-[var(--line)] bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4 text-sm text-[var(--muted)] sm:px-6 lg:px-8">
          <span>{t.app.poweredBy}</span>
          <span>{t.app.freeSoftware}</span>
        </div>
      </footer>
    </div>
  );
}
