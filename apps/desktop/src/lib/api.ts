import { createApiClient, type ApiClient } from "@munim/api-client";
import { fetch as tauriFetch } from "@tauri-apps/plugin-http";
import { getApiBaseUrl, getApiKey } from "./env";

let client: ApiClient | null = null;
let clientKey = "";

/**
 * True when running inside the Tauri webview (plugin commands available).
 * In a plain browser (e.g. `vite` dev in a regular tab) this is false and we
 * fall back to the global fetch.
 */
function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

/**
 * The Tauri webview's own fetch is CORS-blocked for cross-origin requests
 * (no Access-Control-Allow-Origin), which surfaced as "Failed query" /
 * "Connection failed" everywhere. @tauri-apps/plugin-http runs the request
 * in Rust — no CORS — so it is used inside Tauri; plain-browser dev falls
 * back to global fetch.
 */
function resolveFetchImpl(): typeof fetch {
  return isTauri() ? (tauriFetch as unknown as typeof fetch) : globalThis.fetch;
}

/**
 * Lazily builds the shared typed API client. The client is rebuilt whenever
 * the base URL or key changes (e.g. after saving new settings).
 */
export function getApi(): ApiClient {
  const baseUrl = getApiBaseUrl();
  const apiKey = getApiKey();
  if (!baseUrl) {
    throw new Error(
      "No server URL configured. Add one in Settings (or set VITE_API_URL in apps/desktop/.env).",
    );
  }
  if (!apiKey) {
    throw new Error("No API key configured. Set VITE_API_KEY at build time (or save one in Settings).");
  }
  const key = `${baseUrl}|${apiKey}`;
  if (!client || clientKey !== key) {
    client = createApiClient({ baseUrl, apiKey, fetchImpl: resolveFetchImpl() });
    clientKey = key;
  }
  return client;
}

/** Drop the cached client (call after changing the URL/key in Settings). */
export function resetApi(): void {
  client = null;
  clientKey = "";
}

/**
 * Connection test for Settings + onboarding — builds a throwaway client for
 * the given URL (with the build/saved key) and pings GET /readyz. Throws on
 * failure; resolves when the API + DB are reachable.
 */
export async function pingApiUrl(baseUrl: string, apiKey?: string): Promise<void> {
  const key = apiKey ?? getApiKey();
  if (!key) throw new Error("No API key available for the test — set VITE_API_KEY at build time.");
  const probe = createApiClient({ baseUrl, apiKey: key, fetchImpl: resolveFetchImpl() });
  await probe.health.ready(); // throws ApiClientError on non-2xx (e.g. 503 DB down)
}
