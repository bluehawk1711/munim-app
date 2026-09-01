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
    return `BARCODE ${x},${y},"EAN13",${heightDots},2,0,2,4,"${digits}"`;
  }
  return `BARCODE ${x},${y},"128",${heightDots},2,0,2,3,"${tsplText(value).toUpperCase()}"`;
}

/**
 * Builds the full TSPL2 command stream for a batch of labels.
 *
 * Layout — side-by-side (left/right):
 * ┌───────────────────────────┐
 * │ Name         │            │
 * │              │  BARCODE   │
 * │ Weight       │  (rot 90°) │
 * │              │            │
 * └───────────────────────────┘
 * Left ~40%: product name (top) + weight (bottom)
 * Right ~60%: barcode rotated 90° (vertical, fills height)
 */
export function buildLabelTspl2(labels: ProductLabel[], opts: TsplLabelOptions = {}): string {
  const copies = Math.min(999, Math.max(1, Math.floor(opts.copies ?? 1)));
  const widthMm = opts.widthMm ?? LABEL_WIDTH_MM;
  const heightMm = opts.heightMm ?? LABEL_HEIGHT_MM;
  const gapMm = opts.gapMm ?? 2;
  const dpi = opts.dpi ?? 203;

  const w = mmToDots(widthMm, dpi);
  const h = mmToDots(heightMm, dpi);
  const m = Math.round(w * 0.03); // side margin

  // ── Split point: left ~40%, right ~60% ──
  const splitX = Math.round(w * 0.42);
  // Vertical separator line between halves.
  const sepX = Math.round(w * 0.44);

  // ── Left side: text ──
  // Font "0" scalable: x/y params are font size in POINTS (1 pt = 1/72").
  const toPt = (dots: number): number => Math.max(2, Math.round((dots * 72) / dpi));
  const nameSize = toPt(Math.round(h * 0.11)); // ~27pt on 240-dot label
  const weightSize = toPt(Math.round(h * 0.09)); // ~22pt
  const maxTextWidth = splitX - m - 4; // dots available for text

  // ── Right side: barcode rotated 90° ──
  // With rotation=90 the barcode prints top→bottom; the "height" param
  // becomes the horizontal width of the barcode bars.
  const bcX = Math.round(w * 0.50); // barcode left edge
  const bcY = Math.round(h * 0.06); // top margin
  const bcWidth = Math.round(w * 0.30); // horizontal width of barcode (~14mm)
  // The barcode extends downward; EAN-13 at module=2 ≈ 190 dots long.
  // For label height 240 dots, max barcode height before clipping:
  const bcMaxLen = h - bcY - Math.round(h * 0.08); // leave room for digits below

  const lines: string[] = [
    `SIZE ${widthMm} mm,${heightMm} mm`,
    gapMm > 0 ? `GAP ${gapMm} mm,0` : `GAP 0,0`,
    "DIRECTION 1",
    "CODEPAGE UTF-8",
  ];

  for (const label of labels) {
    const name = truncateToWidth(
      tsplText(label.productName),
      Math.floor(maxTextWidth / ((nameSize * dpi) / 72 / 1.8)),
    );
    const weight = label.weightMg != null ? formatWeight(label.weightMg) : "";

    lines.push("CLS");

    // ── Vertical separator line ──
    lines.push(`LINE ${sepX},${Math.round(h * 0.06)},${sepX},${Math.round(h * 0.94)},1`);

    // ── Left side: product name (top) ──
    if (name) {
      lines.push(
        `TEXT ${m},${Math.round(h * 0.12)},"0",0,${nameSize},${nameSize},"${name}"`,
      );
    }

    // ── Left side: weight (bottom) ──
    if (weight) {
      lines.push(
        `TEXT ${m},${Math.round(h * 0.65)},"0",0,${weightSize},${weightSize},"${weight}"`,
      );
    }

    // ── Right side: barcode (rotated 90°) ──
    if (label.barcode?.trim()) {
      const digits = label.barcode.replace(/\D/g, "");
      const isEan = isEan13(digits);
      const bcType = isEan ? "EAN13" : "128";
      const bcData = isEan ? digits : tsplText(label.barcode).toUpperCase();
      const bcHr = isEan ? 4 : 3; // human-readable below barcode
      // rotation=90: barcode prints top→bottom, height param = horizontal width
      lines.push(
        `BARCODE ${bcX},${bcY},"${bcType}",${bcWidth},90,${bcHr},2,4,"${bcData}"`,
      );
    } else {
      // No barcode — put "NO BARCODE" centered in the right half.
      const noBcSize = toPt(Math.round(h * 0.07));
      lines.push(
        `TEXT ${bcX + 4},${Math.round(h * 0.40)},"0",0,${noBcSize},${noBcSize},"NO BARCODE"`,
      );
    }

    lines.push(`PRINT ${copies},1`);
  }

  return lines.join("\r\n") + "\r\n";
}
