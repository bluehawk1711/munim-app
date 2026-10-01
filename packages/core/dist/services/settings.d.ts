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
    /** Allow creating invoices with a total of ₹0. */
    allowZeroTotal?: boolean;
    /** Default labour METHOD for auto-priced GOLD products (silver is per-product). */
    defaultLabourType?: "PERCENT" | "FIXED" | "PER_GRAM";
    /** Default labour rate/amount (meaning depends on the method; 0 → none). */
    defaultLabourValue?: number;
    /** Shop-wide silver ₹/gram for auto-priced silver products (0 → off). */
    silverRatePerGram?: number;
};
/** Fetches settings, creating the singleton row on first use. */
export declare function getSettings(db: DbClient): Promise<{
    id: string;
    mode: string;
    updatedAt: Date;
    lowStockThreshold: number;
    shopName: string;
    shopAddress: string | null;
    shopPhones: string[];
    shopEmail: string | null;
    currency: string;
    defaultTemplate: Record<string, unknown>;
    theme: string;
    allowZeroTotal: boolean;
    defaultLabourType: "PERCENT" | "FIXED" | "PER_GRAM";
    defaultLabourValue: number;
    silverRatePerGram: number;
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
    allowZeroTotal: boolean;
    defaultLabourType: "PERCENT" | "FIXED" | "PER_GRAM";
    defaultLabourValue: number;
    silverRatePerGram: number;
    updatedAt: Date;
}>;
//# sourceMappingURL=settings.d.ts.map