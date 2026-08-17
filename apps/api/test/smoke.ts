/**
 * Boot smoke test — no real database required.
 *
 * Spins up the Nest app with a placeholder DATABASE_URL (never actually
 * connects: /healthz doesn't touch the DB and /readyz fails fast with 503),
 * then verifies:
 *   1. /healthz is public and returns 200
 *   2. /readyz returns 503 (DB unreachable) — proves the guard + filter shape
 *   3. /api/* returns 401 without an x-api-key
 *   4. /api/* returns 401 with a wrong key
 *
 * Run: pnpm test (from apps/api)
 */
import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { AppModule } from "../src/app.module.js";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL = "postgresql://user:pass@localhost:5432/nonexistent";
process.env.API_KEY_WEB = "test-web-key-123456";
process.env.API_KEY_DESKTOP = "test-desktop-key-123456";
process.env.API_KEY_MOBILE = "test-mobile-key-123456";

let failures = 0;

function check(name: string, ok: boolean, detail?: string): void {
  if (ok) {
    console.log(`PASS  ${name}`);
  } else {
    failures++;
    console.error(`FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

async function main(): Promise<void> {
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());
  app.setGlobalPrefix("api", { exclude: ["healthz", "readyz"] });
  await app.init();
  const http = app.getHttpServer();
  const server = app.getHttpAdapter().getInstance();

  const port = 4199;
  await new Promise<void>((resolve) => {
    server.listen({ port }, () => resolve());
  });

  const base = `http://localhost:${port}`;

  try {
    // 1. healthz public
    const h = await fetch(`${base}/healthz`);
    check("GET /healthz → 200", h.status === 200, `got ${h.status}`);

    // 2. readyz → 503 (no DB) — proves filter shape
    const r = await fetch(`${base}/readyz`);
    const rBody = (await r.json()) as { error?: string; status?: number };
    check("GET /readyz → 503 with { error, status }", r.status === 503 && !!rBody.error && rBody.status === 503, `got ${r.status} ${JSON.stringify(rBody)}`);

    // 3. no key → 401
    const nk = await fetch(`${base}/api/products`);
    const nkBody = (await nk.json()) as { error?: string; status?: number };
    check("GET /api/products (no key) → 401", nk.status === 401 && !!nkBody.error, `got ${nk.status} ${JSON.stringify(nkBody)}`);

    // 4. wrong key → 401
    const wk = await fetch(`${base}/api/products`, { headers: { "x-api-key": "wrong-key" } });
    check("GET /api/products (wrong key) → 401", wk.status === 401, `got ${wk.status}`);

    // 5. correct key passes the guard (DB query fails → 500, not 401)
    const ok = await fetch(`${base}/api/products`, { headers: { "x-api-key": process.env.API_KEY_WEB! } });
    check("GET /api/products (valid key) → not 401", ok.status !== 401, `got ${ok.status} (500 expected — no real DB)`);
  } finally {
    await app.close();
  }

  console.log(failures === 0 ? "\nSMOKE OK" : `\n${failures} FAILURE(S)`);
  process.exit(failures === 0 ? 0 : 1);
}

void main();
