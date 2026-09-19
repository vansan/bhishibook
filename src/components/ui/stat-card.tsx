import type { LucideIcon } from "lucide-react";

type StatCardProps = {
  icon: LucideIcon;
  label: string;
  value: string;
  hint?: string;
};

export function StatCard({ icon: Icon, label, value, hint }: StatCardProps) {
  return (
    <div className="rounded-lg border border-[var(--line)] bg-white p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm text-[var(--muted)]">{label}</p>
          <p className="mt-2 text-2xl font-semibold text-[var(--foreground)]">{value}</p>
          {hint ? <p className="mt-1 text-xs text-[var(--muted)]">{hint}</p> : null}
        </div>
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-[var(--primary)]">
          <Icon size={20} />
        </div>
      </div>
    </div>
  );
}
