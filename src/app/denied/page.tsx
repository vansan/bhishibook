import { ShieldAlert } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { getAuth, homePathFor } from "@/lib/auth";
import { getMessages } from "@/lib/i18n";

export default async function DeniedPage() {
  const t = await getMessages();
  const auth = await getAuth();

  return (
    <AppShell>
      <section className="mx-auto max-w-2xl px-4 py-16 text-center sm:px-6">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-amber-50 text-[var(--warn)]">
          <ShieldAlert size={24} />
        </div>
        <h1 className="mt-5 text-2xl font-bold">{t.denied.title}</h1>
        <p className="mt-3 text-base leading-7 text-[var(--muted)]">{t.denied.subtitle}</p>
        <div className="mt-7 flex justify-center">
          <Button href={auth ? homePathFor(auth.role) : "/login"}>
            {auth ? t.denied.backHome : t.nav.login}
          </Button>
        </div>
      </section>
    </AppShell>
  );
}
