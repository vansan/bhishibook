"use client";

import { useEffect, useState } from "react";
import { Languages } from "lucide-react";
import { cn } from "@/lib/utils";

export function LanguageToggle() {
  const [currentLocale, setCurrentLocale] = useState<"mr" | "en">("mr");

  useEffect(() => {
    const match = document.cookie.match(/(?:^|;\s*)bb_locale=([^;]*)/);
    if (match && match[1] === "en") {
      setCurrentLocale("en");
    } else {
      setCurrentLocale("mr");
    }
  }, []);

  function setLanguage(locale: "en" | "mr") {
    document.cookie = `bb_locale=${locale}; path=/; max-age=31536000; samesite=lax`;
    window.location.reload();
  }

  return (
    <div className="flex shrink-0 items-center rounded-lg border border-[var(--line)] bg-white p-0.5 text-xs font-semibold shadow-2xs">
      <Languages size={14} className="mx-1 text-[var(--muted)] hidden sm:inline-block" />
      <button
        className={cn(
          "focus-ring rounded px-1.5 py-1 transition",
          currentLocale === "en"
            ? "bg-[var(--primary)] !text-white text-white"
            : "text-[var(--foreground)] hover:bg-slate-100"
        )}
        onClick={() => setLanguage("en")}
        style={currentLocale === "en" ? { color: "#ffffff" } : undefined}
        type="button"
      >
        EN
      </button>
      <button
        className={cn(
          "focus-ring rounded px-1.5 py-1 transition",
          currentLocale === "mr"
            ? "bg-[var(--primary)] !text-white text-white"
            : "text-[var(--foreground)] hover:bg-slate-100"
        )}
        onClick={() => setLanguage("mr")}
        style={currentLocale === "mr" ? { color: "#ffffff" } : undefined}
        type="button"
      >
        मर
      </button>
    </div>
  );
}
