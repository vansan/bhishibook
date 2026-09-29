import { ArrowLeft, CheckCircle2, Clock, MessageCircle, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { ActionForm } from "@/components/ui/action-form";
import { requireGroupAdmin } from "@/lib/auth";
import {
  formatYearMonth,
  monthsBetween,
  yearMonthKey,
  yearMonthOf,
  type YearMonth,
} from "@/lib/finance";
import { getLocale, getMessages } from "@/lib/i18n";
import { formatMemberName } from "@/lib/members";
import { atLeastZero, decimalToPaise, formatPaise } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { whatsappShareUrl } from "@/lib/receipt-text";
import { cn } from "@/lib/utils";
import { recordContributionAction } from "../../actions";
import { PrintButton } from "./print-button";

type PageProps = { searchParams: Promise<{ month?: string }> };

const today = () => new Date().toISOString().slice(0, 10);

export default async function MeetingSheetPage({ searchParams }: PageProps) {
  const scope = await requireGroupAdmin();
  const [t, locale, { month: monthParam }] = await Promise.all([
    getMessages(),
    getLocale(),
    searchParams,
  ]);

  const cycle = await prisma.cycle.findFirst({
    where: { groupId: scope.groupId, status: { in: ["ACTIVE", "DRAFT", "CLOSING"] } },
    orderBy: { startsOn: "desc" },
    select: { id: true, name: true, startsOn: true, endsOn: true, contributionDueDay: true, shareAmount: true },
  });

  if (!cycle) {
    return (
      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <h1 className="text-2xl font-bold sm:text-3xl">{t.contributions.meetingSheet}</h1>
        <p className="mt-3 rounded-lg border border-dashed border-[var(--line)] bg-white p-6 text-sm text-[var(--muted)]">
          {t.group.noCycle}
        </p>
      </section>
    );
  }

  const currentDate = new Date();
  const horizon = currentDate < cycle.endsOn ? currentDate : cycle.endsOn;
  const months = monthsBetween(cycle.startsOn, horizon);
  const fallback = months.at(-1) ?? yearMonthOf(currentDate);
  const selected = parseMonth(monthParam) ?? fallback;

  const rows = await prisma.contribution.findMany({
    where: { cycleId: cycle.id, year: selected.year, month: selected.month },
    orderBy: { member: { displayName: "asc" } },
    select: {
      id: true,
      amountDue: true,
      amountPaid: true,
      paidOn: true,
      member: {
        select: {
          id: true,
          displayName: true,
          displayNameMr: true,
          phone: true,
          shareCount: true,
        },
      },
      receipts: {
        select: { whatsappText: true },
        orderBy: { issuedAt: "desc" },
        take: 1,
      },
    },
  });

  const whole = { whole: true } as const;

  const totals = rows.reduce(
    (acc, row) => {
      const due = decimalToPaise(row.amountDue);
      const paid = decimalToPaise(row.amountPaid);
      return {
        due: acc.due + due,
        paid: acc.paid + paid,
        outstanding: acc.outstanding + atLeastZero(due - paid),
      };
    },
    { due: 0, paid: 0, outstanding: 0 }
  );

  return (
    <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Top Header & Actions */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Link
              className="inline-flex items-center gap-1 text-sm font-medium text-[var(--primary)] hover:underline print:hidden"
              href={`/group/contributions?month=${yearMonthKey(selected)}`}
            >
              <ArrowLeft size={16} />
              {t.contributions.backToStandardView}
            </Link>
          </div>
          <h1 className="mt-2 text-2xl font-bold sm:text-3xl">
            📋 {t.contributions.meetingSheet} — {formatYearMonth(selected)}
          </h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {t.contributions.meetingSheetSubtitle}
          </p>
        </div>

        <div className="flex items-center gap-2 print:hidden">
          <PrintButton label={t.contributions.printSheet} />
        </div>
      </div>

      {/* Rules Notice */}
      <div className="mt-4 flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50/70 p-4 text-sm text-blue-900">
        <Clock className="shrink-0 text-[var(--primary)]" size={18} />
        <span>
          <strong>{t.contributions.collectionWindowNote}</strong>
        </span>
      </div>

      {/* Month Tabs */}
      {months.length > 0 ? (
        <nav aria-label={t.common.month} className="mt-6 flex flex-wrap gap-2 print:hidden">
          {months.map((period) => {
            const active = yearMonthKey(period) === yearMonthKey(selected);
            return (
              <Link
                aria-current={active ? "page" : undefined}
                className={cn(
                  "focus-ring rounded-md border px-3 py-1.5 text-sm font-medium transition",
                  active
                    ? "border-[var(--primary)] bg-[var(--primary)] text-white"
                    : "border-[var(--line)] bg-white text-[var(--muted)] hover:border-[var(--primary)]"
                )}
                href={`/group/contributions/sheet?month=${yearMonthKey(period)}`}
                key={yearMonthKey(period)}
              >
                {formatYearMonth(period)}
              </Link>
            );
          })}
        </nav>
      ) : null}

      {/* Summary Cards */}
      <div className="mt-6 grid gap-4 grid-cols-2 sm:grid-cols-4">
        <div className="rounded-lg border border-[var(--line)] bg-white p-4">
          <p className="text-xs font-medium text-[var(--muted)]">{t.superadmin.members}</p>
          <p className="mt-1 text-xl font-bold">{rows.length}</p>
        </div>
        <div className="rounded-lg border border-[var(--line)] bg-white p-4">
          <p className="text-xs font-medium text-[var(--muted)]">{t.contributions.expectedTotal}</p>
          <p className="mt-1 text-xl font-bold">{formatPaise(totals.due, whole)}</p>
        </div>
        <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-4">
          <p className="text-xs font-medium text-emerald-800">{t.contributions.collectedTotal}</p>
          <p className="mt-1 text-xl font-bold text-emerald-700">{formatPaise(totals.paid, whole)}</p>
        </div>
        <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-4">
          <p className="text-xs font-medium text-amber-800">{t.contributions.pendingTotal}</p>
          <p className="mt-1 text-xl font-bold text-amber-700">{formatPaise(totals.outstanding, whole)}</p>
        </div>
      </div>

      {/* Fast Meeting Table */}
      {rows.length === 0 ? (
        <p className="mt-6 rounded-lg border border-dashed border-[var(--line)] bg-white p-6 text-center text-sm text-[var(--muted)]">
          {t.contributions.noRows}
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-lg border border-[var(--line)] bg-white">
          <table className="w-full min-w-[700px] text-sm">
            <thead>
              <tr className="border-b border-[var(--line)] bg-slate-50 text-left text-[var(--muted)]">
                <th className="px-4 py-3 font-semibold text-center w-12" scope="col">
                  #
                </th>
                <th className="px-4 py-3 font-semibold" scope="col">
                  {t.common.member}
                </th>
                <th className="px-4 py-3 text-center font-semibold" scope="col">
                  {t.common.shares}
                </th>
                <th className="px-4 py-3 text-right font-semibold" scope="col">
                  {t.common.due}
                </th>
                <th className="px-4 py-3 text-right font-semibold" scope="col">
                  {t.common.paid}
                </th>
                <th className="px-4 py-3 font-semibold" scope="col">
                  {t.common.status}
                </th>
                <th className="px-4 py-3 text-right font-semibold print:hidden" scope="col">
                  {t.contributions.recordPayment} / WhatsApp
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => {
                const due = decimalToPaise(row.amountDue);
                const paid = decimalToPaise(row.amountPaid);
                const outstanding = atLeastZero(due - paid);
                const isPaid = paid >= due;
                const whatsappText = row.receipts[0]?.whatsappText ?? null;

                return (
                  <tr
                    className={cn(
                      "border-b border-[var(--line)] hover:bg-slate-50/60 transition",
                      isPaid ? "bg-emerald-50/20" : ""
                    )}
                    key={row.id}
                  >
                    <td className="px-4 py-3 text-center text-xs text-[var(--muted)]">
                      {idx + 1}
                    </td>
                    <td className="px-4 py-3 font-medium">
                      <div>{formatMemberName(row.member, locale)}</div>
                      {row.member.phone ? (
                        <div className="text-xs text-[var(--muted)]">{row.member.phone}</div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
                        <ShieldCheck size={12} />
                        {row.member.shareCount}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold">
                      {formatPaise(due, whole)}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-emerald-700">
                      {formatPaise(paid, whole)}
                    </td>
                    <td className="px-4 py-3">
                      {isPaid ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
                          <CheckCircle2 size={13} />
                          {t.contributions.fullyPaid}
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-800">
                          {t.contributions.unpaid} ({formatPaise(outstanding, whole)})
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right print:hidden">
                      <div className="flex items-center justify-end gap-2 whitespace-nowrap">
                        {isPaid ? (
                          row.member.phone && whatsappText ? (
                            <a
                              className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 transition"
                              href={whatsappShareUrl(whatsappText, row.member.phone)}
                              rel="noopener noreferrer"
                              target="_blank"
                            >
                              <MessageCircle size={14} />
                              <span>WhatsApp पावती</span>
                            </a>
                          ) : (
                            <span className="text-xs text-emerald-600 font-medium">
                              ✓ {t.contributions.fullyPaid}
                            </span>
                          )
                        ) : (
                          <ActionForm
                            action={recordContributionAction}
                            compact
                            hidden={{
                              contributionId: row.id,
                              amount: (outstanding / 100).toFixed(2),
                              paidOn: today(),
                            }}
                            pendingLabel="..."
                            submitLabel={t.contributions.markPaid}
                            variant="primary"
                          />
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function parseMonth(value?: string): YearMonth | null {
  const match = /^(\d{4})-(\d{2})$/.exec(value ?? "");
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;
  return { year, month };
}
