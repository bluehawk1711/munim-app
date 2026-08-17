import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import type { SaleDto, SaleFormValues } from "@munim/core";
import { useApiClient } from "./provider.js";
import { qk } from "./keys.js";

/** Sale list filters — flattened invoice rows. */
export type SaleFilters = {
  search?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
};

/** GET /api/sales — flattened sale rows, cached per filter set. */
export function useSales(filters: SaleFilters = {}) {
  const getClient = useApiClient();
  return useQuery({
    queryKey: qk.sales.list(filters),
    queryFn: async () => {
      const api = await getClient();
      return api.sales.list(filters);
    },
  });
}

/** POST /api/sales — quick single-product sale. */
export function useCreateSale() {
  const getClient = useApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (values: SaleFormValues): Promise<SaleDto> => {
      const api = await getClient();
      return api.sales.create(values);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.sales.all });
      qc.invalidateQueries({ queryKey: qk.products.all });
      qc.invalidateQueries({ queryKey: qk.dashboard });
    },
  });
}

/** DELETE /api/sales/:id — undo a sale (stock restore). */
export function useUndoSale() {
  const getClient = useApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const api = await getClient();
      return api.sales.remove(id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.sales.all });
      qc.invalidateQueries({ queryKey: qk.products.all });
      qc.invalidateQueries({ queryKey: qk.dashboard });
    },
  });
}
