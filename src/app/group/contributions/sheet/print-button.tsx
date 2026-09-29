"use client";

import { Printer } from "lucide-react";

export function PrintButton({ label }: { label: string }) {
  return (
    <button
      className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-[var(--line)] bg-white px-4 py-2 text-sm font-semibold transition hover:border-[var(--primary)]"
      onClick={() => window.print()}
      type="button"
    >
      <Printer size={16} />
      {label}
    </button>
  );
}
