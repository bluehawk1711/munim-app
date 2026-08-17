"use client"

/**
 * Web products hooks — thin re-exports of the shared @munim/query hooks so all
 * three apps call the API through one layer (keys, caching, invalidation).
 * See docs/state-management.md.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { apiFetch } from "@/lib/api-client"
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

/** Web-only dev tool — seeds demo products via the local /api/products/seed route. */
export function useSeedProducts() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => apiFetch<{ success: boolean; count: number }>("/api/products/seed", { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] })
      qc.invalidateQueries({ queryKey: ["dashboard"] })
      qc.invalidateQueries({ queryKey: ["sales"] })
    },
  })
}
