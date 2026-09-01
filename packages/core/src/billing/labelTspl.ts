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

/** The ₹ glyph isn't in the printer's fonts — spell it out instead. */
function priceText(sellingPrice: number): string {
  return `Rs.${Number(sellingPrice).toFixed(2)}`;
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
 * Layout (proportional to stock size, tuned for the 63.5 × 33.9 mm label):
 * shop name → product name → native barcode (human-readable digits below)
 * → details (color · size · weight) → SKU + price footer.
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
  // Sizes below are planned in dots (proportional to label height), then
  // converted so the print is identical at 203 or 300 dpi.
  const toPt = (dots: number): number => Math.max(2, Math.round((dots * 72) / dpi));
  const shopSize = toPt(Math.round(h * 0.06));
  const nameSize = toPt(Math.round(h * 0.075));
  const detSize = toPt(Math.round(h * 0.052));
  const priceSize = toPt(Math.round(h * 0.067));
  const barcodeHeight = Math.round(h * 0.24);

  const lines: string[] = [
    `SIZE ${widthMm} mm,${heightMm} mm`,
    gapMm > 0 ? `GAP ${gapMm} mm,0` : `GAP 0,0`,
    "DIRECTION 1",
    "CODEPAGE UTF-8",
  ];

  for (const label of labels) {
    const shop = tsplText(label.shopName);
    const name = truncateToWidth(
      tsplText(label.productName),
      Math.floor((w - 2 * m) / ((nameSize * dpi) / 72 / 1.9)),
    );
    const details = tsplText(
      [label.color, label.size, label.weightMg != null ? formatWeight(label.weightMg) : null]
        .filter(Boolean)
        .join(" · "),
    );
    const sku = truncateToWidth(
      tsplText(label.sku),
      Math.floor((w * 0.62) / ((detSize * dpi) / 72 / 1.7)),
    );
    const price = priceText(label.sellingPrice);

    lines.push("CLS");
    if (shop) lines.push(`TEXT ${m},${Math.round(h * 0.025)},"0",0,${shopSize},${shopSize},"${shop}"`);
    if (name) lines.push(`TEXT ${m},${Math.round(h * 0.11)},"0",0,${nameSize},${nameSize},"${name}"`);
    if (label.barcode) {
      lines.push(barcodeCommand(m, Math.round(h * 0.22), barcodeHeight, label.barcode));
    } else {
      lines.push(`TEXT ${m},${Math.round(h * 0.3)},"0",0,${detSize},${detSize},"NO BARCODE"`);
    }
    if (details) lines.push(`TEXT ${m},${Math.round(h * 0.585)},"0",0,${detSize},${detSize},"${details}"`);
    lines.push(`TEXT ${m},${Math.round(h * 0.675)},"0",0,${detSize},${detSize},"${sku}"`);
    // Alignment 3 = right: the text ENDS at x = w - m (TSPL2 manual, TEXT).
    lines.push(`TEXT ${w - m},${Math.round(h * 0.66)},"0",0,${priceSize},${priceSize},3,"${price}"`);
    lines.push(`PRINT ${copies},1`);
  }

  return lines.join("\r\n") + "\r\n";
}
