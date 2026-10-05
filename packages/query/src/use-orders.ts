import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import type {
  BillFromOrderResult,
  OrderDto,
  OrderFilters,
  OrderFormValues,
  OrderUpdateValues,
} from "@munim/core";
import { useApiClient } from "./provider.js";
import { qk } from "./keys.js";

/** GET /api/orders — paginated, cached per filter set. */
export function useOrders(filters: OrderFilters = {}) {
  const getClient = useApiClient();
  return useQuery({
    queryKey: qk.orders.list(filters),
    queryFn: async () => {
      const api = await getClient();
      return api.orders.list(filters);
    },
    placeholderData: (previous) => previous,
  });
}

/** GET /api/orders/:id. */
export function useOrder(id: string | null) {
  const getClient = useApiClient();
  return useQuery({
    queryKey: qk.orders.detail(id ?? ""),
    queryFn: async (): Promise<OrderDto> => {
      const api = await getClient();
      return api.orders.get(id ?? "");
    },
    enabled: !!id,
  });
}

/** POST /api/orders. */
export function useCreateOrder() {
  const getClient = useApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (values: OrderFormValues): Promise<OrderDto> => {
      const api = await getClient();
      return api.orders.create(values);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.orders.all });
      qc.invalidateQueries({ queryKey: qk.dashboard });
    },
  });
}

/** PATCH /api/orders/:id — edit an open order. */
export function useUpdateOrder() {
  const getClient = useApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      values,
    }: {
      id: string;
      values: OrderUpdateValues;
    }): Promise<OrderDto> => {
      const api = await getClient();
      return api.orders.update(id, values);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.orders.all });
    },
  });
}

/** POST /api/orders/:id/bill — quoted lines → a real invoice (stock checked). */
export function useGenerateOrderBill() {
  const getClient = useApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<BillFromOrderResult> => {
      const api = await getClient();
      return api.orders.generateBill(id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.orders.all });
      qc.invalidateQueries({ queryKey: qk.invoices.all });
      qc.invalidateQueries({ queryKey: qk.sales.all });
      qc.invalidateQueries({ queryKey: qk.products.all });
      qc.invalidateQueries({ queryKey: qk.dashboard });
    },
  });
}

/** DELETE /api/orders/:id — blocked once a bill exists. */
export function useDeleteOrder() {
  const getClient = useApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const api = await getClient();
      return api.orders.remove(id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.orders.all });
      qc.invalidateQueries({ queryKey: qk.dashboard });
    },
  });
}
