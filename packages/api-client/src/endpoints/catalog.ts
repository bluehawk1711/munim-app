import type { CatalogItem, CatalogKind } from "@munim/core";
import type { HttpClient } from "../http.js";

/**
 * One controller backs colors, sizes AND categories at /api/catalog/:kind
 * (kind = color | size | category). Methods mirror core's catalog service.
 */
export function catalog(http: HttpClient) {
  return {
    /** GET /api/catalog/:kind — mirrors core `listCatalogItems(db, kind)`. */
    list(kind: CatalogKind): Promise<CatalogItem[]> {
      return http.get(`/api/catalog/${kind}`);
    },
    /** POST /api/catalog/:kind — mirrors core `createCatalogItem(db, kind, name)`. */
    create(kind: CatalogKind, name: string): Promise<CatalogItem> {
      return http.post(`/api/catalog/${kind}`, { name });
    },
    /** PATCH /api/catalog/:kind/:id — mirrors core `renameCatalogItem`. */
    rename(kind: CatalogKind, id: string, name: string): Promise<CatalogItem> {
      return http.patch(`/api/catalog/${kind}/${id}`, { name });
    },
    /** DELETE /api/catalog/:kind/:id — mirrors core `deleteCatalogItem`. */
    remove(kind: CatalogKind, id: string): Promise<{ success: boolean }> {
      return http.del(`/api/catalog/${kind}/${id}`);
    },
  };
}

export type CatalogEndpoints = ReturnType<typeof catalog>;
