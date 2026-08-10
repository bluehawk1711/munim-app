"use client"

import { useQuery } from "@tanstack/react-query"
import { apiFetch } from "@/lib/api-client"

export type ProductMeta = {
  colors: string[]
  sizes: string[]
}

export function useProductMeta() {
  return useQuery({
    queryKey: ["products", "meta"],
    queryFn: () => apiFetch<ProductMeta>("/api/products/meta"),
    staleTime: 1000 * 60,
  })
}
