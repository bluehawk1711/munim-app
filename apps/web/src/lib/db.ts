// The web app no longer owns a database driver. All schema and connection
// logic lives in @munim/core (shared with the desktop & mobile apps).
// We just expose the shared singleton.
import { getDb, type DbClient } from "@munim/core";

// The client must NOT be constructed at import time: `next build` evaluates
// route modules to collect page data, and there is no DATABASE_URL in the
// build environment (it's a server runtime secret). The proxy materializes
// the client on first property access — i.e. at request time.
let cached: DbClient | null = null;

function materialize(): DbClient {
  if (!cached) cached = getDb();
  return cached;
}

export const db = new Proxy({} as DbClient, {
  get(_target, prop, receiver) {
    return Reflect.get(materialize(), prop, receiver) as DbClient[keyof DbClient];
  },
  set(_target, prop, value, receiver) {
    return Reflect.set(materialize(), prop, value, receiver);
  },
});
export type Db = typeof db;
