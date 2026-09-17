import { LogOut } from "lucide-react";
import { logout } from "@/app/(auth)/login/actions";

type LogoutButtonProps = {
  label: string;
  name: string;
};

/**
 * A plain form posting to the logout Server Function, so signing out works
 * even before JavaScript has hydrated.
 */
export function LogoutButton({ label, name }: LogoutButtonProps) {
  return (
    <form action={logout} className="flex items-center gap-2">
      <span className="hidden text-sm font-medium text-[var(--muted)] sm:inline">{name}</span>
      <button
        className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-[var(--line)] bg-white px-3 py-2 text-sm font-semibold transition hover:border-[var(--primary)]"
        type="submit"
      >
        <LogOut size={16} />
        <span className="hidden sm:inline">{label}</span>
      </button>
    </form>
  );
}
