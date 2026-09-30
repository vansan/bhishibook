import { cn } from "@/lib/utils";

interface ReceiptBadgeProps {
  type: string;
  locale?: string;
  className?: string;
}

export function ReceiptBadge({ type, locale = "mr", className }: ReceiptBadgeProps) {
  const isMr = locale === "mr";

  const config: Record<
    string,
    { label: string; bg: string; text: string; border: string }
  > = {
    INTEREST: {
      label: isMr ? "कर्ज व्याज" : "Loan Interest",
      bg: "bg-amber-50",
      text: "text-amber-800",
      border: "border-amber-200",
    },
    REPAYMENT: {
      label: isMr ? "कर्ज परतफेड" : "Loan Repayment",
      bg: "bg-blue-50",
      text: "text-blue-800",
      border: "border-blue-200",
    },
    CONTRIBUTION: {
      label: isMr ? "मासिक हप्ता" : "Contribution",
      bg: "bg-emerald-50",
      text: "text-emerald-800",
      border: "border-emerald-200",
    },
    LOAN: {
      label: isMr ? "कर्ज वाटप" : "Disbursement",
      bg: "bg-purple-50",
      text: "text-purple-800",
      border: "border-purple-200",
    },
    FINE: {
      label: isMr ? "दंड" : "Fine",
      bg: "bg-red-50",
      text: "text-red-800",
      border: "border-red-200",
    },
    DISTRIBUTION: {
      label: isMr ? "अंतिम वाटप" : "Settlement",
      bg: "bg-teal-50",
      text: "text-teal-800",
      border: "border-teal-200",
    },
  };

  const item = config[type] || {
    label: type,
    bg: "bg-gray-50",
    text: "text-gray-800",
    border: "border-gray-200",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap",
        item.bg,
        item.text,
        item.border,
        className
      )}
    >
      {item.label}
    </span>
  );
}
