import "server-only";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { formatPaise, type Paise } from "@/lib/money";

/**
 * A one page A5 receipt, generated server side.
 *
 * pdf-lib is pure JavaScript, so this needs no native build step and no
 * headless browser. The standard PDF fonts are Latin-1 only, so any text that
 * cannot be encoded is transliterated rather than crashing the download: a
 * Marathi group name would otherwise take the whole receipt down. The rupee
 * sign is outside Latin-1 too, so amounts are written as "Rs".
 */

export type ReceiptPdfInput = {
  groupName: string;
  platformName: string;
  receiptNo: string;
  memberName: string;
  receiptType: string;
  issuedAt: Date;
  lines: Array<{ label: string; amountPaise: Paise }>;
  totalPaise: Paise;
  footerNote?: string;
};

/**
 * The standard PDF fonts are Latin-1 only, so anything above code point 255
 * cannot be drawn. Devanagari is dropped rather than throwing, because a
 * Marathi group name must not take the whole receipt download down.
 *
 * Written as a code point check rather than a regex escape: an escape like
 * \u0000 is fragile to pass through tooling and can end up as a literal
 * control byte in the source.
 */
function safe(text: string): string {
  let cleaned = "";
  for (const character of text) {
    const code = character.codePointAt(0) ?? 0;
    if (code >= 32 && code <= 255) cleaned += character;
    else if (character === " ") cleaned += " ";
  }
  cleaned = cleaned.replace(/\s+/g, " ").trim();
  return cleaned.length > 0 ? cleaned : "-";
}

function money(paise: Paise): string {
  return formatPaise(paise, { whole: true }).replace("₹", "Rs ");
}

export async function buildReceiptPdf(input: ReceiptPdfInput): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  // A5 portrait, which prints cleanly and is easy to read on a phone.
  const page = pdf.addPage([420, 595]);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const ink = rgb(0.12, 0.16, 0.2);
  const muted = rgb(0.4, 0.44, 0.5);
  const brand = rgb(0.086, 0.396, 0.204);

  const left = 40;
  const right = 380;
  let y = 545;

  page.drawRectangle({ x: 0, y: 565, width: 420, height: 30, color: brand });
  page.drawText(safe(input.platformName), {
    x: left,
    y: 574,
    size: 12,
    font: bold,
    color: rgb(1, 1, 1),
  });

  page.drawText(safe(input.groupName), { x: left, y, size: 17, font: bold, color: ink });
  y -= 18;
  page.drawText(safe(input.receiptType), { x: left, y, size: 10, font: regular, color: muted });

  y -= 28;
  const meta: Array<[string, string]> = [
    ["Receipt no", input.receiptNo],
    ["Date", input.issuedAt.toISOString().slice(0, 10)],
    ["Member", safe(input.memberName)],
  ];
  for (const [label, value] of meta) {
    page.drawText(label, { x: left, y, size: 9, font: regular, color: muted });
    page.drawText(value, { x: left + 90, y, size: 10, font: bold, color: ink });
    y -= 16;
  }

  y -= 10;
  page.drawLine({
    start: { x: left, y },
    end: { x: right, y },
    thickness: 1,
    color: rgb(0.85, 0.87, 0.82),
  });
  y -= 22;

  for (const line of input.lines) {
    if (line.amountPaise <= 0) continue;
    const amount = money(line.amountPaise);
    page.drawText(safe(line.label), { x: left, y, size: 10, font: regular, color: ink });
    page.drawText(amount, {
      x: right - regular.widthOfTextAtSize(amount, 10),
      y,
      size: 10,
      font: regular,
      color: ink,
    });
    y -= 18;
  }

  y -= 6;
  page.drawLine({
    start: { x: left, y },
    end: { x: right, y },
    thickness: 1,
    color: rgb(0.85, 0.87, 0.82),
  });
  y -= 24;

  const total = money(input.totalPaise);
  page.drawText("Total", { x: left, y, size: 12, font: bold, color: ink });
  page.drawText(total, {
    x: right - bold.widthOfTextAtSize(total, 12),
    y,
    size: 12,
    font: bold,
    color: brand,
  });

  if (input.footerNote) {
    y -= 34;
    for (const part of safe(input.footerNote).split(" | ")) {
      page.drawText(part, { x: left, y, size: 9, font: regular, color: muted });
      y -= 13;
    }
  }

  page.drawText(`Powered by ${safe(input.platformName)}`, {
    x: left,
    y: 40,
    size: 8,
    font: regular,
    color: muted,
  });
  page.drawText("Computer generated receipt", {
    x: left,
    y: 28,
    size: 8,
    font: regular,
    color: muted,
  });

  return pdf.save();
}
