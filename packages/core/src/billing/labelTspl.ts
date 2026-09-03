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
 * FONT CHOICE — bitmap, not scalable
 * ───────────────────────────────────
 * The TE244 has 8 internal bitmap fonts (Font 1–8) and one scalable font
 * (Font "0" — Monotype CG Triumvirate Bold). The x/y parameters mean
 * different things for each:
 *
 *   • Bitmap fonts (1–8):  x/y = horizontal/vertical **multiplication**
 *     of the font's native cell. Base sizes are fixed per font number
 *     (Font 2 ≈ 3mm tall, Font 3 ≈ 4mm, Font 4 ≈ 5mm …).
 *   • Scalable font ("0"): x/y = **scale factors 1–10** of a ~12-dot
 *     base (so scale 8 ≈ 96 dots ≈ 12mm).
 *
 * The shop's previous TSC BarTender UltraLite template uses "TSC Sans Serif
 * Size 12pt" — that maps to **Font 2 at x-multiplication 1, y-multiplication
 * 2** (Font 2 base ≈ 3mm × 2 = ~6mm, which renders 12pt text crisply at
 * 203 DPI). We stick with bitmap Font 2/3 here because:
 *   1. They render predictably (no surprises between firmware versions).
 *   2. The native cell already provides good readability at 203 DPI.
 *   3. They are the same fonts BarTender selected for this printer.
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

/**
 * Bitmap font geometry at 203 DPI (TSPL2 manual, table 4).
 * Used to clamp multiplication factors so text never overflows the label.
 * Heights/widths are the font's *native* cell in dots before multiplication.
 */
const BITMAP_FONT_NATIVE: Record<
  string,
  { baseHeightDots: number; baseWidthDots: number }
> = {
  "1": { baseHeightDots: 16, baseWidthDots: 12 },
  "2": { baseHeightDots: 24, baseWidthDots: 16 },
  "3": { baseHeightDots: 32, baseWidthDots: 24 },
  "4": { baseHeightDots: 40, baseWidthDots: 32 },
};

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
  const m = Math.round(w * 0.04); // side margin (~1.8mm on 45mm)

  // --- Left zone (text): x = m … 42% of width ---
  const leftMaxX = Math.round(w * 0.42);
  const textMaxChars = leftMaxX - m; // rough char budget for left zone

  // --- Right zone (barcode): x = 48% … w-m ---
  const barcodeX = Math.round(w * 0.48);

  // Bitmap Font 2 (TSC Sans Serif equivalent) — 24 dots tall, 16 dots wide
  // at 1× multiplication. 2× multiplication renders the same look as
  // BarTender's "12pt" preset on the TE244 (~6mm tall, very readable).
  const NAME_FONT = "2";
  const NAME_X_MULT = 2;
  const NAME_Y_MULT = 2;
  const nameHeightDots = BITMAP_FONT_NATIVE[NAME_FONT]!.baseHeightDots * NAME_Y_MULT; // 48
  const nameWidthDots = BITMAP_FONT_NATIVE[NAME_FONT]!.baseWidthDots * NAME_X_MULT;  // 32

  // Bitmap Font 2 at 1× for the weight — smaller, matches a "9pt" BarTender preset.
  const WEIGHT_FONT = "2";
  const WEIGHT_X_MULT = 1;
  const WEIGHT_Y_MULT = 1;
  const weightHeightDots = BITMAP_FONT_NATIVE[WEIGHT_FONT]!.baseHeightDots * WEIGHT_Y_MULT; // 24

  // Barcode: 30% of label height (~72 dots = ~9mm), comfortably above the
  // 12.5mm minimum for reliable scanning and within the 30mm label height.
  const barcodeHeight = Math.round(h * 0.30);

  const lines: string[] = [
    `SIZE ${widthMm} mm,${heightMm} mm`,
    gapMm > 0 ? `GAP ${gapMm} mm,0` : `GAP 0,0`,
    "DIRECTION 0",
    "CLS",
  ];

  for (const label of labels) {
    const nameMaxChars = Math.max(1, Math.floor(textMaxChars / nameWidthDots));
    const name = truncateToWidth(tsplText(label.productName), nameMaxChars);
    const weight = label.weightMg != null ? formatWeight(label.weightMg) : "";

    // Layout: name at top of the left zone, weight at the bottom of the
    // left zone, barcode on the right side. All Y values measured from the
    // top edge under DIRECTION 0.
    const nameY = m;                          // ~1.8mm from top
    const barcodeY = m;                       // top-aligned with the name
    const weightY = h - weightHeightDots - m; // bottom of label, with side margin

    // LEFT side — Product name (top)
    if (name) {
      lines.push(`TEXT ${m},${nameY},"${NAME_FONT}",0,${NAME_X_MULT},${NAME_Y_MULT},"${name}"`);
    }
    // LEFT side — Weight (bottom)
    if (weight) {
      lines.push(
        `TEXT ${m},${weightY},"${WEIGHT_FONT}",0,${WEIGHT_X_MULT},${WEIGHT_Y_MULT},"${tsplText(weight)}"`,
      );
    }
    // RIGHT side — Barcode (horizontal, upright, number below the bars)
    if (label.barcode) {
      lines.push(barcodeCommand(barcodeX, barcodeY, barcodeHeight, label.barcode));
    } else {
      lines.push(
        `TEXT ${barcodeX},${weightY},"${WEIGHT_FONT}",0,${WEIGHT_X_MULT},${WEIGHT_Y_MULT},"NO BARCODE"`,
      );
    }

    lines.push(`PRINT ${copies},1`);
    lines.push("CLS");
  }

  lines.push("END");
  return lines.join("\r\n") + "\r\n";
}
