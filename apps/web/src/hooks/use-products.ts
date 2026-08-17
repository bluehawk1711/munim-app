"use client"

/**
 * Web products hooks — thin re-exports of the shared @munim/query hooks so all
 * three apps call the API through one layer (keys, caching, invalidation).
 * See docs/state-management.md.
 */
import {
  useProducts,
  useCreateProduct,
  useUpdateProduct,
  useDeleteProduct,
  useAdjustStock,
  useBackfillBarcodes,
} from "@munim/query"

export {
  useProducts,
  useCreateProduct,
  useUpdateProduct,
  useDeleteProduct,
  useAdjustStock,
  useBackfillBarcodes,
}
