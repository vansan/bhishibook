import { Download } from "lucide-react";

type ExportButtonProps = {
  /** members | contributions | loans | fines | ledger | receipts */
  report: string;
  label: string;
  hint?: string;
};

/**
 * A plain link to the CSV route.
 *
 * Not a Server Action: actions cannot return a file, and a link lets the
 * browser handle the download and the filename on its own.
 */
export function ExportButton({ report, label, hint }: ExportButtonProps) {
  return (
    <a
      className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-[var(--line)] bg-white px-4 py-2 text-sm font-semibold transition hover:border-[var(--primary)]"
      download
      href={`/api/export/${report}`}
      title={hint}
    >
      <Download size={16} />
      {label}
    </a>
  );
}
