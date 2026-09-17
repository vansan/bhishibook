import Link from "next/link";
import { cn } from "@/lib/utils";

type ButtonProps = {
  children: React.ReactNode;
  className?: string;
  href?: string;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  /**
   * Only meaningful without `href`. Defaults to "submit" so the button works
   * inside a form posting to a Server Function; pass "button" for anything
   * that should not submit.
   */
  type?: "button" | "submit";
  disabled?: boolean;
  name?: string;
  value?: string;
};

export function Button({
  children,
  className,
  href,
  variant = "primary",
  type = "submit",
  disabled,
  name,
  value,
}: ButtonProps) {
  const classes = cn(
    "focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60",
    variant === "primary" &&
      "bg-[var(--primary)] text-white hover:bg-[var(--primary-strong)]",
    variant === "secondary" &&
      "border border-[var(--line)] bg-white text-[var(--foreground)] hover:border-[var(--primary)]",
    variant === "ghost" &&
      "text-[var(--muted)] hover:bg-white hover:text-[var(--foreground)]",
    variant === "danger" &&
      "border border-red-200 bg-white text-red-700 hover:border-red-400",
    className
  );

  if (href) {
    return (
      <Link className={classes} href={href}>
        {children}
      </Link>
    );
  }

  return (
    <button className={classes} disabled={disabled} name={name} type={type} value={value}>
      {children}
    </button>
  );
}
