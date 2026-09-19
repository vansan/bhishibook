"use client";

import { useState } from "react";
import { Check, KeyRound, Lock, Phone, Mail, User as UserIcon, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { updateProfileAction, changePasswordAction, type ActionResponse } from "./actions";

type EditProfileProps = {
  initial: {
    name: string;
    email: string;
    phone: string;
  };
  labels: {
    editProfile: string;
    name: string;
    phone: string;
    email: string;
    saveProfile: string;
    saving: string;
  };
};

export function EditProfileForm({ initial, labels }: EditProfileProps) {
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<ActionResponse | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setResult(null);

    const formData = new FormData(e.currentTarget);
    try {
      const res = await updateProfileAction(formData);
      setResult(res);
    } catch {
      setResult({ error: "Something went wrong. Please try again." });
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {result?.error ? (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <ShieldAlert size={18} className="shrink-0" />
          <span>{result.error}</span>
        </div>
      ) : null}

      {result?.ok ? (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          <Check size={18} className="shrink-0" />
          <span>{result.message}</span>
        </div>
      ) : null}

      <div>
        <label className="block text-sm font-medium text-[var(--foreground)]" htmlFor="name">
          {labels.name}
        </label>
        <div className="relative mt-1">
          <UserIcon size={16} className="absolute left-3 top-3 text-[var(--muted)]" />
          <input
            id="name"
            name="name"
            type="text"
            required
            defaultValue={initial.name}
            className="w-full rounded-md border border-[var(--line)] bg-white py-2 pl-9 pr-3 text-sm focus:border-[var(--primary)] focus:outline-none"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-[var(--foreground)]" htmlFor="phone">
          {labels.phone}
        </label>
        <div className="relative mt-1">
          <Phone size={16} className="absolute left-3 top-3 text-[var(--muted)]" />
          <input
            id="phone"
            name="phone"
            type="tel"
            defaultValue={initial.phone}
            placeholder="+91 82080 59375"
            className="w-full rounded-md border border-[var(--line)] bg-white py-2 pl-9 pr-3 text-sm focus:border-[var(--primary)] focus:outline-none"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-[var(--foreground)]" htmlFor="email">
          {labels.email}
        </label>
        <div className="relative mt-1">
          <Mail size={16} className="absolute left-3 top-3 text-[var(--muted)]" />
          <input
            id="email"
            name="email"
            type="email"
            required
            defaultValue={initial.email}
            className="w-full rounded-md border border-[var(--line)] bg-white py-2 pl-9 pr-3 text-sm focus:border-[var(--primary)] focus:outline-none"
          />
        </div>
      </div>

      <div className="pt-2">
        <Button type="submit" disabled={pending}>
          {pending ? labels.saving : labels.saveProfile}
        </Button>
      </div>
    </form>
  );
}

type ChangePasswordProps = {
  labels: {
    changePassword: string;
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
    updatePassword: string;
    updating: string;
  };
};

export function ChangePasswordForm({ labels }: ChangePasswordProps) {
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<ActionResponse | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setResult(null);

    const form = e.currentTarget;
    const formData = new FormData(form);
    try {
      const res = await changePasswordAction(formData);
      setResult(res);
      if (res.ok) {
        form.reset();
      }
    } catch {
      setResult({ error: "Something went wrong. Please try again." });
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {result?.error ? (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <ShieldAlert size={18} className="shrink-0" />
          <span>{result.error}</span>
        </div>
      ) : null}

      {result?.ok ? (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          <Check size={18} className="shrink-0" />
          <span>{result.message}</span>
        </div>
      ) : null}

      <div>
        <label
          className="block text-sm font-medium text-[var(--foreground)]"
          htmlFor="currentPassword"
        >
          {labels.currentPassword}
        </label>
        <div className="relative mt-1">
          <KeyRound size={16} className="absolute left-3 top-3 text-[var(--muted)]" />
          <input
            id="currentPassword"
            name="currentPassword"
            type="password"
            required
            className="w-full rounded-md border border-[var(--line)] bg-white py-2 pl-9 pr-3 text-sm focus:border-[var(--primary)] focus:outline-none"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-[var(--foreground)]" htmlFor="newPassword">
          {labels.newPassword}
        </label>
        <div className="relative mt-1">
          <Lock size={16} className="absolute left-3 top-3 text-[var(--muted)]" />
          <input
            id="newPassword"
            name="newPassword"
            type="password"
            required
            minLength={8}
            className="w-full rounded-md border border-[var(--line)] bg-white py-2 pl-9 pr-3 text-sm focus:border-[var(--primary)] focus:outline-none"
          />
        </div>
      </div>

      <div>
        <label
          className="block text-sm font-medium text-[var(--foreground)]"
          htmlFor="confirmPassword"
        >
          {labels.confirmPassword}
        </label>
        <div className="relative mt-1">
          <Lock size={16} className="absolute left-3 top-3 text-[var(--muted)]" />
          <input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            required
            minLength={8}
            className="w-full rounded-md border border-[var(--line)] bg-white py-2 pl-9 pr-3 text-sm focus:border-[var(--primary)] focus:outline-none"
          />
        </div>
      </div>

      <div className="pt-2">
        <Button type="submit" disabled={pending}>
          {pending ? labels.updating : labels.updatePassword}
        </Button>
      </div>
    </form>
  );
}
