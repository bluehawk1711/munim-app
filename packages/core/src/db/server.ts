import { Pool, type PoolConfig } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import type { DbClient } from "./client.js";
import * as schema from "./schema.js";

/**
 * Creates a server-side Drizzle client backed by a real `pg` connection pool.
 *
 * Used by the NestJS API (`apps/api`) — a long-running Node process where the
 * per-query TLS handshake + HTTP round-trip of the fetch-based pg-proxy client
 * (`createDb`) is the wrong tradeoff. A pooled TCP connection with prepared
 * statements is dramatically faster.
 *
 * IMPORTANT: this module is ONLY reachable via the `@munim/core/server`
 * subpath export. It is intentionally NOT re-exported from the package index,
 * so `pg` never enters the React Native / webview bundle graph (Metro and the
 * browser never see `import "pg"`). Apps must import it as:
 *
 *   import { createServerDb } from "@munim/core/server";
 *
 * The returned client satisfies `DbClient` (see `./client.ts`), so every core
 * service accepts it unchanged.
 */
export function createServerDb(connectionString: string, poolConfig?: Partial<PoolConfig>): DbClient {
  const pool = new Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    ...poolConfig,
  });
  return drizzle(pool, { schema });
}

/** Same as createServerDb but accepts an existing Pool (for tests / reuse). */
export function fromPool(pool: Pool, poolConfig?: Partial<PoolConfig>): DbClient {
  return drizzle(pool, { schema });
}
