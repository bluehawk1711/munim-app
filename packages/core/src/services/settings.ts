import { eq } from "drizzle-orm";
import type { DbClient } from "../db/client.js";
import * as schema from "../db/schema.js";

const SETTINGS_ID = "shop-settings";

export type ShopSettingsInput = {
  shopName?: string;
  shopAddress?: string;
  shopPhones?: string[];
  shopEmail?: string;
  lowStockThreshold?: number;
  currency?: string;
  defaultTemplate?: Record<string, unknown>;
  /** Accent theme name. LEGACY: the apps used to sync theme/mode through this
   *  row; that was removed (theme + mode are now per-device, stored locally).
   *  The columns are kept for compatibility but no app reads or writes them. */
  theme?: string;
  /** Light/dark mode ("light" | "dark" | "system"). LEGACY — see `theme`. */
  mode?: string;
};

/** Fetches settings, creating the singleton row on first use. */
export async function getSettings(db: DbClient) {
  let row = await db.query.settings.findFirst();
  if (!row) {
    const created = await db
      .insert(schema.settings)
      .values({ id: SETTINGS_ID })
      .onConflictDoNothing()
      .returning();
    row = created[0];
    if (!row) row = (await db.query.settings.findFirst())!;
  }
  return row;
}

export async function updateSettings(db: DbClient, input: ShopSettingsInput) {
  await getSettings(db); // ensure row exists
  const [row] = await db
    .update(schema.settings)
    .set({
      ...(input.shopName !== undefined ? { shopName: input.shopName } : {}),
      ...(input.shopAddress !== undefined ? { shopAddress: input.shopAddress } : {}),
      ...(input.shopPhones !== undefined ? { shopPhones: input.shopPhones } : {}),
      ...(input.shopEmail !== undefined ? { shopEmail: input.shopEmail } : {}),
      ...(input.lowStockThreshold !== undefined ? { lowStockThreshold: input.lowStockThreshold } : {}),
      ...(input.currency !== undefined ? { currency: input.currency } : {}),
      ...(input.defaultTemplate !== undefined ? { defaultTemplate: input.defaultTemplate } : {}),
      ...(input.theme !== undefined ? { theme: input.theme } : {}),
      ...(input.mode !== undefined ? { mode: input.mode } : {}),
      updatedAt: new Date(),
    })
    .where(eq(schema.settings.id, SETTINGS_ID))
    .returning();
  return row!;
}
