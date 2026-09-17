import { requireGroupAdmin } from "@/lib/auth";
import { getMessages } from "@/lib/i18n";
import { decimalToPaise, formatPaise } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { cn } from "@/lib/utils";

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
    },
  });

  const whole = { whole: true } as const;

  return (
    <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold sm:text-3xl">{t.ledger.title}</h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">
        {t.ledger.subtitle}
      </p>

      {entries.length === 0 ? (
        <p className="mt-6 rounded-lg border border-dashed border-[var(--line)] bg-white p-6 text-center text-sm text-[var(--muted)]">
          {t.ledger.noEntries}
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-lg border border-[var(--line)] bg-white">
          <table className="w-full min-w-[720px] text-sm">
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
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => {
                const isOutflow = OUTFLOWS.has(entry.entryType);
                const isReversal = Boolean(entry.reversalOfId);
                const paise = decimalToPaise(entry.amount);

                return (
                  <tr className="border-b border-[var(--line)] last:border-0" key={entry.id}>
                    <td className="px-4 py-3 text-[var(--muted)]">
                      {entry.entryDate.toISOString().slice(0, 10)}
                    </td>
                    <td className="px-4 py-3">
                      {TYPE_LABELS[entry.entryType] ?? entry.entryType}
                    </td>
                    <td className="px-4 py-3">{entry.description}</td>
                    <td
                      className={cn(
                        "px-4 py-3 text-right font-medium tabular-nums",
                        isReversal
                          ? "text-[var(--muted)] line-through"
                          : isOutflow
                            ? "text-[var(--warn)]"
                            : "text-[var(--primary)]"
                      )}
                    >
                      {isOutflow ? "-" : "+"}
                      {formatPaise(paise, whole)}
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
