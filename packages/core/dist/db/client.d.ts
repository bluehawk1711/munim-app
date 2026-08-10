import * as schema from "./schema";
export type DbClient = ReturnType<typeof createDb>;
/**
 * Cheap connectivity check used by the Settings screens. Runs `select 1`
 * through the app's own db client (fetch-based Neon proxy), so apps don't
 * need to import drizzle directly (avoids version-duplication type issues).
 */
export declare function pingDatabase(db: DbClient): Promise<void>;
/**
 * Parses a Postgres connection URL into the parts needed for Neon's
 * SQL-over-HTTP endpoint. Avoids pulling in a full URL parser so the package
 * stays dependency-free for React Native / webview bundlers.
 */
export declare function parseConnectionString(url: string): {
    host: string;
    user: string;
    password: string;
};
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
export declare function createDb(opts?: {
    databaseUrl?: string;
    host?: string;
    user?: string;
    password?: string;
    authToken?: string;
    fetchImpl?: typeof fetch;
}): import("drizzle-orm/pg-proxy").PgRemoteDatabase<typeof schema>;
export type DbOptions = NonNullable<Parameters<typeof createDb>[0]>;
export declare function getDb(opts?: DbOptions): DbClient;
//# sourceMappingURL=client.d.ts.map