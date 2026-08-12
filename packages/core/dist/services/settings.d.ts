import type { DbClient } from "../db/client";
export type ShopSettingsInput = {
    shopName?: string;
    shopAddress?: string;
    shopPhones?: string[];
    shopEmail?: string;
    lowStockThreshold?: number;
    currency?: string;
    defaultTemplate?: Record<string, unknown>;
    /** Accent theme name shared across all apps — persisted here so a change on
     *  any platform syncs to the rest. Validated against the theme list in each
     *  app layer (core stays dependency-free of @munim/theme). */
    theme?: string;
    /** Light/dark mode shared across all apps ("light" | "dark" | "system"). */
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