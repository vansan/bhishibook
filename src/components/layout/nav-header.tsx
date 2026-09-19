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
  auth,
  labels,
  showNav,
  languageToggle,
}: NavHeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();

  const closeMenu = () => setMobileMenuOpen(false);

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--line)] bg-white/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 px-4 py-3 sm:px-6 sm:py-4 lg:px-8">
        {/* Brand Logo & Title */}
        <Link className="flex min-w-0 items-center gap-2.5 sm:gap-3" href="/" onClick={closeMenu}>
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-[var(--line)] bg-white p-1 shadow-xs sm:size-11">
            <Image
              alt="BhishiBook Emblem"
              className="size-full object-contain"
              height={38}
              priority
              src="/logo-icon.png"
              width={38}
            />
          </div>
          <div className="min-w-0">
            <p className="truncate text-base font-bold text-[var(--foreground)] sm:text-lg">
              {heading}
            </p>
            <p className="text-[11px] font-medium text-[var(--muted)] sm:text-xs">{poweredBy}</p>
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
                  <Button href="/login">{labels.login}</Button>
                </>
              )}
            </nav>

            {/* Mobile Header Controls: Language Toggle + Hamburger Button */}
            <div className="flex items-center gap-1.5 md:hidden">
              {languageToggle}
              <button
                aria-expanded={mobileMenuOpen}
                aria-label={mobileMenuOpen ? labels.close : labels.menu}
                className="focus-ring inline-flex size-10 items-center justify-center rounded-lg border border-[var(--line)] bg-white text-[var(--foreground)] hover:bg-slate-50"
                onClick={() => setMobileMenuOpen((prev) => !prev)}
                type="button"
              >
                {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
              </button>
            </div>
          </>
        ) : (
          <div className="flex items-center gap-2">{languageToggle}</div>
        )}
      </div>

      {/* Mobile Drawer / Slide-down Menu */}
      {showNav && mobileMenuOpen ? (
        <div className="border-t border-[var(--line)] bg-white px-4 py-4 shadow-lg md:hidden">
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
            {links.map((link) => {
              const active =
                link.href === "/group"
                  ? pathname.startsWith("/group")
                  : pathname.startsWith(link.href);
              return (
                <Link
                  className={cn(
                    "flex items-center rounded-lg px-3 py-2.5 text-base font-medium transition",
                    active
                      ? "bg-[var(--primary)] text-white"
                      : "text-[var(--foreground)] hover:bg-slate-100"
                  )}
                  href={link.href}
                  key={link.href}
                  onClick={closeMenu}
                >
                  {link.label}
                </Link>
              );
            })}

            {auth ? (
              <>
                <Link
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-3 py-2.5 text-base font-medium transition",
                    pathname === "/profile"
                      ? "bg-[var(--primary)] text-white"
                      : "text-[var(--foreground)] hover:bg-slate-100"
                  )}
                  href="/profile"
                  onClick={closeMenu}
                >
                  <User size={18} />
                  {labels.profile}
                </Link>

                <div className="pt-2">
                  <PwaInstallButton
                    className="w-full justify-center"
                    label={labels.installApp}
                    variant="primary"
                  />
                </div>

                <div className="mt-3 border-t border-[var(--line)] pt-3">
                  <LogoutButton label={labels.logout} name={auth.name} />
                </div>
              </>
            ) : (
              <>
                <div className="pt-2">
                  <PwaInstallButton
                    className="w-full justify-center"
                    label={labels.installApp}
                    variant="primary"
                  />
                </div>
                <div className="mt-3 border-t border-[var(--line)] pt-3">
                  <Link
                    className="flex w-full items-center justify-center rounded-lg bg-[var(--primary)] px-4 py-2.5 text-base font-semibold text-white"
                    href="/login"
                    onClick={closeMenu}
                  >
                    {labels.login}
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}
    </header>
  );
}
