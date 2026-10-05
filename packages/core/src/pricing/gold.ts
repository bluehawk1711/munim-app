/**
 * Gold karat utilities + the manual per-karat RATE TABLE — karat range,
 * purity helpers, hallmark parsing and `resolveGoldRateTable` (quoted rows +
 * karats derived from the base). Pure TS, shared by every app via
 * `@munim/core`.
 *
 * The PRICE formula itself lives next door in `pricing/product.ts`
 * (`priceProduct`), which composes these rate helpers with `labour.ts`.
 * Model (see `docs/features.md`):
 *
 *   - `gold_rates` stores the shop's OWN quoted retail ₹/gram for the karats
 *     it sells. Karats without a row are DERIVED from the highest quoted
 *     karat: `rate(k) = round(baseRate × k ÷ baseKarat)` — so a shop that only
 *     knows its 24K rate still gets a sane rate for all 0–24 karats.
 *   - The rate is the karat's own retail rate — purity is NOT applied twice.
 *   - Prices are recomputed on READ, never materialised: editing a rate
 *     re-prices the whole auto catalogue instantly, while already-saved
 *     invoices keep their stored totals.
 */

/* ── Karats 0–24 ──────────────────────────────────────────────── */

/** Every selectable karat, 0 through 24 (the spec's full range). */
export const KARAT_VALUES = [
  0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
  13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24,
] as const;

/** Literal union of the supported karats. */
export type GoldKarat = (typeof KARAT_VALUES)[number];

/** Highest supported karat (fine gold). */
export const MAX_KARAT = 24;

/** Runtime guard — the boundary for karat values coming from the wire/DB. */
export function isGoldKarat(value: number): value is GoldKarat {
  return Number.isInteger(value) && value >= 0 && value <= MAX_KARAT;
}

/** Narrows an arbitrary number (e.g. a DB int column) to a `GoldKarat`. */
export function toGoldKarat(value: number | null | undefined): GoldKarat | null {
  if (value === null || value === undefined) return null;
  return isGoldKarat(value) ? value : null;
}

/** Fine-gold fraction of a karat — 22K → 0.9166…, 24K → 1. */
export function karatPurityFraction(karat: number): number {
  if (!Number.isFinite(karat) || karat <= 0) return 0;
  return Math.min(karat, MAX_KARAT) / MAX_KARAT;
}

/** Purity of a karat as a percentage — 22K → 91.67 (rounded to 2dp). */
export function karatPurityPercent(karat: number): number {
  return round2(karatPurityFraction(karat) * 100);
}

/** BIS hallmark stamps for the common karats (labels + purity parsing). */
export const KARAT_HALLMARK: Readonly<Record<number, string>> = {
  24: "995",
  22: "916",
  18: "750",
  14: "585",
  9: "375",
};

/** BIS stamp (and the 999 fine-gold stamp) → karat. */
const HALLMARK_KARAT: Readonly<Record<string, number>> = {
  "999": 24,
  "995": 24,
  "916": 22,
  "750": 18,
  "585": 14,
  "375": 9,
};

/**
 * Parses a free-text purity stamp into a karat. Accepts the conventions shops
 * actually type: `"22K"`, `"22 kt"`, `"916"` (BIS hallmark), `"24ct"`.
 * Returns null when nothing sensible can be read — callers keep the product
 * un-priced rather than guessing.
 */
export function karatFromPurity(purity: string | null | undefined): GoldKarat | null {
  const text = (purity ?? "").trim().toUpperCase();
  if (!text) return null;

  // "22K" / "22 KT" / "22CT" / "22 CARAT"
  const karatMatch = /^(\d{1,2})\s*(?:K|KT|CT|CARAT|CARATS)$/.exec(text);
  const karatText = karatMatch?.[1];
  if (karatText) {
    const value = Number.parseInt(karatText, 10);
    return isGoldKarat(value) ? value : null;
  }

  // BIS hallmark stamp ("916", "750", "995", …)
  const hallmark = HALLMARK_KARAT[text];
  if (hallmark !== undefined) return isGoldKarat(hallmark) ? hallmark : null;

  return null;
}

/* ── Numbers & weights ────────────────────────────────────────── */

/** Money rounding used everywhere in pricing (paisa precision). */
export function round2(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

/** Converts the stored weight into grams using the product's display unit. */
export function weightToGrams(
  weight: number | null | undefined,
  weightUnit: string | null | undefined,
): number {
  if (typeof weight !== "number" || !Number.isFinite(weight) || weight <= 0) return 0;
  return weightUnit === "mg" ? weight / 1000 : weight;
}

/**
 * Parses the free-text NET WEIGHT column ("9.850 gm", "−.100", "1,015 g")
 * into a number: strips every character that isn't a digit or a dot, then
 * converts. Returns `null` when no number can be found (empty, missing, or
 * unparseable like "9.8.5") — callers surface a user-facing message instead
 * of guessing. The SQL twin of this rule lives in `services/products.ts`
 * (`netWeightGmSql`) and must be kept in lockstep.
 */
export function parseNetWeight(text: string | null | undefined): number | null {
  if (!text) return null;
  const cleaned = text.replace(/[^0-9.]/g, "");
  if (cleaned === "") return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

/* ── Rate table resolution (custom rows + derived karats) ─────── */

/** One entry of the effective 0–24 rate table (always all 25 karats). */
export type GoldRateTableEntry = {
  karat: GoldKarat;
  /** ₹ per gram for this karat (0 when nothing is quoted yet). */
  ratePerGram: number;
  /** true → the shop quoted this karat (a stored `gold_rates` row). */
  isCustom: boolean;
  /** true → computed from the base karat, not stored. */
  derived: boolean;
  /** Purity of this karat, e.g. 91.67 for 22K. */
  purityPercent: number;
};

/** The shape the service reads out of the DB / the API sends over the wire. */
export type GoldRateRowLike = {
  karat: number;
  ratePerGram: number;
  isCustom: boolean;
};

/** Derived rate helper — `rate(k) = round(base × k ÷ baseKarat)`. */
export function deriveRateFromBase(baseRatePerGram: number, baseKarat: number, karat: number): number {
  if (!Number.isFinite(baseRatePerGram) || baseRatePerGram <= 0) return 0;
  if (!Number.isFinite(baseKarat) || baseKarat <= 0 || !Number.isFinite(karat)) return 0;
  return round2((baseRatePerGram * karat) / baseKarat);
}

/**
 * Expands the stored custom rows into a complete 0–24 rate table, deriving
 * every un-quoted karat from the highest quoted karat (the "base").
 */
export function resolveGoldRateTable(rows: readonly GoldRateRowLike[]): GoldRateTableEntry[] {
  const custom = new Map<GoldKarat, number>();
  for (const row of rows) {
    const karat = toGoldKarat(row.karat);
    if (karat === null) continue;
    if (!row.isCustom || !Number.isFinite(row.ratePerGram) || row.ratePerGram <= 0) continue;
    custom.set(karat, row.ratePerGram);
  }

  // Base = highest quoted karat (usually 24K); it scales every derived karat.
  let baseKarat: GoldKarat | null = null;
  for (const karat of custom.keys()) {
    if (baseKarat === null || karat > baseKarat) baseKarat = karat;
  }
  const baseRate = baseKarat === null ? 0 : custom.get(baseKarat) ?? 0;

  return KARAT_VALUES.map((karat) => {
    const customRate = custom.get(karat);
    if (customRate !== undefined) {
      return {
        karat,
        ratePerGram: customRate,
        isCustom: true,
        derived: false,
        purityPercent: karatPurityPercent(karat),
      };
    }
    const derivedRate = baseKarat === null ? 0 : deriveRateFromBase(baseRate, baseKarat, karat);
    return {
      karat,
      ratePerGram: derivedRate,
      isCustom: false,
      derived: baseKarat !== null,
      purityPercent: karatPurityPercent(karat),
    };
  });
}

/** Looks up one karat in an expanded table (0 when the table has no entry). */
export function rateForKarat(table: readonly GoldRateTableEntry[], karat: GoldKarat | null): number {
  if (karat === null) return 0;
  return table.find((entry) => entry.karat === karat)?.ratePerGram ?? 0;
}

/**
 * Bill-level rate edit: replaces the BASE (highest quoted) karat's rate and
 * re-derives every non-quoted karat from it. Other explicitly quoted karats
 * stay exactly as the shop wrote them.
 * Returns the table unchanged when the override/base karat is missing or non-positive.
 */
export function applyGoldBaseRate(
  table: readonly GoldRateTableEntry[],
  baseRatePerGram: number,
  baseKarat: number | null,
): GoldRateTableEntry[] {
  if (!Number.isFinite(baseRatePerGram) || baseRatePerGram <= 0) return [...table];
  if (baseKarat === null || !Number.isFinite(baseKarat) || baseKarat <= 0) return [...table];
  return table.map((entry) => {
    if (entry.karat === baseKarat) return { ...entry, ratePerGram: baseRatePerGram };
    if (entry.isCustom) return entry;
    return { ...entry, ratePerGram: deriveRateFromBase(baseRatePerGram, baseKarat, entry.karat) };
  });
}
