"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, User, X } from "lucide-react";
import { LogoutButton } from "@/components/layout/logout-button";
import { PwaInstallButton } from "@/components/pwa-install-button";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type NavLink = {
  href: string;
  label: string;
};

type NavHeaderProps = {
  heading: string;
  poweredBy: string;
  links: NavLink[];
  groupTabs?: NavLink[];
  auth: { role: string; name: string } | null;
  labels: {
    profile: string;
    login: string;
    logout: string;
    installApp: string;
    menu: string;
    close: string;
  };
  showNav: boolean;
  languageToggle: React.ReactNode;
};

export function NavHeader({
  heading,
  poweredBy,
  links,
  groupTabs,
  auth,
  labels,
  showNav,
  languageToggle,
}: NavHeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();

  const closeMenu = () => setMobileMenuOpen(false);

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--line)] bg-white print:hidden">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 px-3 py-2.5 sm:px-6 sm:py-3.5 lg:px-8">
        {/* Brand Logo & Title */}
        <Link className="flex min-w-0 items-center gap-2 sm:gap-3" href="/" onClick={closeMenu}>
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-[var(--line)] bg-white p-1 shadow-2xs sm:size-10">
            <Image
              alt="BhishiBook Emblem"
              className="size-full object-contain"
              height={36}
              priority
              src="/logo-icon.png"
              width={36}
            />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-[var(--foreground)] sm:text-base lg:text-lg">
              {heading}
            </p>
            <p className="hidden text-[10px] font-medium text-[var(--muted)] sm:block sm:text-xs">
              {poweredBy}
            </p>
          </div>
        </Link>

        {/* Right side controls */}
        {showNav ? (
          <>
            {/* Desktop Navigation */}
            <nav className="hidden items-center gap-2 md:flex">
              {links.map((link) => {
                const active =
                  link.href === "/group"
                    ? pathname.startsWith("/group")
                    : pathname.startsWith(link.href);
                return (
                  <Button
                    className={cn(active && "font-bold text-[var(--primary)]")}
                    href={link.href}
                    key={link.href}
                    variant="ghost"
                  >
                    {link.label}
                  </Button>
                );
              })}

              {languageToggle}

              {auth ? (
                <>
                  <Button
                    className={cn(pathname === "/profile" && "font-bold text-[var(--primary)]")}
                    href="/profile"
                    variant="ghost"
                  >
                    <User size={15} />
                    {labels.profile}
                  </Button>
                  <PwaInstallButton label={labels.installApp} variant="ghost" />
                  <LogoutButton label={labels.logout} name={auth.name} />
                </>
              ) : (
                <>
                  <PwaInstallButton label={labels.installApp} variant="ghost" />
                  <Button
                    className="!text-white shadow-xs"
                    href="/login"
                    style={{ color: "#ffffff" }}
                  >
                    <span className="font-semibold text-white">{labels.login}</span>
                  </Button>
                </>
              )}
            </nav>

            {/* Mobile Header Controls: Install Button + Language Toggle + Hamburger Button */}
            <div className="flex shrink-0 items-center gap-2 md:hidden">
              <PwaInstallButton
                className="h-8 shrink-0 px-2.5 py-1 text-xs font-bold whitespace-nowrap"
                label="Install"
                variant="banner"
              />
              {languageToggle}
              <button
                aria-expanded={mobileMenuOpen}
                aria-label={mobileMenuOpen ? labels.close : labels.menu}
                className="focus-ring inline-flex size-8 shrink-0 items-center justify-center rounded-lg border border-[var(--line)] bg-white text-[var(--foreground)] hover:bg-slate-50"
                onClick={() => setMobileMenuOpen((prev) => !prev)}
                type="button"
              >
                {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
              </button>
            </div>
          </>
        ) : (
          <div className="flex shrink-0 items-center gap-2">
            <PwaInstallButton
              className="h-8 shrink-0 px-2.5 py-1 text-xs font-bold whitespace-nowrap"
              label="Install"
              variant="banner"
            />
            {languageToggle}
          </div>
        )}
      </div>

      {/* Mobile Drawer / Slide-down Menu */}
      {showNav && mobileMenuOpen ? (
        <div className="max-h-[85vh] overflow-y-auto border-t border-[var(--line)] bg-white px-4 py-4 shadow-lg md:hidden">
          {auth ? (
            <div className="mb-4 flex items-center justify-between rounded-lg bg-blue-50/60 p-3">
              <div className="flex items-center gap-2.5">
                <div className="flex size-9 items-center justify-center rounded-full bg-[var(--primary)] text-white">
                  <User size={18} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-[var(--foreground)]">{auth.name}</p>
                  <p className="text-xs text-[var(--muted)]">
                    {auth.role === "GROUP_ADMIN" ? "व्यवस्थापक / Admin" : "सभासद / Member"}
                  </p>
                </div>
              </div>
            </div>
          ) : null}

          <div className="flex flex-col gap-1.5">
            {groupTabs && groupTabs.length > 0 ? (
              <div className="flex flex-col gap-1">
                <p className="px-3 pb-1 text-xs font-bold uppercase tracking-wider text-[var(--muted)]">
                  विभाग / Sections
                </p>
                {groupTabs.map((tab) => {
                  const active =
                    tab.href === "/group"
                      ? pathname === "/group"
                      : pathname.startsWith(tab.href);
                  return (
                    <Link
                      className={cn(
                        "flex items-center rounded-lg px-3 py-2 text-sm font-medium transition",
                        active
                          ? "bg-[var(--primary)] !text-white text-white font-semibold"
                          : "text-[var(--foreground)] hover:bg-slate-100"
                      )}
                      href={tab.href}
                      key={tab.href}
                      onClick={closeMenu}
                      style={active ? { color: "#ffffff" } : undefined}
                    >
                      <span className={active ? "text-white font-semibold" : undefined}>
                        {tab.label}
                      </span>
                    </Link>
                  );
                })}

                {auth?.role === "GROUP_ADMIN" ? (
                  <div className="mt-2 border-t border-[var(--line)] pt-2">
                    <Link
                      className={cn(
                        "flex items-center rounded-lg px-3 py-2 text-sm font-medium transition",
                        pathname === "/member"
                          ? "bg-[var(--primary)] !text-white text-white font-semibold"
                          : "text-[var(--foreground)] hover:bg-slate-100"
                      )}
                      href="/member"
                      onClick={closeMenu}
                      style={pathname === "/member" ? { color: "#ffffff" } : undefined}
                    >
                      <span className={pathname === "/member" ? "text-white font-semibold" : undefined}>
                        माझे खाते (Member View)
                      </span>
                    </Link>
                  </div>
                ) : null}
              </div>
            ) : (
              links.map((link) => {
                const active =
                  link.href === "/group"
                    ? pathname.startsWith("/group")
                    : pathname.startsWith(link.href);
                return (
                  <Link
                    className={cn(
                      "flex items-center rounded-lg px-3 py-2.5 text-base font-medium transition",
                      active
                        ? "bg-[var(--primary)] !text-white text-white font-semibold"
                        : "text-[var(--foreground)] hover:bg-slate-100"
                    )}
                    href={link.href}
                    key={link.href}
                    onClick={closeMenu}
                    style={active ? { color: "#ffffff" } : undefined}
                  >
                    <span className={active ? "text-white font-semibold" : undefined}>
                      {link.label}
                    </span>
                  </Link>
                );
              })
            )}

            {auth ? (
              <>
                <Link
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition mt-1",
                    pathname === "/profile"
                      ? "bg-[var(--primary)] !text-white text-white font-semibold"
                      : "text-[var(--foreground)] hover:bg-slate-100"
                  )}
                  href="/profile"
                  onClick={closeMenu}
                  style={pathname === "/profile" ? { color: "#ffffff" } : undefined}
                >
                  <User size={16} />
                  <span className={pathname === "/profile" ? "text-white font-semibold" : undefined}>
                    {labels.profile}
                  </span>
                </Link>

                <div className="mt-3 border-t border-[var(--line)] pt-3">
                  <LogoutButton label={labels.logout} name={auth.name} />
                </div>
              </>
            ) : (
              <div className="mt-3 border-t border-[var(--line)] pt-3">
                <Link
                  className="flex w-full items-center justify-center rounded-lg bg-[var(--primary)] px-4 py-2.5 text-base font-semibold !text-white text-white shadow-sm"
                  href="/login"
                  onClick={closeMenu}
                  style={{ color: "#ffffff" }}
                >
                  <span className="font-semibold text-white">{labels.login}</span>
                </Link>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </header>
  );
}
