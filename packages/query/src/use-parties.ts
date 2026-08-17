import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import type {
  PartyDto,
  PartyFormValues,
  PartyUpdateValues,
  AdvanceDto,
  AdvanceFormValues,
  PaymentDto,
  PaymentFormValues,
} from "@munim/core";
import { useApiClient } from "./provider.js";
import { qk } from "./keys.js";

/** GET /api/parties. */
export function useParties(type?: string, search?: string) {
  const getClient = useApiClient();
  return useQuery({
    queryKey: qk.parties.list(type, search),
    queryFn: async () => {
      const api = await getClient();
      return api.parties.list({ type, search });
    },
  });
}

/** GET /api/parties?balances=true — the khata "who owes whom" view. */
export function usePartyBalances() {
  const getClient = useApiClient();
  return useQuery({
    queryKey: qk.parties.balances,
    queryFn: async () => {
      const api = await getClient();
      return api.parties.balances();
    },
  });
}

/** GET /api/parties/:id — party plus its full ledger. */
export function useParty(id: string | null) {
  const getClient = useApiClient();
  return useQuery({
    queryKey: qk.parties.detail(id ?? ""),
    queryFn: async () => {
      const api = await getClient();
      return api.parties.get(id ?? "");
    },
    enabled: !!id,
  });
}

/** POST /api/parties. */
export function useCreateParty() {
  const getClient = useApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (values: PartyFormValues): Promise<PartyDto> => {
      const api = await getClient();
      return api.parties.create(values);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.parties.all });
    },
  });
}

/** PUT /api/parties/:id. */
export function useUpdateParty() {
  const getClient = useApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      values,
    }: {
      id: string;
      values: PartyUpdateValues;
    }): Promise<PartyDto> => {
      const api = await getClient();
      return api.parties.update(id, values);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.parties.all });
    },
  });
}

/** DELETE /api/parties/:id. */
export function useDeleteParty() {
  const getClient = useApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const api = await getClient();
      return api.parties.remove(id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.parties.all });
      qc.invalidateQueries({ queryKey: qk.dashboard });
    },
  });
}

/* ── Advances ────────────────────────────────────────────────── */

/** GET /api/advances — all advances, or filtered by party. */
export function useAdvances(partyId?: string) {
  const getClient = useApiClient();
  return useQuery({
    queryKey: qk.advances.list(partyId),
    queryFn: async () => {
      const api = await getClient();
      return api.advances.list(partyId);
    },
  });
}

/** POST /api/advances. */
export function useCreateAdvance() {
  const getClient = useApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (values: AdvanceFormValues): Promise<AdvanceDto> => {
      const api = await getClient();
      return api.advances.create(values);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.advances.all });
      qc.invalidateQueries({ queryKey: qk.parties.all });
      qc.invalidateQueries({ queryKey: qk.dashboard });
    },
  });
}

/** POST /api/advances/:id/settle — close an open advance. */
export function useSettleAdvance() {
  const getClient = useApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<AdvanceDto> => {
      const api = await getClient();
      return api.advances.settle(id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.advances.all });
      qc.invalidateQueries({ queryKey: qk.parties.all });
      qc.invalidateQueries({ queryKey: qk.dashboard });
    },
  });
}

/** DELETE /api/advances/:id. */
export function useDeleteAdvance() {
  const getClient = useApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const api = await getClient();
      return api.advances.remove(id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.advances.all });
      qc.invalidateQueries({ queryKey: qk.parties.all });
      qc.invalidateQueries({ queryKey: qk.dashboard });
    },
  });
}

/* ── Payments (money in/out against a party) ─────────────────── */

/** GET /api/payments — all, or filtered by party. */
export function usePayments(partyId?: string) {
  const getClient = useApiClient();
  return useQuery({
    queryKey: qk.payments.list(partyId),
    queryFn: async () => {
      const api = await getClient();
      return api.payments.list(partyId);
    },
  });
}

/** POST /api/payments — money in/out against a party (khata). */
export function useRecordPartyPayment() {
  const getClient = useApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (values: PaymentFormValues): Promise<PaymentDto> => {
      const api = await getClient();
      return api.payments.create(values);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.payments.all });
      qc.invalidateQueries({ queryKey: qk.advances.all });
      qc.invalidateQueries({ queryKey: qk.parties.all });
      qc.invalidateQueries({ queryKey: qk.dashboard });
    },
  });
}
