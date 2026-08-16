import { createDb, type DbClient } from "@munim/core";
import { fetch as tauriFetch } from "@tauri-apps/plugin-http";
import { getDatabaseUrl } from "./env";

let client: DbClient | null = null;

/**
 * True when running inside the Tauri webview (plugin commands available).
 * In a plain browser (e.g. `vite` dev in a regular tab) this is false and we
 * fall back to the global fetch.
 */
function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

/**
 * The Tauri webview's own fetch is CORS-blocked for Neon's SQL-over-HTTP
 * endpoint (no Access-Control-Allow-Origin), which surfaced as
 * "Failed query: …" / "Connection failed" everywhere the webview's fetch was
 * used. @tauri-apps/plugin-http runs the request in Rust — no CORS — so it is
 * used inside Tauri; plain-browser dev (which can't reach Neon anyway) falls
 * back to global fetch.
 */
function resolveFetchImpl(): typeof fetch {
  return isTauri() ? (tauriFetch as unknown as typeof fetch) : globalThis.fetch;
}

/** Creates a Drizzle client for an explicit URL with the platform fetch (same
 * CORS fix as getCore). Used by the Settings connection test. */
export function createAppDb(databaseUrl: string): DbClient {
  return createDb({ databaseUrl, fetchImpl: resolveFetchImpl() });
}

/** Lazily creates the shared Drizzle client (fetch → Neon, no API server). */
export function getCore(): DbClient {
  if (!client) {
    const databaseUrl = getDatabaseUrl();
    if (!databaseUrl) {
      throw new Error(
        "No database URL configured. Add one in Settings (or set it in apps/desktop/.env).",
      );
    }
    client = createAppDb(databaseUrl);
  }
  return client;
}

/** Drop the cached client (call after changing the URL in Settings). */
export function resetCore(): void {
  client = null;
}
