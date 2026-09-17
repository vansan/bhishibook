import Link from "next/link";
import { BookOpenText } from "lucide-react";
import { LanguageToggle } from "@/components/layout/language-toggle";
import { Button } from "@/components/ui/button";
import { platform } from "@/lib/demo-data";
import { getMessages } from "@/lib/i18n";

type AppShellProps = {
  children: React.ReactNode;
  groupName?: string;
};

export async function AppShell({
  children,
  groupName = platform.defaultGroupName
}: AppShellProps) {
  const t = await getMessages();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-[var(--line)] bg-white/90">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
          <Link className="flex min-w-0 items-center gap-3" href="/">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-[var(--primary)] text-white">
              <BookOpenText size={22} />
            </div>
            <div className="min-w-0">
              <p className="truncate text-lg font-bold">{groupName}</p>
              <p className="text-xs font-medium text-[var(--muted)]">
                {t.app.poweredBy}
              </p>
            </div>
          </Link>
          <nav className="flex flex-wrap items-center gap-2">
            <Button href="/superadmin" variant="ghost">
              {t.nav.superadmin}
            </Button>
            <Button href="/group" variant="ghost">
              {t.nav.group}
            </Button>
            <Button href="/member" variant="ghost">
              {t.nav.member}
            </Button>
            <LanguageToggle />
          </nav>
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
