import { logActivity as coreLogActivity } from "@munim/core";
import { db } from "./db";

export async function logActivity(action: string, detail?: string) {
  await coreLogActivity(db, action, detail);
}
