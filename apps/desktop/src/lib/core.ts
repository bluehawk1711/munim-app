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

/** Lazily creates the shared Drizzle client (fetch → Neon, no API server). */
export function getCore(): DbClient {
  if (!client) {
    const databaseUrl = getDatabaseUrl();
    if (!databaseUrl) {
      throw new Error(
        "No database URL configured. Add one in Settings (or set it in apps/desktop/.env).",
      );
    }
    // The Tauri webview's own fetch is CORS-blocked for Neon's SQL-over-HTTP
    // endpoint (no Access-Control-Allow-Origin), which surfaced as
    // "Failed query: …" on the dashboard. @tauri-apps/plugin-http runs the
    // request in Rust — no CORS — so it is used inside Tauri; plain-browser
    // dev (which can't reach Neon anyway) falls back to global fetch.
    client = createDb({
      databaseUrl,
      fetchImpl: isTauri() ? tauriFetch : globalThis.fetch,
    });
  }
  return client;
}

/** Drop the cached client (call after changing the URL in Settings). */
export function resetCore(): void {
  client = null;
}
