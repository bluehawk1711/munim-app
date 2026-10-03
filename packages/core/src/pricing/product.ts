/**
 * priceProduct — THE single product-pricing dispatcher (§10 of the spec).
 *
 * One deterministic, typed function computes the current unit price for any
 * product; the SQL twin (`autoPriceSql` / `effectivePriceSql` in
 * `services/products.ts`) implements exactly the same branches for lists and
 * aggregates, and `scripts/verify-pricing.ts` proves they agree.
 *
 * Branches (first match wins):
 *
 *   1. Gold  + priceMode "auto" + karat + karat rate>0 + NET weight parsed>0
 *          metalValue = netWeightGm × rate(karat)
 *          labour     = product labour, else SHOP DEFAULT (settings)
 *          price      = round2(metalValue + labour)
 *          (net weight is free text — `parseNetWeight` strips non-numeric
 *           chars; no number found → the "invalid-net-weight" fallback.)
 *
 *   2. Silver + priceMode "auto" + shop silver rate>0 + weight>0
 *          metalValue = weightGm × silverPercentage/100 × silverRate
 *          labour     = product labour ONLY (silver never uses a shop default
 *                       — per-product by design), unset → ₹0
 *          price      = round2(metalValue + labour)
 *
 *   3. Anything else (manual mode, non-metal type, missing karat/rate/weight)
 *          → the stored `sellingPrice`, with a typed `fallback` reason.
 *          Never ₹0 by accident — legacy products keep working untouched.
 *
 * The price is computed on READ and never stored on the product row; invoices
 * freeze the number in `invoice_items.price` (+ an optional `pricing`
 * snapshot) so historical bills never move when rates change.
 *
 * Pure TS (no DB/DOM) — API, web/desktop/mobile forms and tests all import
 * this from `@munim/core`.
 */
import {
  karatPurityPercent,
  parseNetWeight,
  rateForKarat,
  toGoldKarat,
  weightToGrams,
  type GoldKarat,
  type GoldRateTableEntry,
} from "./gold.js";
import { computeLabour, type LabourConfig, type LabourType } from "./labour.js";

/** auto → computed from current rates; manual → stored sellingPrice. */
export type PriceMode = "auto" | "manual";

/** Why an auto-priced product fell back to its stored `sellingPrice`. */
export type PriceFallback =
  | "manual-mode"
  | "no-karat"
  | "no-rate"
  | "zero-weight"
  | "invalid-net-weight"
  | "no-silver-rate"
  | null;

/**
 * User-facing explanation for a fallback reason — shared by the web, desktop
 * and mobile product forms so the message reads the same everywhere (§3:
 * shared logic lives in core). Returns `null` for `null` (auto-priced).
 */
export function priceFallbackMessage(fallback: PriceFallback): string | null {
  switch (fallback) {
    case "manual-mode":
      return "Price mode is Manual — switch to Auto to compute from rates.";
    case "no-karat":
      return "No karat selected — pick one so a gold rate applies.";
    case "no-rate":
      return "No gold rate for this karat yet — set one in Settings → Rates & labour.";
    case "zero-weight":
      return "Weight is 0 — enter a positive weight to auto-price.";
    case "invalid-net-weight":
      return "Net weight is missing or not a number — enter a number like 9.85 so this gold product can auto-price.";
    case "no-silver-rate":
      return "Shop silver rate is 0 — set it in Settings → Rates & labour.";
    default:
      return null;
  }
}

/** The labour slice of the breakdown (what the operator sees). */
export type PriceLabour = {
  /** Method that applied (null when no labour was configured). */
  type: LabourType | null;
  /** The configured rate/amount (0 when unset). */
  value: number;
  /** Computed labour amount in ₹. */
  amount: number;
};

/** Full, explainable price computation — the "why" behind every number. */
export type PriceBreakdown = {
  /** "auto" → computed from rates; "manual" → stored sellingPrice. */
  source: "auto" | "manual";
  fallback: PriceFallback;
  /** Which engine priced it (Gold/Silver), null on manual fallback. */
  metal: "Gold" | "Silver" | null;
  /** Gold only — the product's karat. */
  karat: GoldKarat | null;
  /** Gold → karat purity % (22K → 91.67); Silver → silverPercentage. */
  purityPercent: number | null;
  /** ₹/gram used: the karat's rate (gold) or the shop silver rate. */
  ratePerGram: number;
  weightGm: number;
  /** rate × weight (× purity for silver). */
  metalValue: number;
  labour: PriceLabour;
  /** Final unit price (before invoice-level discount/delivery). */
  price: number;
};


/** The product fields the engine needs (structurally typed — DTO-compatible). */
export type PriceableProduct = {
  type: string;
  priceMode: PriceMode;
  weight: number | null;
  weightUnit: string | null;
  /** Gold karat 0–24 (null → un-priced until backfilled/selected). */
  goldKarat: number | null;
  /** Silver purity % (e.g. 92.5). Ignored for gold. */
  silverPercentage: number;
  /** Product's own labour method (its `labourValue` decides if it applies). */
  labourType: LabourType;
  /** null → Gold uses the shop default; Silver uses no labour. */
  labourValue: number | null;
  /** Free-text net weight (gold auto-price basis) — parsed by `parseNetWeight`. */
  netWeight?: string | null;
  /** Stored price — the manual price and every fallback. */
  sellingPrice: number;
};

/** Current shop-level pricing inputs (from settings + the gold rate table). */
export type PricingContext = {
  /** Expanded 0–24 gold rate table (quoted rows + derived karats). */
  goldRateTable: readonly GoldRateTableEntry[];
  /** Shop-wide silver ₹/gram (0 → silver never auto-prices). */
  silverRatePerGram: number;
  /** Shop default labour for GOLD products with no labour of their own. */
  defaultLabour: LabourConfig | null;
};

function r2(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

/** The product's own labour config, or null when `labourValue` is unset. */
function productLabour(product: PriceableProduct): LabourConfig | null {
  if (product.labourValue === null || !Number.isFinite(product.labourValue)) return null;
  if (product.labourValue <= 0) return { type: product.labourType, value: 0 };
  return { type: product.labourType, value: product.labourValue };
}

/**
 * Computes the effective unit price of a product (and the full breakdown).
 * Never throws: every missing input degrades to the stored `sellingPrice`.
 */
export function priceProduct(product: PriceableProduct, context: PricingContext): PriceBreakdown {
  const weightGm = weightToGrams(product.weight, product.weightUnit);
  const karat = toGoldKarat(product.goldKarat);
  const silverPercent =
    Number.isFinite(product.silverPercentage) && product.silverPercentage > 0
      ? Math.min(product.silverPercentage, 100)
      : 100;

  const manual = (fallback: PriceFallback, extra?: Partial<PriceBreakdown>): PriceBreakdown => ({
    source: "manual",
    fallback,
    metal: null,
    karat,
    purityPercent: karat === null ? null : karatPurityPercent(karat),
    ratePerGram: 0,
    weightGm,
    metalValue: 0,
    labour: { type: null, value: 0, amount: 0 },
    price: r2(product.sellingPrice),
    ...extra,
  });

  if (product.priceMode !== "auto") return manual("manual-mode");

  // ── Gold ────────────────────────────────────────────────────────
  if (product.type === "Gold") {
    if (karat === null) return manual("no-karat");
    const rate = rateForKarat(context.goldRateTable, karat);
    if (!Number.isFinite(rate) || rate <= 0) return manual("no-rate", { ratePerGram: 0 });
    // Gold prices from the NET weight (free text) — strict: no number found
    // means no auto-price; the form shows `priceFallbackMessage` instead.
    const netWeight = parseNetWeight(product.netWeight);
    if (netWeight === null) {
      return manual("invalid-net-weight", { ratePerGram: rate, purityPercent: karatPurityPercent(karat) });
    }
    const netWeightGm = weightToGrams(netWeight, product.weightUnit);
    if (netWeightGm <= 0) {
      return manual("zero-weight", { ratePerGram: rate, purityPercent: karatPurityPercent(karat) });
    }

    const metalValue = r2(netWeightGm * rate);
    // Gold: product labour wins; unset falls back to the shop default.
    const labourConfig = productLabour(product) ?? context.defaultLabour;
    const labourAmount = computeLabour(labourConfig, { metalValue, weightGm: netWeightGm });
    return {
      source: "auto",
      fallback: null,
      metal: "Gold",
      karat,
      purityPercent: karatPurityPercent(karat),
      ratePerGram: rate,
      weightGm: netWeightGm,
      metalValue,
      labour: {
        type: labourConfig?.type ?? null,
        value: labourConfig?.value ?? 0,
        amount: labourAmount,
      },
      price: r2(metalValue + labourAmount),
    };
  }

  // ── Silver ──────────────────────────────────────────────────────
  if (product.type === "Silver") {
    const rate = Number.isFinite(context.silverRatePerGram) ? context.silverRatePerGram : 0;
    if (rate <= 0) return manual("no-silver-rate");
    if (weightGm <= 0) return manual("zero-weight", { ratePerGram: rate, purityPercent: silverPercent });

    const metalValue = r2(weightGm * (silverPercent / 100) * rate);
    // Silver labour is strictly per product (no shop default) → unset = ₹0.
    const labourConfig = productLabour(product);
    const labourAmount = computeLabour(labourConfig, { metalValue, weightGm });
    return {
      source: "auto",
      fallback: null,
      metal: "Silver",
      karat: null,
      purityPercent: silverPercent,
      ratePerGram: rate,
      weightGm,
      metalValue,
      labour: {
        type: labourConfig?.type ?? null,
        value: labourConfig?.value ?? 0,
        amount: labourAmount,
      },
      price: r2(metalValue + labourAmount),
    };
  }

  // Diamond/Platinum/Other — never metal-priced.
  return manual("manual-mode");
}

/**
 * Convenience for callers that hold the gold table + settings values directly
 * (forms keep them in component state).
 */
export function priceWithTable(
  product: PriceableProduct,
  goldRateTable: readonly GoldRateTableEntry[],
  silverRatePerGram: number,
  defaultLabour: LabourConfig | null,
): PriceBreakdown {
  return priceProduct(product, { goldRateTable, silverRatePerGram, defaultLabour });
}

