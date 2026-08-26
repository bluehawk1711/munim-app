import { invoke } from "@tauri-apps/api/core";
import {
  buildLabelTspl2,
  type LabelPrinterInfo,
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
 * Printer + label-stock size are device-local (like the API URL in env.ts) —
 * a printer/roll attached to this machine is meaningless on other devices.
 */

const LABEL_PRINTER_KEY = "munim.labelPrinter";
const LABEL_SIZE_KEY = "munim.labelSize";

/** Defaults matched to the shop's jewellery tag roll — adjustable in
 * Settings → Printing (test-print to calibrate). */
export const DEFAULT_LABEL_SIZE: LabelSizeSettings = {
  widthMm: 45,
  heightMm: 30,
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

/** Installed printers from the OS (default printer first). */
export async function listLabelPrinters(): Promise<LabelPrinterInfo[]> {
  return invoke<LabelPrinterInfo[]>("list_printers");
}

/**
 * Prints labels straight to a thermal printer: builds the TSPL2 stream in
 * core (with the device's saved stock size) and hands the raw bytes to the
 * spooler. No print dialog.
 */
export async function printLabelsToThermal(
  printerName: string,
  labels: ProductLabel[],
  copies = 1,
): Promise<void> {
  const size = getSavedLabelSize();
  const tspl = buildLabelTspl2(labels, { ...size, copies });
  const data = Array.from(new TextEncoder().encode(tspl));
  await invoke("print_raw", { printerName, data });
}
