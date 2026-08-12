"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiFetch } from "@/lib/api-client"

export type ShopSettings = {
  id: string
  shopName: string
  shopAddress: string | null
  shopPhones: string[]
  shopEmail: string | null
  lowStockThreshold: number
  currency: string
  defaultTemplate: Record<string, unknown>
  theme: string
  mode: string
  updatedAt: string
}

export function useSettings() {
  return useQuery({
    queryKey: ["settings"],
    queryFn: () => apiFetch<ShopSettings>("/api/settings"),
  })
}

export function useUpdateSettings() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (values: Partial<ShopSettings>) =>
      apiFetch<ShopSettings>("/api/settings", { method: "PUT", body: values }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["settings"] })
    },
  })
}
