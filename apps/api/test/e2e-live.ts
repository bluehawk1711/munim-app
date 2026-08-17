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
  } finally {
    await app.close();
  }

  console.log(failures === 0 ? "\nLIVE E2E OK" : `\n${failures} FAILURE(S)`);
  process.exit(failures === 0 ? 0 : 1);
}

void main();
