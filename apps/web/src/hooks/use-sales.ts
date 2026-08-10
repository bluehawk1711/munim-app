"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiFetch } from "@/lib/api-client"
import type { Sale, SaleFilters } from "@/lib/types"
import type { SaleFormValues } from "@/lib/validators"

export const saleKeys = {
  all: ["sales"] as const,
  list: (filters: SaleFilters) => ["sales", "list", filters] as const,
}

function buildQueryString(filters: SaleFilters): string {
  const params = new URLSearchParams()
  if (filters.search) params.set("search", filters.search)
  if (filters.startDate) params.set("startDate", filters.startDate)
  if (filters.endDate) params.set("endDate", filters.endDate)
  const qs = params.toString()
  return qs ? `?${qs}` : ""
}

export function useSales(filters: SaleFilters = {}) {
  return useQuery({
    queryKey: saleKeys.list(filters),
    queryFn: () => apiFetch<Sale[]>(`/api/sales${buildQueryString(filters)}`),
  })
}

export function useCreateSale() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (values: SaleFormValues) =>
      apiFetch<Sale>("/api/sales", { method: "POST", body: values }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: saleKeys.all })
      qc.invalidateQueries({ queryKey: ["products"] })
      qc.invalidateQueries({ queryKey: ["dashboard"] })
    },
  })
}

export function useUndoSale() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiFetch<{ success: boolean }>(`/api/sales/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: saleKeys.all })
      qc.invalidateQueries({ queryKey: ["products"] })
      qc.invalidateQueries({ queryKey: ["dashboard"] })
    },
  })
}
