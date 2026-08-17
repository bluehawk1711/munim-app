import { createServerDb } from "@munim/core/server";
import type { DbClient } from "@munim/core";
import type { Provider } from "@nestjs/common";
import { getEnv } from "../config/env.js";

/** NestJS injection token for the shared Drizzle client. */
export const DRIZZLE = "DRIZZLE";

/**
 * Builds the single server-side Drizzle client (pg.Pool-backed) and reuses it
 * for the process lifetime. All controllers inject this and pass it straight
 * to @munim/core service functions — business logic never lives in the API.
 */
export const drizzleProvider: Provider = {
  provide: DRIZZLE,
  useFactory: (): DbClient => {
    const env = getEnv();
    return createServerDb(env.DATABASE_URL);
  },
};
