import {
  priceProductRow,
  type PriceBreakdown,
  type PricingContext,
  type ProductRowPricingInput,
} from "./product.js";
import { weightToGrams, toGoldKarat } from "./gold.js";
import { type LabourType } from "./labour.js";
import type { InvoiceItemPricing } from "../db/schema.js";

/** A bill line's weight as typed on the bill (pricing override basis). */
export type BillLineWeight = {
  weight: number | null | undefined;
  weightUnit?: "gm" | "mg" | null;
};

/**
 * Per-line pricing edits from the bill screen (desktop New Bill; web follows).
 * Every field is optional: null/undefined keeps the product's own input, a
 * number replaces it for THIS line only — the engine still does the math, so
 * rounding/labour rules stay identical to product pricing.
 */
export type BillLinePricingOverrides = {
  /** Line rate ₹/gram — gold: replaces the line's karat entry in the rate
   *  table; silver: a bill-line silver override (same precedence as the
   *  bill-level override). */
  ratePerGram?: number | null;
  /** Labour method (PERCENT / FIXED / PER_GRAM). */
  labourType?: LabourType | null;
  /** Labour rate/amount (₹, ₹/g or % — interpreted via the method). */
  labourValue?: number | null;
  /** Flat ₹ nag charge (gold-only; the silver engine ignores nag). */
  nag?: number | null;
  /** Flat ₹ povayi charge. */
  povayi?: number | null;
  /** Flat ₹ other charges. */
  otherCharges?: number | null;
  /** Silver purity % used for THIS line's pricing. */
  silverPercentage?: number | null;
};

/** Product row with the line's edits layered on (null/undefined → unchanged). */
function applyOverrides(
  product: ProductRowPricingInput,
  overrides: BillLinePricingOverrides | undefined,
): ProductRowPricingInput {
  if (!overrides) return product;
  return {
    ...product,
    labourType: overrides.labourType ?? product.labourType,
    labourValue: overrides.labourValue ?? product.labourValue,
    nagRate: overrides.nag ?? product.nagRate,
    povayiRate: overrides.povayi ?? product.povayiRate,
    otherCharges: overrides.otherCharges ?? product.otherCharges,
    silverPercentage: overrides.silverPercentage ?? product.silverPercentage,
  };
}

/**
 * Line-level rate override on top of the bill context: silver reuses the
 * bill-style `silverRateOverride`; gold swaps the line's own karat entry in
 * the table so `rateForKarat` returns exactly the typed rate (other karats
 * stay untouched — only this one line is priced with this context).
 */
function applyRateOverride(
  product: ProductRowPricingInput,
  context: PricingContext,
  ratePerGram: number | null | undefined,
): PricingContext {
  if (ratePerGram == null || !Number.isFinite(ratePerGram) || ratePerGram <= 0) return context;
  if (product.type === "Silver") return { ...context, silverRateOverride: ratePerGram };
  if (product.type === "Gold") {
    const karat = toGoldKarat(product.goldKarat);
    if (karat === null) return context;
    return {
      ...context,
      goldRateTable: context.goldRateTable.map((entry) =>
        entry.karat === karat ? { ...entry, ratePerGram } : entry,
      ),
    };
  }
  return context;
}

/**
 * Re-price ONE bill line. The LINE's weight (when set) overrides the
 * product's pricing weight — Gold prices from the override as its NET weight
 * basis, Silver as its weight basis — and `overrides` layer the bill screen's
 * per-line rate/labour/charge edits on top. Used when the shop edits a line's
 * Weight/Rate/Labour/charges (and by later bill-rate reprices) so an edited
 * line is never silently reverted to the product's stored inputs.
 *
 * Returns null only when the line isn't a Gold/Silver product (never
 * metal-priced) — callers keep the current price. A missing/invalid line
 * weight falls back to the product's own weight basis internally, so callers
 * can pass the line as-is on every reprice.
 */
export function priceBillLineRow(
  product: ProductRowPricingInput,
  context: PricingContext,
  line: BillLineWeight,
  overrides?: BillLinePricingOverrides,
): PriceBreakdown | null {
  if (product.type !== "Gold" && product.type !== "Silver") return null;
  const effective = applyOverrides(product, overrides);
  const ctx = applyRateOverride(effective, context, overrides?.ratePerGram);

  const weight = line.weight;
  const weightGm =
    weight == null || !Number.isFinite(weight) || weight <= 0
      ? 0
      : weightToGrams(weight, line.weightUnit ?? "gm");
  if (weightGm <= 0) return priceProductRow(effective, ctx);
  if (product.type === "Gold") {
    return priceProductRow({ ...effective, netWeight: String(weightGm), weightUnit: "gm" }, ctx);
  }
  return priceProductRow({ ...effective, weight: weightGm, weightUnit: "gm" }, ctx);
}

/**
 * The frozen `invoice_items.pricing` snapshot for a computed line — the ONE
 * breakdown→snapshot mapping, shared by the server (`pricingSnapshotFor`) and
 * the bill screens (which send their edited line's snapshot on save so the
 * printed bill shows the edited rate/labour/other charges).
 */
export function invoicePricingFromBreakdown(breakdown: PriceBreakdown): InvoiceItemPricing | null {
  if (breakdown.source !== "auto" || breakdown.metal === null) return null;
  return {
    metal: breakdown.metal,
    ratePerGram: breakdown.ratePerGram,
    karat: breakdown.karat,
    silverPercentage: breakdown.metal === "Silver" ? breakdown.purityPercent : null,
    weightGm: breakdown.weightGm,
    metalValue: breakdown.metalValue,
    labourType: breakdown.labour.type,
    labourValue: breakdown.labour.value,
    labourAmount: breakdown.labour.amount,
    povayi: breakdown.charges.povayi,
    nag: breakdown.metal === "Gold" ? breakdown.charges.nag : null,
    other: breakdown.charges.other,
  };
}
