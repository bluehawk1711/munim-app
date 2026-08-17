/**
 * LIVE-DB e2e that drives the REAL NestJS API through @munim/api-client —
 * the exact typed client desktop/mobile will use. Requires a real
 * DATABASE_URL; skipped otherwise.
 *
 *   DATABASE_URL=postgres://... npx tsx test/e2e-client.ts
 */
import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { createApiClient } from "@munim/api-client";
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
    server.listen({ port: 4197 }, () => resolve());
  });

  const api = createApiClient({
    baseUrl: "http://localhost:4197",
    apiKey: process.env.API_KEY_WEB!,
  });

  try {
    // Health
    const h = await api.health.health();
    check("client.health.health() → ok", h.status === "ok");

    const r = await api.health.ready();
    check("client.health.ready() → ok (DB reachable)", r.status === "ok");

    // Dashboard
    const dash = await api.dashboard.get();
    check("client.dashboard.get() → stats", typeof dash.totalProducts === "number" && typeof dash.totalRevenue === "number");

    // Products
    const list = await api.products.list({ pageSize: 3 });
    check(
      "client.products.list({pageSize:3}) → ≤3 products + pagination",
      Array.isArray(list.products) && list.products.length <= 3 && typeof list.pagination.totalCount === "number",
    );

    const meta = await api.products.meta();
    check("client.products.meta() → colors/sizes/categories arrays", Array.isArray(meta.colors) && Array.isArray(meta.sizes) && Array.isArray(meta.categories));

    // Catalog
    const colors = await api.catalog.list("color");
    check("client.catalog.list('color') → array", Array.isArray(colors));

    // Parties — both list and balances
    const parties = await api.parties.list();
    check("client.parties.list() → array", Array.isArray(parties));
    const balances = await api.parties.balances();
    check("client.parties.balances() → balances/receivables/payables", Array.isArray(balances.balances) && Array.isArray(balances.receivables) && Array.isArray(balances.payables));

    // Invoices + Sales
    const invoices = await api.invoices.list({ pageSize: 3 });
    check("client.invoices.list() → invoices + pagination", Array.isArray(invoices.invoices) && typeof invoices.pagination.totalCount === "number");

    const sales = await api.sales.list();
    check("client.sales.list() → array of flattened Sale DTOs", Array.isArray(sales));

    // Advances + Payments
    const advances = await api.advances.list();
    check("client.advances.list() → array", Array.isArray(advances));
    const payments = await api.payments.list();
    check("client.payments.list() → array", Array.isArray(payments));

    // Job letters
    const letters = await api.jobLetters.list();
    check("client.jobLetters.list() → array", Array.isArray(letters));

    // Settings
    const settings = await api.settings.get();
    check("client.settings.get() → shopName string", typeof settings.shopName === "string");

    // Reports — JSON + CSV
    const report = await api.reports.get({ type: "monthly" });
    check("client.reports.get({type:'monthly'}) → typed report", report.type === "monthly" && Array.isArray(report.rows) && typeof report.generatedAt === "string");

    const csv = await api.reports.csv({ type: "sold" });
    check("client.reports.csv() → raw CSV text", typeof csv === "string" && csv.includes("Product"));

    // Error path — wrong key → ApiClientError 401
    const badApi = createApiClient({ baseUrl: "http://localhost:4197", apiKey: "wrong-key" });
    let badStatus = 0;
    try {
      await badApi.products.list();
    } catch (err) {
      badStatus = err instanceof Error && "status" in err ? (err as { status: number }).status : 0;
    }
    check("client wrong key → ApiClientError status 401", badStatus === 401, `got ${badStatus}`);
  } finally {
    await app.close();
  }

  console.log(failures === 0 ? "\nCLIENT LIVE E2E OK" : `\n${failures} FAILURE(S)`);
  process.exit(failures === 0 ? 0 : 1);
}

void main();
