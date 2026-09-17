import { RefreshCw } from "lucide-react";
import { ActionForm } from "@/components/ui/action-form";
import { requireGroupAdmin } from "@/lib/auth";
import { formatYearMonth } from "@/lib/finance";
import { getMessages } from "@/lib/i18n";
import { atLeastZero, decimalToPaise, formatPaise, sumPaise } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { runFinesAction } from "../actions";
import { WaiveFineRow } from "./waive-fine-row";

export default async function FinesPage() {
  const scope = await requireGroupAdmin();
  const t = await getMessages();

  const cycle = await prisma.cycle.findFirst({
    where: { groupId: scope.groupId, status: { in: ["ACTIVE", "DRAFT", "CLOSING"] } },
    orderBy: { startsOn: "desc" },
    select: { id: true },
  });

  const fines = cycle
    ? await prisma.fine.findMany({
        where: { cycleId: cycle.id },
        orderBy: [{ year: "desc" }, { month: "desc" }, { member: { displayName: "asc" } }],
        select: {
          id: true,
          fineType: true,
          month: true,
          year: true,
          daysLate: true,
          amount: true,
          amountPaid: true,
          waivedAmount: true,
          member: { select: { displayName: true } },
        },
      })
    : [];

  const whole = { whole: true } as const;

  const outstandingOf = (fine: (typeof fines)[number]) =>
    atLeastZero(
      decimalToPaise(fine.amount) -
        decimalToPaise(fine.amountPaid) -
        decimalToPaise(fine.waivedAmount)
    );

  const totals = {
    raised: sumPaise(fines.map((fine) => decimalToPaise(fine.amount))),
    paid: sumPaise(fines.map((fine) => decimalToPaise(fine.amountPaid))),
    waived: sumPaise(fines.map((fine) => decimalToPaise(fine.waivedAmount))),
    outstanding: sumPaise(fines.map(outstandingOf)),
  };

  return (
    <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">{t.fines.title}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">
            {t.fines.subtitle}
          </p>
        </div>

        <div className="rounded-lg border border-[var(--line)] bg-white p-4">
          <ActionForm
            action={runFinesAction}
            compact
            pendingLabel={t.fines.running}
            submitLabel={t.fines.runAssessment}
          >
            <p className="flex items-start gap-2 text-xs text-[var(--muted)]">
              <RefreshCw className="mt-0.5 shrink-0" size={14} />
              {t.fines.runHint}
            </p>
          </ActionForm>
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Summary label={t.common.total} value={formatPaise(totals.raised, whole)} />
        <Summary label={t.common.paid} value={formatPaise(totals.paid, whole)} />
        <Summary label={t.fines.waived} value={formatPaise(totals.waived, whole)} />
        <Summary label={t.common.outstanding} value={formatPaise(totals.outstanding, whole)} />
      </div>

      {fines.length === 0 ? (
        <p className="mt-6 rounded-lg border border-dashed border-[var(--line)] bg-white p-6 text-center text-sm text-[var(--muted)]">
          {t.fines.noFines}
          {t.fines.runHint}
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-lg border border-[var(--line)] bg-white">
          <table className="w-full min-w-[820px] text-sm">
            <caption className="sr-only">{t.fines.title}</caption>
            <thead>
              <tr className="border-b border-[var(--line)] text-left text-[var(--muted)]">
                <th className="px-4 py-3 font-medium" scope="col">
                  {t.common.member}
                </th>
                <th className="px-4 py-3 font-medium" scope="col">
                  {t.common.month}
                </th>
                <th className="px-4 py-3 font-medium" scope="col">
                  {t.ledger.type}
                </th>
                <th className="px-4 py-3 text-right font-medium" scope="col">
                  {t.fines.daysLate}
                </th>
                <th className="px-4 py-3 text-right font-medium" scope="col">
                  {t.common.outstanding}
                </th>
                <th className="px-4 py-3 text-right font-medium" scope="col">
                  <span className="sr-only">{t.fines.waive}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {fines.map((fine) => {
                const outstanding = outstandingOf(fine);
                return (
                  <WaiveFineRow
                    fine={{
                      id: fine.id,
                      memberName: fine.member.displayName,
                      period: formatYearMonth({ year: fine.year, month: fine.month }),
                      typeLabel:
                        fine.fineType === "INTEREST"
                          ? t.fines.interestFine
                          : t.fines.contributionFine,
                      daysLate: fine.daysLate,
                      outstandingLabel: formatPaise(outstanding, whole),
                      outstandingRupees: (outstanding / 100).toFixed(2),
                      waivedLabel:
                        decimalToPaise(fine.waivedAmount) > 0
                          ? formatPaise(decimalToPaise(fine.waivedAmount), whole)
                          : null,
                    }}
                    key={fine.id}
                    labels={{
                      waive: t.fines.waive,
                      waiveAmount: t.fines.waiveAmount,
                      reason: t.fines.reason,
                      waived: t.fines.waived,
                    }}
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[var(--line)] bg-white p-4">
      <p className="text-sm text-[var(--muted)]">{label}</p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
    </div>
  );
}
