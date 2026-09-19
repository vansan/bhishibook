"use client";

import { useState } from "react";
import { Check, Copy, Eye, FileDown, X } from "lucide-react";

function WhatsAppIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      aria-hidden="true"
      className="shrink-0"
      fill="currentColor"
      height={size}
      viewBox="0 0 24 24"
      width={size}
    >
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

type ReceiptActionsProps = {
  receiptId: string;
  pdfLabel: string;
  text: string;
  shareUrl: string;
  shareLabel: string;
  copyLabel: string;
  copiedLabel: string;
  recipientName?: string;
  recipientPhone?: string | null;
};

export function ReceiptActions({
  receiptId,
  pdfLabel,
  text,
  shareUrl,
  shareLabel,
  copyLabel,
  copiedLabel,
  recipientName,
  recipientPhone,
}: ReceiptActionsProps) {
  const [copied, setCopied] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt(copyLabel, text);
    }
  }

  return (
    <>
      <div className="flex items-center justify-end gap-2">
        <button
          className="focus-ring inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-[var(--muted)] hover:text-[var(--foreground)]"
          onClick={() => setShowPreview(true)}
          title="View message text"
          type="button"
        >
          <Eye size={13} />
          <span className="hidden md:inline">Preview</span>
        </button>

        <button
          className="focus-ring inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-[var(--muted)] hover:text-[var(--foreground)]"
          onClick={copy}
          type="button"
        >
          {copied ? <Check className="text-emerald-600" size={13} /> : <Copy size={13} />}
          <span className="hidden sm:inline">{copied ? copiedLabel : copyLabel}</span>
        </button>

        <a
          className="focus-ring inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-[var(--muted)] hover:text-[var(--foreground)]"
          download
          href={`/api/receipts/${receiptId}/pdf`}
          title="Download PDF"
        >
          <FileDown size={13} />
          <span className="hidden lg:inline">{pdfLabel}</span>
        </a>

        {/* Direct WhatsApp Share Button */}
        <a
          className="focus-ring inline-flex items-center gap-1.5 rounded-md bg-[#25D366] px-2.5 py-1 text-xs font-semibold text-white shadow-xs transition hover:bg-[#20bd5a]"
          href={shareUrl}
          rel="noopener noreferrer"
          target="_blank"
          title="Send directly on WhatsApp"
        >
          <WhatsAppIcon size={14} />
          <span>{shareLabel}</span>
        </a>
      </div>

      {/* WhatsApp Message Preview Modal */}
      {showPreview ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-[var(--line)] bg-[#EFEAE2] shadow-2xl">
            {/* WhatsApp Modal Header */}
            <div className="flex items-center justify-between bg-[#075E54] px-4 py-3 text-white">
              <div className="flex items-center gap-2">
                <WhatsAppIcon size={18} />
                <div>
                  <h3 className="text-sm font-semibold leading-tight">
                    {recipientName ? recipientName : "WhatsApp Receipt"}
                  </h3>
                  {recipientPhone ? (
                    <p className="text-[11px] text-emerald-100">{recipientPhone}</p>
                  ) : null}
                </div>
              </div>
              <button
                className="rounded-full p-1 text-white/80 hover:bg-white/10 hover:text-white"
                onClick={() => setShowPreview(false)}
                type="button"
              >
                <X size={18} />
                <span className="sr-only">Close</span>
              </button>
            </div>

            {/* Chat Message Bubble */}
            <div className="p-4">
              <div className="relative max-w-sm rounded-lg rounded-tl-none bg-white p-3.5 shadow-sm text-slate-800 text-xs sm:text-sm font-sans whitespace-pre-wrap leading-relaxed border border-slate-100">
                {text}
                <div className="mt-2 text-right text-[10px] text-slate-400 font-mono">
                  Delivered ✓✓
                </div>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#D1D7DB] bg-[#F0F2F5] px-4 py-3">
              <button
                className="focus-ring inline-flex items-center gap-1.5 rounded-md border border-[var(--line)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--foreground)] hover:bg-slate-50"
                onClick={copy}
                type="button"
              >
                {copied ? <Check className="text-emerald-600" size={14} /> : <Copy size={14} />}
                {copied ? copiedLabel : copyLabel}
              </button>

              <a
                className="focus-ring inline-flex items-center gap-1.5 rounded-md bg-[#25D366] px-4 py-1.5 text-xs font-semibold text-white shadow-xs transition hover:bg-[#20bd5a]"
                href={shareUrl}
                rel="noopener noreferrer"
                target="_blank"
              >
                <WhatsAppIcon size={15} />
                <span>Open in WhatsApp</span>
              </a>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
