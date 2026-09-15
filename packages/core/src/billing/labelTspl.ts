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
  /** Gap between labels in mm (0 for continuous stock). */
  gapMm: number;
  /** BARCODE human-readable interpretation: 0 = off, 1 = left, 2 = center, 3 = right. */
  hri: 0 | 1 | 2 | 3;
  /** Number of copies per label. */
  copies: number;
  /** Barcode narrow element width in dots. */
  narrow: number;
  /** Barcode wide element width in dots. */
  wide: number;
  /** Name text Y position in dots. */
  nameY: number;
  /** Weight text Y position in dots. */
  weightY: number;
  /** Left margin in mm. */
  leftMarginMm: number;
  /** Barcode X position in dots. */
  barcodeX: number;
  /** Barcode Y position in dots. */
  barcodeY: number;
  /** Include the product purity after its name. */
  showPurity: boolean;
  /** Gold label weight field visibility toggles. */
  showGrossWeight: boolean;
  showNagLessWeight: boolean;
  showNagRate: boolean;
  showChejatWeight: boolean;
  showNetWeight: boolean;
  /** Gold label weight field Y nudges (dots) from each field's auto-stacked
   *  position in its column. 0 = auto. */
  grossWeightY: number;
  nagLessWeightY: number;
  nagRateY: number;
  chejatWeightY: number;
  netWeightY: number;
  /** Y (dots) where the gold weight-fields column starts, below the name. */
  goldFieldsStartY: number;
};

/** Default settings for the first print — easy to override in the dialog. */
export const DEFAULT_LABEL_PRINT_SETTINGS: LabelPrintSettings = {
  gapMm: 2,
  hri: 0,
  copies: 1,
  narrow: 2,
  wide: 3,
  nameY: 25,
  weightY: 80,
  // Gold weight-fields column starts below the name (~40-45 dots) so the
  // smaller field text never collides with the taller name line.
  goldFieldsStartY: 55,
  leftMarginMm: 3.5,
  barcodeX: 305,
  barcodeY: 30,
  showPurity: false,
  // Gold label weight field visibility — all enabled by default
  showGrossWeight: true,
  showNagLessWeight: true,
  showNagRate: true,
  showChejatWeight: true,
  showNetWeight: true,
  // Gold label weight field Y positions (dots, relative to weightY base)
  // Defaults: 0 = auto-stacked sequentially from weightY
  grossWeightY: 0,
  nagLessWeightY: 0,
  nagRateY: 0,
  chejatWeightY: 0,
  netWeightY: 0,
};

export type TsplLabelOptions = Partial<LabelSizeSettings> & {
  /** Physical labels to print of each entry. Default 1. */
  copies?: number;
  /** Printer resolution in dpi (TE244 = 203). Default 203. */
  dpi?: number;
  /** TSPL2 DIRECTION: always 1 for TSC TE244. */
  direction?: 0 | 1;
  /** CODEPAGE command. Default "UTF-8". */
  codepage?: string;
  /** BARCODE HRI: 0 = off, 1 = left, 2 = center, 3 = right. Default 0. */
  hri?: 0 | 1 | 2 | 3;
  /** Barcode narrow element width in dots. Default 2. */
  narrow?: number;
  /** Barcode wide element width in dots. Default 4. */
  wide?: number;
  /** Name text Y position in dots. */
  nameY?: number;
  /** Weight text Y position in dots. */
  weightY?: number;
  /** Left margin in mm. */
  leftMarginMm?: number;
  /** Barcode X position in dots (0 = computed). */
  barcodeX?: number;
  /** Barcode Y position in dots (0 = computed). */
  barcodeY?: number;
  /** Include the product purity after its name. */
  showPurity?: boolean;
  /** Gold label weight field visibility toggles. */
  showGrossWeight?: boolean;
  showNagLessWeight?: boolean;
  showNagRate?: boolean;
  showChejatWeight?: boolean;
  showNetWeight?: boolean;
  /** Gold label weight field Y nudges (dots) from each field's auto-stacked
   *  position in its column. 0 = auto. */
  grossWeightY?: number;
  nagLessWeightY?: number;
  nagRateY?: number;
  chejatWeightY?: number;
  netWeightY?: number;
  /** Y (dots) where the gold weight-fields column starts, below the name.
   *  Default 45. */
  goldFieldsStartY?: number;
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

/** Native TSPL2 barcode — Code 128 with configurable narrow/wide. */
function barcodeCommand(x: number, y: number, heightDots: number, value: string, hri: number, narrow: number, wide: number): string {
  return `BARCODE ${x},${y},"128",${heightDots},${hri},0,${narrow},${wide},"${tsplText(value).toUpperCase()}"`;
}

/**
 * Builds the full TSPL2 command stream for a batch of labels.
 *
 * Two label designs based on product type:
 *
 * Silver / other:
 *   LEFT:  product name + " - sil" (top) + weight (bottom), stacked
 *   RIGHT: barcode (takes remaining width, vertically centered)
 *
 * Gold:
 *   LEFT:  product name (top) + weight + 4 weight fields + purity (bottom)
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
  const direction = opts.direction ?? 1;  // MUST be 1 for TSC TE244
  const codepage = opts.codepage ?? "UTF-8";
  const hri = opts.hri ?? 0;
  const narrow = opts.narrow ?? 2;
  const wide = opts.wide ?? 3;

  const w = mmToDots(widthMm, dpi);
  const h = mmToDots(heightMm, dpi);

  // Printer margins
  const leftMargin = mmToDots(opts.leftMarginMm ?? 3.5, dpi);
  const rightMargin = mmToDots(0.5, dpi);
  const printableW = w - leftMargin - rightMargin;

  // Font "0" — x/y params are POINTS (1 pt = 1/72").
  const toPt = (dots: number): number => Math.max(2, Math.round((dots * 72) / dpi));

  // Layout: LEFT = text area, RIGHT = barcode (~76%)
  const gapBetween = mmToDots(2, dpi);
  const textAreaW = Math.round(printableW * 0.24);

  // Font sizes — 15mm tall = 120 dots at 203 DPI
  // Gold labels need smaller fonts to fit name + 6 weight lines in 15mm.
  // Silver labels (name + 1 weight line) can use larger fonts.
  // Budget: 120 dots total. Gold: name ~25 dots, 6 weight lines × ~14 dots = 84 dots.
  // Silver: name ~40 dots, 1 weight line ~30 dots.
  const maxNameSize = toPt(Math.round(h * 0.20));   // Gold name: ~24 dots = 8.5pt
  const minNameSize = toPt(Math.round(h * 0.17));   // Gold name min: ~20 dots = 7pt
  const weightSize = toPt(Math.round(h * 0.25));     // Silver weight: ~30 dots = 10.6pt
  const smallSize = toPt(Math.round(h * 0.16));      // Gold weight fields: ~19 dots = 6.8pt

  const barcodeHeight = 65;
  const barcodeX = (opts.barcodeX && opts.barcodeX > 0) ? opts.barcodeX : leftMargin + textAreaW + gapBetween + mmToDots(10, dpi);
  const barcodeY = (opts.barcodeY && opts.barcodeY > 0) ? opts.barcodeY : Math.round((h - barcodeHeight) / 2) - 8;
  const nameY = opts.nameY ?? 25;
  const weightY = opts.weightY ?? 80;
  // A period is valid TSPL text. Size names to fit before truncating, so
  // values such as "92.5ring1" are not shortened to "92.5..".
  const availableNameWidth = Math.max(1, barcodeX - leftMargin - gapBetween);
  const nameCharWidthAtOnePoint = (dpi / 72) * 0.6;

  const lines: string[] = [
    `SIZE ${widthMm} mm,${heightMm} mm`,
    gapMm > 0 ? `GAP ${gapMm} mm,0` : `GAP 0,0`,
    `DIRECTION ${direction}`,
    `CODEPAGE ${codepage}`,
    "CLS",
  ];

  for (const label of labels) {
    const isGold = label.productType === "Gold";

    // Build display name
    let displayName = label.productName;
    if (!isGold) {
      displayName = `${displayName} - sil`;
    }
    const nameWithPurity = [displayName, opts.showPurity ? label.purity : null]
      .filter((value): value is string => Boolean(value?.trim()))
      .join(" ");
    const fittingNameSize = Math.floor(
      availableNameWidth / (Math.max(1, nameWithPurity.length) * nameCharWidthAtOnePoint),
    );
    const nameSize = Math.max(minNameSize, Math.min(maxNameSize, fittingNameSize));
    const name = truncateToWidth(
      tsplText(nameWithPurity),
      Math.max(2, Math.floor(availableNameWidth / (minNameSize * nameCharWidthAtOnePoint))),
    );

    // Build weight line
    const weight = label.weightMg != null && label.weightMg > 0
      ? `${label.weightMg} ${label.weightUnit}`
      : "";

    lines.push("CLS");

    // LEFT: product name (top)
    if (name) {
      lines.push(`TEXT ${leftMargin},${nameY},"0",0,${nameSize},${nameSize},"${name}"`);
    }

    if (isGold) {
      // Gold label: weight + weight fields in 2 columns to use horizontal space.
      // LEFT is ~24mm wide. At 5.7pt, ~13 chars per column.
      // Line 1: Name (top) | Lines 2+: weight fields stacked in 2 columns below.
      type GoldFieldYKey = "grossWeightY" | "nagLessWeightY" | "nagRateY" | "chejatWeightY" | "netWeightY";
      const weightFieldEntries: { text: string; yKey: GoldFieldYKey | null }[] = [];
      if (weight) weightFieldEntries.push({ text: weight, yKey: null });
      if (opts.showGrossWeight !== false && label.grossWeight?.trim()) weightFieldEntries.push({ text: `G:${label.grossWeight.trim()}`, yKey: "grossWeightY" });
      if (opts.showNagLessWeight !== false && label.nagLessWeight?.trim()) weightFieldEntries.push({ text: `N:${label.nagLessWeight.trim()}`, yKey: "nagLessWeightY" });
      if (opts.showNagRate !== false && label.nagRate?.trim()) weightFieldEntries.push({ text: `NR:${label.nagRate.trim()}`, yKey: "nagRateY" });
      if (opts.showChejatWeight !== false && label.chejatWeight?.trim()) weightFieldEntries.push({ text: `C:${label.chejatWeight.trim()}`, yKey: "chejatWeightY" });
      if (opts.showNetWeight !== false && label.netWeight?.trim()) weightFieldEntries.push({ text: `Net:${label.netWeight.trim()}`, yKey: "netWeightY" });

      if (weightFieldEntries.length > 0) {
        // Column geometry. 15mm tall = 120 dots at 203 dpi: the name occupies
        // the top band, fields start below it (goldFieldsStartY, default 55) and stack down in two columns.
        // and stack goldLineSpacing apart so nothing shares a Y in a column.
        // The old code drew every second-row field at ONE Y — they printed on
        // top of each other.
        const fieldsStartY = opts.goldFieldsStartY ?? 55;
        const goldLineSpacing = 28;
        const columnGap = mmToDots(12, dpi);

        // Distribute round-robin down the two columns (row reads L→R), so the
        // deepest row with all 6 fields is 55 + 2×28 = 111 dots — inside 120.
        const leftCol: typeof weightFieldEntries = [];
        const rightCol: typeof weightFieldEntries = [];
        weightFieldEntries.forEach((entry, i) => (i % 2 === 0 ? leftCol : rightCol).push(entry));

        const drawColumn = (entries: typeof weightFieldEntries, x: number) => {
          entries.forEach((entry, row) => {
            const yAuto = fieldsStartY + row * goldLineSpacing;
            // Per-field Y nudge (dots) — user-configurable in the print dialog.
            const yNudge = entry.yKey ? opts[entry.yKey] : 0;
            const y = yAuto + (typeof yNudge === "number" ? yNudge : 0);
            lines.push(`TEXT ${x},${y},"0",0,${smallSize},${smallSize},"${tsplText(entry.text)}"`);
          });
        };
        drawColumn(leftCol, leftMargin);
        drawColumn(rightCol, leftMargin + columnGap);
      }
    } else {
      // Silver / other: weight below name at weightY position
      if (weight) {
        lines.push(`TEXT ${leftMargin},${weightY},"0",0,${weightSize},${weightSize},"${tsplText(weight)}"`);
      }
    }

    // RIGHT: barcode
    if (label.barcode) {
      lines.push(barcodeCommand(barcodeX, barcodeY, barcodeHeight, label.barcode, hri, narrow, wide));
    } else {
      lines.push(`TEXT ${barcodeX},${barcodeY},"0",0,${weightSize},${weightSize},"NO BARCODE"`);
    }
    lines.push(`PRINT ${copies},1`);
  }

  lines.push("END");
  return lines.join("\r\n") + "\r\n";
}
