import { ExportButton } from "@/components/ui/export-button";
import { requireGroupAdmin } from "@/lib/auth";
import { getLocale, getMessages } from "@/lib/i18n";
import { formatMemberName } from "@/lib/members";
import { decimalToPaise, formatPaise } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { whatsappShareUrl } from "@/lib/receipt-text";
import { ReceiptActions } from "./receipt-actions";

export default async function ReceiptsPage() {
  const scope = await requireGroupAdmin();
  const [t, locale] = await Promise.all([getMessages(), getLocale()]);

  const receipts = await prisma.receipt.findMany({
    where: { groupId: scope.groupId },
    orderBy: { issuedAt: "desc" },
    take: 200,
    select: {
      id: true,
      receiptNo: true,
      receiptType: true,
      amount: true,
      issuedAt: true,
      whatsappText: true,
      member: { select: { displayName: true, displayNameMr: true, phone: true } },
    },
  });

  const whole = { whole: true } as const;

  return (
    <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">{t.receipts.title}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">
            {t.receipts.subtitle}
          </p>
        </div>
        <ExportButton hint={t.ledger.exportHint} label={t.ledger.export} report="receipts" />
      </div>

      {receipts.length === 0 ? (
        <p className="mt-6 rounded-lg border border-dashed border-[var(--line)] bg-white p-6 text-center text-sm text-[var(--muted)]">
          {t.receipts.noReceipts}
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-lg border border-[var(--line)] bg-white">
          <table className="w-full min-w-[760px] text-sm">
            <caption className="sr-only">{t.receipts.title}</caption>
            <thead>
              <tr className="border-b border-[var(--line)] text-left text-[var(--muted)]">
                <th className="px-4 py-3 font-medium" scope="col">
                  {t.receipts.receiptNo}
                </th>
                <th className="px-4 py-3 font-medium" scope="col">
                  {t.common.date}
                </th>
                <th className="px-4 py-3 font-medium" scope="col">
                  {t.common.member}
                </th>
                <th className="px-4 py-3 font-medium" scope="col">
                  {t.ledger.type}
                </th>
                <th className="px-4 py-3 text-right font-medium" scope="col">
                  {t.common.amount}
                </th>
                <th className="px-4 py-3 text-right font-medium" scope="col">
                  <span className="sr-only">{t.receipts.shareWhatsapp}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {receipts.map((receipt) => (
                <tr className="border-b border-[var(--line)] last:border-0" key={receipt.id}>
                  <td className="px-4 py-3 font-medium tabular-nums">{receipt.receiptNo}</td>
                  <td className="px-4 py-3 text-[var(--muted)]">
                    {receipt.issuedAt.toISOString().slice(0, 10)}
                  </td>
                  <td className="px-4 py-3">
                    {receipt.member ? formatMemberName(receipt.member, locale) : "-"}
                  </td>
                  <td className="px-4 py-3">{receipt.receiptType}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {formatPaise(decimalToPaise(receipt.amount), whole)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <ReceiptActions
                      copiedLabel={t.receipts.copied}
                      copyLabel={t.receipts.copy}
                      pdfLabel={t.ledger.downloadPdf}
                      receiptId={receipt.id}
                      recipientName={receipt.member ? formatMemberName(receipt.member, locale) : undefined}
                      recipientPhone={receipt.member?.phone}
                      shareLabel={t.receipts.shareWhatsapp}
                      shareUrl={whatsappShareUrl(
                        receipt.whatsappText ?? "",
                        receipt.member?.phone
                      )}
                      text={receipt.whatsappText ?? ""}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
