import { resolveColorId as coreColor, resolveSizeId as coreSize } from "@munim/core";
import { db } from "./db";

export async function resolveColorId(name: string): Promise<string> {
  return coreColor(db, name);
}

export async function resolveSizeId(name: string): Promise<string> {
  return coreSize(db, name);
}
