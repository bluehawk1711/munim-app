"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiFetch } from "@/lib/api-client"
import type { Product, ProductFilters, StockStatus } from "@/lib/types"
import type { ProductFormValues, StockAdjustmentValues } from "@/lib/validators"

export const productKeys = {
  all: ["products"] as const,
  list: (filters: ProductFilters) => ["products", "list", filters] as const,
  detail: (id: string) => ["products", "detail", id] as const,
}

export type PaginationMeta = {
  page: number
  pageSize: number
  totalCount: number
  totalPages: number
}

type PaginatedProductsResponse = {
  products: Product[]
  pagination: PaginationMeta
}

function buildQueryString(filters: ProductFilters): string {
  const params = new URLSearchParams()
  if (filters.search) params.set("search", filters.search)
  if (filters.color && filters.color !== "all") params.set("color", filters.color)
  if (filters.size && filters.size !== "all") params.set("size", filters.size)
  if (filters.status && filters.status !== "all") params.set("status", filters.status)

  if (filters.page) params.set("page", String(filters.page))
  if (filters.pageSize) params.set("pageSize", String(filters.pageSize))

  const qs = params.toString()
  return qs ? `?${qs}` : ""
}

export function useProducts(
  filters: ProductFilters = {},
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: productKeys.list(filters),
    queryFn: () =>
      apiFetch<PaginatedProductsResponse>(`/api/products${buildQueryString(filters)}`),
    enabled: options?.enabled,
    select: (data) => ({
      products: data.products,
      pagination: data.pagination,
    }),
    placeholderData: (previous) => previous,
  })
}

export function useCreateProduct() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (values: ProductFormValues) =>
      apiFetch<Product>("/api/products", { method: "POST", body: values }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: productKeys.all })
      qc.invalidateQueries({ queryKey: ["dashboard"] })
    },
  })
}

export function useUpdateProduct() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, values }: { id: string; values: ProductFormValues }) =>
      apiFetch<Product>(`/api/products/${id}`, { method: "PUT", body: values }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: productKeys.all })
      qc.invalidateQueries({ queryKey: ["dashboard"] })
    },
  })
}

export function useDeleteProduct() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiFetch<{ success: boolean }>(`/api/products/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: productKeys.all })
      qc.invalidateQueries({ queryKey: ["dashboard"] })
      qc.invalidateQueries({ queryKey: ["sales"] })
    },
  })
}

export function useAdjustStock() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, values }: { id: string; values: StockAdjustmentValues }) =>
      apiFetch<Product>(`/api/products/${id}/stock`, { method: "PATCH", body: values }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: productKeys.all })
      qc.invalidateQueries({ queryKey: ["dashboard"] })
    },
  })
}

export function useSeedProducts() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => apiFetch<{ success: boolean; count: number }>("/api/products/seed", { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: productKeys.all })
      qc.invalidateQueries({ queryKey: ["dashboard"] })
      qc.invalidateQueries({ queryKey: ["sales"] })
    },
  })
}

export type { StockStatus }
