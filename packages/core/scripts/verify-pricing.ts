/**
 * verify-pricing — proves the two pricing engines agree.
 *
 * The TS engine (`priceProduct` in pricing/product.ts) is the source of truth
 * used by every form preview, bill line and API write; the SQL twin
 * (`autoPriceSql` / `goldRatePerGramSql` / `effectivePriceSql` in
 * services/products.ts) prices every list, aggregate, report and stock
 * valuation on read. This script walks every product in the connected
 * database, computes both, and fails (exit 1) if any unit price or rate
 * differs by a paisa or more — covering the derived-karat lookup, the
 * rounding stages (metal → labour → price) and every fallback branch.
 *
 * Run (needs DATABASE_URL in packages/core/.env or the root .env):
 *   pnpm verify:pricing            # read-only: every product already in the DB
 *   pnpm verify:pricing --seed     # + a temp fixture that exercises EVERY
 *                                     branch (quoted & derived karats, all
 *                                     three labour methods, silver, every
 *                                     fallback), then a second "bare" pass with
 *                                     gold_rates emptied and silver at ₹0 for
 *                                     the no-rate fallbacks — snapshot/restore
 *                                     of gold_rates & settings, deleted at the
 *                                     end (restored even if a pass fails).
 *                                     Guarded: requires MUNIM_ALLOW_PRICING_SEED=1
 *                                     AND a scratch DATABASE_URL — never run the
 *                                     seeded pass against production (AGENTS.md §7).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { getDb, type DbClient } from "../src/db/client";
import * as schema from "../src/db/schema";
import { loadGoldPricing } from "../src/services/goldRates";
import {
  autoPriceSql,
  effectivePriceSql,
  goldRatePerGramSql,
  createProduct,
  deleteProduct,
  type ProductInput,
} from "../src/services/products";
import { priceProduct } from "../src/pricing/product";
import { rateForKarat, toGoldKarat } from "../src/pricing/gold";

/** Difference in whole paisa (both engines round to 2dp, so a diverging
 *  paisa digit is a bug; sub-paisa float noise between the two runtimes is
 *  not). */
function paisa(value: number): number {
  return Math.round(value * 100);
}

function diff(a: number | null, b: number | null): boolean {
  if (a === null && b === null) return false;
  if (a === null || b === null) return true;
  return paisa(a) !== paisa(b);
}

/** dotenv-style .env load (cwd = packages/core when run via pnpm). */
function loadEnv() {
  for (const file of [join(process.cwd(), ".env"), join(process.cwd(), "..", "..", ".env")]) {
    try {
      for (const line of readFileSync(file, "utf8").split("\n")) {
        const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)\s*$/);
        if (m && !(m[1] in process.env)) {
          process.env[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, "");
        }
      }
      if (process.env.DATABASE_URL) return;
    } catch {
      // try the next candidate
    }
  }
  console.error("No .env with DATABASE_URL found — set DATABASE_URL in the environment instead.");
}

type Row = {
  id: string;
  sku: string;
  name: string;
  type: string | null;
  priceMode: string | null;
  weight: number | null;
  weightUnit: string | null;
  netWeight: string | null;
  goldKarat: number | null;
  silverPercentage: number | null;
  labourType: string | null;
  labourValue: number | null;
  sellingPrice: number;
  nagRate: string | null;
  povayiRate: number | null;
  otherCharges: number | null;
  productSilverRate: number | null;
  sqlRate: number;
  sqlAuto: number | null;
  sqlEffective: number;
};

type Mismatch = {
  sku: string;
  name: string;
  field: "rate" | "autoPrice" | "effectivePrice";
  ts: number | null;
  sql: number | null;
};

/* ── Opt-in fixture (--seed) ─────────────────────────────────────────── */

type Cleanup = () => Promise<void>;

/** One product per branch of `priceProduct` (and of the SQL twin). */
const FIXTURES: ProductInput[] = [
  // Gold auto-prices from the NET weight (free text) — every fixture carries a
  // net_weight unless the branch is specifically about a missing/invalid one.
  { name: "ZZZ-Pricing-Verify gold 22K quoted + shop-default labour", type: "Gold", size: "V", priceMode: "auto", goldKarat: 22, weight: 10, weightUnit: "gm", netWeight: "9.850 gm", sellingPrice: 1, stock: 1 },
  { name: "ZZZ-Pricing-Verify gold 18K derived + per-gram labour", type: "Gold", size: "V", priceMode: "auto", goldKarat: 18, weight: 5.5, weightUnit: "gm", netWeight: "5.5", labourType: "PER_GRAM", labourValue: 180, sellingPrice: 1, stock: 1 },
  { name: "ZZZ-Pricing-Verify gold 24K quoted + fixed labour + mg weight", type: "Gold", size: "V", priceMode: "auto", goldKarat: 24, weight: 3500, weightUnit: "mg", netWeight: "3500", labourType: "FIXED", labourValue: 250, sellingPrice: 1, stock: 1 },
  { name: "ZZZ-Pricing-Verify gold 14K derived + zero net weight fallback", type: "Gold", size: "V", priceMode: "auto", goldKarat: 14, weight: 10, weightUnit: "gm", netWeight: "0", sellingPrice: 999, stock: 1 },
  { name: "ZZZ-Pricing-Verify gold 14K missing net weight fallback", type: "Gold", size: "V", priceMode: "auto", goldKarat: 14, weight: 10, weightUnit: "gm", sellingPrice: 998, stock: 1 },
  { name: "ZZZ-Pricing-Verify gold 22K junk net weight fallback", type: "Gold", size: "V", priceMode: "auto", goldKarat: 22, weight: 10, weightUnit: "gm", netWeight: "abc", sellingPrice: 997, stock: 1 },
  { name: "ZZZ-Pricing-Verify gold 22K multi-dot net weight fallback", type: "Gold", size: "V", priceMode: "auto", goldKarat: 22, weight: 10, weightUnit: "gm", netWeight: "9.8.5", sellingPrice: 996, stock: 1 },
  { name: "ZZZ-Pricing-Verify gold 22K leading-dot net weight", type: "Gold", size: "V", priceMode: "auto", goldKarat: 22, weight: 1, weightUnit: "gm", netWeight: ".100", sellingPrice: 1, stock: 1 },
  { name: "ZZZ-Pricing-Verify gold 22K trailing-dot net weight", type: "Gold", size: "V", priceMode: "auto", goldKarat: 22, weight: 12, weightUnit: "gm", netWeight: "12.", sellingPrice: 1, stock: 1 },
  { name: "ZZZ-Pricing-Verify gold auto without karat fallback", type: "Gold", size: "V", priceMode: "auto", goldKarat: null, weight: 10, weightUnit: "gm", netWeight: "9.5", sellingPrice: 888, stock: 1 },
  { name: "ZZZ-Pricing-Verify gold 22K manual mode", type: "Gold", size: "V", priceMode: "manual", goldKarat: 22, weight: 10, weightUnit: "gm", netWeight: "9.5", sellingPrice: 777, stock: 1 },
  { name: "ZZZ-Pricing-Verify gold 22K explicit zero labour", type: "Gold", size: "V", priceMode: "auto", goldKarat: 22, weight: 8, weightUnit: "gm", netWeight: "7.75", labourType: "PERCENT", labourValue: 0, sellingPrice: 1, stock: 1 },
  { name: "ZZZ-Pricing-Verify gold 16K derived fractional + percent labour", type: "Gold", size: "V", priceMode: "auto", goldKarat: 16, weight: 4444, weightUnit: "mg", netWeight: "4444", labourType: "PERCENT", labourValue: 7.5, sellingPrice: 1, stock: 1 },
  // Silver proves the net weight column is IGNORED for its basis (gross weight).
  { name: "ZZZ-Pricing-Verify silver 92.5 + percent labour", type: "Silver", size: "V", priceMode: "auto", silverPercentage: 92.5, weight: 20, weightUnit: "gm", labourType: "PERCENT", labourValue: 10, sellingPrice: 1, stock: 1 },
  { name: "ZZZ-Pricing-Verify silver no labour + fractional weight", type: "Silver", size: "V", priceMode: "auto", silverPercentage: 90, weight: 12.345, weightUnit: "gm", labourValue: null, sellingPrice: 1, stock: 1 },
  { name: "ZZZ-Pricing-Verify silver fixed labour + fractional weight", type: "Silver", size: "V", priceMode: "auto", silverPercentage: 92.5, weight: 7.7777, weightUnit: "gm", labourType: "FIXED", labourValue: 300, sellingPrice: 1, stock: 1 },
  { name: "ZZZ-Pricing-Verify silver purity 0 (→100%) + per-gram labour", type: "Silver", size: "V", priceMode: "auto", silverPercentage: 0, weight: 3, weightUnit: "gm", labourType: "PER_GRAM", labourValue: 50, sellingPrice: 1, stock: 1 },
  { name: "ZZZ-Pricing-Verify silver zero weight fallback", type: "Silver", size: "V", priceMode: "auto", silverPercentage: 92.5, weight: 0, weightUnit: "gm", sellingPrice: 666, stock: 1 },
  // ── Flat ₹ charges: nag (gold-only) + povayi + other ──────────────
  // The counter's real-world case: 6.890 gross − 0.800mg nag + 0.200mg
  // chejat → net 6.8894 gm, labour ₹1500/gram, plus flat charges.
  { name: "ZZZ-Pricing-Verify gold 22K charges + 1500/gram labour (counter case)", type: "Gold", size: "V", priceMode: "auto", goldKarat: 22, weight: 6.89, weightUnit: "gm", netWeight: "6.8894 gm", labourType: "PER_GRAM", labourValue: 1500, nagRate: "5", povayiRate: 100, otherCharges: 25, sellingPrice: 1, stock: 1 },
  { name: "ZZZ-Pricing-Verify gold 18K junk nag text + zero/negative charges", type: "Gold", size: "V", priceMode: "auto", goldKarat: 18, weight: 5, weightUnit: "gm", netWeight: "5", labourType: "PERCENT", labourValue: 8, nagRate: "abc", povayiRate: 0, otherCharges: -3, sellingPrice: 1, stock: 1 },
  { name: "ZZZ-Pricing-Verify gold 22K manual mode ignores charges", type: "Gold", size: "V", priceMode: "manual", goldKarat: 22, weight: 5, weightUnit: "gm", netWeight: "5", nagRate: "50", povayiRate: 500, otherCharges: 500, sellingPrice: 444, stock: 1 },
  // ── Per-product silver rate (custom wins; blank/0 → shop rate) ────
  { name: "ZZZ-Pricing-Verify silver custom rate wins over shop ₹95", type: "Silver", size: "V", priceMode: "auto", silverPercentage: 92.5, weight: 10, weightUnit: "gm", silverRatePerGram: 110, labourType: "FIXED", labourValue: 50, sellingPrice: 1, stock: 1 },
  { name: "ZZZ-Pricing-Verify silver zero custom rate falls back to shop", type: "Silver", size: "V", priceMode: "auto", silverPercentage: 92.5, weight: 6, weightUnit: "gm", silverRatePerGram: 0, sellingPrice: 1, stock: 1 },
  { name: "ZZZ-Pricing-Verify silver shop rate + povayi + other charges", type: "Silver", size: "V", priceMode: "auto", silverPercentage: 92.5, weight: 8, weightUnit: "gm", povayiRate: 30, otherCharges: 15, sellingPrice: 1, stock: 1 },
  { name: "ZZZ-Pricing-Verify non-metal type never auto-prices", type: "Other", size: "V", priceMode: "auto", weight: 10, weightUnit: "gm", sellingPrice: 555, stock: 1 },
];

/**
 * Temporarily installs a known rate table (24K & 22K quoted, everything else
 * derived, one non-custom row that BOTH engines must ignore) + shop settings
 * (silver ₹95/g, default labour PERCENT 12), and creates the fixture products.
 * Returns a cleanup that puts gold_rates/settings back exactly as they were.
 */
async function seedFixture(db: DbClient): Promise<Cleanup> {
  const ratesSnapshot = await db.select().from(schema.goldRates);
  const [settingsBefore] = await db.select().from(schema.settings).limit(1);
  const ids: string[] = [];

  // Built BEFORE any write runs, so a throw mid-seed can still restore
  // gold_rates/settings (and any fixtures that were already created).
  const restore: Cleanup = async () => {
    for (const id of ids) await deleteProduct(db, id);
    await db.delete(schema.goldRates);
    if (ratesSnapshot.length > 0) await db.insert(schema.goldRates).values(ratesSnapshot);
    if (settingsBefore) {
      await db
        .update(schema.settings)
        .set({
          defaultLabourType: settingsBefore.defaultLabourType,
          defaultLabourValue: settingsBefore.defaultLabourValue,
          silverRatePerGram: settingsBefore.silverRatePerGram,
        })
        .where(eq(schema.settings.id, settingsBefore.id));
    } else {
      await db.delete(schema.settings);
    }
    console.log("cleanup        : temp products deleted, gold_rates & settings restored");
  };

  try {
    await db.delete(schema.goldRates);
    await db.insert(schema.goldRates).values([
      { karat: 24, ratePerGram: 7200, isCustom: true },
      { karat: 22, ratePerGram: 6800, isCustom: true },
      { karat: 10, ratePerGram: 999, isCustom: false },
    ]);

    const seededSettings = {
      defaultLabourType: "PERCENT" as const,
      defaultLabourValue: 12,
      silverRatePerGram: 95,
    };
    if (settingsBefore) {
      await db.update(schema.settings).set(seededSettings).where(eq(schema.settings.id, settingsBefore.id));
    } else {
      await db.insert(schema.settings).values(seededSettings);
    }

    for (const fixture of FIXTURES) {
      const product = await createProduct(db, fixture);
      ids.push(product.id);
    }
  } catch (err) {
    await restore().catch((restoreErr) => {
      console.error("cleanup after seed failure also failed:", restoreErr);
    });
    throw err;
  }

  console.log(
    `seeded fixture : ${ids.length} temp products, rates 24K ₹7200 / 22K ₹6800 (derived below), silver ₹95/g, default labour PERCENT 12`,
  );
  return restore;
}

type PassResult = { mismatches: Mismatch[]; auto: number; total: number };

/** One full compare pass: load the live pricing context, price every product
 *  in both engines and collect the divergences. */
async function runPass(db: DbClient, label: string): Promise<PassResult> {
  const context = await loadGoldPricing(db);

  const rows = await db
    .select({
      id: schema.products.id,
      sku: schema.products.sku,
      name: schema.products.name,
      type: schema.products.type,
      priceMode: schema.products.priceMode,
      weight: schema.products.weight,
      weightUnit: schema.products.weightUnit,
      netWeight: schema.products.netWeight,
      goldKarat: schema.products.goldKarat,
      silverPercentage: schema.products.silverPercentage,
      labourType: schema.products.labourType,
      labourValue: schema.products.labourValue,
      sellingPrice: schema.products.sellingPrice,
      nagRate: schema.products.nagRate,
      povayiRate: schema.products.povayiRate,
      otherCharges: schema.products.otherCharges,
      productSilverRate: schema.products.silverRatePerGram,
      sqlRate: goldRatePerGramSql.as("sql_rate"),
      sqlAuto: autoPriceSql.as("sql_auto"),
      sqlEffective: effectivePriceSql.as("sql_effective"),
    })
    .from(schema.products);

  const mismatches: Mismatch[] = [];
  let auto = 0;

  for (const row of rows as Row[]) {
    const ts = priceProduct(
      {
        type: row.type ?? "Gold",
        priceMode: row.priceMode === "auto" ? "auto" : "manual",
        weight: row.weight,
        weightUnit: row.weightUnit,
        goldKarat: row.goldKarat,
        silverPercentage: row.silverPercentage ?? 100,
        labourType:
          row.labourType === "FIXED" || row.labourType === "PER_GRAM" ? row.labourType : "PERCENT",
        labourValue: row.labourValue,
        netWeight: row.netWeight,
        nagRate: row.nagRate,
        povayiRate: row.povayiRate,
        otherCharges: row.otherCharges,
        silverRatePerGram: row.productSilverRate,
        sellingPrice: row.sellingPrice,
      },
      {
        goldRateTable: context.table,
        silverRatePerGram: context.silverRatePerGram,
        defaultLabour: context.defaultLabour,
      },
    );
    if (ts.source === "auto") auto += 1;

    // Rate parity: the pure ₹/gram lookup both engines do for this karat
    // (SQL's column is a lookup, so compare against the same lookup in TS —
    // NOT `breakdown.ratePerGram`, which some fallback branches zero out).
    const tsRate = rateForKarat(context.table, toGoldKarat(row.goldKarat));
    if (diff(tsRate, row.sqlRate)) {
      mismatches.push({ sku: row.sku, name: row.name, field: "rate", ts: tsRate, sql: row.sqlRate });
    }
    // Auto price: TS `breakdown.price` when auto, else NULL (manual fallback).
    if (diff(ts.source === "auto" ? ts.price : null, row.sqlAuto)) {
      mismatches.push({
        sku: row.sku,
        name: row.name,
        field: "autoPrice",
        ts: ts.source === "auto" ? ts.price : null,
        sql: row.sqlAuto,
      });
    }
    // What lists/billing actually show.
    if (diff(ts.price, row.sqlEffective)) {
      mismatches.push({ sku: row.sku, name: row.name, field: "effectivePrice", ts: ts.price, sql: row.sqlEffective });
    }
  }

  console.log(`── pass ${label}`);
  console.log(`products checked : ${rows.length}`);
  console.log(`auto-priced      : ${auto}`);
  console.log(
    `rate table       : ${context.table.filter((e) => e.isCustom).length} quoted, silver ₹${context.silverRatePerGram}/g, default labour ${context.defaultLabour ? `${context.defaultLabour.type} ${context.defaultLabour.value}` : "none"}`,
  );
  return { mismatches, auto, total: rows.length };
}

async function main() {
  loadEnv();
  const withSeed = process.argv.includes("--seed");
  if (withSeed && process.env.MUNIM_ALLOW_PRICING_SEED !== "1") {
    console.error(
      [
        "Refusing to run --seed: the fixture WRITES to the connected database",
        "(temp products + gold_rates/settings) and must never touch production.",
        "Point DATABASE_URL at a scratch database and opt in explicitly:",
        "  MUNIM_ALLOW_PRICING_SEED=1 DATABASE_URL=<scratch> pnpm verify:pricing --seed",
        "See AGENTS.md §7 — never seed the production database.",
      ].join("\n"),
    );
    process.exitCode = 1;
    return;
  }
  const db = getDb();
  const cleanup = withSeed ? await seedFixture(db) : null;

  try {
    const failures: Mismatch[] = [];

    const seeded = await runPass(db, "seeded rates");
    failures.push(...seeded.mismatches);

    if (withSeed) {
      // Bare-rate pass: the seeded table can't cover the "nothing quoted"
      // fallbacks, so empty gold_rates + a zero silver rate get their own
      // pass before cleanup restores everything.
      await db.delete(schema.goldRates);
      const [settingsRow] = await db.select().from(schema.settings).limit(1);
      if (settingsRow) {
        await db
          .update(schema.settings)
          .set({ silverRatePerGram: 0 })
          .where(eq(schema.settings.id, settingsRow.id));
      }
      const bare = await runPass(db, "no quoted rates + zero silver");
      failures.push(...bare.mismatches);
    }

    console.log(`mismatches       : ${failures.length}`);

    if (failures.length > 0) {
      for (const m of failures.slice(0, 40)) {
        console.error(`  ✗ ${m.sku} "${m.name}" ${m.field}: ts=${m.ts} sql=${m.sql}`);
      }
      if (failures.length > 40) console.error(`  … and ${failures.length - 40} more`);
      process.exitCode = 1;
      return;
    }
    console.log("✓ TS and SQL pricing agree on every product");
  } finally {
    if (cleanup) await cleanup();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
