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
 * Layout: three fields stacked vertically — name (top), barcode (middle),
 * weight with unit (bottom). Everything aligned at the left margin.
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

/** mm → printer dots (TSPL2: 203 dpi ⇒ 1 mm = 8 dots). */
const mmToDots = (mm: number, dpi: number): number => Math.round((mm * dpi) / 25.4);

/** Native TSPL2 barcode for a value: 13 digits → EAN-13, else Code 128. */
function barcodeCommand(x: number, y: number, heightDots: number, value: string, hri: number): string {
  const digits = value.replace(/\D/g, "");
  if (isEan13(digits)) {
    return `BARCODE ${x},${y},"EAN13",${heightDots},${hri},0,2,4,"${digits.slice(0, 12)}"`;
  }
  return `BARCODE ${x},${y},"128",${heightDots},${hri},0,2,3,"${tsplText(value).toUpperCase()}"`;
}

/**
 * Builds the full TSPL2 command stream for a batch of labels.
 *
 * Three-field stacked layout:
 *   • Name    — top of the label
 *   • Barcode — middle of the label (left-aligned)
 *   • Weight  — bottom of the label (with unit: "2.5 g", "350 mg")
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
  const m = Math.round(w * 0.032); // side margin

  // Font "0" (Monotype CG Triumvirate Bold) is scalable: its x/y parameters
  // are the font size in POINTS (1 pt = 1/72"), not dots.
  const toPt = (dots: number): number => Math.max(2, Math.round((dots * 72) / dpi));
  const nameSize = toPt(Math.round(h * 0.09));   // ~8pt
  const weightSize = toPt(Math.round(h * 0.07)); // ~6pt
  const nameHeightDots = Math.round((nameSize * dpi) / 72);
  const weightHeightDots = Math.round((weightSize * dpi) / 72);
  const barcodeHeight = Math.round(h * 0.22);

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
      Math.max(2, Math.floor((w - 2 * m) / ((nameSize * dpi) / 72 / 1.9))),
    );
    // formatWeight already includes the unit ("2.5 g", "350 mg", "—").
    const weight = label.weightMg != null ? formatWeight(label.weightMg) : "";

    const topMargin = 4;
    const bottomMargin = 4;
    const elementGap = 6;

    let nameY: number;
    let weightY: number;
    let barcodeY: number;

    if (direction === 0) {
      // DIRECTION 0: y=0 is the top edge. Elements extend DOWNWARD.
      nameY = topMargin;
      weightY = h - weightHeightDots - bottomMargin;
      const nameBottom = nameY + nameHeightDots + elementGap;
      const weightTop = weightY - elementGap;
      const available = weightTop - nameBottom;
      barcodeY = nameBottom + Math.max(0, Math.floor((available - barcodeHeight) / 2));
    } else {
      // DIRECTION 1: y=0 is the bottom edge. Elements extend UPWARD.
      nameY = h - nameHeightDots - topMargin;
      weightY = bottomMargin;
      const weightTop = weightY + weightHeightDots + elementGap;
      const nameBottom = nameY - elementGap;
      const available = nameBottom - weightTop;
      barcodeY = weightTop + Math.max(0, Math.floor((available - barcodeHeight) / 2));
    }

    lines.push("CLS");
    if (name) {
      lines.push(`TEXT ${m},${nameY},"0",0,${nameSize},${nameSize},"${name}"`);
    }
    if (label.barcode) {
      lines.push(barcodeCommand(m, barcodeY, barcodeHeight, label.barcode, hri));
    } else {
      lines.push(`TEXT ${m},${barcodeY},"0",0,${weightSize},${weightSize},"NO BARCODE"`);
    }
    if (weight) {
      lines.push(`TEXT ${m},${weightY},"0",0,${weightSize},${weightSize},"${tsplText(weight)}"`);
    }
    lines.push(`PRINT ${copies},1`);
  }

  lines.push("END");
  return lines.join("\r\n") + "\r\n";
}
