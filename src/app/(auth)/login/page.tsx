import { Shield, User, Users } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { getMessages } from "@/lib/i18n";

export default async function LoginPage() {
  const t = await getMessages();

  const roles = [
    {
      title: t.login.superadmin,
      href: "/superadmin",
      icon: Shield
    },
    {
      title: t.login.groupAdmin,
      href: "/group",
      icon: Users
    },
    {
      title: t.login.member,
      href: "/member",
      icon: User
    }
  ];

  return (
    <AppShell>
      <section className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <h1 className="text-3xl font-bold sm:text-4xl">{t.login.title}</h1>
          <p className="mt-3 text-base leading-7 text-[var(--muted)]">
            {t.login.subtitle}
          </p>
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {roles.map((role) => (
            <div
              className="rounded-lg border border-[var(--line)] bg-white p-5"
              key={role.href}
            >
              <div className="flex size-11 items-center justify-center rounded-md bg-emerald-50 text-[var(--primary)]">
                <role.icon size={22} />
              </div>
              <h2 className="mt-4 text-lg font-semibold">{role.title}</h2>
              <Button className="mt-5 w-full" href={role.href}>
                Open
              </Button>
            </div>
          ))}
        </div>
      </section>
    </AppShell>
  );
}
