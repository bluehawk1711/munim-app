import { drizzle, type RemoteCallback } from "drizzle-orm/pg-proxy";
import { sql } from "drizzle-orm";
import * as schema from "./schema";

export type DbClient = ReturnType<typeof createDb>;

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

// Cross-runtime base64 (no Buffer dependency — works in RN/Hermes too).
const B64_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
function toBase64(input: string): string {
  if (typeof btoa === "function") return btoa(input);
  let out = "";
  const bytes = new TextEncoder().encode(input);
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i]!;
    const b1 = bytes[i + 1];
    const b2 = bytes[i + 2];
    out += B64_CHARS[b0 >> 2];
    out += B64_CHARS[((b0 & 3) << 4) | ((b1 ?? 0) >> 4)];
    out += b1 === undefined ? "=" : B64_CHARS[((b1 & 15) << 2) | ((b2 ?? 0) >> 6)];
    out += b2 === undefined ? "=" : B64_CHARS[b2 & 63];
  }
  return out;
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
 *   - DATABASE_URL  (postgres://user:pass@host/db — Basic auth)
 *   - NEON_HOST + NEON_USER + NEON_PASSWORD
 *   - DATABASE_AUTH_TOKEN (Bearer auth, overrides Basic)
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

  const authHeader = authToken
    ? `Bearer ${authToken}`
    : `Basic ${toBase64(`${resolvedUser}:${resolvedPassword}`)}`;

  const endpoint = `https://${resolvedHost}/sql`;

  const callback: RemoteCallback = async (sql, params) => {
    const res = await doFetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader,
      },
      body: JSON.stringify({ query: sql, params }),
      cache: "no-store",
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Munim DB error ${res.status}: ${text.slice(0, 300)}`);
    }

    const payload = (await res.json()) as
      | Record<string, unknown>[]
      | { count?: number }
      | Record<string, unknown>;

    // Neon HTTP returns an array of row objects for SELECT / RETURNING,
    // and { count } for plain DML.
    if (Array.isArray(payload)) {
      return { rows: payload };
    }
    return { rows: [], rowCount: typeof payload.count === "number" ? payload.count : undefined };
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
