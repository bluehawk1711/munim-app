import { invoke } from "@tauri-apps/api/core";
import { buildLabelTspl2, type LabelPrinterInfo, type ProductLabel } from "@munim/core";

/**
 * Thermal label-printer bridge (desktop only).
 *
 * The Rust side (`src-tauri/src/printer.rs`) enumerates installed printers
 * and spools raw bytes to the Windows print queue. Label content itself is
 * built by @munim/core's `buildLabelTspl2` (TSPL2 — the command language
 * TSC thermal printers like the TE244 speak natively), so every app shares
 * the same label model; this layer is only the platform pipe.
 *
 * The chosen printer is device-local (like the API URL in env.ts) — a
 * printer attached to this machine is meaningless on other devices.
 */

const LABEL_PRINTER_KEY = "munim.labelPrinter";

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

/** Installed printers from the OS (default printer first). */
export async function listLabelPrinters(): Promise<LabelPrinterInfo[]> {
  return invoke<LabelPrinterInfo[]>("list_printers");
}

/**
 * Prints labels straight to a thermal printer: builds the TSPL2 stream in
 * core and hands the raw bytes to the spooler. No print dialog.
 */
export async function printLabelsToThermal(
  printerName: string,
  labels: ProductLabel[],
  copies = 1,
): Promise<void> {
  const tspl = buildLabelTspl2(labels, { copies });
  const data = Array.from(new TextEncoder().encode(tspl));
  await invoke("print_raw", { printerName, data });
}
