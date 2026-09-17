import { ArrowLeft, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { LoginForm } from "@/app/(auth)/login/login-form";
import { loginPlatform } from "@/app/(auth)/login/actions";
import { LanguageToggle } from "@/components/layout/language-toggle";
import { getMessages } from "@/lib/i18n";
import { platform } from "@/lib/demo-data";

type PageProps = {
  searchParams: Promise<{ next?: string }>;
};

/**
 * The platform front door, for BhishiBook staff only.
 *
 * Deliberately not wrapped in AppShell: a group's branding has no business on
 * the platform sign-in, and this page should not look like a tenant page.
 */
export default async function SuperadminLoginPage({ searchParams }: PageProps) {
  const t = await getMessages();
  const { next } = await searchParams;

  return (
    <div className="flex min-h-screen flex-col bg-[var(--foreground)]">
      <header className="flex items-center justify-between px-4 py-4 sm:px-6">
        <span className="flex items-center gap-2 font-bold text-white">
          <ShieldCheck size={20} />
          {platform.name}
        </span>
        <LanguageToggle />
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-10 sm:px-6">
        <section className="w-full max-w-md">
          <div className="rounded-lg border border-[var(--line)] bg-white p-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--accent)]">
              {t.login.platformEyebrow}
            </p>
            <h1 className="mt-2 text-2xl font-bold">{t.login.platformTitle}</h1>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
              {t.login.platformSubtitle}
            </p>

            <div className="mt-6">
              <LoginForm
                labels={{
                  email: t.login.email,
                  password: t.login.password,
                  submit: t.login.submit,
                  submitting: t.login.submitting,
                }}
                next={next}
                signIn={loginPlatform}
              />
            </div>
          </div>

          <Link
            className="focus-ring mt-4 flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-white/70 hover:text-white"
            href="/login"
          >
            <ArrowLeft size={15} />
            {t.login.tenantLink}
          </Link>

          {process.env.NODE_ENV !== "production" ? (
            <p className="mt-4 rounded-lg border border-dashed border-white/25 p-4 text-center text-sm text-white/70">
              superadmin@bhishibook.local / <code className="font-semibold">bhishi1234</code>
            </p>
          ) : null}
        </section>
      </main>

      <footer className="px-4 py-4 text-center text-sm text-white/50 sm:px-6">
        {t.app.poweredBy}
      </footer>
    </div>
  );
}
