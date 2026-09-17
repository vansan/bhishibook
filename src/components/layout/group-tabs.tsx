"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export type GroupTab = { href: string; label: string };

export function GroupTabs({ tabs }: { tabs: GroupTab[] }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Group sections"
      className="border-b border-[var(--line)] bg-white/70"
    >
      <div className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 sm:px-6 lg:px-8">
        {tabs.map((tab) => {
          // /group must only light up on an exact match, or it would stay
          // active on every child route.
          const active =
            tab.href === "/group" ? pathname === "/group" : pathname.startsWith(tab.href);

          return (
            <Link
              aria-current={active ? "page" : undefined}
              className={cn(
                "focus-ring whitespace-nowrap border-b-2 px-3 py-3 text-sm font-medium transition",
                active
                  ? "border-[var(--primary)] text-[var(--primary)]"
                  : "border-transparent text-[var(--muted)] hover:text-[var(--foreground)]"
              )}
              href={tab.href}
              key={tab.href}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
