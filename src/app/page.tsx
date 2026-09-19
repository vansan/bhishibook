import Image from "next/image";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { getAuth, homePathFor } from "@/lib/auth";
import { highlights, platform } from "@/lib/demo-data";
import { getMessages } from "@/lib/i18n";

export default async function HomePage() {
  const [t, auth] = await Promise.all([getMessages(), getAuth()]);

  return (
    <AppShell groupName={platform.name}>
      <section className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:px-8">
        <div>
          <div className="mb-4 flex items-center gap-3">
            <Image
              alt="BhishiBook Logo"
              className="h-12 w-auto object-contain"
              height={48}
              priority
              src="/logo.png"
              width={192}
            />
          </div>
          <h1 className="mt-3 max-w-3xl text-4xl font-bold leading-tight text-[var(--foreground)] sm:text-5xl">
            SaaS foundation for friend groups, classmates, and community bhishi.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--muted)]">
            Each group can use its own name, language, members, rules, and cycle settings
            while BhishiBook stays as the platform powering everything.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            {auth ? (
              <Button href={homePathFor(auth.role)}>
                Go to my dashboard
                <ArrowRight size={16} />
              </Button>
            ) : (
              <Button href="/login">
                {t.nav.login}
                <ArrowRight size={16} />
              </Button>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-[var(--line)] bg-white p-6 shadow-xs">
          <div className="flex items-center gap-4 border-b border-[var(--line)] pb-5">
            <div className="size-16 shrink-0 overflow-hidden rounded-xl border border-[var(--line)] bg-slate-50 p-1">
              <Image
                alt="MaitriNidhi Logo"
                className="size-full object-contain"
                height={64}
                src="/maitrinidhi.png"
                width={64}
              />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--accent)]">{platform.tagline}</p>
              <h2 className="truncate text-xl font-bold text-[var(--foreground)] sm:text-2xl">{platform.defaultGroupName}</h2>
              <p className="mt-0.5 text-xs font-medium text-[var(--muted)]">{t.app.poweredBy}</p>
            </div>
          </div>
          <div className="mt-5 space-y-3">
            {highlights.map((item) => (
              <div className="flex gap-3" key={item}>
                <CheckCircle2 className="mt-0.5 shrink-0 text-[var(--accent)]" size={18} />
                <p className="text-sm leading-6 text-[var(--muted)]">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </AppShell>
  );
}
