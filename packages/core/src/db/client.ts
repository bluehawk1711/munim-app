import { drizzle, type RemoteCallback } from "drizzle-orm/pg-proxy";
import { sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "./schema.js";

/**
 * The Drizzle client type shared by every consumer.
 *
 * Widened from `ReturnType<typeof createDb>` (which is `PgRemoteDatabase`, the
 * fetch-based pg-proxy client) to the base `PgDatabase` so that BOTH the
 * fetch-based client AND the server-side `pg.Pool` client (see `./server.ts`)
 * satisfy the same service signatures. Verified: `PgRemoteDatabase` and
 * `node-postgres`'s `PgDatabase` are both assignable to this type, and all
 * service methods (`select`/`insert`/`update`/`delete`/`execute`/`transaction`)
 * typecheck against it.
 */
export type DbClient = PgDatabase<PgQueryResultHKT, typeof schema>;

/**
 * Cheap connectivity check used by the Settings screens. Runs `select 1`
 * through the app's own db client (fetch-based Neon proxy), so apps don't
 * need to import drizzle directly (avoids version-duplication type issues).
 */
export async function pingDatabase(db: DbClient): Promise<void> {
  await db.execute(sql`select 1`);
}

/**
 * Parses a Postgres connection URL into the parts needed for Neon's
 * SQL-over-HTTP endpoint. Avoids pulling in a full URL parser so the package
 * stays dependency-free for React Native / webview bundlers.
 */
export function parseConnectionString(url: string): {
  host: string;
  user: string;
  password: string;
} {
  const withoutProtocol = url.replace(/^postgres(ql)?:\/\//, "");
  const [credentials, hostPort] = withoutProtocol.split("@");
  const [user, password] = (credentials ?? "").split(":");
  const [host] = (hostPort ?? "").split("/");
  return {
    host: host ?? "",
    user: decodeURIComponent(user ?? ""),
    password: decodeURIComponent(password ?? ""),
  };
}

/**
 * Creates the Drizzle client talking DIRECTLY to Neon's SQL-over-HTTP
 * endpoint (https://<host>/sql) using plain fetch. Because it is pure fetch +
 * JSON, the exact same client works in:
 *   - Next.js server (Node 18+)
 *   - Tauri webview (browser fetch)
 *   - React Native / Expo (global fetch)
 * No API server required — every app imports this package.
 *
 * Requires one of:
 *   - DATABASE_URL  (postgres://user:pass@host/db — sent via the
 *     `neon-connection-string` header, the current Neon HTTP auth)
 *   - NEON_HOST + NEON_USER + NEON_PASSWORD
 *   - DATABASE_AUTH_TOKEN (Bearer auth)
 */
export function createDb(opts?: {
  databaseUrl?: string;
  host?: string;
  user?: string;
  password?: string;
  authToken?: string;
  fetchImpl?: typeof fetch;
}) {
  const databaseUrl =
    opts?.databaseUrl ??
    (typeof process !== "undefined" ? process.env?.DATABASE_URL : undefined) ??
    (typeof process !== "undefined" ? process.env?.EXPO_PUBLIC_DATABASE_URL : undefined);
  const host =
    opts?.host ?? (typeof process !== "undefined" ? process.env?.NEON_HOST : undefined);
  const user =
    opts?.user ?? (typeof process !== "undefined" ? process.env?.NEON_USER : undefined);
  const password =
    opts?.password ?? (typeof process !== "undefined" ? process.env?.NEON_PASSWORD : undefined);
  const authToken =
    opts?.authToken ??
    (typeof process !== "undefined" ? process.env?.DATABASE_AUTH_TOKEN : undefined) ??
    (typeof process !== "undefined" ? process.env?.EXPO_PUBLIC_DATABASE_AUTH_TOKEN : undefined);
  const doFetch = opts?.fetchImpl ?? globalThis.fetch;

  const resolvedHost =
    host ?? (databaseUrl ? parseConnectionString(databaseUrl).host : undefined);
  const resolvedUser =
    user ?? (databaseUrl ? parseConnectionString(databaseUrl).user : undefined);
  const resolvedPassword =
    password ?? (databaseUrl ? parseConnectionString(databaseUrl).password : undefined);

  if (!resolvedHost) {
    throw new Error(
      "Munim core: no database configured. Set DATABASE_URL (or NEON_HOST/USER/PASSWORD).",
    );
  }

  // Neon SQL-over-HTTP auth (2026): the FULL connection string goes in the
  // `neon-connection-string` header. Sending an Authorization header alongside
  // it is rejected ("missing authentication credentials: required password"),
  // so the header is the single auth mechanism when a URL is available.
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (databaseUrl) {
    headers["neon-connection-string"] = databaseUrl;
  } else if (authToken) {
    headers["Authorization"] = `Bearer ${authToken}`;
  } else if (resolvedUser && resolvedPassword) {
    headers["neon-connection-string"] =
      `postgresql://${encodeURIComponent(resolvedUser)}:${encodeURIComponent(resolvedPassword)}@${resolvedHost}`;
  } else {
    throw new Error(
      "Munim core: no database credentials. Set DATABASE_URL (or NEON_HOST/USER/PASSWORD, or DATABASE_AUTH_TOKEN).",
    );
  }

  const endpoint = `https://${resolvedHost}/sql`;

  const callback: RemoteCallback = async (sql, params) => {
    const res = await doFetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({ query: sql, params }),
      cache: "no-store",
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Munim DB error ${res.status}: ${text.slice(0, 300)}`);
    }

    type NeonRow = Record<string, unknown>;
    type NeonResponse = {
      fields?: { name: string }[];
      rows?: NeonRow[];
      rowCount?: number;
      count?: number;
    };
    const payload = (await res.json()) as NeonResponse | NeonRow[];

    // Neon's SQL-over-HTTP endpoint returns { fields, rows: [...], rowCount }
    // where rows are OBJECTS keyed by column name. drizzle's pg-proxy maps
    // results POSITIONALLY (mapResultRow reads row[columnIndex]), so rows must
    // be converted to positional arrays aligned with the fields array — object
    // rows otherwise map to all-undefined values.
    if (Array.isArray(payload)) {
      // Legacy shape: bare array of object rows.
      const fields = payload.length > 0 ? Object.keys(payload[0] as NeonRow) : [];
      return { rows: payload.map((row) => fields.map((name) => row[name])) };
    }

    const fields = Array.isArray(payload.fields) ? payload.fields.map((f) => f.name) : [];
    const objectRows = Array.isArray(payload.rows) ? payload.rows : [];
    const rows = objectRows.map((row) => fields.map((name) => row[name]));
    return {
      rows,
      rowCount: typeof payload.rowCount === "number" ? payload.rowCount : undefined,
      count: typeof payload.count === "number" ? payload.count : undefined,
    };
  };

  return drizzle(callback, { schema });
}

export type DbOptions = NonNullable<Parameters<typeof createDb>[0]>;

/**
 * Singleton for apps that share one connection (web app, desktop).
 * Mobile apps can also use it since fetch is global.
 */
const globalForDb = globalThis as { munimDb?: DbClient };

export function getDb(opts?: DbOptions): DbClient {
  if (!globalForDb.munimDb) globalForDb.munimDb = createDb(opts);
  return globalForDb.munimDb;
}
