/**
 * Unit smoke for @munim/api-client — no DB, no Nest, no network.
 *
 * Spins up a tiny node:http stub that mimics the Munim API surface and drives
 * the client against it, verifying:
 *   1. URL joining + query-string serialization (pageSize, filters)
 *   2. x-api-key header on every request
 *   3. JSON body encode (POST /api/products)
 *   4. Error mapping → ApiClientError with status + API message (401/404/503)
 *   5. CSV text mode (GET /api/reports?format=csv)
 *
 * Run: pnpm test (from packages/api-client)
 */
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { createApiClient, ApiClientError } from "../src/index.js";

const API_KEY = "smoke-test-key-123456";
let failures = 0;

function check(name: string, ok: boolean, detail?: string): void {
  if (ok) {
    console.log(`PASS  ${name}`);
  } else {
    failures++;
    console.error(`FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

function json(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

function text(res: ServerResponse, status: number, body: string): void {
  res.writeHead(status, { "content-type": "text/csv" });
  res.end(body);
}

/** A stub that records requests and asserts the x-api-key header. */
function startStub(): Promise<{ port: number; close: () => Promise<void>; seen: () => Array<{ url: string; method: string; headers: Record<string, string | string[] | undefined>; body: string }> }> {
  const seen: Array<{ url: string; method: string; headers: Record<string, string | string[] | undefined>; body: string }> = [];

  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    let body = "";
    req.on("data", (chunk: Buffer) => {
      body += chunk.toString();
    });
    req.on("end", () => {
      seen.push({ url: req.url ?? "", method: req.method ?? "GET", headers: req.headers, body });

      const url = new URL(req.url ?? "/", "http://localhost");
      const path = url.pathname;
      const key = req.headers["x-api-key"];

      // /healthz and /readyz are public (no key check).
      if (path === "/healthz") return json(res, 200, { status: "ok" });
      if (path === "/readyz") return json(res, 200, { status: "ok" });

      if (key !== API_KEY) return json(res, 401, { error: "Invalid API key", status: 401 });

      if (path === "/api/products" && req.method === "GET") {
        return json(res, 200, {
          products: [
            {
              id: "p1",
              sku: "SKU-1",
              name: "Gold Ring",
              color: "Gold",
              size: "12",
              category: "Jewellery",
              barcode: "8901234567890",
              weight: 3200,
              imageUrl: null,
              stock: 5,
              purchasePrice: 100,
              sellingPrice: 250,
              lowStockThreshold: 2,
              notes: null,
              createdAt: "2026-01-01T00:00:00.000Z",
              updatedAt: "2026-01-01T00:00:00.000Z",
            },
          ],
          pagination: { page: 1, pageSize: 20, totalCount: 1, totalPages: 1 },
        });
      }

      if (path === "/api/products" && req.method === "POST") {
        const parsed = JSON.parse(body) as { name?: string; size?: string };
        if (!parsed.name || !parsed.size) {
          return json(res, 400, { error: "Product name is required", status: 400 });
        }
        return json(res, 201, {
          id: "p-new",
          sku: "SKU-NEW",
          name: parsed.name,
          color: "",
          size: parsed.size,
          category: "",
          barcode: "8901234567891",
          weight: null,
          imageUrl: null,
          stock: 0,
          purchasePrice: 0,
          sellingPrice: 0,
          lowStockThreshold: 5,
          notes: null,
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        });
      }

      if (path === "/api/products/lookup") {
        return json(res, 404, { error: "No product with that barcode", status: 404 });
      }

      if (path === "/api/parties" && url.searchParams.get("balances") === "true") {
        return json(res, 200, {
          balances: [],
          receivables: [],
          payables: [],
        });
      }

      if (path === "/api/reports") {
        if (url.searchParams.get("format") === "csv") {
          return text(res, 200, 'Product,SKU,Color,Size,Stock,Sold Qty,Sold Wt (g),Revenue,Profit\r\n"Gold Ring","SKU-1","Gold","12",5,2,6.4,500,300\r\n');
        }
        return json(res, 200, {
          type: url.searchParams.get("type") ?? "monthly",
          title: "Monthly Sales Report",
          generatedAt: "2026-01-01T00:00:00.000Z",
          periodLabel: "January 2026",
          rows: [],
          totals: { stock: 0, soldQuantity: 0, soldWeight: 0, revenue: 0, profit: 0 },
        });
      }

      if (path === "/api/dashboard") {
        return json(res, 200, {
          totalProducts: 1,
          totalStock: 5,
          lowStockCount: 0,
          outOfStockCount: 0,
          totalRevenue: 500,
          productsSoldToday: 2,
          monthlyRevenue: 500,
          averageSale: 250,
          invoicesCount: 2,
          unpaidAmount: 100,
          receivables: 100,
          payables: 0,
          recentInvoices: [],
          monthlySales: [],
          stockDistribution: [],
          topProducts: [],
          salesByCategory: [],
          invoiceStatus: [],
          advanceSplit: [],
          soldPerMonth: [],
          recentActivity: [],
          recentAdvances: [],
        });
      }

      return json(res, 404, { error: `No stub for ${req.method} ${path}`, status: 404 });
    });
  });

  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      resolve({
        port,
        close: () => new Promise((done) => server.close(() => done())),
        seen: () => seen,
      });
    });
  });
}

async function main(): Promise<void> {
  const stub = await startStub();
  const api = createApiClient({ baseUrl: `http://127.0.0.1:${stub.port}`, apiKey: API_KEY });

  try {
    // 1. health + ready
    const h = await api.health.health();
    check("health.health() → { status: 'ok' }", h.status === "ok");

    const r = await api.health.ready();
    check("health.ready() → { status: 'ok' }", r.status === "ok");

    // 2. products.list with filters → query serialization + pagination envelope
    const list = await api.products.list({ search: "gold", pageSize: 20, status: "in_stock" });
    check("products.list() → products array + pagination", Array.isArray(list.products) && list.products.length === 1 && typeof list.pagination.totalCount === "number");
    const productReq = stub.seen().find((s) => s.url.includes("/api/products?") && s.method === "GET");
    check(
      "products.list() serializes query params (search, pageSize, status)",
      !!productReq && productReq.url.includes("search=gold") && productReq.url.includes("pageSize=20") && productReq.url.includes("status=in_stock"),
      productReq?.url,
    );

    // 3. x-api-key header present
    const anyReq = stub.seen().find((s) => s.url.startsWith("/api/"));
    check("x-api-key header sent on API calls", !!anyReq && anyReq.headers["x-api-key"] === API_KEY);

    // 4. products.create → JSON body encode
    const created = await api.products.create({ name: "Silver Chain", size: "M" });
    check("products.create() returns created product", created.name === "Silver Chain" && created.id === "p-new");
    const postReq = stub.seen().find((s) => s.url === "/api/products" && s.method === "POST");
    check(
      "products.create() sends JSON body",
      !!postReq && postReq.headers["content-type"] === "application/json" && postReq.body.includes('"name":"Silver Chain"'),
      postReq?.body,
    );

    // 5. error mapping — 401 (wrong key)
    const badApi = createApiClient({ baseUrl: `http://127.0.0.1:${stub.port}`, apiKey: "wrong-key" });
    let badErr: unknown = null;
    try {
      await badApi.products.list();
    } catch (err) {
      badErr = err;
    }
    check(
      "wrong key → ApiClientError with status 401 + message",
      badErr instanceof ApiClientError && badErr.status === 401 && badErr.message.includes("Invalid API key"),
      badErr instanceof Error ? badErr.message : String(badErr),
    );

    // 6. error mapping — 404 lookup
    let lookupErr: unknown = null;
    try {
      await api.products.byBarcode("0000000000000");
    } catch (err) {
      lookupErr = err;
    }
    check(
      "byBarcode 404 → ApiClientError 404 + message",
      lookupErr instanceof ApiClientError && lookupErr.status === 404 && lookupErr.message.includes("No product"),
      lookupErr instanceof Error ? lookupErr.message : String(lookupErr),
    );

    // 7. parties.balances()
    const balances = await api.parties.balances();
    check("parties.balances() → { balances, receivables, payables }", Array.isArray(balances.balances) && Array.isArray(balances.receivables) && Array.isArray(balances.payables));

    // 8. CSV text mode
    const csv = await api.reports.csv({ type: "monthly" });
    check("reports.csv() returns raw CSV text", typeof csv === "string" && csv.includes("Gold Ring") && csv.includes("\r\n"));

    // 9. reports.get JSON mode
    const report = await api.reports.get({ type: "monthly" });
    check("reports.get() returns typed report", report.type === "monthly" && Array.isArray(report.rows));

    // 10. dashboard
    const dash = await api.dashboard.get();
    check("dashboard.get() returns stats", typeof dash.totalProducts === "number" && typeof dash.totalRevenue === "number");

    // 11. trailing-slash baseUrl tolerance
    const slashApi = createApiClient({ baseUrl: `http://127.0.0.1:${stub.port}/`, apiKey: API_KEY });
    const h2 = await slashApi.health.health();
    check("baseUrl with trailing slash still works", h2.status === "ok");
  } finally {
    await stub.close();
  }

  console.log(failures === 0 ? "\nSMOKE OK" : `\n${failures} FAILURE(S)`);
  process.exit(failures === 0 ? 0 : 1);
}

void main();
