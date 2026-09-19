import { ShieldCheck, UserCheck, Calendar, IndianRupee, PieChart } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { requireAuth } from "@/lib/auth";
import { getLocale, getMessages } from "@/lib/i18n";
import { formatMemberName, formatPhoneNumber } from "@/lib/members";
import { prisma } from "@/lib/prisma";
import { EditProfileForm, ChangePasswordForm } from "./profile-forms";

export default async function ProfilePage() {
  const [auth, t, locale] = await Promise.all([requireAuth(), getMessages(), getLocale()]);

  const user = await prisma.user.findUnique({
    where: { id: auth.userId },
    include: {
      memberships: {
        include: { group: true },
        take: 1,
      },
    },
  });

  const member = user?.memberships[0] ?? null;
  const displayName = member ? formatMemberName(member, locale) : (user?.name ?? "");
  const phone = member?.phone ? formatPhoneNumber(member.phone) : "";
  const isAdmin = user?.role === "GROUP_ADMIN" || user?.role === "SUPER_ADMIN";

  return (
    <AppShell>
      <section className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold sm:text-3xl">{t.profile.title}</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">{t.profile.subtitle}</p>
        </div>

        {/* Membership Details Card */}
        {member ? (
          <div className="mb-8 rounded-xl border border-[var(--line)] bg-white p-6 shadow-xs">
            <h2 className="flex items-center gap-2 text-base font-semibold text-[var(--foreground)]">
              <ShieldCheck size={20} className="text-[var(--primary)]" />
              {t.profile.membershipInfo}
            </h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg border border-[var(--line)] bg-slate-50 p-3.5">
                <p className="text-xs text-[var(--muted)]">{t.profile.group}</p>
                <p className="mt-1 font-semibold text-[var(--foreground)]">{member.group.name}</p>
              </div>

              <div className="rounded-lg border border-[var(--line)] bg-slate-50 p-3.5">
                <p className="text-xs text-[var(--muted)]">{t.profile.role}</p>
                <div className="mt-1 flex items-center gap-2">
                  <span className="font-semibold text-[var(--foreground)]">
                    {isAdmin ? t.profile.admin : t.profile.member}
                  </span>
                  {isAdmin ? (
                    <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-[var(--primary)]">
                      {t.common.adminBadge}
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="rounded-lg border border-[var(--line)] bg-slate-50 p-3.5">
                <p className="text-xs text-[var(--muted)]">{t.profile.shares}</p>
                <p className="mt-1 font-semibold text-[var(--foreground)]">
                  {member.shareCount} {t.common.shares} (₹{Number(member.monthlyHafta).toLocaleString()}/mo)
                </p>
              </div>

              <div className="rounded-lg border border-[var(--line)] bg-slate-50 p-3.5">
                <p className="text-xs text-[var(--muted)]">{t.profile.joinedDate}</p>
                <p className="mt-1 font-semibold text-[var(--foreground)]">
                  {new Date(member.joinedAt).toLocaleDateString(locale === "mr" ? "mr-IN" : "en-IN", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
                </p>
              </div>
            </div>
          </div>
        ) : null}

        <div className="grid gap-8 lg:grid-cols-2">
          {/* Edit Profile Form */}
          <div className="rounded-xl border border-[var(--line)] bg-white p-6 shadow-xs">
            <h2 className="mb-4 text-lg font-semibold text-[var(--foreground)]">
              {t.profile.editProfile}
            </h2>
            <EditProfileForm
              initial={{
                name: displayName,
                phone: phone,
                email: user?.email ?? "",
              }}
              labels={{
                editProfile: t.profile.editProfile,
                name: t.profile.name,
                phone: t.profile.phone,
                email: t.profile.email,
                saveProfile: t.profile.saveProfile,
                saving: t.profile.saving,
              }}
            />
          </div>

          {/* Change Password Form */}
          <div className="rounded-xl border border-[var(--line)] bg-white p-6 shadow-xs">
            <h2 className="mb-4 text-lg font-semibold text-[var(--foreground)]">
              {t.profile.changePassword}
            </h2>
            <ChangePasswordForm
              labels={{
                changePassword: t.profile.changePassword,
                currentPassword: t.profile.currentPassword,
                newPassword: t.profile.newPassword,
                confirmPassword: t.profile.confirmPassword,
                updatePassword: t.profile.updatePassword,
                updating: t.profile.updating,
              }}
            />
          </div>
        </div>
      </section>
    </AppShell>
  );
}
