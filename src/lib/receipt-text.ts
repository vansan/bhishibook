import { formatPaise, type Paise } from "@/lib/money";
import { formatYearMonth, type YearMonth } from "@/lib/finance";

/**
 * The plain-text receipt an admin shares on WhatsApp.
 *
 * WhatsApp sharing was chosen as the first receipt channel because it is free
 * and every member already has it. The text is stored on the Receipt row so
 * what was sent can always be seen again.
 */

export type ReceiptTextInput = {
  groupName: string;
  receiptNo: string;
  memberName: string;
  issuedAt: Date;
  lines: Array<{ label: string; amountPaise: Paise }>;
  totalPaise: Paise;
  period?: YearMonth;
  footer?: string;
};

function formatDate(value: Date): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(value);
}

export function buildReceiptText(input: ReceiptTextInput): string {
  const money = (paise: Paise) => formatPaise(paise, { whole: true });

  const parts = [
    `*${input.groupName}*`,
    `Receipt ${input.receiptNo}`,
    `${input.memberName}`,
    input.period ? `For: ${formatYearMonth(input.period)}` : null,
    `Date: ${formatDate(input.issuedAt)}`,
    "",
    ...input.lines
      .filter((line) => line.amountPaise > 0)
      .map((line) => `${line.label}: ${money(line.amountPaise)}`),
    "",
    `*Total: ${money(input.totalPaise)}*`,
    "",
    input.footer ?? "Powered by BhishiBook",
  ];

  return parts.filter((part) => part !== null).join("\n");
}

/** A wa.me link that opens WhatsApp with the receipt already typed out. */
export function whatsappShareUrl(text: string, phone?: string | null): string {
  const encoded = encodeURIComponent(text);
  const digits = phone?.replace(/\D/g, "");
  // Indian numbers are stored locally; wa.me needs the country code.
  const target = digits && digits.length === 10 ? `91${digits}` : digits;
  return target ? `https://wa.me/${target}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
}
