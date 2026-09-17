import type { LucideIcon } from "lucide-react";

type StatCardProps = {
  icon: LucideIcon;
  label: string;
  value: string;
};

export function StatCard({ icon: Icon, label, value }: StatCardProps) {
  return (
    <div className="rounded-lg border border-[var(--line)] bg-white p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-[var(--muted)]">{label}</p>
          <p className="mt-2 text-2xl font-semibold text-[var(--foreground)]">
            {value}
          </p>
        </div>
        <div className="flex size-10 items-center justify-center rounded-md bg-emerald-50 text-[var(--primary)]">
          <Icon size={20} />
        </div>
      </div>
    </div>
  );
}
