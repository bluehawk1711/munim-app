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
 * Side-by-side layout (15 × 101 mm jewelry tag strip):
 *   LEFT:  product name + weight with unit
 *   RIGHT: barcode rotated 90° (horizontal bars, uses the 101mm height)
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
  direction: 0,
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
 *  Jewelry tag strip: 15 mm wide × 101 mm long (feed direction).
 *  Printable area = 12.4 mm wide × 101 mm long after 1.3 mm margins.
 *  Barcode is rotated 90° so it uses the full 101mm height. */
export const LABEL_WIDTH_MM = 15;
export const LABEL_HEIGHT_MM = 101;
const mmToDots = (mm: number, dpi: number): number => Math.round((mm * dpi) / 25.4);

/** Native TSPL2 barcode for a value: 13 digits → EAN-13, else Code 128.
 *  Module width 1 for narrow labels (15mm wide ≈ 100 dots printable). */
function barcodeCommand(x: number, y: number, heightDots: number, value: string, hri: number): string {
  const digits = value.replace(/\D/g, "");
  if (isEan13(digits)) {
    return `BARCODE ${x},${y},"EAN13",${heightDots},${hri},0,1,1,"${digits.slice(0, 12)}"`;
  }
  return `BARCODE ${x},${y},"128",${heightDots},${hri},0,1,1,"${tsplText(value).toUpperCase()}"`;
}

/** Rotated barcode (rotation=1 = 90°): bars run horizontally.
 *  heightDots = width perpendicular to bars (across the narrow label width).
 *  barcodeWidth = length of barcode along the label height. */
function barcodeRotatedCommand(x: number, y: number, heightDots: number, value: string, hri: number): string {
  const digits = value.replace(/\D/g, "");
  if (isEan13(digits)) {
    return `BARCODE ${x},${y},"EAN13",${heightDots},${hri},1,1,1,"${digits.slice(0, 12)}"`;
  }
  return `BARCODE ${x},${y},"128",${heightDots},${hri},1,1,1,"${tsplText(value).toUpperCase()}"`;
}

/**
 * Builds the full TSPL2 command stream for a batch of labels.
 *
 * Side-by-side layout (15 × 101 mm jewelry tag strip):
 *   LEFT:  product name + weight with unit (stacked vertically)
 *   RIGHT: barcode rotated 90° (horizontal bars, uses the 101mm height)
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

  // Printer margins: 1.3 mm each side → printable area = 12.4 mm wide.
  const leftMargin = mmToDots(1.3, dpi);
  const rightMargin = mmToDots(1.3, dpi);
  const printableW = w - leftMargin - rightMargin;

  // Font "0" (Monotype CG Triumvirate Bold) is scalable: its x/y parameters
  // are the font size in POINTS (1 pt = 1/72"), not dots.
  const toPt = (dots: number): number => Math.max(2, Math.round((dots * 72) / dpi));

  // Side-by-side layout:
  // LEFT  = name + weight (stacked), uses ~40% of printable width
  // RIGHT = barcode rotated 90°, uses ~60% of printable width
  const gapBetween = mmToDots(1.5, dpi);
  const leftAreaW = Math.round(printableW * 0.40);
  const rightAreaX = leftMargin + leftAreaW + gapBetween;
  const rightAreaW = printableW - leftAreaW - gapBetween;

  // Vertical sizing — label is tall (101mm ≈ 807 dots)
  const nameSize = toPt(Math.round(h * 0.065));    // ~5pt
  const weightSize = toPt(Math.round(h * 0.05));   // ~4pt
  const nameHeightDots = Math.round((nameSize * dpi) / 72);
  const weightHeightDots = Math.round((weightSize * dpi) / 72);

  // Barcode: rotated 90° so bars run horizontally.
  // "height" param = barcode width perpendicular to bars (across the 15mm label width).
  // Must fit within rightAreaW (≈5mm ≈ 40 dots).
  const barcodeBarWidth = Math.min(rightAreaW - 4, Math.round(h * 0.65)); // bars span ~65% of height
  const barcodeHeightDots = rightAreaW - 4; // width across the label (perpendicular to bars)

  // Vertical positions for name/weight
  const topMargin = 4;
  const bottomMargin = 4;
  const elementGap = 6;
  const nameY = topMargin;
  const weightY = h - weightHeightDots - bottomMargin;

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
      Math.max(2, Math.floor(leftAreaW / ((nameSize * dpi) / 72 / 1.9))),
    );
    // formatWeight already includes the unit ("2.5 g", "350 mg", "—").
    const weight = label.weightMg != null ? formatWeight(label.weightMg) : "";

    lines.push("CLS");
    // LEFT SIDE: product name + weight stacked vertically
    if (name) {
      lines.push(`TEXT ${leftMargin},${nameY},"0",0,${nameSize},${nameSize},"${name}"`);
    }
    if (weight) {
      lines.push(`TEXT ${leftMargin},${weightY},"0",0,${weightSize},${weightSize},"${tsplText(weight)}"`);
    }
    // RIGHT SIDE: barcode rotated 90° (rotation=1), vertically centered
    if (label.barcode) {
      const barcodeY = Math.round((h - barcodeBarWidth) / 2);
      lines.push(barcodeRotatedCommand(rightAreaX, barcodeY, barcodeHeightDots, label.barcode, hri));
    } else {
      const barcodeY = Math.round((h - weightHeightDots) / 2);
      lines.push(`TEXT ${rightAreaX},${barcodeY},"0",0,${weightSize},${weightSize},"NO BARCODE"`);
    }
    lines.push(`PRINT ${copies},1`);
  }

  lines.push("END");
  return lines.join("\r\n") + "\r\n";
}
