/**
 * Purity-stamp presets for the bill screens' Purity dropdown (the estimate's
 * printed Purity column, which replaced the `(22K)` suffix beside the name).
 *
 * A convenience list, NOT a constraint: lines keep carrying free-text purity
 * (products store arbitrary stamps), so the screens add the line's current
 * value as an extra option whenever it's off-list. Karats first (this shop
 * mostly stamps karats), then common millesimal fines.
 */
export const PURITY_PRESETS: readonly string[] = [
  "24K",
  "22K",
  "20K",
  "18K",
  "16K",
  "14K",
  "916",
  "925",
  "999",
  "995",
  "750",
  "585",
] as const;

/** Preset options for a line — always includes its current (possibly
 *  off-list) value so a saved stamp never renders as a blank dropdown. */
export function purityOptionsFor(current?: string | null): string[] {
  const value = current?.trim();
  if (!value) return [...PURITY_PRESETS];
  return PURITY_PRESETS.includes(value) ? [...PURITY_PRESETS] : [value, ...PURITY_PRESETS];
}
