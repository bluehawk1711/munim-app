"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiFetch } from "@/lib/api-client"
import type { Party, PartyBalance, Advance, Payment, LedgerLine } from "@/lib/types"

export const partyKeys = {
  all: ["parties"] as const,
  balances: ["parties", "balances"] as const,
  detail: (id: string) => ["parties", "detail", id] as const,
}

export function useParties(type?: string, search?: string) {
  const params = new URLSearchParams()
  if (type && type !== "all") params.set("type", type)
  if (search) params.set("search", search)
  const qs = params.toString()
  return useQuery({
    queryKey: ["parties", "list", type, search],
    queryFn: () => apiFetch<Party[]>(`/api/parties${qs ? `?${qs}` : ""}`),
  })
}

export function usePartyBalances() {
  return useQuery({
    queryKey: partyKeys.balances,
    queryFn: () =>
      apiFetch<{ balances: PartyBalance[]; receivables: PartyBalance[]; payables: PartyBalance[] }>(
        "/api/parties?balances=true"
      ),
  })
}

export function useParty(id: string | null) {
  return useQuery({
    queryKey: partyKeys.detail(id ?? ""),
    queryFn: () =>
      apiFetch<{
        party: Party
        ledger: { lines: LedgerLine[]; balance: number }
      }>(`/api/parties/${id}`),
    enabled: !!id,
  })
}

export function useCreateParty() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (values: Partial<Party>) => apiFetch<Party>("/api/parties", { method: "POST", body: values }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: partyKeys.all })
    },
  })
}

export function useUpdateParty() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, values }: { id: string; values: Partial<Party> }) =>
      apiFetch<Party>(`/api/parties/${id}`, { method: "PUT", body: values }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: partyKeys.all })
    },
  })
}

export function useDeleteParty() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiFetch<{ success: boolean }>(`/api/parties/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: partyKeys.all })
      qc.invalidateQueries({ queryKey: ["dashboard"] })
    },
  })
}

/* ── Advances & payments ──────────────────────────────────────── */

export function useAdvances(partyId?: string) {
  return useQuery({
    queryKey: ["advances", partyId],
    queryFn: () =>
      apiFetch<Advance[]>(`/api/advances${partyId ? `?partyId=${partyId}` : ""}`),
  })
}

export function useCreateAdvance() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (values: { partyId: string; direction: "GIVEN" | "TAKEN"; amount: number; date?: string; note?: string }) =>
      apiFetch<Advance>("/api/advances", { method: "POST", body: values }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["advances"] })
      qc.invalidateQueries({ queryKey: partyKeys.all })
      qc.invalidateQueries({ queryKey: ["dashboard"] })
    },
  })
}

export function usePayments(partyId?: string) {
  return useQuery({
    queryKey: ["payments", partyId],
    queryFn: () =>
      apiFetch<Payment[]>(`/api/payments${partyId ? `?partyId=${partyId}` : ""}`),
  })
}

export function useRecordPayment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (values: { partyId?: string; direction: "IN" | "OUT"; amount: number; method?: string; date?: string; note?: string }) =>
      apiFetch<Payment>("/api/payments", { method: "POST", body: values }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payments"] })
      qc.invalidateQueries({ queryKey: ["advances"] })
      qc.invalidateQueries({ queryKey: partyKeys.all })
      qc.invalidateQueries({ queryKey: ["dashboard"] })
    },
  })
}
