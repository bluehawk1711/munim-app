import { createDb, type DbClient } from "@munim/core";
import { getDatabaseUrl } from "./env";

let client: DbClient | null = null;

/** Lazily creates the shared Drizzle client (fetch → Neon, no API server). */
export function getCore(): DbClient {
  if (!client) {
    const databaseUrl = getDatabaseUrl();
    if (!databaseUrl) {
      throw new Error(
        "No database URL configured. Set VITE_DATABASE_URL in apps/desktop/.env or add one in Settings.",
      );
    }
    client = createDb({ databaseUrl });
  }
  return client;
}

/** Drop the cached client (call after changing the URL in Settings). */
export function resetCore(): void {
  client = null;
}
