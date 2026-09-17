import Link from "next/link";
import { cn } from "@/lib/utils";

type ButtonProps = {
  children: React.ReactNode;
  className?: string;
  href?: string;
  variant?: "primary" | "secondary" | "ghost";
};

export function Button({
  children,
  className,
  href,
  variant = "primary"
}: ButtonProps) {
  const classes = cn(
    "focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition",
    variant === "primary" &&
      "bg-[var(--primary)] text-white hover:bg-[var(--primary-strong)]",
    variant === "secondary" &&
      "border border-[var(--line)] bg-white text-[var(--foreground)] hover:border-[var(--primary)]",
    variant === "ghost" &&
      "text-[var(--muted)] hover:bg-white hover:text-[var(--foreground)]",
    className
  );

  if (href) {
    return (
      <Link className={classes} href={href}>
        {children}
      </Link>
    );
  }

  return <button className={classes}>{children}</button>;
}
