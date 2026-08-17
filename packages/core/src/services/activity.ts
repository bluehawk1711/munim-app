import type { DbClient } from "../db/client.js";

/** Best-effort activity logging — never throws into the caller's flow. */
export async function logActivity(db: DbClient, action: string, detail?: string) {
  try {
    await db.insert(schema.activityLogs).values({ action, detail: detail ?? null });
  } catch {
    // ignore — logging must never break the main operation
  }
}

import * as schema from "../db/schema.js";
