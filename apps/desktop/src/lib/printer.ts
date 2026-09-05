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
        direction: s.direction === 1 ? 1 : 0,
        gapMm: typeof s.gapMm === "number" && s.gapMm >= 0 && s.gapMm <= 10 ? s.gapMm : 2,
        codepage: typeof s.codepage === "string" && s.codepage.trim() ? s.codepage.trim() : "UTF-8",
        hri: typeof s.hri === "number" && s.hri >= 0 && s.hri <= 3 ? s.hri as 0 | 1 | 2 | 3 : 0,
        copies: typeof s.copies === "number" && s.copies >= 1 && s.copies <= 999 ? s.copies : 1,
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
    direction: ps.direction,
    gapMm: ps.gapMm,
    codepage: ps.codepage,
    hri: ps.hri,
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
  await invoke("print_raw", { printerName, data });
}
