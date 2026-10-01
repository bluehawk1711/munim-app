/**
 * Labour cost — the ONE calculation for "making charge / labour", shared by
 * every app and mirrored by the SQL expression in `services/products.ts`.
 *
 * Three methods, chosen per product (`labourType` + `labourValue`):
 *
 *   PERCENT  → labour = metalValue × value ÷ 100   (% of metal value)
 *   FIXED    → labour = value                      (flat ₹ added)
 *   PER_GRAM → labour = weightGm × value           (₹ per gram × weight)
 *
 * A `null` config means "not configured":
 *   - Gold: callers fall back to the shop default (`settings.default_labour_*`).
 *   - Silver: labour is strictly per product (no shop default) → ₹0 when unset.
 *
 * Pure TS (no DB/DOM) so the API, forms, previews and tests compute the exact
 * same number. New components (e.g. a future wastage %) only need a new type
 * here + a matching CASE branch in the SQL twin — the engine signature never
 * changes.
 */

export const LABOUR_TYPES = ["PERCENT", "FIXED", "PER_GRAM"] as const;

/** Literal union of the supported labour-cost methods. */
export type LabourType = (typeof LABOUR_TYPES)[number];

/** Runtime guard — the boundary for values coming from the wire/DB. */
export function isLabourType(value: string): value is LabourType {
  return (LABOUR_TYPES as readonly string[]).includes(value);
}

/** A configured labour cost: which method + its rate/amount. */
export type LabourConfig = {
  type: LabourType;
  /** PERCENT → 0–100, FIXED → ₹, PER_GRAM → ₹/g. Always ≥ 0. */
  value: number;
};

/** Inputs the labour formula needs beyond the config itself. */
export type LabourBasis = {
  /** Metal value the percentage applies to (round2'd). */
  metalValue: number;
  /** Product weight in grams (PER_GRAM). */
  weightGm: number;
};

/**
 * Computes the labour amount. Never throws; an absent/invalid config is ₹0.
 * Result is rounded to paisa (round2 done by caller modules to avoid an
 * import cycle — see `round2` in pricing/gold.ts; we inline the same rule).
 */
export function computeLabour(config: LabourConfig | null | undefined, basis: LabourBasis): number {
  if (!config) return 0;
  if (!Number.isFinite(config.value) || config.value <= 0) return 0;
  const metalValue = Number.isFinite(basis.metalValue) ? basis.metalValue : 0;
  const weightGm = Number.isFinite(basis.weightGm) ? basis.weightGm : 0;

  let amount: number;
  switch (config.type) {
    case "FIXED":
      amount = config.value;
      break;
    case "PER_GRAM":
      amount = weightGm * config.value;
      break;
    case "PERCENT":
      amount = (metalValue * config.value) / 100;
      break;
  }
  if (!Number.isFinite(amount)) return 0;
  return Math.round(amount * 100) / 100;
}
