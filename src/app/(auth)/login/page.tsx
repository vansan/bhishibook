import { KeyRound } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { getMessages } from "@/lib/i18n";
import { LoginForm } from "./login-form";

// searchParams is a Promise in this version of Next.js.
type LoginPageProps = {
  searchParams: Promise<{ next?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const t = await getMessages();
  const { next } = await searchParams;

  return (
    <AppShell showNav={false}>
      <section className="mx-auto max-w-md px-4 py-12 sm:px-6">
        <div className="rounded-lg border border-[var(--line)] bg-white p-6">
          <div className="flex size-11 items-center justify-center rounded-md bg-emerald-50 text-[var(--primary)]">
            <KeyRound size={22} />
          </div>
          <h1 className="mt-4 text-2xl font-bold">{t.login.title}</h1>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{t.login.subtitle}</p>

          <div className="mt-6">
            <LoginForm
              labels={{
                email: t.login.email,
                password: t.login.password,
                submit: t.login.submit,
                submitting: t.login.submitting,
              }}
              next={next}
            />
          </div>
        </div>

        {process.env.NODE_ENV !== "production" ? (
          <div className="mt-4 rounded-lg border border-dashed border-[var(--line)] bg-white/60 p-4 text-sm text-[var(--muted)]">
            <p className="font-semibold text-[var(--foreground)]">Demo logins</p>
            <ul className="mt-2 space-y-1">
              <li>superadmin@bhishibook.local</li>
              <li>admin@maitrinidhi.local</li>
              <li>amit.patil@maitrinidhi.local</li>
            </ul>
            <p className="mt-2">
              Password for all three: <code className="font-semibold">bhishi1234</code>
            </p>
          </div>
        ) : null}
      </section>
    </AppShell>
  );
}
