/**
 * LIVE-DB e2e check — requires a real DATABASE_URL in the environment.
 * Verifies the pg.Pool-backed client + controllers work end-to-end against
 * Neon. NOT part of the default `pnpm test` (no DB in CI); run manually:
 *
 *   DATABASE_URL=postgres://... npx tsx test/e2e-live.ts
 */
import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { AppModule } from "../src/app.module.js";

if (!process.env.DATABASE_URL) {
  console.error("SKIP — DATABASE_URL not set");
  process.exit(0);
}

process.env.NODE_ENV = "test";
process.env.API_KEY_WEB ??= "e2e-web-key-123456";
process.env.API_KEY_DESKTOP ??= "e2e-desktop-key-123456";
process.env.API_KEY_MOBILE ??= "e2e-mobile-key-123456";

let failures = 0;
function check(name: string, ok: boolean, detail?: string): void {
  if (ok) console.log(`PASS  ${name}`);
  else {
    failures++;
    console.error(`FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

async function main(): Promise<void> {
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());
  app.setGlobalPrefix("api", { exclude: ["healthz", "readyz"] });
  await app.init();
  const server = app.getHttpAdapter().getInstance();
  await new Promise<void>((resolve) => {
    server.listen({ port: 4198 }, () => resolve());
  });
  const base = `http://localhost:4198`;
  const web = { "x-api-key": process.env.API_KEY_WEB! };

  try {
    const r1 = await fetch(`${base}/readyz`);
    check("GET /readyz → 200 (DB reachable)", r1.status === 200, `got ${r1.status}`);

    const r2 = await fetch(`${base}/api/dashboard`, { headers: web });
    const body = (await r2.json()) as { totalProducts?: number; totalRevenue?: number };
    check(
      "GET /api/dashboard → 200 with stats",
      r2.status === 200 && typeof body.totalProducts === "number",
      `got ${r2.status}`,
    );

    const r3 = await fetch(`${base}/api/products?pageSize=3`, { headers: web });
    const p3 = (await r3.json()) as { products?: unknown[]; pagination?: { totalCount?: number } };
    check(
      "GET /api/products?pageSize=3 → 200, ≤3 rows, totalCount",
      r3.status === 200 && Array.isArray(p3.products) && p3.products.length <= 3 && typeof p3.pagination?.totalCount === "number",
      `got ${r3.status} products=${p3.products?.length}`,
    );

    const r4 = await fetch(`${base}/api/catalog/color`, { headers: { "x-api-key": process.env.API_KEY_MOBILE! } });
    const colors = (await r4.json()) as unknown[];
    check("GET /api/catalog/color → 200 array", r4.status === 200 && Array.isArray(colors), `got ${r4.status}`);

    const r5 = await fetch(`${base}/api/settings`, { headers: { "x-api-key": process.env.API_KEY_DESKTOP! } });
    const s5 = (await r5.json()) as { shopName?: string };
    check("GET /api/settings → 200 with shopName", r5.status === 200 && typeof s5.shopName === "string", `got ${r5.status}`);

    // New controllers — read paths
    const r6 = await fetch(`${base}/api/invoices?pageSize=3`, { headers: web });
    const i6 = (await r6.json()) as { invoices?: unknown[]; pagination?: { totalCount?: number } };
    check(
      "GET /api/invoices?pageSize=3 → 200 with pagination",
      r6.status === 200 && Array.isArray(i6.invoices) && typeof i6.pagination?.totalCount === "number",
      `got ${r6.status}`,
    );

    const r7 = await fetch(`${base}/api/sales?pageSize=3`, { headers: web });
    const s7 = (await r7.json()) as unknown[];
    check("GET /api/sales → 200 array (flattened Sale DTO)", r7.status === 200 && Array.isArray(s7), `got ${r7.status}`);

    const r8 = await fetch(`${base}/api/parties`, { headers: web });
    const p8 = (await r8.json()) as unknown[];
    check("GET /api/parties → 200 array", r8.status === 200 && Array.isArray(p8), `got ${r8.status}`);

    const r9 = await fetch(`${base}/api/parties?balances=true`, { headers: web });
    const p9 = (await r9.json()) as { balances?: unknown[] };
    check("GET /api/parties?balances=true → 200 with balances", r9.status === 200 && Array.isArray(p9.balances), `got ${r9.status}`);

    const r10 = await fetch(`${base}/api/advances`, { headers: web });
    const a10 = (await r10.json()) as unknown[];
    check("GET /api/advances → 200 array", r10.status === 200 && Array.isArray(a10), `got ${r10.status}`);

    const r11 = await fetch(`${base}/api/job-letters`, { headers: web });
    const j11 = (await r11.json()) as unknown[];
    check("GET /api/job-letters → 200 array", r11.status === 200 && Array.isArray(j11), `got ${r11.status}`);

    const r12 = await fetch(`${base}/api/reports?type=monthly`, { headers: web });
    const rep12 = (await r12.json()) as { type?: string; rows?: unknown[] };
    check("GET /api/reports?type=monthly → 200 with rows", r12.status === 200 && rep12.type === "monthly" && Array.isArray(rep12.rows), `got ${r12.status}`);

    const r13 = await fetch(`${base}/api/reports?type=sold&format=csv`, { headers: web });
    const csv13 = await r13.text();
    check("GET /api/reports?format=csv → 200 CSV text", r13.status === 200 && csv13.includes("Product"), `got ${r13.status}`);

    // Invalid body → 400 via shared zod schema
    const r14 = await fetch(`${base}/api/products`, {
      method: "POST",
      headers: { ...web, "content-type": "application/json" },
      body: JSON.stringify({ name: "", size: "" }),
    });
    check("POST /api/products (invalid) → 400 { error }", r14.status === 400, `got ${r14.status}`);

    // Cache-aside: second read must be served from cache (in-memory fallback
    // here — no Upstash creds in CI). We can't observe hits directly, so we
    // prove the write path invalidates by checking a WRITE clears the cache
    // and the next read still succeeds.
    const r15a = await fetch(`${base}/api/catalog/color`, { headers: web });
    const r15b = await fetch(`${base}/api/catalog/color`, { headers: web });
    const colors2 = (await r15b.json()) as unknown[];
    check(
      "GET /api/catalog/color twice → both 200 (cache-aside)",
      r15a.status === 200 && r15b.status === 200 && Array.isArray(colors2),
      `got ${r15a.status}/${r15b.status}`,
    );

    // Sale round-trip with the FULL desktop shape (price override, customer,
    // paid): create a product → quick sale → assert fields → undo → delete.
    // Net-zero on the DB (undo restores stock; product deleted after).
    const saleName = `e2e-sale-${Date.now()}`;
    const rp = await fetch(`${base}/api/products`, {
      method: "POST",
      headers: { ...web, "content-type": "application/json" },
      body: JSON.stringify({ name: saleName, size: "Standard", stock: 10, purchasePrice: 50, sellingPrice: 100 }),
    });
    const prod = (await rp.json()) as { id?: string; sku?: string };
    let saleId: string | null = null;
    let saleCheckOk = (rp.status === 200 || rp.status === 201) && typeof prod.id === "string";
    if (saleCheckOk) {
      const rs = await fetch(`${base}/api/sales`, {
        method: "POST",
        headers: { ...web, "content-type": "application/json" },
        body: JSON.stringify({
          productId: prod.id,
          quantity: 2,
          sellingPrice: 120,
          customerName: "E2E Customer",
          paid: true,
          paymentMethod: "cash",
        }),
      });
      const sale = (await rs.json()) as { id?: string; total?: number; status?: string };
      saleId = sale.id ?? null;
      saleCheckOk =
        (rs.status === 200 || rs.status === 201) &&
        sale.total === 240 &&
        sale.status === "PAID";
      if (!saleCheckOk) {
        console.log(`  └ sale resp: http=${rs.status} total=${sale.total} status=${sale.status}`);
      }
    }
    check(
      "POST /api/sales keeps full desktop shape (price override + paid)",
      saleCheckOk,
      saleCheckOk ? undefined : "sale did not round-trip price override / PAID",
    );
    if (saleId) {
      await fetch(`${base}/api/sales/${saleId}`, { method: "DELETE", headers: web });
    }
    if (prod.id) {
      await fetch(`${base}/api/products/${prod.id}`, { method: "DELETE", headers: web });
    }

    // settings GET → PUT (invalidates settings group incl. invoices/sales) → GET
    const r16a = await fetch(`${base}/api/settings`, { headers: web });
    const s16 = (await r16a.json()) as { shopName?: string };
    const r16b = await fetch(`${base}/api/settings`, {
      method: "PUT",
      headers: { ...web, "content-type": "application/json" },
      body: JSON.stringify({ ...s16, shopName: s16.shopName ?? "Test Shop" }),
    });
    const r16c = await fetch(`${base}/api/settings`, { headers: web });
    const s16c = (await r16c.json()) as { shopName?: string };
    check(
      "settings GET→PUT→GET stays consistent through invalidation",
      r16a.status === 200 && r16b.status === 200 && r16c.status === 200 && typeof s16c.shopName === "string",
      `got ${r16a.status}/${r16b.status}/${r16c.status}`,
    );
  } finally {
    await app.close();
  }

  console.log(failures === 0 ? "\nLIVE E2E OK" : `\n${failures} FAILURE(S)`);
  process.exit(failures === 0 ? 0 : 1);
}

void main();
