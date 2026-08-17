import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import type {
  ProductDto,
  ProductFilters,
  ProductFormValues,
  StockAdjustmentValues,
} from "@munim/core";
import { useApiClient } from "./provider.js";
import { qk } from "./keys.js";

/** GET /api/products — paginated list, cached per filter set. */
export function useProducts(
  filters: ProductFilters = {},
  options?: { enabled?: boolean },
) {
  const getClient = useApiClient();
  return useQuery({
    queryKey: qk.products.list(filters),
    queryFn: async () => {
      const api = await getClient();
      return api.products.list(filters);
    },
    enabled: options?.enabled,
    select: (data) => ({
      products: data.products,
      pagination: data.pagination,
    }),
    placeholderData: (previous) => previous,
  });
}

/** GET /api/products/meta — the color/size/category option lists. */
export function useProductMeta(options?: { enabled?: boolean }) {
  const getClient = useApiClient();
  return useQuery({
    queryKey: qk.products.meta,
    queryFn: async () => {
      const api = await getClient();
      return api.products.meta();
    },
    enabled: options?.enabled,
  });
}

/** GET /api/products/lookup?barcode=… — fast shop-counter lookup (404 = none). */
export function useProductByBarcode(barcode: string | null) {
  const getClient = useApiClient();
  return useQuery({
    queryKey: ["products", "barcode", barcode ?? ""] as const,
    queryFn: async () => {
      const api = await getClient();
      return api.products.byBarcode(barcode ?? "");
    },
    enabled: !!barcode,
    retry: false,
  });
}

/** GET /api/products/:id/movements — stock audit trail. */
export function useProductMovements(id: string | null) {
  const getClient = useApiClient();
  return useQuery({
    queryKey: qk.products.movements(id ?? ""),
    queryFn: async () => {
      const api = await getClient();
      return api.products.movements(id ?? "");
    },
    enabled: !!id,
  });
}

/** POST /api/products. */
export function useCreateProduct() {
  const getClient = useApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (values: ProductFormValues): Promise<ProductDto> => {
      const api = await getClient();
      return api.products.create(values);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.products.all });
      qc.invalidateQueries({ queryKey: qk.dashboard });
    },
  });
}

/** PUT /api/products/:id. */
export function useUpdateProduct() {
  const getClient = useApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      values,
    }: {
      id: string;
      values: ProductFormValues;
    }): Promise<ProductDto> => {
      const api = await getClient();
      return api.products.update(id, values);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.products.all });
      qc.invalidateQueries({ queryKey: qk.dashboard });
    },
  });
}

/** DELETE /api/products/:id. */
export function useDeleteProduct() {
  const getClient = useApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const api = await getClient();
      return api.products.remove(id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.products.all });
      qc.invalidateQueries({ queryKey: qk.dashboard });
      qc.invalidateQueries({ queryKey: qk.sales.all });
    },
  });
}

/** PATCH /api/products/:id/stock. */
export function useAdjustStock() {
  const getClient = useApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      values,
    }: {
      id: string;
      values: StockAdjustmentValues;
    }): Promise<ProductDto> => {
      const api = await getClient();
      return api.products.adjustStock(id, values);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.products.all });
      qc.invalidateQueries({ queryKey: qk.dashboard });
    },
  });
}

/** POST /api/products/backfill-barcodes. */
export function useBackfillBarcodes() {
  const getClient = useApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const api = await getClient();
      return api.products.backfillBarcodes();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.products.all });
    },
  });
}
