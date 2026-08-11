import { eq } from "drizzle-orm";
import * as schema from "../db/schema";
const SETTINGS_ID = "shop-settings";
/** Fetches settings, creating the singleton row on first use. */
export async function getSettings(db) {
    let row = await db.query.settings.findFirst();
    if (!row) {
        const created = await db
            .insert(schema.settings)
            .values({ id: SETTINGS_ID })
            .onConflictDoNothing()
            .returning();
        row = created[0];
        if (!row)
            row = (await db.query.settings.findFirst());
    }
    return row;
}
export async function updateSettings(db, input) {
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
        updatedAt: new Date(),
    })
        .where(eq(schema.settings.id, SETTINGS_ID))
        .returning();
    return row;
}
//# sourceMappingURL=settings.js.map