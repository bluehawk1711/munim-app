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
 *          charges    = nag rate + povayi rate + other charges (flat ₹,
 *                       parsed — nag is a gold-only charge)
 *          price      = round2(metalValue + labour + charges)
 *          (net weight is free text — `parseNetWeight` strips non-numeric
 *           chars; no number found → the "invalid-net-weight" fallback.)
 *
 *   2. Silver + priceMode "auto" + silver rate>0 + weight>0
 *          rate       = product's OWN silverRatePerGram when > 0, else the
 *                       shop-wide rate (a global silver change recalculates
 *                       every product without a custom rate instantly)
 *          metalValue = weightGm × silverPercentage/100 × rate
 *          labour     = product labour ONLY (silver never uses a shop default
 *                       — per-product by design), unset → ₹0
 *          charges    = povayi rate + other charges (flat ₹; nag is gold-only)
 *          price      = round2(metalValue + labour + charges)
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
      return "No silver rate — set this product's rate in the form or the shop rate in Settings → Rates & labour.";
    default:
      return null;
  }
}

/**
 * Parses a flat ₹ charge (nag rate / povayi rate / other charges) — accepts
 * the free-text column (`"5"`, `"₹5"`) or an already-numeric value. Anything
 * unparseable or ≤ 0 is ₹0 (never a negative price contribution). Mirrors the
 * SQL charge parse in `services/products.ts` — keep them in lockstep.
 */
export function parseCharge(value: string | number | null | undefined): number {
  if (typeof value === "number") {
    return Number.isFinite(value) && value > 0 ? r2(value) : 0;
  }
  if (!value) return 0;
  const cleaned = value.replace(/[^0-9.]/g, "");
  if (cleaned === "") return 0;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) && parsed > 0 ? r2(parsed) : 0;
}

/** The flat ₹ charges slice of the breakdown (0 in manual mode). */
export type PriceCharges = {
  /** Gold-only flat ₹ nag charge. */
  nag: number;
  /** Flat ₹ povayi charge (gold + silver). */
  povayi: number;
  /** Flat ₹ other charges (gold + silver). */
  other: number;
};

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
  /** Flat ₹ charges added on top (nag/povayi/other) — all 0 in manual mode. */
  charges: PriceCharges;
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
  /** Per-product silver ₹/gram — wins over the shop rate when > 0. */
  silverRatePerGram?: number | null;
  /** Flat ₹ nag charge — free-text column, parsed by {@link parseCharge} (gold only). */
  nagRate?: string | number | null;
  /** Flat ₹ povayi charge (gold + silver). */
  povayiRate?: number | null;
  /** Flat ₹ other charges (gold + silver). */
  otherCharges?: number | null;
  /** Stored price — the manual price and every fallback. */
  sellingPrice: number;
};

/** Current shop-level pricing inputs (from settings + the gold rate table). */
export type PricingContext = {
  /** Expanded 0–24 gold rate table (quoted rows + derived karats). */
  goldRateTable: readonly GoldRateTableEntry[];
  /** Shop-wide silver ₹/gram (0 → silver never auto-prices). */
  silverRatePerGram: number;
  /** Bill-level silver ₹/gram override — wins over the product's own rate AND
   *  the shop rate (only while a bill is being built; products keep their
   *  custom rate everywhere else). null → normal precedence. */
  silverRateOverride?: number | null;
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
    charges: { nag: 0, povayi: 0, other: 0 },
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
    // Flat ₹ charges: nag (gold-only) + povayi + other.
    const charges: PriceCharges = {
      nag: parseCharge(product.nagRate),
      povayi: parseCharge(product.povayiRate),
      other: parseCharge(product.otherCharges),
    };
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
      charges,
      price: r2(metalValue + labourAmount + charges.nag + charges.povayi + charges.other),
    };
  }

  // ── Silver ──────────────────────────────────────────────────────
  if (product.type === "Silver") {
    // Per-product rate wins; blank/0 falls back to the shop-wide rate so a
    // global silver change recalculates every non-custom product live. A
    // bill-level override (this bill only) wins over BOTH.
    const customRate = product.silverRatePerGram;
    const override = context.silverRateOverride;
    const rate =
      typeof override === "number" && Number.isFinite(override) && override > 0
        ? override
        : typeof customRate === "number" && Number.isFinite(customRate) && customRate > 0
          ? customRate
          : Number.isFinite(context.silverRatePerGram)
            ? context.silverRatePerGram
            : 0;
    if (rate <= 0) return manual("no-silver-rate");
    if (weightGm <= 0) return manual("zero-weight", { ratePerGram: rate, purityPercent: silverPercent });

    const metalValue = r2(weightGm * (silverPercent / 100) * rate);
    // Silver labour is strictly per product (no shop default) → unset = ₹0.
    const labourConfig = productLabour(product);
    const labourAmount = computeLabour(labourConfig, { metalValue, weightGm });
    // Flat ₹ charges: nag is gold-only, so silver gets povayi + other only.
    const charges: PriceCharges = {
      nag: 0,
      povayi: parseCharge(product.povayiRate),
      other: parseCharge(product.otherCharges),
    };
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
      charges,
      price: r2(metalValue + labourAmount + charges.povayi + charges.other),
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

/** Serialized product rows (`ProductDto`) — the same fields, keyed by the
 *  DTO's `productSilverRatePerGram` read key. */
export type ProductRowPricingInput = Omit<PriceableProduct, "silverRatePerGram"> & {
  productSilverRatePerGram?: number | null;
};

/** `priceProduct` for serialized product rows — billing reprice when the
 *  shop edits a bill's gold rate. */
export function priceProductRow(product: ProductRowPricingInput, context: PricingContext): PriceBreakdown {
  const { productSilverRatePerGram, ...rest } = product;
  return priceProduct({ ...rest, silverRatePerGram: productSilverRatePerGram ?? null }, context);
}

/* ── Net weight derivation (product forms) ─────────────────────── */

export type NetWeightInput = {
  /** Free text, in the product's `weightUnit` (e.g. "6.890" / "6890"). */
  grossWeight?: string | null;
  /** Free text nag-less weight, in `nagUnit`. */
  nagLessWeight?: string | null;
  /** Free text chejat weight, in `nagUnit`. */
  chejatWeight?: string | null;
  /** Unit of gross/net: "mg" | "gm" (default gm). */
  weightUnit?: string | null;
  /** Unit of the nag/chejat pair — the toggle beside those fields. */
  nagUnit?: string | null;
};

export type NetWeightResult = {
  /** Derived net weight in GRAMS (the pricing basis). */
  grams: number;
  /** Ready-to-store `net_weight` text expressed in the product's weight unit. */
  text: string;
};

function toGrams(value: number, unit: string | null | undefined): number {
  return unit === "mg" ? value / 1000 : value;
}

/**
 * net = gross − nag + chejat, every input normalised to grams (nag/chejat use
 * their own unit toggle; gross uses the product weight unit). Free text is
 * parsed with the same non-digit/dot strip as `parseNetWeight`. Returns null
 * when gross itself is unparseable (nothing to derive from); missing nag or
 * chejat counts as 0. This is the ONE derivation — desktop, web and mobile
 * forms all call it so the value they store always matches the price.
 */
export function calcNetWeight(input: NetWeightInput): NetWeightResult | null {
  const gross = parseNetWeight(input.grossWeight);
  if (gross === null) return null;
  const nag = parseNetWeight(input.nagLessWeight) ?? 0;
  const chejat = parseNetWeight(input.chejatWeight) ?? 0;
  const raw = toGrams(gross, input.weightUnit) - toGrams(nag, input.nagUnit) + toGrams(chejat, input.nagUnit);
  const grams = Math.round(raw * 10000) / 10000;
  if (!Number.isFinite(grams)) return null;
  const unit = input.weightUnit === "mg" ? "mg" : "gm";
  const stored = unit === "mg" ? Math.round(grams * 1000 * 100) / 100 : grams;
  return { grams, text: `${stored} ${unit}` };
}

