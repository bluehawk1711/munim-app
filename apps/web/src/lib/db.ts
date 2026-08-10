// The web app no longer owns a database driver. All schema and connection
// logic lives in @munim/core (shared with the desktop & mobile apps).
// We just expose the shared singleton.
import { getDb } from "@munim/core";

export const db = getDb();
export type Db = typeof db;
