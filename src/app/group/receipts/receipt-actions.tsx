"use client";

import { useState } from "react";
import { Check, Copy, Share2 } from "lucide-react";

type ReceiptActionsProps = {
  text: string;
  shareUrl: string;
  shareLabel: string;
  copyLabel: string;
  copiedLabel: string;
};

export function ReceiptActions({
  text,
  shareUrl,
  shareLabel,
  copyLabel,
  copiedLabel,
}: ReceiptActionsProps) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be refused (an insecure origin, or a browser
      // permission). Select the text instead so it can still be copied by hand.
      window.prompt(copyLabel, text);
    }
  }

  return (
    <div className="flex items-center justify-end gap-3">
      <button
        className="focus-ring inline-flex items-center gap-1.5 rounded px-2 py-1 text-sm font-medium text-[var(--muted)] hover:text-[var(--foreground)]"
        onClick={copy}
        type="button"
      >
        {copied ? <Check size={14} /> : <Copy size={14} />}
        <span className="hidden sm:inline">{copied ? copiedLabel : copyLabel}</span>
      </button>

      <a
        className="focus-ring inline-flex items-center gap-1.5 rounded px-2 py-1 text-sm font-medium text-[var(--primary)] hover:underline"
        href={shareUrl}
        rel="noopener noreferrer"
        target="_blank"
      >
        <Share2 size={14} />
        <span className="hidden sm:inline">{shareLabel}</span>
      </a>
    </div>
  );
}
