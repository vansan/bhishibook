"use client";

import { Languages } from "lucide-react";

export function LanguageToggle() {
  function setLanguage(locale: "en" | "mr") {
    document.cookie = `bb_locale=${locale}; path=/; max-age=31536000; samesite=lax`;
    window.location.reload();
  }

  return (
    <div className="flex items-center gap-1 rounded-md border border-[var(--line)] bg-white p-1">
      <Languages size={16} className="mx-2 text-[var(--muted)]" />
      <button
        className="focus-ring rounded px-2 py-1 text-sm font-medium hover:bg-slate-100 hover:text-[var(--primary)]"
        onClick={() => setLanguage("en")}
        type="button"
      >
        EN
      </button>
      <button
        className="focus-ring rounded px-2 py-1 text-sm font-medium hover:bg-slate-100 hover:text-[var(--primary)]"
        onClick={() => setLanguage("mr")}
        type="button"
      >
        मर
      </button>
    </div>
  );
}
