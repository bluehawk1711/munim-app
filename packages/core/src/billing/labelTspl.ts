import { isEan13 } from "../utils/barcode.js";
import { formatWeight } from "../utils/format.js";
import { type ProductLabel } from "./labelDocument.js";

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
 * Horizontal layout (101 × 15 mm — wide strip):
 *   LEFT:  product name (top) + weight (bottom), stacked vertically
 *   RIGHT: barcode (wide, vertically centered)
 * Font "0" (Monotype CG Triumvirate Bold) — scalable, x/y = point size.
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

/** Advanced TSPL2 print settings — adjustable per-print from the dialog. */
export type LabelPrintSettings = {
  /** TSPL2 DIRECTION: 0 = origin top-left (Y down), 1 = origin bottom-left (Y up). */
  direction: 0 | 1;
  /** Gap between labels in mm (0 for continuous stock). */
  gapMm: number;
  /** CODEPAGE command sent to the printer (UTF-8 or a TSPL codepage name). */
  codepage: string;
  /** BARCODE human-readable interpretation: 0 = off, 1 = left, 2 = center, 3 = right. */
  hri: 0 | 1 | 2 | 3;
  /** Number of copies per label. */
  copies: number;
};

/** Default settings for the first print — easy to override in the dialog. */
export const DEFAULT_LABEL_PRINT_SETTINGS: LabelPrintSettings = {
  direction: 1,
  gapMm: 2,
  codepage: "UTF-8",
  hri: 0,
  copies: 1,
};

export type TsplLabelOptions = Partial<LabelSizeSettings> & {
  /** Physical labels to print of each entry. Default 1. */
  copies?: number;
  /** Printer resolution in dpi (TE244 = 203). Default 203. */
  dpi?: number;
  /** TSPL2 DIRECTION: 0 = origin top-left (Y down), 1 = origin bottom-left (Y up). Default 0. */
  direction?: 0 | 1;
  /** CODEPAGE command (UTF-8 or TSPL codepage name). Default "UTF-8". */
  codepage?: string;
  /** BARCODE HRI: 0 = off, 1 = left, 2 = center, 3 = right. Default 0. */
  hri?: 0 | 1 | 2 | 3;
};

/** TSPL2 content is double-quoted — strip quotes/newlines so a value can't
 * break out of its parameter (also drops control chars the firmware rejects). */
function tsplText(value: string): string {
  return value.replace(/["\r\n\x00-\x1f]/g, " ").trim();
}

function truncateToWidth(text: string, maxChars: number): string {
  return text.length > maxChars ? `${text.slice(0, Math.max(0, maxChars - 2))}..` : text;
}

/** Default label-stock dimensions (matches the shop's TSC TE244 roll).
 *  BarTender Page Setup: Width 101mm (across print head), Height 15mm (along feed).
 *  Printable area = 98.5 × 15 mm after 1.3 mm left/right margins. */
export const LABEL_WIDTH_MM = 101;
export const LABEL_HEIGHT_MM = 15;
const mmToDots = (mm: number, dpi: number): number => Math.round((mm * dpi) / 25.4);

/** Native TSPL2 barcode for a value: 13 digits → EAN-13, else Code 128.
 *  Horizontal module 3 for wide readable bars on a 101mm-wide label. */
function barcodeCommand(x: number, y: number, heightDots: number, value: string, hri: number): string {
  const digits = value.replace(/\D/g, "");
  if (isEan13(digits)) {
    return `BARCODE ${x},${y},"EAN13",${heightDots},${hri},0,1,3,"${digits.slice(0, 12)}"`;
  }
  return `BARCODE ${x},${y},"128",${heightDots},${hri},0,1,3,"${tsplText(value).toUpperCase()}"`;
}

/**
 * Builds the full TSPL2 command stream for a batch of labels.
 *
 * Layout (101 × 15 mm — wide strip):
 *   LEFT:  product name (top) + weight (bottom), stacked
 *   RIGHT: barcode (takes remaining width, vertically centered)
 *
 * Direction 0: Y from top (downward). Direction 1: Y from bottom (upward).
 */
export function buildLabelTspl2(labels: ProductLabel[], opts: TsplLabelOptions = {}): string {
  const copies = Math.min(999, Math.max(1, Math.floor(opts.copies ?? 1)));
  const widthMm = opts.widthMm ?? LABEL_WIDTH_MM;
  const heightMm = opts.heightMm ?? LABEL_HEIGHT_MM;
  const gapMm = opts.gapMm ?? 2;
  const dpi = opts.dpi ?? 203;
  const direction = opts.direction ?? 0;
  const codepage = opts.codepage ?? "UTF-8";
  const hri = opts.hri ?? 0;

  const w = mmToDots(widthMm, dpi);
  const h = mmToDots(heightMm, dpi);

  // Printer margins: 1.3 mm each side → printable area = 98.5 mm wide.
  const leftMargin = mmToDots(1.3, dpi);
  const rightMargin = mmToDots(1.3, dpi);
  const printableW = w - leftMargin - rightMargin;

  // Font "0" — x/y params are POINTS (1 pt = 1/72").
  const toPt = (dots: number): number => Math.max(2, Math.round((dots * 72) / dpi));

  // Layout: LEFT = name+weight stacked (~16%), RIGHT = barcode (~84%)
  const gapBetween = mmToDots(2, dpi);
  const textAreaW = Math.round(printableW * 0.16);  // ~15.7mm for name + weight
  const barcodeX = leftMargin + textAreaW + gapBetween;

  // Font sizes — 15mm tall = 120 dots at 203 DPI
  const nameSize = toPt(Math.round(h * 0.38));    // ~5pt
  const weightSize = toPt(Math.round(h * 0.32));  // ~4pt
  const nameHeightDots = Math.round((nameSize * dpi) / 72);
  const weightHeightDots = Math.round((weightSize * dpi) / 72);

  // Barcode: fills remaining width, height ~80% of label
  const barcodeHeight = Math.round(h * 0.80);

  // Vertical positions
  const topMargin = 3;
  const bottomMargin = 3;
  const textGap = 2;
  const nameY = topMargin;
  const weightY = h - weightHeightDots - bottomMargin;
  const barcodeY = Math.round((h - barcodeHeight) / 2);

  const lines: string[] = [
    `SIZE ${widthMm} mm,${heightMm} mm`,
    gapMm > 0 ? `GAP ${gapMm} mm,0` : `GAP 0,0`,
    `DIRECTION ${direction}`,
    `CODEPAGE ${codepage}`,
    "CLS",
  ];

  for (const label of labels) {
    const name = truncateToWidth(
      tsplText(label.productName),
      Math.max(2, Math.floor(textAreaW / ((nameSize * dpi) / 72 / 1.9))),
    );
    const weight = label.weightMg != null ? formatWeight(label.weightMg) : "";

    lines.push("CLS");
    // LEFT: product name (top) + weight (bottom)
    if (name) {
      lines.push(`TEXT ${leftMargin},${nameY},"0",0,${nameSize},${nameSize},"${name}"`);
    }
    if (weight) {
      lines.push(`TEXT ${leftMargin},${weightY},"0",0,${weightSize},${weightSize},"${tsplText(weight)}"`);
    }
    // RIGHT: barcode (vertically centered)
    if (label.barcode) {
      lines.push(barcodeCommand(barcodeX, barcodeY, barcodeHeight, label.barcode, hri));
    } else {
      lines.push(`TEXT ${barcodeX},${barcodeY},"0",0,${weightSize},${weightSize},"NO BARCODE"`);
    }
    lines.push(`PRINT ${copies},1`);
  }

  lines.push("END");
  return lines.join("\r\n") + "\r\n";
}
