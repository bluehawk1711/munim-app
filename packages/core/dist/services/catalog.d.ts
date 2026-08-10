import type { DbClient } from "../db/client";
/**
 * Catalog (colors / sizes) management — SHARED by all three apps.
 *
 * The web app previously had this logic inline in its API routes; desktop and
 * mobile had none. This module is the single source of truth:
 *
 *   - listCatalogItems(db, kind)  → items with a productCount (real row ids)
 *   - createCatalogItem(...)      → duplicate-guarded create (reuses addColor/addSize)
 *   - renameCatalogItem(...)      → duplicate + existence guarded rename
 *   - deleteCatalogItem(...)      → refuses to delete colors/sizes still in use
 *
 * All mutations write an activity log so the trail is consistent everywhere.
 */
export type CatalogKind = "color" | "size";
export type CatalogItem = {
    id: string;
    name: string;
    createdAt: string;
    productCount: number;
};
export declare function listCatalogItems(db: DbClient, kind: CatalogKind): Promise<CatalogItem[]>;
export declare function createCatalogItem(db: DbClient, kind: CatalogKind, name: string): Promise<CatalogItem>;
export declare function renameCatalogItem(db: DbClient, kind: CatalogKind, id: string, name: string): Promise<CatalogItem>;
export declare function deleteCatalogItem(db: DbClient, kind: CatalogKind, id: string): Promise<{
    success: boolean;
}>;
//# sourceMappingURL=catalog.d.ts.map