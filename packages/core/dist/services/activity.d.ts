import type { DbClient } from "../db/client";
/** Best-effort activity logging — never throws into the caller's flow. */
export declare function logActivity(db: DbClient, action: string, detail?: string): Promise<void>;
//# sourceMappingURL=activity.d.ts.map