/**
 * @munim/api-client — the single typed HTTP client for the Munim NestJS API.
 *
 * Desktop, mobile and (later) web all talk to the API through this package.
 * Endpoint methods mirror the @munim/core service names (products.list,
 * invoices.create, …) so screen swaps are mechanical — the argument/return
 * shapes match what the core services already produce.
 */
import type { HttpClient } from "./http.js";
import { createHttpClient } from "./http.js";
import { products } from "./endpoints/products.js";
import { dashboard } from "./endpoints/dashboard.js";
import { invoices } from "./endpoints/invoices.js";
import { sales } from "./endpoints/sales.js";
import { parties } from "./endpoints/parties.js";
import { advances } from "./endpoints/advances.js";
import { payments } from "./endpoints/payments.js";
import { jobLetters } from "./endpoints/job-letters.js";
import { reports } from "./endpoints/reports.js";
import { settings } from "./endpoints/settings.js";
import { catalog } from "./endpoints/catalog.js";
import { upload } from "./endpoints/upload.js";
export type { UploadableFile, UploadResult } from "./endpoints/upload.js";
import { health } from "./endpoints/health.js";

export { ApiClientError } from "./http.js";
export type { HttpClient, QueryParams } from "./http.js";
export * from "./types.js";

export type ApiClientOptions = {
  /** API base URL, e.g. "https://api.example.com". Trailing slash optional. */
  baseUrl: string;
  /** Per-platform API key (web/desktop/mobile), sent as `x-api-key`. */
  apiKey: string;
  /** Injectable fetch — desktop passes the Tauri HTTP-plugin fetch; mobile and
   * web pass global fetch. Defaults to globalThis.fetch. */
  fetchImpl?: typeof fetch;
};

export type ApiClient = {
  products: ReturnType<typeof products>;
  dashboard: ReturnType<typeof dashboard>;
  invoices: ReturnType<typeof invoices>;
  sales: ReturnType<typeof sales>;
  parties: ReturnType<typeof parties>;
  advances: ReturnType<typeof advances>;
  payments: ReturnType<typeof payments>;
  jobLetters: ReturnType<typeof jobLetters>;
  reports: ReturnType<typeof reports>;
  settings: ReturnType<typeof settings>;
  catalog: ReturnType<typeof catalog>;
  upload: ReturnType<typeof upload>;
  health: ReturnType<typeof health>;
};

/** Builds the typed API client. Cheap — safe to call once per app and reuse. */
export function createApiClient(options: ApiClientOptions): ApiClient {
  const http: HttpClient = createHttpClient({
    baseUrl: options.baseUrl,
    apiKey: options.apiKey,
    fetchImpl: options.fetchImpl,
  });

  return {
    products: products(http),
    dashboard: dashboard(http),
    invoices: invoices(http),
    sales: sales(http),
    parties: parties(http),
    advances: advances(http),
    payments: payments(http),
    jobLetters: jobLetters(http),
    reports: reports(http),
    settings: settings(http),
    catalog: catalog(http),
    upload: upload(http),
    health: health(http),
  };
}
