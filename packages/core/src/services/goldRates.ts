import { and, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import type { DbClient } from "../db/client.js";
import * as schema from "../db/schema.js";
import {
  applyGoldBaseRate,
  isGoldKarat,
  karatFromPurity,
  resolveGoldRateTable,
  round2,
  type GoldKarat,
  type GoldRateTableEntry,
} from "../pricing/gold.js";
import type { LabourConfig } from "../pricing/labour.js";
import { logActivity } from "./activity.js";

/**
 * Gold rate table management — SHARED by all three apps (Settings → Gold rate).
 *
 *   - listGoldRates(db)        → all 25 karats (quoted + derived) for the editor
 *   - saveGoldRates(db, rows)  → upsert quoted karats, delete the ones reset to
 *                                "derived" (one save = one atomic intent)
 *   - loadGoldPricing(db)      → the expanded table + shop default making charge
 *                                (used by quick-sale pricing)
 *   - backfillGoldKarats(db)   → fills `products.goldKarat` from the free-text
 *                                purity stamp ("22K" / "916") for existing rows
 *
 * Every write is activity-logged so the trail matches the rest of the app.
 */

export class GoldRateError extends Error {
  constructor(
    message: string,
    public code: string,
    public status = 400,
  ) {
    super(message);
  }
}

/** One karat row as the editor/API sees it (Date-free → wire-ready). */
export type KaratRate = {
  karat: GoldKarat;
  /** ₹ per gram for this karat (0 when nothing is quoted yet). */
  ratePerGram: number;
  /** true → the shop quoted this karat. */
  isCustom: boolean;
  /** true → derived from the base karat (shown greyed in the editor). */
  derived: boolean;
  /** Purity of the karat, e.g. 91.67 for 22K. */
  purityPercent: number;
  /** ISO timestamp of the last quote for this karat (null when derived). */
  updatedAt: string | null;
};

/** GET /api/gold-rates payload. */
export type GoldRatesResult = {
  rates: KaratRate[];
  /** Highest quoted karat — the derivation base (null until a rate is set). */
  baseKarat: GoldKarat | null;
  baseRatePerGram: number;
  /** Latest quote time across all quoted karats. */
  updatedAt: string | null;
};

/** One row of a PUT /api/gold-rates body. */
export type GoldRateSaveInput = {
  karat: number;
  ratePerGram: number;
  /** false → reset this karat to derived (deletes the stored quote). */
  isCustom: boolean;
};

/** Expanded rate table + shop-wide pricing defaults (internal consumers). */
export type GoldPricingContext = {
  table: GoldRateTableEntry[];
  /** Shop default labour for gold (null when no default is configured). */
  defaultLabour: LabourConfig | null;
  /** Shop-wide silver ₹/gram (0 → silver never auto-prices). */
  silverRatePerGram: number;
  /** Bill-level silver ₹/gram override (null → normal precedence). */
  silverRateOverride: number | null;
};

/** The effective 0–24 table + shop pricing defaults, in one round trip. */
export async function loadGoldPricing(
  db: DbClient,
  opts?: { goldBaseRate?: number; silverBaseRate?: number },
): Promise<GoldPricingContext> {
  const [rows, settingsRow] = await Promise.all([
    db.select().from(schema.goldRates),
    db.query.settings.findFirst(),
  ]);
  const defaultLabourValue = settingsRow?.defaultLabourValue ?? 0;
  const table = resolveGoldRateTable(
    rows.map((r) => ({ karat: r.karat, ratePerGram: r.ratePerGram, isCustom: r.isCustom })),
  );
  // Bill-level gold rate edit: the bill's rate replaces the BASE row and is
  // re-derived across every non-quoted karat (other quotes stay as saved).
  // (No override → today's table.)
  const override = opts?.goldBaseRate;
  let baseKarat: number | null = null;
  for (const r of rows) {
    if (r.isCustom && r.ratePerGram > 0 && (baseKarat === null || r.karat > baseKarat)) baseKarat = r.karat;
  }
  const effectiveTable =
    override !== undefined && override > 0 ? applyGoldBaseRate(table, override, baseKarat) : table;
  return {
    table: effectiveTable,
    defaultLabour:
      defaultLabourValue > 0
        ? { type: settingsRow?.defaultLabourType ?? "PERCENT", value: defaultLabourValue }
        : null,
    silverRatePerGram: settingsRow?.silverRatePerGram ?? 0,
    silverRateOverride: opts?.silverBaseRate !== undefined && opts.silverBaseRate > 0 ? opts.silverBaseRate : null,
  };
}

/** All 25 karats — quoted rows plus everything derived from the base karat. */
export async function listGoldRates(db: DbClient): Promise<GoldRatesResult> {
  const rows = await db.select().from(schema.goldRates);
  const table = resolveGoldRateTable(rows);

  const storedByKarat = new Map(rows.map((r) => [r.karat, r]));
  const quoted = table.filter((entry) => entry.isCustom && entry.ratePerGram > 0);
  const base = quoted.length > 0 ? quoted[quoted.length - 1] : undefined;

  let updatedAt: string | null = null;
  for (const row of rows) {
    const iso = row.updatedAt.toISOString();
    if (updatedAt === null || iso > updatedAt) updatedAt = iso;
  }

  return {
    rates: table.map((entry) => ({
      karat: entry.karat,
      ratePerGram: entry.ratePerGram,
      isCustom: entry.isCustom,
      derived: entry.derived,
      purityPercent: entry.purityPercent,
      updatedAt: storedByKarat.get(entry.karat)?.updatedAt.toISOString() ?? null,
    })),
    baseKarat: base?.karat ?? null,
    baseRatePerGram: base?.ratePerGram ?? 0,
    updatedAt,
  };
}

/** Human summary for the activity log — quoted karats only. */
function describeSave(quoted: readonly GoldRateSaveInput[], resetKarats: readonly number[]): string {
  const parts = quoted
    .slice()
    .sort((a, b) => b.karat - a.karat)
    .map((row) => `${row.karat}K ${round2(row.ratePerGram)}/g`);
  const resetParts = resetKarats
    .slice()
    .sort((a, b) => b - a)
    .map((karat) => `${karat}K`);
  const segments: string[] = [];
  if (parts.length > 0) segments.push(parts.join(", "));
  if (resetParts.length > 0) segments.push(`reset to derived: ${resetParts.join(", ")}`);
  return `Gold rate updated — ${segments.join(" | ")}`;
}

/**
 * Saves the rate table. Rows with `isCustom: true` (and a positive rate) are
 * upserted; rows with `isCustom: false` are deleted so the karat goes back to
 * being derived. Returns the fresh table.
 */
export async function saveGoldRates(
  db: DbClient,
  rows: readonly GoldRateSaveInput[],
): Promise<GoldRatesResult> {
  const quoted: GoldRateSaveInput[] = [];
  const resetKarats: number[] = [];
  const seen = new Set<number>();

  for (const row of rows) {
    if (!isGoldKarat(row.karat)) {
      throw new GoldRateError(
        `Karat must be a whole number between 0 and 24 (got ${row.karat})`,
        "INVALID_KARAT",
      );
    }
    if (seen.has(row.karat)) {
      throw new GoldRateError(`Karat ${row.karat}K was sent twice`, "DUPLICATE_KARAT");
    }
    seen.add(row.karat);
    if (row.isCustom && Number.isFinite(row.ratePerGram) && row.ratePerGram > 0) {
      quoted.push(row);
    } else {
      resetKarats.push(row.karat);
    }
  }

  if (quoted.length === 0 && resetKarats.length === 0) return listGoldRates(db);

  const now = new Date();
  for (const row of quoted) {
    const ratePerGram = round2(row.ratePerGram);
    await db
      .insert(schema.goldRates)
      .values({ karat: row.karat, ratePerGram, isCustom: true })
      .onConflictDoUpdate({
        target: schema.goldRates.karat,
        set: { ratePerGram, isCustom: true, updatedAt: now },
      });
  }
  if (resetKarats.length > 0) {
    await db.delete(schema.goldRates).where(inArray(schema.goldRates.karat, resetKarats));
  }

  await logActivity(db, "GOLD_RATE_UPDATED", describeSave(quoted, resetKarats));
  return listGoldRates(db);
}

/** Result of the karat backfill (mirrors `backfillBarcodes`). */
export type GoldKaratsBackfillResult = {
  /** Products that got a karat from their purity stamp. */
  updated: number;
  /** Gold products whose purity stamp couldn't be read. */
  skipped: number;
  /** Gold products missing a karat that were inspected. */
  total: number;
};

/**
 * Fills `goldKarat` on existing gold products from their free-text purity stamp
 * ("22K" → 22, "916" → 22, "750" → 18). Never touches products that already
 * have a karat — safe to re-run, exactly like the barcode backfill.
 */
export async function backfillGoldKarats(db: DbClient): Promise<GoldKaratsBackfillResult> {
  const rows = await db
    .select({ id: schema.products.id, purity: schema.products.purity })
    .from(schema.products)
    .where(
      and(
        eq(schema.products.type, "Gold"),
        isNull(schema.products.goldKarat),
        isNotNull(schema.products.purity),
      ),
    );

  let updated = 0;
  let skipped = 0;
  for (const row of rows) {
    const karat = karatFromPurity(row.purity);
    if (karat === null) {
      skipped++;
      continue;
    }
    await db
      .update(schema.products)
      .set({ goldKarat: karat, updatedAt: new Date() })
      .where(eq(schema.products.id, row.id));
    updated++;
  }

  if (updated > 0) {
    await logActivity(
      db,
      "GOLD_KARAT_BACKFILLED",
      `Filled karat for ${updated} gold product(s) from their purity stamp`,
    );
  }
  return { updated, skipped, total: rows.length };
}
