"use client";

import { useActionState } from "react";
import { AlertCircle, LogIn } from "lucide-react";
import type { LoginState } from "./actions";

type LoginFormProps = {
  /** loginTenant or loginPlatform, chosen by the page that renders this. */
  signIn: (prev: LoginState, formData: FormData) => Promise<LoginState>;
  next?: string;
  labels: {
    email: string;
    password: string;
    submit: string;
    submitting: string;
  };
};

const INITIAL: LoginState = {};

export function LoginForm({ signIn, next, labels }: LoginFormProps) {
  const [state, action, pending] = useActionState(signIn, INITIAL);

  return (
    <form action={action} className="space-y-4">
      {next ? <input name="next" type="hidden" value={next} /> : null}

      <div>
        <label className="block text-sm font-medium" htmlFor="email">
          {labels.email}
        </label>
        <input
          autoComplete="email"
          className="focus-ring mt-1 w-full rounded-md border border-[var(--line)] bg-white px-3 py-2.5 text-base"
          id="email"
          name="email"
          required
          type="email"
        />
      </div>

      <div>
        <label className="block text-sm font-medium" htmlFor="password">
          {labels.password}
        </label>
        <input
          autoComplete="current-password"
          className="focus-ring mt-1 w-full rounded-md border border-[var(--line)] bg-white px-3 py-2.5 text-base"
          id="password"
          name="password"
          required
          type="password"
        />
      </div>

      {state.error ? (
        <p
          className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
          role="alert"
        >
          <AlertCircle className="mt-0.5 shrink-0" size={16} />
          {state.error}
        </p>
      ) : null}

      <button
        className="focus-ring inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--primary-strong)] disabled:opacity-60"
        disabled={pending}
        type="submit"
      >
        <LogIn size={16} />
        {pending ? labels.submitting : labels.submit}
      </button>
    </form>
  );
}
