"use client";

import { useActionState } from "react";
import { AlertCircle, CheckCircle2, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ActionState } from "@/lib/action-state";

type ActionFormProps = {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  children?: React.ReactNode;
  submitLabel: string;
  pendingLabel?: string;
  className?: string;
  variant?: "primary" | "secondary" | "danger" | "link" | "danger-link";
  icon?: LucideIcon;
  /** Values the action needs that the admin does not type. */
  hidden?: Record<string, string>;
  compact?: boolean;
};

/**
 * A form wired to a Server Action, with pending state and inline feedback.
 *
 * Kept as one shared component so every admin screen reports success and
 * failure the same way, and so no screen quietly swallows an error.
 */
export function ActionForm({
  action,
  children,
  submitLabel,
  pendingLabel,
  className,
  variant = "primary",
  icon: Icon,
  hidden,
  compact = false,
}: ActionFormProps) {
  const [state, formAction, pending] = useActionState(action, {} as ActionState);
  const isLink = variant === "link" || variant === "danger-link";

  return (
    <form
      action={formAction}
      className={cn(isLink ? "inline-flex m-0 p-0" : "space-y-3", className)}
    >
      {hidden
        ? Object.entries(hidden).map(([key, value]) => (
            <input key={key} name={key} type="hidden" value={value} />
          ))
        : null}

      {children}

      <div
        className={cn(
          isLink
            ? "inline-flex items-center m-0 p-0 gap-1.5"
            : cn("flex flex-wrap items-center gap-3", compact && "gap-2")
        )}
      >
        <button
          className={cn(
            isLink
              ? cn(
                  "focus-ring inline-flex items-center gap-1.5 rounded px-2 py-1 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60",
                  variant === "link" && "text-[var(--primary)] hover:underline",
                  variant === "danger-link" && "text-red-600 hover:text-red-700 hover:underline"
                )
              : cn(
                  "focus-ring inline-flex items-center justify-center gap-1.5 rounded-md font-semibold transition disabled:cursor-not-allowed disabled:opacity-60",
                  compact ? "min-h-8 px-2.5 py-1 text-xs" : "min-h-11 px-4 py-2 text-sm",
                  variant === "primary" &&
                    "bg-[var(--primary)] text-white hover:bg-[var(--primary-strong)]",
                  variant === "secondary" &&
                    "border border-[var(--line)] bg-white text-[var(--foreground)] hover:border-[var(--primary)]",
                  variant === "danger" &&
                    "border border-red-200 bg-white text-red-700 hover:border-red-400"
                )
          )}
          disabled={pending}
          type="submit"
        >
          {Icon ? <Icon className="shrink-0" size={14} /> : null}
          {pending ? (pendingLabel ?? `${submitLabel}...`) : submitLabel}
        </button>

        {state.error ? (
          <span
            className="flex items-center gap-1.5 text-sm font-medium text-red-700"
            role="alert"
          >
            <AlertCircle size={15} />
            {state.error}
          </span>
        ) : null}

        {state.success ? (
          <span
            className="flex items-center gap-1.5 text-sm font-medium text-[var(--primary)]"
            role="status"
          >
            <CheckCircle2 size={15} />
            {state.success}
          </span>
        ) : null}
      </div>
    </form>
  );
}

type FieldProps = {
  label: string;
  name: string;
  type?: "text" | "number" | "date" | "tel" | "email";
  defaultValue?: string | number;
  placeholder?: string;
  required?: boolean;
  step?: string;
  min?: string;
  hint?: string;
};

export function Field({
  label,
  name,
  type = "text",
  defaultValue,
  placeholder,
  required,
  step,
  min,
  hint,
}: FieldProps) {
  return (
    <label className="block">
      <span className="block text-sm font-medium">{label}</span>
      <input
        className="focus-ring mt-1 w-full rounded-md border border-[var(--line)] bg-white px-3 py-2 text-base"
        defaultValue={defaultValue}
        min={min}
        name={name}
        placeholder={placeholder}
        required={required}
        step={step}
        type={type}
      />
      {hint ? <span className="mt-1 block text-xs text-[var(--muted)]">{hint}</span> : null}
    </label>
  );
}

type SelectFieldProps = {
  label: string;
  name: string;
  options: Array<{ value: string; label: string }>;
  defaultValue?: string;
  required?: boolean;
};

export function SelectField({
  label,
  name,
  options,
  defaultValue,
  required,
}: SelectFieldProps) {
  return (
    <label className="block">
      <span className="block text-sm font-medium">{label}</span>
      <select
        className="focus-ring mt-1 w-full rounded-md border border-[var(--line)] bg-white px-3 py-2 text-base"
        defaultValue={defaultValue}
        name={name}
        required={required}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
