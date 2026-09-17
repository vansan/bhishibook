import type { LucideIcon } from "lucide-react";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/ui/stat-card";

type DashboardPageProps = {
  actions: string[];
  eyebrow: string;
  stats: Array<{ label: string; value: string; icon: LucideIcon }>;
  subtitle: string;
  title: string;
};

export function DashboardPage({
  actions,
  eyebrow,
  stats,
  subtitle,
  title
}: DashboardPageProps) {
  return (
    <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-start">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-[var(--accent)]">
            {eyebrow}
          </p>
          <h1 className="mt-3 max-w-3xl text-3xl font-bold text-[var(--foreground)] sm:text-4xl">
            {title}
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-[var(--muted)]">
            {subtitle}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            {actions.map((action, index) => (
              <Button
                href="#"
                key={action}
                variant={index === 0 ? "primary" : "secondary"}
              >
                {action}
                {index === 0 ? <ArrowRight size={16} /> : null}
              </Button>
            ))}
          </div>
        </div>
        <div className="rounded-lg border border-[var(--line)] bg-white p-5">
          <h2 className="text-base font-semibold">Part 1 + 2 status</h2>
          <div className="mt-4 space-y-3 text-sm text-[var(--muted)]">
            <p>Foundation, roles, group branding, and language setup are ready.</p>
            <p>
              Finance modules come next: members, cycles, monthly hafta, fines,
              loans, repayments, ledger, receipts, and reports.
            </p>
          </div>
        </div>
      </div>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <StatCard
            icon={stat.icon}
            key={stat.label}
            label={stat.label}
            value={stat.value}
          />
        ))}
      </div>
    </section>
  );
}
