import { isEan13 } from "../utils/barcode.js";
import { formatWeight } from "../utils/format.js";
import { LABEL_HEIGHT_MM, LABEL_WIDTH_MM, type ProductLabel } from "./labelDocument.js";

/**
 * TSPL2 label commands — direct thermal printing to TSC label printers
 * (e.g. TE244) and any other TSPL/TSPL2-compatible printer.
 *
 * The printer's built-in interpreter draws the label from text commands, so
 * barcodes are printed natively (EAN-13 / Code 128) — razor sharp at the
 * printer's native 203 dpi, no rasterization, no print dialog, no driver
 * rendering. The command string is UTF-8 text; the desktop app sends it raw
 * to the Windows print spooler (datatype "RAW").
 *
 * Same label model as the A4 sheet (`ProductLabel`) — one source of truth.
 */

/** A printer installed on the OS (desktop `list_printers` result). */
export type LabelPrinterInfo = {
  name: string;
  isDefault: boolean;
};

/** Label-stock dimensions (device-local settings, e.g. Settings → Printing). */
export type LabelSizeSettings = {
  /** Label stock width in mm. */
  widthMm: number;
  /** Label stock height in mm. */
  heightMm: number;
  /** Gap between labels in mm (0 for continuous stock). */
  gapMm: number;
};

export type TsplLabelOptions = Partial<LabelSizeSettings> & {
  /** Physical labels to print of each entry. Default 1. */
  copies?: number;
  /** Printer resolution in dpi (TE244 = 203). Default 203. */
  dpi?: number;
};

/** TSPL2 content is double-quoted — strip quotes/newlines so a value can't
 * break out of its parameter (also drops control chars the firmware rejects). */
function tsplText(value: string): string {
  return value.replace(/["\r\n\x00-\x1f]/g, " ").trim();
}

function truncateToWidth(text: string, maxChars: number): string {
  return text.length > maxChars ? `${text.slice(0, Math.max(0, maxChars - 2))}..` : text;
}

/** mm → printer dots (TSPL2: 203 dpi ⇒ 1 mm = 8 dots). */
const mmToDots = (mm: number, dpi: number): number => Math.round((mm * dpi) / 25.4);

/** Native TSPL2 barcode for a value: 13 digits → EAN-13, else Code 128. */
function barcodeCommand(x: number, y: number, heightDots: number, value: string): string {
  const digits = value.replace(/\D/g, "");
  // EAN-13 only when the check digit is actually valid — an invalid one
  // prints a barcode no scanner will read. Code 128 encodes the literal
  // string, so the printed label still scans back to the stored value.
  if (isEan13(digits)) {
    // TSPL2 EAN13 expects 12 data digits; the printer calculates the check digit.
    // narrow/wide params are IGNORED for EAN-13 (fixed module widths per ISO 13633).
    return `BARCODE ${x},${y},"EAN13",${heightDots},2,0,1,2,"${digits.slice(0, 12)}"`;
  }
  // narrow=1 wide=2 — fits Code 128 in the right half of a 45mm label.
  // (At narrow=2 wide=4 a 12-char Code 128 is ~190 dots — overflows.)
  return `BARCODE ${x},${y},"128",${heightDots},2,0,1,2,"${tsplText(value).toUpperCase()}"`;
}

/**
 * Builds the full TSPL2 command stream for a batch of labels.
 *
 * Side-by-side layout (3 fields — tuned for 45×30mm thermal stock):
 * LEFT  half: product name (top) + weight (bottom)
 * RIGHT half: horizontal barcode (fills the right side)
 *
 * No rotation, no LINE commands — only basic TSPL2 that the TE244 supports.
 */
export function buildLabelTspl2(labels: ProductLabel[], opts: TsplLabelOptions = {}): string {
  const copies = Math.min(999, Math.max(1, Math.floor(opts.copies ?? 1)));
  const widthMm = opts.widthMm ?? LABEL_WIDTH_MM;
  const heightMm = opts.heightMm ?? LABEL_HEIGHT_MM;
  const gapMm = opts.gapMm ?? 2;
  const dpi = opts.dpi ?? 203;

  const w = mmToDots(widthMm, dpi);
  const h = mmToDots(heightMm, dpi);
  const m = Math.round(w * 0.032); // side margin

  // --- Left zone (text): x = m … 42% of width ---
  const leftMaxX = Math.round(w * 0.42);
  const textMaxChars = leftMaxX - m; // rough char budget for left zone

  // --- Right zone (barcode): x = 48% … w-m ---
  const barcodeX = Math.round(w * 0.48);
  const barcodeMaxW = w - m - barcodeX;

  // Font "0" (Monotype CG Triumvirate Bold) is scalable: its x/y parameters
  // are scale factors 1–10 (NOT point sizes). Base height ~12 dots (1.5mm)
  // at 203 DPI, so scale 8 = ~96 dots (~12mm), scale 5 = ~60 dots (~7.5mm).
  const nameSize = 8;    // Font 0 scale 8 — ~12mm, readable product name
  const weightSize = 5;  // Font 0 scale 5 — ~7.5mm, fits within label bounds
  const barcodeHeight = Math.round(h * 0.32);  // 32% of height (~77 dots for 30mm label)

  const lines: string[] = [
    `SIZE ${widthMm} mm,${heightMm} mm`,
    gapMm > 0 ? `GAP ${gapMm} mm,0` : `GAP 0,0`,
    "DIRECTION 0",
    // CODEPAGE intentionally omitted — not in standard TSPL codepage list;
    // ASCII text (product names, weights) works on any codepage.
  ];

  for (const label of labels) {
    const name = truncateToWidth(
      tsplText(label.productName),
      Math.floor(textMaxChars / ((nameSize * dpi) / 72 / 1.9)),
    );
    const weight = label.weightMg != null ? formatWeight(label.weightMg) : "";

    lines.push("CLS");
    // With DIRECTION 0: Y=0 is top, increases downward.
    // LEFT side — Name at top
    if (name) lines.push(`TEXT ${m},${Math.round(h * 0.08)},"0",0,${nameSize},${nameSize},"${name}"`);
    // LEFT side — Weight at bottom (y=70% keeps scale-5 text within label bounds)
    if (weight) lines.push(`TEXT ${m},${Math.round(h * 0.70)},"0",0,${weightSize},${weightSize},"${tsplText(weight)}"`);
    // RIGHT side — Barcode (horizontal, upright, number below)
    if (label.barcode) {
      lines.push(barcodeCommand(barcodeX, Math.round(h * 0.20), barcodeHeight, label.barcode));
    } else {
      lines.push(`TEXT ${barcodeX},${Math.round(h * 0.45)},"0",0,${weightSize},${weightSize},"NO BARCODE"`);
    }
    lines.push(`PRINT ${copies},1`);
  }

  lines.push("END");
  return lines.join("\r\n") + "\r\n";
}
