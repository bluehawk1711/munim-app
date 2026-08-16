#!/usr/bin/env node
/**
 * Munim core — database service smoke test.
 *
 * Runs every exported core service function against the REAL database
 * (DATABASE_URL from packages/core/.env), then deletes the test records.
 *
 * Usage (from packages/core):
 *   pnpm smoke            # builds dist, bundles this script, runs it
 *   (or from the repo root: pnpm db:smoke)
 *
 * The dist output uses extensionless ESM imports, so the script is bundled
 * with esbuild before running (see the `smoke` script in package.json).
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
  const colorRenamed = S("__smoke_color_rn");
  const extraSize = S("__smoke_size_2");

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

  // ── catalog CRUD (shared by web/desktop/mobile) ──
  await test("catalog createCatalogItem color", () => core.createCatalogItem(db, "color", colorRenamed).then((c) => `id=${c.id.slice(0, 8)} name=${c.name} count=${c.productCount}`));
  await test("catalog createCatalogItem size", () => core.createCatalogItem(db, "size", extraSize).then((c) => c.name));
  await test("catalog listCatalogItems color", () => core.listCatalogItems(db, "color").then((a) => `${a.length} colors, contains=${a.some((c) => c.name === colorRenamed)}`));
  await test("catalog listCatalogItems size", () => core.listCatalogItems(db, "size").then((a) => `${a.length} sizes`));
  await test("catalog renameCatalogItem", async () => {
    const list = await core.listCatalogItems(db, "color");
    const item = list.find((c) => c.name === colorRenamed);
    if (!item) return "skipped";
    const r = await core.renameCatalogItem(db, "color", item.id, `${colorRenamed}-v2`);
    return `name=${r.name}`;
  });
  await test("catalog deleteCatalogItem in-use guard", async () => {
    const list = await core.listCatalogItems(db, "color");
    const item = list.find((c) => c.name === color);
    if (!item) return "skipped";
    try {
      await core.deleteCatalogItem(db, "color", item.id);
      return "FAILED (should have thrown)";
    } catch (e) {
      return e?.code === "IN_USE" ? `blocked (${e.code})` : `unexpected: ${e?.message}`;
    }
  });

    // ── products & stock ──
    let createdBarcode = null;
    await test("createProduct (auto barcode + weight)", async () => {
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
      weight: 24500,
    });
    productId = p.id;
    createdBarcode = p.barcode;
    const ok =
      p.barcode &&
      /^\d{13}$/.test(p.barcode) &&
      core.isEan13(p.barcode) &&
      p.weight === 24500;
    return `sku=${p.sku} barcode=${p.barcode} ean13=${ok ? "valid" : "INVALID"} weight=${p.weight}`;
  });
  await test("findProductByBarcode", async () => {
    if (!productId || !createdBarcode) return "skipped";
    const p = await core.findProductByBarcode(db, createdBarcode);
    return p ? `found ${p.name}` : "NOT FOUND";
  });
  await test("backfillBarcodes", async () => {
    if (!productId) return "skipped";
    // Manually null the barcode to simulate a pre-barcode product.
    await db.update(schema.products).set({ barcode: null }).where(eq(schema.products.id, productId));
    const r = await core.backfillBarcodes(db);
    const after = await core.getProduct(db, productId);
    const ok = r.updated >= 1 && after?.barcode && core.isEan13(after.barcode);
    return `updated=${r.updated} assigned=${ok ? "valid EAN-13" : "FAILED"}`;
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
  await test("updateProduct", async () => {
    if (!productId) return "skipped";
    const p = await core.updateProduct(db, productId, { name: productName, color, size, sellingPrice: 950 });
    // update omits `barcode` → must be preserved (not wiped).
    return `price=${p.sellingPrice} barcode-kept=${p.barcode ? "yes" : "WIPED"}`;
  });
  await test("seedProducts", async () => {
    // No-op guard on a non-empty DB (returns success:false); on an empty
    // scratch DB it seeds 7 sample products (cleaned up in the finally block).
    const r = await core.seedProducts(db);
    return `success=${r.success}, count=${r.count}`;
  });

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
  await test("getReceivables", () => core.getReceivables(db).then((r) => `recv=${r.length}`));

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
  await test("deleteAdvance", async () => {
    if (!partyId) return "skipped";
    const a = await core.createAdvance(db, { partyId, direction: "TAKEN", amount: 10, note: "smoke-del" });
    const r = await core.deleteAdvance(db, a.id);
    return `success=${r.success}`;
  });
  await test("recordPayment IN", () => (partyId ? core.recordPayment(db, { partyId, direction: "IN", amount: 300, method: "cash" }).then((p) => `amount=${p.amount}`) : "skipped"));
  await test("recordPayment OUT", () => (partyId ? core.recordPayment(db, { partyId, direction: "OUT", amount: 100, method: "upi" }).then((p) => `amount=${p.amount}`) : "skipped"));
  await test("listPayments", () => (partyId ? core.listPayments(db, partyId).then((p) => `${p.length} payments`) : "skipped"));
  await test("getPartyLedger after khata", () => (partyId ? core.getPartyLedger(db, partyId).then((l) => `balance=${l.balance}, lines=${l.lines.length}`) : "skipped"));
  await test("getPayables", () => core.getPayables(db).then((p) => `pay=${p.length}`));

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
  await test("listInvoices (with items)", async () => {
    // Regression guard: the items lookup must attach real rows. A previous bug
    // (sql`…in (${chunks.join(", ")})`) silently produced `in ($1)` with a
    // single mangled param, so items came back EMPTY while the DB had them.
    const r = await core.listInvoices(db, { search: partyName.slice(0, 12) });
    const inv = r.invoices[0];
    const item = inv?.items?.[0];
    const ok = !!inv && !!item && item.productName === productName;
    return `${r.invoices.length} invoice(s), items=${inv?.items?.length ?? 0}, product=${item?.productName ?? "NONE"} ${ok ? "ok" : "ITEMS MISSING"}`;
  });
  await test("getInvoice", () => (invoiceId ? core.getInvoice(db, invoiceId).then((i) => `${i?.items.length} item(s)`) : "skipped"));
  await test("recordInvoicePayment", () => (invoiceId ? core.recordInvoicePayment(db, invoiceId, { amount: 200, method: "upi" }).then((i) => `status=${i.status} paid=${i.amountPaid}`) : "skipped"));
  await test("deleteInvoice", async () => {
    if (!invoiceId) return "skipped";
    const r = await core.deleteInvoice(db, invoiceId);
    return `success=${r.success}`;
  });
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
    await test("getReport weight fields", async () => {
      const r = await core.getReport(db, "monthly");
      const hasSoldWeight = typeof r.totals?.soldWeight === "number";
      const hasRowWeight = r.rows.every((row) => "weight" in row && "soldWeight" in row);
      return `totals.soldWeight=${r.totals?.soldWeight} rows=${hasRowWeight ? "weighted" : "MISSING"} ${hasSoldWeight ? "ok" : "MISSING TOTAL"}`;
    });

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
    await test("renderBillText", () => {
      const doc = core.buildBillDocument({
        shop: { name: "S", address: "A", phones: ["1"], email: "e" },
        lines: [{ productName: "X", quantity: 1, price: 100 }],
        billNo: "SMK-2",
        customerName: "C",
      });
      return core.renderBillText(doc).includes("BILL NO: SMK-2") ? "has BILL NO" : "MISSING BILL NO";
    });
    await test("renderBillHtml", () => {
      const doc = core.buildBillDocument({
        shop: { name: "S", address: "A", phones: ["1"], email: "e" },
        lines: [{ productName: "X", quantity: 2, price: 100 }],
        billNo: "SMK-3",
        customerName: "C",
        discount: 10,
      });
      const html = core.renderBillHtml(doc);
      const ok =
        html.includes("SMK-3") &&
        html.includes("₹") &&
        html.includes("Discount") &&
        html.includes("TOTAL");
      return ok ? "has billNo + totals + discount" : "MISSING elements";
    });
    // ── barcodes (pure logic, no DB) ──
    await test("ean13CheckDigit known vectors", () => {
      const ok =
        core.ean13CheckDigit("590123412345") === 7 &&
        core.ean13CheckDigit("400638133393") === 1 &&
        core.ean13CheckDigit("200000000000") === 8;
      return ok ? "5901234123457 / 4006381333931 / 2000000000008" : "CHECK DIGIT WRONG";
    });
    await test("isEan13", () => {
      const ok =
        core.isEan13("5901234123457") &&
        !core.isEan13("5901234123458") &&
        !core.isEan13("ABC123") &&
        !core.isEan13("590123412345") &&
        !core.isEan13("59012341234571");
      return ok ? "valid + invalid rejected" : "EAN-13 VALIDATOR FAILED";
    });
    await test("generateEan13", async () => {
      const seen = new Set();
      for (let i = 0; i < 5; i++) {
        const code = await core.generateEan13(async (c) => seen.has(c));
        if (!core.isEan13(code)) return "GENERATED INVALID";
        seen.add(code);
      }
      return `${seen.size} unique valid codes`;
    });
    await test("barcodeSvg EAN-13", () => {
      const svg = core.barcodeSvg("5901234123457", { scale: 2 });
      const ok =
        svg.startsWith("<svg") &&
        svg.includes("<rect") &&
        svg.includes("width=\"190\"") && // 95 modules × scale 2
        svg.includes("5901234123457");
      return ok ? "95-module EAN-13 svg" : "EAN SVG MISSING ELEMENTS";
    });
    await test("barcodeSvg Code 39 fallback", () => {
      const svg = core.barcodeSvg("MUNIM-123", { scale: 1 });
      const ok = svg.startsWith("<svg") && svg.includes("<rect") && svg.includes("MUNIM-123");
      return ok ? "code39 svg rendered" : "CODE39 SVG FAILED";
    });
    await test("formatWeight", () => {
      const ok =
        core.formatWeight(350) === "350 mg" &&
        core.formatWeight(24500) === "24.5 g" &&
        core.formatWeight(1500000) === "1.5 kg" &&
        core.formatWeight(null) === "—";
      return ok ? "mg/g/kg + empty" : "FORMAT WRONG";
    });
    await test("buildProductLabel", () => {
      const label = core.buildProductLabel(
        { id: "p1", name: "Gold Bangle <Heavy>", sku: "PRD-ABC123", barcode: "5901234123457", weight: 24500, sellingPrice: 1200, colorName: "Gold", sizeName: "M", categoryName: "Jewellery" },
        { name: "Munim Shop" },
      );
      const ok = label.productName === "Gold Bangle <Heavy>" && label.weightMg === 24500 && label.shopName === "Munim Shop";
      return ok ? "label built from product row" : "LABEL BUILD FAILED";
    });
    await test("renderLabelSheetHtml", () => {
      const label = core.buildProductLabel(
        { id: "p1", name: "Gold Bangle", sku: "PRD-ABC123", barcode: "5901234123457", weight: 24500, sellingPrice: 1200, colorName: "Gold", sizeName: "M", categoryName: "Jewellery" },
        { name: "Munim Shop" },
      );
      const html = core.renderLabelSheetHtml([label], { copies: 2 });
      const ok =
        html.startsWith("<!DOCTYPE html>") &&
        html.includes("24.5 g") &&
        html.includes("PRD-ABC123") &&
        html.includes("<svg") &&
        (html.match(/class=\"label\"/g) ?? []).length >= 2 &&
        html.includes("@page");
      return ok ? "24-up sheet with barcode + 2 copies" : "LABEL HTML FAILED";
    });
    await test("renderLabelMarkup no-barcode", () => {
      const label = core.buildProductLabel(
        { id: "p1", name: "No Code Item", sku: "PRD-X", barcode: null, weight: null, sellingPrice: 50 },
        { name: "S" },
      );
      return core.renderLabelMarkup(label).includes("NO BARCODE") ? "graceful no-barcode fallback" : "MISSING NO-BARCODE TEXT";
    });
    await test("renderJobLetterHtml", () => {
      const html = core.renderJobLetterHtml({
        companyName: "Gold & Co <Jewellers>",
        companyAddress: "Main Bazaar",
        companyEmail: "gold@co.in",
        employeeName: "Ravi Sharma",
        employeeAddress: "12 Old City",
        position: "Accountant",
        joiningDate: "2026-08-11",
        monthlySalary: 25000,
        workingHoursDescription: "8 hours per day",
        workingHoursFrom: "10:00 AM",
        workingHoursTo: "07:00 PM",
        timeFormat: "AM",
        weeklyOff1: "Sunday",
        weeklyOff2: "",
        probationMonths: 3,
        additionalTasks: "Reconcile daily cash",
      });
      const ok =
        html.includes("&lt;Jewellers&gt;") && // escaped
        html.includes("Ravi Sharma") &&
        html.includes("Appointment &amp; Joining") &&
        html.includes("11 August 2026") &&
        html.includes("25,000") &&
        html.includes("Reconcile daily cash") &&
        html.includes("Authorized Signatory");
      return ok ? "escaped + date + salary + words" : "MISSING elements";
    });
    await test("jobLetterFromStored merge", () => {
      const d = core.jobLetterFromStored(
        { notes: "from desktop", joiningDate: "2026-09-01" },
        { employeeName: "Asha", position: "Cashier", monthlySalary: 15000 },
        { name: "Munim Shop", address: "1 Main Rd", email: "s@shop.in" },
      );
      const ok =
        d.employeeName === "Asha" &&
        d.position === "Cashier" &&
        d.monthlySalary === 15000 &&
        d.companyName === "Munim Shop" &&
        d.additionalTasks === "from desktop" &&
        d.joiningDate === "2026-09-01" &&
        d.probationMonths === 3 &&
        d.weeklyOff1 === "Sunday";
      return ok ? "sparse row + settings merged" : "MERGE FAILED";
    });
    await test("sha256Hex known vector", () => {
      const hex = core.sha256Hex("abc");
      return hex === "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad" ? "correct" : `WRONG ${hex}`;
    });
    await test("hashPin + verifyPin roundtrip", () => {
      const hash = core.hashPin("2468");
      const ok = core.isPinHash(hash) && core.verifyPin("2468", hash) && !core.verifyPin("2469", hash);
      return ok ? "verified + rejected wrong digit" : "ROUNDTRIP FAILED";
    });
    await test("test account", () => {
      const hash = core.hashPin(core.TEST_PIN);
      const ok = core.TEST_PIN === "1234" && core.isTestPinHash(hash) && !core.isTestPinHash(core.hashPin("9999"));
      return ok ? `PIN 1234 recognized` : "TEST ACCOUNT FAILED";
    });
    await test("pin validators", () => {
      const ok =
        core.isFourDigitPin("0000") &&
        !core.isFourDigitPin("123") &&
        !core.isFourDigitPin("12a4") &&
        !core.isPinHash("nope") &&
        !core.verifyPin("1234", "not-a-hash");
      return ok ? "4-digit + hash shape enforced" : "VALIDATOR FAILED";
    });
    await test("email/password credentials", () => {
      const emailHash = core.hashEmail(core.TEST_EMAIL);
      const pwHash = core.hashPassword(core.TEST_PASSWORD);
      const checks = [
        core.TEST_EMAIL === "test@munim.app",
        core.TEST_PASSWORD === "1234",
        core.isEmail("a@b.co"),
        !core.isEmail("not-an-email"),
        core.isPassword("abcd"),
        !core.isPassword("abc"),
        core.isTestEmail("TEST@Munim.App"),
        core.isTestPasswordHash(pwHash),
        !core.isTestPasswordHash(core.hashPassword("9999")),
        core.verifyPassword(core.TEST_PASSWORD, pwHash),
        !core.verifyPassword("0000", pwHash),
        core.verifyEmail("  TEST@Munim.App ", core.TEST_EMAIL),
        !core.verifyEmail("other@munim.app", core.TEST_EMAIL),
        core.isPasswordHash(pwHash),
        core.isEmail("test@munim.app"),
      ];
      if (!checks.every(Boolean)) throw new Error("CREDENTIALS FAILED: " + checks.map(Boolean).join(","));
      return "test credentials + hashing + validators ok";
    });
  } finally {
    // ── cleanup (always runs, even if a check throws) ──
    console.log("── cleanup ──");
    if (invoiceId) await db.delete(schema.invoices).where(eq(schema.invoices.id, invoiceId)).catch(() => {});
    if (letterId) await core.deleteJobLetter(db, letterId).catch(() => {});
    if (partyId) await core.deleteParty(db, partyId).catch(() => {});
    if (productId) await core.deleteProduct(db, productId).catch(() => {});
    // If seedProducts seeded a fresh DB, remove its sample rows.
    for (const n of ["Gold Necklace Set", "Silver Anklet", "Diamond Ring", "Pearl Earrings", "Cotton Kurti", "Silk Saree", "Brass Diya Set"]) {
      await db.delete(schema.products).where(eq(schema.products.name, n)).catch(() => {});
    }
    await del(schema.colors, color);
    await del(schema.colors, colorRenamed);
    await del(schema.colors, `${colorRenamed}-v2`);
    await del(schema.sizes, size);
    await del(schema.sizes, extraSize);
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
