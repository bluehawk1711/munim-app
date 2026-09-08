import { invoke } from "@tauri-apps/api/core";
import {
  buildLabelTspl2,
  DEFAULT_LABEL_PRINT_SETTINGS,
  type LabelPrinterInfo,
  type LabelPrintSettings,
  type LabelSizeSettings,
  type ProductLabel,
} from "@munim/core";

/**
 * Thermal label-printer bridge (desktop only).
 *
 * The Rust side (`src-tauri/src/printer.rs`) enumerates installed printers
 * and spools raw bytes to the Windows print queue. Label content itself is
 * built by @munim/core's `buildLabelTspl2` (TSPL2 — the command language
 * TSC thermal printers like the TE244 speak natively), so every app shares
 * the same label model; this layer is only the platform pipe.
 *
 * All print operations are mirrored to `~/Downloads/munim-print-debug.log`
 * from the Rust side so a misprint can be diagnosed afterwards.
 */

const LABEL_PRINTER_KEY = "munim.labelPrinter";
const LABEL_SIZE_KEY = "munim.labelSize";
const LABEL_PRINT_KEY = "munim.labelPrint";

/** Defaults matched to the shop's jewellery tag roll — adjustable in
 * Settings → Printing (test-print to calibrate). */
export const DEFAULT_LABEL_SIZE: LabelSizeSettings = {
    widthMm: 101,
    heightMm: 15,
    gapMm: 2,
};

/** True when running inside the Tauri desktop shell. */
export function isDesktopApp(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

/** Label printer saved in Settings → Printing, if any. */
export function getSavedLabelPrinter(): string | undefined {
  const saved = localStorage.getItem(LABEL_PRINTER_KEY);
  return saved && saved.trim() ? saved.trim() : undefined;
}

export function saveLabelPrinter(name: string): void {
  localStorage.setItem(LABEL_PRINTER_KEY, name.trim());
}

/** Label-stock size saved in Settings → Printing (defaults for a fresh setup). */
export function getSavedLabelSize(): LabelSizeSettings {
  try {
    const raw = localStorage.getItem(LABEL_SIZE_KEY);
    if (!raw) return { ...DEFAULT_LABEL_SIZE };
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      const s = parsed as Partial<LabelSizeSettings>;
      const widthMm = Number(s.widthMm);
      const heightMm = Number(s.heightMm);
      const gapMm = Number(s.gapMm);
      if (widthMm >= 10 && widthMm <= 120 && heightMm >= 10 && heightMm <= 300 && gapMm >= 0 && gapMm <= 10) {
        return { widthMm, heightMm, gapMm };
      }
    }
  } catch {
    // fall through to defaults
  }
  return { ...DEFAULT_LABEL_SIZE };
}

export function saveLabelSize(size: LabelSizeSettings): void {
  localStorage.setItem(LABEL_SIZE_KEY, JSON.stringify(size));
}

/** Per-device print settings (direction, gap, codepage, HRI, copies). */
export function getSavedLabelPrintSettings(): LabelPrintSettings {
  try {
    const raw = localStorage.getItem(LABEL_PRINT_KEY);
    if (!raw) return { ...DEFAULT_LABEL_PRINT_SETTINGS };
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      const s = parsed as Partial<LabelPrintSettings>;
      return {
        gapMm: typeof s.gapMm === "number" && s.gapMm >= 0 && s.gapMm <= 10 ? s.gapMm : 2,
        hri: typeof s.hri === "number" && s.hri >= 0 && s.hri <= 3 ? s.hri as 0 | 1 | 2 | 3 : 0,
        copies: typeof s.copies === "number" && s.copies >= 1 && s.copies <= 999 ? s.copies : 1,
        narrow: typeof s.narrow === "number" && s.narrow >= 1 && s.narrow <= 10 ? s.narrow : 2,
        wide: typeof s.wide === "number" && s.wide >= 2 && s.wide <= 20 ? s.wide : 3,
        nameY: typeof s.nameY === "number" && s.nameY >= 0 && s.nameY <= 120 ? s.nameY : 25,
        weightY: typeof s.weightY === "number" && s.weightY >= 0 && s.weightY <= 120 ? s.weightY : 80,
        leftMarginMm: typeof s.leftMarginMm === "number" && s.leftMarginMm >= 0 && s.leftMarginMm <= 10 ? s.leftMarginMm : 3.5,
        barcodeX: typeof s.barcodeX === "number" && s.barcodeX >= 0 && s.barcodeX <= 800 ? s.barcodeX : 305,
        barcodeY: typeof s.barcodeY === "number" && s.barcodeY >= 0 && s.barcodeY <= 120 ? s.barcodeY : 30,
        showPurity: s.showPurity === true,
      };
    }
  } catch {
    // fall through
  }
  return { ...DEFAULT_LABEL_PRINT_SETTINGS };
}

export function saveLabelPrintSettings(settings: LabelPrintSettings): void {
  localStorage.setItem(LABEL_PRINT_KEY, JSON.stringify(settings));
}

/** Installed printers from the OS (default printer first). */
export async function listLabelPrinters(): Promise<LabelPrinterInfo[]> {
  return invoke<LabelPrinterInfo[]>("list_printers");
}

/**
 * Prints labels straight to a thermal printer: builds the TSPL2 stream in
 * core (with the device's saved stock size + print settings) and hands the
 * raw bytes to the spooler. No print dialog.
 */
export async function printLabelsToThermal(
  printerName: string,
  labels: ProductLabel[],
  copies = 1,
  printSettings?: Partial<LabelPrintSettings>,
): Promise<void> {
  const size = getSavedLabelSize();
  const ps = { ...getSavedLabelPrintSettings(), ...printSettings };
  const tspl = buildLabelTspl2(labels, {
    ...size,
    copies,
    gapMm: ps.gapMm,
    hri: ps.hri,
    narrow: ps.narrow,
    wide: ps.wide,
    nameY: ps.nameY,
    weightY: ps.weightY,
    leftMarginMm: ps.leftMarginMm,
    barcodeX: ps.barcodeX,
    barcodeY: ps.barcodeY,
    showPurity: ps.showPurity,
  });
  const data = Array.from(new TextEncoder().encode(tspl));
  console.info("[Munim label print]", {
    printer: printerName,
    labels: labels.length,
    copies,
    labelSizeMm: size,
    printSettings: ps,
    tsplBytes: data.length,
  });
  console.debug("[Munim label print] TSPL2 stream:\n" + tspl);

  // After first print, save computed barcodeX/barcodeY so future opens show actual values
  if ((ps.barcodeX === 0 || ps.barcodeY === 0) && labels.length > 0) {
    const dpi = 203;
    const mmToDots = (mm: number): number => Math.round((mm * dpi) / 25.4);
    const w = mmToDots(size.widthMm ?? 101);
    const h = mmToDots(size.heightMm ?? 15);
    const leftMargin = mmToDots(ps.leftMarginMm ?? 3.5);
    const rightMargin = mmToDots(0.5);
    const printableW = w - leftMargin - rightMargin;
    const gapBetween = mmToDots(2);
    const textAreaW = Math.round(printableW * 0.24);
    const barcodeHeight = 65;
    const computedX = ps.barcodeX === 0 ? leftMargin + textAreaW + gapBetween + mmToDots(10) : ps.barcodeX;
    const computedY = ps.barcodeY === 0 ? Math.round((h - barcodeHeight) / 2) - 8 : ps.barcodeY;
    const updated = { ...ps, barcodeX: computedX, barcodeY: computedY };
    saveLabelPrintSettings(updated);
  }

  await invoke("print_raw", { printerName, data });
}
