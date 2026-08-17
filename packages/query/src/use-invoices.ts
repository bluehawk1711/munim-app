import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import type {
  InvoiceDto,
  InvoiceFilters,
  InvoiceFormValues,
  InvoicePaymentValues,
} from "@munim/core";
import { useApiClient } from "./provider.js";
import { qk } from "./keys.js";

/** GET /api/invoices — paginated, cached per filter set. */
export function useInvoices(filters: InvoiceFilters = {}) {
  const getClient = useApiClient();
  return useQuery({
    queryKey: qk.invoices.list(filters),
    queryFn: async () => {
      const api = await getClient();
      return api.invoices.list(filters);
    },
    placeholderData: (previous) => previous,
  });
}

/** GET /api/invoices/:id. */
export function useInvoice(id: string | null) {
  const getClient = useApiClient();
  return useQuery({
    queryKey: qk.invoices.detail(id ?? ""),
    queryFn: async (): Promise<InvoiceDto> => {
      const api = await getClient();
      return api.invoices.get(id ?? "");
    },
    enabled: !!id,
  });
}

/** POST /api/invoices. */
export function useCreateInvoice() {
  const getClient = useApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (values: InvoiceFormValues): Promise<InvoiceDto> => {
      const api = await getClient();
      return api.invoices.create(values);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.invoices.all });
      qc.invalidateQueries({ queryKey: qk.dashboard });
      qc.invalidateQueries({ queryKey: qk.products.all });
    },
  });
}

/** DELETE /api/invoices/:id — restores stock. */
export function useDeleteInvoice() {
  const getClient = useApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const api = await getClient();
      return api.invoices.remove(id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.invoices.all });
      qc.invalidateQueries({ queryKey: qk.dashboard });
      qc.invalidateQueries({ queryKey: qk.products.all });
      qc.invalidateQueries({ queryKey: qk.sales.all });
    },
  });
}

/** POST /api/invoices/:id/payment — record a payment against an invoice. */
export function useRecordInvoicePayment(invoiceId: string) {
  const getClient = useApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (values: InvoicePaymentValues): Promise<InvoiceDto> => {
      const api = await getClient();
      return api.invoices.recordPayment(invoiceId, values);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.invoices.all });
      qc.invalidateQueries({ queryKey: qk.dashboard });
      qc.invalidateQueries({ queryKey: qk.parties.all });
    },
  });
}
