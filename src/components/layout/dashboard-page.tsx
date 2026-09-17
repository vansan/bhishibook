import type { LucideIcon } from "lucide-react";
import { StatCard } from "@/components/ui/stat-card";

export type DashboardStat = {
  label: string;
  value: string;
  hint?: string;
  icon: LucideIcon;
};

type DashboardPageProps = {
  eyebrow: string;
  title: string;
  subtitle: string;
  stats: DashboardStat[];
  /** Action buttons, forms, or filters for this screen. */
  actions?: React.ReactNode;
  children?: React.ReactNode;
};

export function DashboardPage({
  eyebrow,
  title,
  subtitle,
  stats,
  actions,
  children,
}: DashboardPageProps) {
  return (
    <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-[var(--accent)]">
            {eyebrow}
          </p>
          <h1 className="mt-2 text-3xl font-bold text-[var(--foreground)] sm:text-4xl">
            {title}
          </h1>
          <p className="mt-2 max-w-2xl text-base leading-7 text-[var(--muted)]">{subtitle}</p>
        </div>
        {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
      </div>

      {stats.length > 0 ? (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map((stat) => (
            <StatCard
              hint={stat.hint}
              icon={stat.icon}
              key={stat.label}
              label={stat.label}
              value={stat.value}
            />
          ))}
        </div>
      ) : null}

      {children ? <div className="mt-8 space-y-8">{children}</div> : null}
    </section>
  );
}
