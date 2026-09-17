/**
 * CSV export.
 *
 * Deliberately CSV rather than a real .xlsx: Excel, Google Sheets and
 * LibreOffice all open it directly, it needs no dependency, and it cannot
 * carry a macro. The BOM matters, because without it Excel on Windows reads
 * the file as the system codepage and Marathi names arrive as mojibake.
 */

export const UTF8_BOM = "﻿";

/**
 * Escape one value.
 *
 * A leading =, +, - or @ makes Excel treat the cell as a formula, so a member
 * name like "=cmd" would execute on open. Prefixing an apostrophe neutralises
 * that without changing what the reader sees.
 */
function cell(value: unknown): string {
  if (value === null || value === undefined) return "";

  let text = value instanceof Date ? value.toISOString().slice(0, 10) : String(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`;

  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function toCsv(headers: string[], rows: Array<Array<unknown>>): string {
  const lines = [headers.map(cell).join(",")];
  for (const row of rows) lines.push(row.map(cell).join(","));
  // CRLF, which is what Excel expects.
  return UTF8_BOM + lines.join("\r\n") + "\r\n";
}

/** A filename that is safe on every platform. */
export function csvFilename(groupName: string, report: string, asOf = new Date()): string {
  const slug = groupName
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .toLowerCase();
  return `${slug || "bhishibook"}-${report}-${asOf.toISOString().slice(0, 10)}.csv`;
}
