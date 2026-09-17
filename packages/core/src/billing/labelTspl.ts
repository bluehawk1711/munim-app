import { formatWeight } from "../utils/format.js";
import { type ProductLabel } from "./labelDocument.js";
import { type LabelPrintSettings, DEFAULT_LABEL_PRINT_SETTINGS } from "./labelDefaults.js";

export type { LabelPrintSettings };
export { DEFAULT_LABEL_PRINT_SETTINGS };

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
   *  Default 55. */
  goldFieldsStartY?: number;
  /** Name Y position for gold labels (dots). 0 = use nameY. */
  goldNameY?: number;
  /** Column gap between left and right weight fields in gold labels (dots). */
  goldColSpacing?: number;
  /** Global Y nudge (dots) for the entire gold weight-field block. Positive = down. */
  goldColY?: number;
  /** Vertical spacing between rows in gold weight fields (dots). */
  goldLineSpacing?: number;
  /** Gold weight field prefixes (shown before value on label). */
  grossWeightPrefix?: string;
  nagLessWeightPrefix?: string;
  nagRatePrefix?: string;
  chejatWeightPrefix?: string;
  netWeightPrefix?: string;
  /** Silver price prefix (shown before ₹ value). */
  pricePrefix?: string;
  /** When true, ignore saved settings and always use defaults. */
  useDefaults?: boolean;
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
  // When useDefaults is on, ignore caller-provided values and use built-in defaults
  const o: TsplLabelOptions = opts.useDefaults ? { ...DEFAULT_LABEL_PRINT_SETTINGS, dpi: opts.dpi, widthMm: opts.widthMm, heightMm: opts.heightMm, gapMm: opts.gapMm, direction: opts.direction, codepage: opts.codepage, copies: opts.copies } : opts;

  const copies = Math.min(999, Math.max(1, Math.floor(o.copies ?? 1)));
  const widthMm = o.widthMm ?? LABEL_WIDTH_MM;
  const heightMm = o.heightMm ?? LABEL_HEIGHT_MM;
  const gapMm = o.gapMm ?? 2;
  const dpi = o.dpi ?? 203;
  const direction =  1;  // MUST be 1 for TSC TE244
  const codepage = o.codepage ?? "UTF-8";
  const hri = o.hri ?? 0;
  const narrow = o.narrow ?? 2;
  const wide = o.wide ?? 3;

  const w = mmToDots(widthMm, dpi);
  const h = mmToDots(heightMm, dpi);

  // Printer margins
  const leftMargin = mmToDots(o.leftMarginMm ?? 3.5, dpi);
  const rightMargin = mmToDots(0.5, dpi);
  const printableW = w - leftMargin - rightMargin;

  // Font "0" — x/y params are POINTS (1 pt = 1/72").
  const toPt = (dots: number): number => Math.max(2, Math.round((dots * 72) / dpi));

  // Layout: LEFT = text area, RIGHT = barcode (~76%)
  const gapBetween = mmToDots(2, dpi);
  const textAreaW = Math.round(printableW * 0.24);

  // Font sizes — 15mm tall = 120 dots at 203 DPI
  // Gold labels need smaller fonts to fit name + 6 weight lines in 15mm.
  // Silver labels (name + weight): name is prominent, weight is secondary.
  const maxNameSize = toPt(Math.round(h * 0.30));   // Gold name: ~24 dots = 8.5pt
  const minNameSize = toPt(Math.round(h * 0.17));   // Gold name min: ~20 dots = 7pt
  const weightSize = toPt(Math.round(h * 0.20));     // Silver weight: ~22 dots = 8pt
  const smallSize = toPt(Math.round(h * 0.16));      // Gold weight fields: ~19 dots = 6.8pt

  const barcodeHeight = 65;
  const barcodeX = (o.barcodeX && o.barcodeX > 0) ? o.barcodeX : leftMargin + textAreaW + gapBetween + mmToDots(10, dpi);
  const barcodeY = (o.barcodeY && o.barcodeY > 0) ? o.barcodeY : Math.round((h - barcodeHeight) / 2) - 8;
  const nameY = o.nameY ?? 25;
  // Silver weight position — smaller font, positioned below the name.
  const weightY = o.weightY ?? 60;
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

    // Build display name — no suffix on thermal labels; weight fields already
    // distinguish gold from silver, and the suffix wastes horizontal space that
    // silver needs for its larger font size.
    const displayName = label.productName;
    const nameWithPurity = [displayName, o.showPurity ? label.purity : null]
      .filter((value): value is string => Boolean(value?.trim()))
      .join(" ");
    const fittingNameSize = Math.floor(
      availableNameWidth / (Math.max(1, nameWithPurity.length) * nameCharWidthAtOnePoint),
    );
    // Silver label name is the dominant text — use the full available height.
    const silverMaxNameSize = toPt(Math.round(h * 0.26));
    const effectiveMaxNameSize = isGold ? maxNameSize : silverMaxNameSize;
    const nameSize = Math.max(minNameSize, Math.min(effectiveMaxNameSize, fittingNameSize));
    const name = truncateToWidth(
      tsplText(nameWithPurity),
      Math.max(2, Math.floor(availableNameWidth / (minNameSize * nameCharWidthAtOnePoint))),
    );

    // Build weight line
    const weight = label.weightMg != null
      ? `${label.weightMg} ${label.weightUnit}`
      : "";

    // Build price line — Indian comma formatting with configurable prefix
    const priceText = label.sellingPrice > 0
      ? `${o.pricePrefix ?? "p"}: \u20B9${label.sellingPrice.toLocaleString("en-IN")}`
      : "";

    lines.push("CLS");

    // LEFT: product name (top)
    if (name) {
      const effectiveNameY = isGold && o.goldNameY ? o.goldNameY : nameY;
      lines.push(`TEXT ${leftMargin},${effectiveNameY},"0",0,${nameSize},${nameSize},"${name}"`);
    }

    if (isGold) {
      // Gold label: weight + weight fields in 2 columns to use horizontal space.
      // LEFT is ~24mm wide. At 5.7pt, ~13 chars per column.
      // Line 1: Name (top) | Lines 2+: weight fields stacked in 2 columns below.
      type GoldFieldYKey = "grossWeightY" | "nagLessWeightY" | "nagRateY" | "chejatWeightY" | "netWeightY";
      const weightFieldEntries: { text: string; yKey: GoldFieldYKey | null }[] = [];
      if (weight) weightFieldEntries.push({ text: weight, yKey: null });
      if (o.showGrossWeight !== false && label.grossWeight?.trim()) weightFieldEntries.push({ text: `${o.grossWeightPrefix ?? "G"}:${label.grossWeight.trim()}`, yKey: "grossWeightY" });
      if (o.showNagLessWeight !== false && label.nagLessWeight?.trim()) weightFieldEntries.push({ text: `${o.nagLessWeightPrefix ?? "N"}:${label.nagLessWeight.trim()}`, yKey: "nagLessWeightY" });
      if (o.showNagRate !== false && label.nagRate?.trim()) weightFieldEntries.push({ text: `${o.nagRatePrefix ?? "NR"}:${label.nagRate.trim()}`, yKey: "nagRateY" });
      if (o.showChejatWeight !== false && label.chejatWeight?.trim()) weightFieldEntries.push({ text: `${o.chejatWeightPrefix ?? "C"}:${label.chejatWeight.trim()}`, yKey: "chejatWeightY" });
      if (o.showNetWeight !== false && label.netWeight?.trim()) weightFieldEntries.push({ text: `${o.netWeightPrefix ?? "Net"}:${label.netWeight.trim()}`, yKey: "netWeightY" });

      if (weightFieldEntries.length > 0) {
        // Column geometry. 15mm tall = 120 dots at 203 dpi: the name occupies
        // the top band, fields start below it (goldFieldsStartY, default 55) and stack down in two columns.
        // and stack goldLineSpacing apart so nothing shares a Y in a column.
        // The old code drew every second-row field at ONE Y — they printed on
        // top of each other.
        const fieldsStartY = o.goldFieldsStartY ?? 55;
        const goldLineSpacing = o.goldLineSpacing ?? 25;
        const columnGap = o.goldColSpacing ?? mmToDots(12, dpi);
        const goldColY = o.goldColY ?? 0;

        // Distribute round-robin down the two columns (row reads L→R), so the
        // deepest row with all 6 fields is 55 + 2×28 = 111 dots — inside 120.
        const leftCol: typeof weightFieldEntries = [];
        const rightCol: typeof weightFieldEntries = [];
        weightFieldEntries.forEach((entry, i) => (i % 2 === 0 ? leftCol : rightCol).push(entry));

        const drawColumn = (entries: typeof weightFieldEntries, x: number) => {
          entries.forEach((entry, row) => {
            const yAuto = fieldsStartY + row * goldLineSpacing + goldColY;
            // Per-field Y nudge (dots) — user-configurable in the print dialog.
            const yNudge = entry.yKey ? o[entry.yKey] : 0;
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
      if (priceText) {
        const priceY = weightY + Math.round(weightSize * 3.2);
        lines.push(`TEXT ${leftMargin},${priceY},"0",0,${weightSize},${weightSize},"${tsplText(priceText)}"`);
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
