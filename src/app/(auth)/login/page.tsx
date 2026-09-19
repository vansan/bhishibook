import Image from "next/image";
import { Shield } from "lucide-react";
import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { getMessages } from "@/lib/i18n";
import { loginTenant } from "./actions";
import { LoginForm } from "./login-form";

// searchParams is a Promise in this version of Next.js.
type LoginPageProps = {
  searchParams: Promise<{ next?: string }>;
};

/** The tenant front door: group admins and members of a group. */
export default async function LoginPage({ searchParams }: LoginPageProps) {
  const t = await getMessages();
  const { next } = await searchParams;

  return (
    <AppShell showNav={false}>
      <section className="mx-auto max-w-md px-4 py-12 sm:px-6">
        <div className="rounded-xl border border-[var(--line)] bg-white p-6 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="size-12 shrink-0 overflow-hidden rounded-xl border border-[var(--line)] bg-slate-50 p-1">
              <Image
                alt="BhishiBook Emblem"
                className="size-full object-contain"
                height={48}
                priority
                src="/logo-icon.png"
                width={48}
              />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--accent)]">
                96/97 KH भिशी - MaitriNidhi
              </p>
              <h1 className="text-2xl font-bold text-[var(--foreground)]">{t.login.title}</h1>
            </div>
          </div>
          <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{t.login.subtitle}</p>

          <div className="mt-6">
            <LoginForm
              labels={{
                email: t.login.email,
                emailPlaceholder: t.login.emailPlaceholder,
                password: t.login.password,
                submit: t.login.submit,
                submitting: t.login.submitting,
              }}
              next={next}
              signIn={loginTenant}
            />
          </div>
        </div>

        <Link
          className="focus-ring mt-4 flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-[var(--muted)] hover:text-[var(--foreground)]"
          href="/superadmin/login"
        >
          <Shield size={15} />
          {t.login.platformLink}
        </Link>

        {process.env.NODE_ENV !== "production" ? (
          <div className="mt-4 rounded-lg border border-dashed border-[var(--line)] bg-white/60 p-4 text-sm text-[var(--muted)]">
            <p className="font-semibold text-[var(--foreground)]">Demo logins</p>
            <ul className="mt-2 space-y-1">
              <li>admin@maitrinidhi.local — group admin</li>
              <li>amit.patil@maitrinidhi.local — member</li>
            </ul>
            <p className="mt-2">
              Password: <code className="font-semibold">bhishi1234</code>
            </p>
          </div>
        ) : null}
      </section>
    </AppShell>
  );
}
