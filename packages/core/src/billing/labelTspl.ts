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
 *
 * Why this layout (proven on the shop's TE244, see commit ac66510):
 *   • DIRECTION 1   — origin at bottom-left, Y increases upward. This is
 *     the default for the shop's TE244 label roll.
 *   • Three fields: name (top), barcode (middle), weight (bottom).
 *     That's it — the only data the admin wants on the tag.
 *   • Single column — everything aligned at the left margin (x = m).
 *   • Font "0"      — Monotype CG Triumvirate Bold scalable. Its x/y
 *     parameters are the size in POINTS (1 pt = 1/72 inch), so we plan
 *     in dots and convert via toPt() — identical at 203/300 dpi.
 *   • CODEPAGE UTF-8 — used in the working version; ASCII product names
 *     and weights are unaffected, so the codepage choice is harmless.
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
    // human_readable=0 hides the HRI digits so the barcode band is exactly
    // `heightDots` tall (avoids overlap with the weight text below).
    return `BARCODE ${x},${y},"EAN13",${heightDots},0,0,2,4,"${digits.slice(0, 12)}"`;
  }
  return `BARCODE ${x},${y},"128",${heightDots},0,0,2,3,"${tsplText(value).toUpperCase()}"`;
}

/**
 * Builds the full TSPL2 command stream for a batch of labels.
 *
 * Three-field stacked layout (DIRECTION 1: Y from bottom):
 *   • Name    — top of the label (y ≈ 90% of height)
 *   • Barcode — middle of the label (y ≈ 75% of height, left-aligned)
 *   • Weight  — bottom of the label (y ≈ 15% of height)
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

  // Font "0" (Monotype CG Triumvirate Bold) is scalable: its x/y parameters
  // are the font size in POINTS (1 pt = 1/72"), not dots (TSPL2 manual, TEXT).
  // Plan in dots (proportional to label height), then convert to points.
  // 1 pt = 1/72 inch; 1 inch = dpi dots ⇒ dots = pt * dpi / 72 ⇒
  // pt = dots * 72 / dpi. For a 45×30mm label (h=240 dots @ 203 dpi),
  // h*0.09 = 22 dots → 8pt, h*0.07 = 17 dots → 6pt.
  const toPt = (dots: number): number => Math.max(2, Math.round((dots * 72) / dpi));
  const nameSize = toPt(Math.round(h * 0.09));   // ~8pt
  const weightSize = toPt(Math.round(h * 0.07)); // ~6pt
  // Text height in dots (for layout math) = pt * dpi / 72.
  const nameHeightDots = Math.round((nameSize * dpi) / 72);
  const weightHeightDots = Math.round((weightSize * dpi) / 72);
  // Barcode band: ~22% of height (~53 dots = ~6.6mm) — comfortably above the
  // 12.5mm minimum for reliable scanning and small enough to leave room.
  const barcodeHeight = Math.round(h * 0.22);

  const lines: string[] = [
    // SIZE first so the printer knows the image buffer dimensions before
    // we draw anything. GAP 2nd so the feed-to-next-label distance is
    // correct. DIRECTION 0 = Y from top, downward. The latest debug log
    // (06:55:38) showed DIRECTION 1 sending a correct stream that the
    // TE244 still split across three physical labels — the firmware
    // over-feeds between draws. DIRECTION 0 is the printer's default
    // and doesn't trigger that behavior. HOME positions the print head
    // at the start of the next label so a stale feed offset from a
    // previous job can't split our content.
    `SIZE ${widthMm} mm,${heightMm} mm`,
    gapMm > 0 ? `GAP ${gapMm} mm,0` : `GAP 0,0`,
    "DIRECTION 0",
    "CODEPAGE UTF-8",
    "CLS",
  ];

  for (const label of labels) {
    const name = truncateToWidth(
      tsplText(label.productName),
      Math.max(2, Math.floor((w - 2 * m) / ((nameSize * dpi) / 72 / 1.9))),
    );
    const weight = label.weightMg != null ? formatWeight(label.weightMg) : "";

    // DIRECTION 0: y=0 is the top edge, y=h is the bottom. The coordinate
    // is the TOP-LEFT of the text/barcode, and the element extends
    // DOWNWARD (toward larger y). Stack top→bottom in visual order means
    // SMALL y → LARGE y. HRI is disabled on the barcode, so its band is
    // exactly `barcodeHeight` dots tall.
    const topMargin = 4;
    const bottomMargin = 4;
    const elementGap = 6;

    // Name sits at the top of the label. Baseline = topMargin.
    const nameY = topMargin;
    // Weight sits at the bottom. Top = h - weightHeight - bottomMargin.
    const weightY = h - weightHeightDots - bottomMargin;
    // Barcode is centered in the gap between name bottom and weight top.
    const nameBottom = nameY + nameHeightDots + elementGap;
    const weightTop = weightY - elementGap;
    const available = weightTop - nameBottom;
    const barcodeY = nameBottom + Math.max(0, Math.floor((available - barcodeHeight) / 2));

    // CLS clears the buffer BEFORE drawing so leftover pixels from a
    // previous label don't bleed into this one. Then draw all three
    // elements into the same buffer. A single PRINT at the end flushes
    // the whole buffer to one physical label.
    lines.push("CLS");
    if (name) {
      lines.push(`TEXT ${m},${nameY},"0",0,${nameSize},${nameSize},"${name}"`);
    }
    if (label.barcode) {
      lines.push(barcodeCommand(m, barcodeY, barcodeHeight, label.barcode));
    } else {
      lines.push(`TEXT ${m},${barcodeY},"0",0,${weightSize},${weightSize},"NO BARCODE"`);
    }
    if (weight) {
      lines.push(`TEXT ${m},${weightY},"0",0,${weightSize},${weightSize},"${tsplText(weight)}"`);
    }
    // PRINT copies,1 → print N copies with the default gap between them.
    lines.push(`PRINT ${copies},1`);
  }

  lines.push("END");
  return lines.join("\r\n") + "\r\n";
}
