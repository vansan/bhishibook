import { ArrowRight, CheckCircle2 } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { platform, roadmap } from "@/lib/demo-data";
import { getMessages } from "@/lib/i18n";

export default async function HomePage() {
  const t = await getMessages();

  return (
    <AppShell groupName={platform.defaultGroupName}>
      <section className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:px-8">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-[var(--accent)]">
            {platform.name}
          </p>
          <h1 className="mt-3 max-w-3xl text-4xl font-bold leading-tight text-[var(--foreground)] sm:text-5xl">
            SaaS foundation for friend groups, classmates, and community bhishi.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--muted)]">
            Each group can use its own name, language, members, rules, and cycle
            settings while BhishiBook stays as the platform powering everything.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Button href="/login">
              {t.nav.login}
              <ArrowRight size={16} />
            </Button>
            <Button href="/superadmin" variant="secondary">
              {t.nav.superadmin}
            </Button>
          </div>
        </div>
        <div className="rounded-lg border border-[var(--line)] bg-white p-5">
          <div className="border-b border-[var(--line)] pb-4">
            <p className="text-sm text-[var(--muted)]">Group display</p>
            <h2 className="mt-1 text-2xl font-bold">{platform.defaultGroupName}</h2>
            <p className="mt-1 text-sm font-medium text-[var(--primary)]">
              {t.app.poweredBy}
            </p>
          </div>
          <div className="mt-5 space-y-3">
            {roadmap.map((item) => (
              <div className="flex gap-3" key={item}>
                <CheckCircle2
                  className="mt-0.5 shrink-0 text-[var(--primary)]"
                  size={18}
                />
                <p className="text-sm leading-6 text-[var(--muted)]">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </AppShell>
  );
}
