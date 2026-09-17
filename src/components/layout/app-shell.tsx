import Link from "next/link";
import { BookOpenText } from "lucide-react";
import { LanguageToggle } from "@/components/layout/language-toggle";
import { LogoutButton } from "@/components/layout/logout-button";
import { Button } from "@/components/ui/button";
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
      <header className="border-b border-[var(--line)] bg-white/90">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
          <Link className="flex min-w-0 items-center gap-3" href="/">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-[var(--primary)] text-white">
              <BookOpenText size={22} />
            </div>
            <div className="min-w-0">
              <p className="truncate text-lg font-bold">{heading}</p>
              <p className="text-xs font-medium text-[var(--muted)]">{t.app.poweredBy}</p>
            </div>
          </Link>

          {showNav ? (
            <nav className="flex flex-wrap items-center gap-2">
              {links.map((link) => (
                <Button href={link.href} key={link.href} variant="ghost">
                  {link.label}
                </Button>
              ))}
              <LanguageToggle />
              {auth ? (
                <LogoutButton label={t.nav.logout} name={auth.name} />
              ) : (
                <Button href="/login">{t.nav.login}</Button>
              )}
            </nav>
          ) : (
            <LanguageToggle />
          )}
        </div>
      </header>

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
