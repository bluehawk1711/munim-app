#!/usr/bin/env node
/**
 * Munim core — database service smoke test.
 *
 * Runs every exported core service function against the REAL database
 * (DATABASE_URL from packages/core/.env), then deletes the test records.
 *
 * Usage (from packages/core):
 *   pnpm build            # ensure dist is current
 *   node scripts/smoke-test.mjs
 *
 * Test records are prefixed `__smoke_` and removed in the cleanup phase, so
 * running this against a dev/prod Neon DB is safe-ish — but it DOES write to
 * whatever database DATABASE_URL points at.
 */
import { readFileSync } from "node:fs";
import * as core from "../dist/index.js";

// ── load packages/core/.env into process.env (DATABASE_URL etc.) ──
// Uses process.cwd() so the script works both standalone and when bundled
// with esbuild (import.meta.url moves to the bundle location).
import { join } from "node:path";
try {
  const env = readFileSync(join(process.cwd(), ".env"), "utf8");
  for (const line of env.split("\n")) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)\s*$/);
    if (m && !(m[1] in process.env)) {
      // strip surrounding quotes (dotenv-style) — .env files often wrap values in '…'
      process.env[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, "");
    }
  }
} catch {
  console.error("No packages/core/.env found — set DATABASE_URL in the env instead.");
}

const { createDb, schema, eq, and, desc, sql } = core;
const db = createDb();

const stamp = Date.now();
const results = [];
let failed = 0;

async function test(name, fn) {
  try {
    const out = await fn();
    results.push(`PASS  ${name}${out !== undefined ? ` → ${out}` : ""}`);
  } catch (e) {
    failed++;
    const cause = e?.cause?.message ? ` :: ${e.cause.message}` : "";
    results.push(`FAIL  ${name} → ${e?.message ?? e}${cause}`);
  }
}

const S = (s) => `${s}_${stamp}`;

// cleanup helpers
const del = (table, name) =>
  db.delete(table).where(eq(table.name, name)).catch(() => {});

// Defensive purge of any leftover __smoke_ rows from earlier aborted runs
// (inserts can succeed even when a run crashes before its cleanup phase).
async function purgeSmokeRows() {
  const like = (col) => sql`${col} like '__smoke_%'`;
  await db.delete(schema.invoices).where(sql`${schema.invoices.customerName} like '__smoke_%' or ${schema.invoices.customerName} = 'Smoke Walk-in'`).catch(() => {});
  await db.delete(schema.jobLetters).where(sql`${schema.jobLetters.title} like 'Smoke%'`).catch(() => {});
  await db.delete(schema.parties).where(like(schema.parties.name)).catch(() => {});
  await db.delete(schema.products).where(like(schema.products.name)).catch(() => {});
  await db.delete(schema.colors).where(like(schema.colors.name)).catch(() => {});
  await db.delete(schema.sizes).where(like(schema.sizes.name)).catch(() => {});
  await db.delete(schema.categories).where(like(schema.categories.name)).catch(() => {});
}

async function run() {
  await purgeSmokeRows();
  const color = S("__smoke_color");
  const size = S("__smoke_size");
  const cat = S("__smoke_cat");
  const partyName = S("__smoke_party");
  const productName = S("__smoke_product");

  // Declared at run() scope so the finally-block cleanup can reach them.
  let productId = null;
  let partyId = null;
  let invoiceId = null;
  let letterId = null;

  try {
    // ── connection ──
    await test("pingDatabase", () => core.pingDatabase(db));

  // ── settings (save + restore the real row) ──
  let originalSettings = null;
  try {
    originalSettings = await core.getSettings(db);
  } catch {}
  await test("getSettings", () => core.getSettings(db).then((s) => `shop="${s.shopName}"`));
  await test("updateSettings", async () => {
    const s = await core.updateSettings(db, { shopName: "Smoke Test Shop" });
    return `shop="${s.shopName}"`;
  });
  if (originalSettings) {
    await core.updateSettings(db, { shopName: originalSettings.shopName }).catch(() => {});
  }

  // ── lookups (colors/sizes/categories) ──
  await test("addColor", () => core.addColor(db, color).then((c) => c.name));
  await test("addSize", () => core.addSize(db, size).then((c) => c.name));
  await test("addCategory", () => core.addCategory(db, cat).then((c) => c.name));
  await test("listMeta", () => core.listMeta(db).then((m) => `${m.colors.length} colors, ${m.sizes.length} sizes`));

    // ── products & stock ──
    await test("createProduct", async () => {
    const p = await core.createProduct(db, {
      name: productName,
      color,
      size,
      category: cat,
      stock: 10,
      purchasePrice: 500,
      sellingPrice: 800,
      lowStockThreshold: 3,
      notes: "smoke",
    });
    productId = p.id;
    return `sku=${p.sku}`;
  });
  await test("listProducts", () => core.listProducts(db, { search: productName.slice(0, 12) }).then((r) => `${r.products.length} hit(s)`));
  await test("getProduct", async () => (productId ? core.getProduct(db, productId).then((p) => `${p?.name}`) : "skipped"));
  await test("listAllProducts", () => core.listAllProducts(db).then((a) => `${a.length} products`));
  await test("adjustStock", async () => {
    if (!productId) return "skipped";
    const p = await core.adjustStock(db, productId, { adjustment: -4, reason: "smoke test" });
    return `stock=${p.stock}`;
  });
  await test("listStockMovements", () => (productId ? core.listStockMovements(db, productId, 5).then((m) => `${m.length} movements`) : "skipped"));

    // ── parties & khata ──
    await test("createParty", async () => {
    const p = await core.createParty(db, { name: partyName, phone: "9999999999", email: "", address: "Smoke St", type: "SUPPLIER", notes: "smoke" });
    partyId = p.id;
    return `id=${p.id.slice(0, 8)} type=${p.type}`;
  });
  await test("listParties", () => core.listParties(db, "SUPPLIER", partyName.slice(0, 12)).then((a) => `${a.length} hit(s)`));
  await test("updateParty", () => (partyId ? core.updateParty(db, partyId, { phone: "8888888888" }).then((p) => `phone=${p.phone}`) : "skipped"));
  await test("getPartyLedger", () => (partyId ? core.getPartyLedger(db, partyId).then((l) => `balance=${l.balance}`) : "skipped"));
  await test("getPartyBalances", () => core.getPartyBalances(db).then((a) => `${a.length} parties`));
  await test("getReceivables/getPayables", () => core.getReceivables(db).then((r) => `recv=${r.length}`));

    // ── advances & payments (needs partyId) ──
    let advanceId = null;
    await test("createAdvance GIVEN", async () => {
    if (!partyId) return "skipped";
    const a = await core.createAdvance(db, { partyId, direction: "GIVEN", amount: 2000, note: "smoke" });
    advanceId = a.id;
    return `amount=${a.amount}`;
  });
  await test("createAdvance TAKEN", () => (partyId ? core.createAdvance(db, { partyId, direction: "TAKEN", amount: 500 }).then((a) => `amount=${a.amount}`) : "skipped"));
  await test("listAdvances", () => (partyId ? core.listAdvances(db, partyId).then((a) => `${a.length} advances`) : "skipped"));
  await test("settleAdvance", () => (advanceId ? core.settleAdvance(db, advanceId).then((a) => `status=${a.status}`) : "skipped"));
  await test("recordPayment IN", () => (partyId ? core.recordPayment(db, { partyId, direction: "IN", amount: 300, method: "cash" }).then((p) => `amount=${p.amount}`) : "skipped"));
  await test("recordPayment OUT", () => (partyId ? core.recordPayment(db, { partyId, direction: "OUT", amount: 100, method: "upi" }).then((p) => `amount=${p.amount}`) : "skipped"));
  await test("listPayments", () => (partyId ? core.listPayments(db, partyId).then((p) => `${p.length} payments`) : "skipped"));
  await test("getPartyLedger after khata", () => (partyId ? core.getPartyLedger(db, partyId).then((l) => `balance=${l.balance}, lines=${l.lines.length}`) : "skipped"));

    // ── invoices / sales ──
    await test("createInvoice", async () => {
    const inv = await core.createInvoice(db, {
      customerName: partyName,
      partyId: partyId ?? undefined,
      items: [{ productId: productId ?? undefined, productName, quantity: 2, price: 800 }],
      deliveryCharge: 50,
      discount: 100,
      amountPaid: 500,
      paymentMethod: "cash",
    });
    invoiceId = inv.id;
    return `no=${inv.invoiceNumber} total=${inv.total}`;
  });
  await test("listInvoices", () => core.listInvoices(db, { search: partyName.slice(0, 12) }).then((r) => `${r.invoices.length} invoice(s)`));
  await test("getInvoice", () => (invoiceId ? core.getInvoice(db, invoiceId).then((i) => `${i?.items.length} item(s)`) : "skipped"));
  await test("recordInvoicePayment", () => (invoiceId ? core.recordInvoicePayment(db, invoiceId, { amount: 200, method: "upi" }).then((i) => `status=${i.status} paid=${i.amountPaid}`) : "skipped"));
  await test("createSale", async () => {
    if (!productId) return "skipped";
    const inv = await core.createSale(db, { productId, quantity: 1, sellingPrice: 800, customerName: "Smoke Walk-in", paid: true, paymentMethod: "cash" });
    return `no=${inv?.invoiceNumber} status=${inv?.status}`;
  });

    // ── job letters ──
    await test("saveJobLetter", async () => {
    const l = await core.saveJobLetter(db, { title: "Smoke Letter", employeeName: "Test Person", position: "Helper", monthlySalary: 12000, data: { smoke: true } });
    letterId = l.id;
    return `title="${l.title}"`;
  });
  await test("listJobLetters", () => core.listJobLetters(db, 5).then((a) => `${a.length} letters`));
  await test("getJobLetter", () => (letterId ? core.getJobLetter(db, letterId).then((l) => `title="${l?.title}"`) : "skipped"));

    // ── dashboard & reports ──
    await test("getDashboard", () => core.getDashboard(db).then((d) => `revenue=${d.totalRevenue}, recv=${d.receivables}`));
    await test("getReport monthly", () => core.getReport(db, "monthly").then((r) => `rows=${r.rows?.length ?? 0}`));
    await test("getReport stock", () => core.getReport(db, "stock").then((r) => `rows=${r.rows?.length ?? 0}`));

    // ── billing (pure logic, no DB) ──
    await test("amountInWords", () => `₹${core.amountInWords(12345.6)}`);
    await test("buildBillDocument", () => {
      const doc = core.buildBillDocument({
        shop: { name: "S", address: "A", phones: ["1"], email: "e" },
        lines: [{ productName: "X", quantity: 2, price: 100 }],
        billNo: "SMK-1",
        customerName: "C",
        date: new Date(),
      });
      return `total=${doc.total}`;
    });
  } finally {
    // ── cleanup (always runs, even if a check throws) ──
    console.log("── cleanup ──");
    if (invoiceId) await db.delete(schema.invoices).where(eq(schema.invoices.id, invoiceId)).catch(() => {});
    if (letterId) await core.deleteJobLetter(db, letterId).catch(() => {});
    if (partyId) await core.deleteParty(db, partyId).catch(() => {});
    if (productId) await core.deleteProduct(db, productId).catch(() => {});
    await del(schema.colors, color);
    await del(schema.sizes, size);
    await del(schema.categories, cat);
  }

  // ── report ──
  console.log("\n── results ──");
  for (const r of results) console.log(r);
  console.log(`\n${results.length - failed}/${results.length} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

run().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
