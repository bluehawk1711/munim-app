"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiFetch } from "@/lib/api-client"
import type { Invoice } from "@/lib/types"

export const invoiceKeys = {
  all: ["invoices"] as const,
  list: (filters: Record<string, unknown>) => ["invoices", "list", filters] as const,
  detail: (id: string) => ["invoices", "detail", id] as const,
}

export function useInvoices(filters: Record<string, unknown> = {}) {
  const params = new URLSearchParams()
  Object.entries(filters).forEach(([k, v]) => {
    if (v !== undefined && v !== "" && v !== "all") params.set(k, String(v))
  })
  const qs = params.toString()
  return useQuery({
    queryKey: invoiceKeys.list(filters),
    queryFn: () =>
      apiFetch<{ invoices: Invoice[]; pagination: { page: number; pageSize: number; totalCount: number; totalPages: number } }>(
        `/api/invoices${qs ? `?${qs}` : ""}`
      ),
  })
}

export function useInvoice(id: string | null) {
  return useQuery({
    queryKey: invoiceKeys.detail(id ?? ""),
    queryFn: () => apiFetch<Invoice>(`/api/invoices/${id}`),
    enabled: !!id,
  })
}

export type CreateInvoiceInput = {
  customerName?: string
  customerPhone?: string
  customerAddress?: string
  partyId?: string
  date?: string
  items: { productId?: string; productName: string; sku?: string; color?: string; size?: string; description?: string; quantity: number; price: number }[]
  deliveryCharge?: number
  discount?: number
  notes?: string
  shopDetails?: { name: string; address: string; phones: string[]; email: string }
  templateSettings?: Record<string, unknown>
  amountPaid?: number
  paymentMethod?: string
}

export function useCreateInvoice() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (values: CreateInvoiceInput) =>
      apiFetch<Invoice>("/api/invoices", { method: "POST", body: values }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: invoiceKeys.all })
      qc.invalidateQueries({ queryKey: ["dashboard"] })
      qc.invalidateQueries({ queryKey: ["products"] })
    },
  })
}

export function useDeleteInvoice() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiFetch<{ success: boolean }>(`/api/invoices/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: invoiceKeys.all })
      qc.invalidateQueries({ queryKey: ["dashboard"] })
      qc.invalidateQueries({ queryKey: ["products"] })
      qc.invalidateQueries({ queryKey: ["sales"] })
    },
  })
}

export function useRecordPayment(invoiceId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (values: { amount: number; method?: string; date?: string; note?: string }) =>
      apiFetch<Invoice>(`/api/invoices/${invoiceId}/payment`, { method: "POST", body: values }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: invoiceKeys.all })
      qc.invalidateQueries({ queryKey: ["dashboard"] })
      qc.invalidateQueries({ queryKey: ["parties"] })
    },
  })
}
