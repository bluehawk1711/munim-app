"use client"

/**
 * Web catalog hooks — thin re-exports of the shared @munim/query hooks
 * (colors / sizes / categories all live behind /api/catalog/:kind, which the
 * web serves from apps/web/src/app/api/catalog/[kind]).
 */
import {
  useCatalog,
  useCreateCatalogItem,
  useUpdateCatalogItem,
  useDeleteCatalogItem,
} from "@munim/query"

export {
  useCatalog,
  useCreateCatalogItem,
  useUpdateCatalogItem,
  useDeleteCatalogItem,
}
export type { CatalogItem, CatalogKind } from "@munim/core"
