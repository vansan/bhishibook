import { ExportButton } from "@/components/ui/export-button";
import { requireGroupAdmin } from "@/lib/auth";
import { getMessages } from "@/lib/i18n";
import { decimalToPaise, formatPaise } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { LedgerRow } from "./ledger-row";

/**
 * Money flowing IN to the corpus is shown positive; money flowing OUT is shown
 * negative. The stored amount is always positive, so direction lives here
 * rather than being baked into the ledger rows.
 */
const OUTFLOWS = new Set(["LOAN_DISBURSEMENT", "DISTRIBUTION"]);

const TYPE_LABELS: Record<string, string> = {
  CONTRIBUTION: "Hafta",
  LOAN_DISBURSEMENT: "Loan given",
  PRINCIPAL_REPAYMENT: "Principal repaid",
  INTEREST_PAYMENT: "Interest",
  CONTRIBUTION_FINE: "Hafta fine",
  INTEREST_FINE: "Interest fine",
  CORRECTION: "Correction",
  REVERSAL: "Reversal",
  DISTRIBUTION: "Distribution",
};

export default async function LedgerPage() {
  const scope = await requireGroupAdmin();
  const t = await getMessages();

  const entries = await prisma.ledgerEntry.findMany({
    where: { groupId: scope.groupId },
    orderBy: [{ entryDate: "desc" }, { createdAt: "desc" }],
    take: 300,
    select: {
      id: true,
      entryType: true,
      amount: true,
      entryDate: true,
      description: true,
      reversalOfId: true,
      reversals: { select: { id: true }, take: 1 },
    },
  });

  const whole = { whole: true } as const;

  return (
    <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">{t.ledger.title}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">
            {t.ledger.subtitle}
          </p>
        </div>
        <ExportButton hint={t.ledger.exportHint} label={t.ledger.export} report="ledger" />
      </div>

      {entries.length === 0 ? (
        <p className="mt-6 rounded-lg border border-dashed border-[var(--line)] bg-white p-6 text-center text-sm text-[var(--muted)]">
          {t.ledger.noEntries}
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-lg border border-[var(--line)] bg-white">
          <table className="w-full min-w-[820px] text-sm">
            <caption className="sr-only">{t.ledger.title}</caption>
            <thead>
              <tr className="border-b border-[var(--line)] text-left text-[var(--muted)]">
                <th className="px-4 py-3 font-medium" scope="col">
                  {t.common.date}
                </th>
                <th className="px-4 py-3 font-medium" scope="col">
                  {t.ledger.type}
                </th>
                <th className="px-4 py-3 font-medium" scope="col">
                  {t.ledger.description}
                </th>
                <th className="px-4 py-3 text-right font-medium" scope="col">
                  {t.common.amount}
                </th>
                <th className="px-4 py-3 text-right font-medium" scope="col">
                  <span className="sr-only">{t.ledger.reverse}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <LedgerRow
                  entry={{
                    id: entry.id,
                    date: entry.entryDate.toISOString().slice(0, 10),
                    typeLabel: TYPE_LABELS[entry.entryType] ?? entry.entryType,
                    description: entry.description,
                    amountLabel: formatPaise(decimalToPaise(entry.amount), whole),
                    isOutflow: OUTFLOWS.has(entry.entryType),
                    isReversal: Boolean(entry.reversalOfId),
                    isReversed: entry.reversals.length > 0,
                  }}
                  key={entry.id}
                  labels={{
                    reverse: t.ledger.reverse,
                    reverseReason: t.ledger.reverseReason,
                    reverseHint: t.ledger.reverseHint,
                    reversed: t.ledger.reversed,
                  }}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
