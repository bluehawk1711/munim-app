"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiFetch } from "@/lib/api-client"
import type { CatalogItem, CatalogKind } from "@munim/core"

export type { CatalogItem, CatalogKind }

export function useCatalog(kind: CatalogKind) {
  return useQuery({
    queryKey: ["catalog", kind],
    queryFn: () => apiFetch<CatalogItem[]>(`/api/${kind}s`),
  })
}

// Renaming/deleting a color or size affects product display names, so every
// catalog mutation also refreshes the product queries (list + meta).
function useInvalidateCatalog() {
  const qc = useQueryClient()
  return () => {
    qc.invalidateQueries({ queryKey: ["catalog"] })
    qc.invalidateQueries({ queryKey: ["products"] })
  }
}

export function useCreateCatalogItem(kind: CatalogKind) {
  const invalidate = useInvalidateCatalog()
  return useMutation({
    mutationFn: (name: string) =>
      apiFetch<CatalogItem>(`/api/${kind}s`, { method: "POST", body: { name } }),
    onSuccess: invalidate,
  })
}

export function useUpdateCatalogItem(kind: CatalogKind) {
  const invalidate = useInvalidateCatalog()
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      apiFetch<CatalogItem>(`/api/${kind}s/${id}`, { method: "PUT", body: { name } }),
    onSuccess: invalidate,
  })
}

export function useDeleteCatalogItem(kind: CatalogKind) {
  const invalidate = useInvalidateCatalog()
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ success: boolean }>(`/api/${kind}s/${id}`, { method: "DELETE" }),
    onSuccess: invalidate,
  })
}
