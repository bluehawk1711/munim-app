import type { DbClient } from "../db/client.js";
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
export declare function getSettings(db: DbClient): Promise<{
    id: string;
    mode: string;
    lowStockThreshold: number;
    updatedAt: Date;
    shopName: string;
    shopAddress: string | null;
    shopPhones: string[];
    shopEmail: string | null;
    currency: string;
    defaultTemplate: Record<string, unknown>;
    theme: string;
}>;
export declare function updateSettings(db: DbClient, input: ShopSettingsInput): Promise<{
    id: string;
    shopName: string;
    shopAddress: string | null;
    shopPhones: string[];
    shopEmail: string | null;
    lowStockThreshold: number;
    currency: string;
    defaultTemplate: Record<string, unknown>;
    theme: string;
    mode: string;
    updatedAt: Date;
}>;
//# sourceMappingURL=settings.d.ts.map