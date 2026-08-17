import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import type { CatalogItem, CatalogKind } from "@munim/core";
import { useApiClient } from "./provider.js";
import { qk } from "./keys.js";

export type { CatalogItem, CatalogKind };

/** GET /api/catalog/:kind — colors, sizes or categories. */
export function useCatalog(kind: CatalogKind) {
  const getClient = useApiClient();
  return useQuery({
    queryKey: qk.catalog.list(kind),
    queryFn: async () => {
      const api = await getClient();
      return api.catalog.list(kind);
    },
  });
}

/** Renaming/deleting a catalog item changes product display names, so every
 * catalog mutation also refreshes the product queries (list + meta). */
function useInvalidateCatalog() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: qk.catalog.all });
    qc.invalidateQueries({ queryKey: qk.products.all });
  };
}

/** POST /api/catalog/:kind. */
export function useCreateCatalogItem(kind: CatalogKind) {
  const getClient = useApiClient();
  const invalidate = useInvalidateCatalog();
  return useMutation({
    mutationFn: async (name: string): Promise<CatalogItem> => {
      const api = await getClient();
      return api.catalog.create(kind, name);
    },
    onSuccess: invalidate,
  });
}

/** PATCH /api/catalog/:kind/:id. */
export function useUpdateCatalogItem(kind: CatalogKind) {
  const getClient = useApiClient();
  const invalidate = useInvalidateCatalog();
  return useMutation({
    mutationFn: async ({
      id,
      name,
    }: {
      id: string;
      name: string;
    }): Promise<CatalogItem> => {
      const api = await getClient();
      return api.catalog.rename(kind, id, name);
    },
    onSuccess: invalidate,
  });
}

/** DELETE /api/catalog/:kind/:id. */
export function useDeleteCatalogItem(kind: CatalogKind) {
  const getClient = useApiClient();
  const invalidate = useInvalidateCatalog();
  return useMutation({
    mutationFn: async (id: string) => {
      const api = await getClient();
      return api.catalog.remove(kind, id);
    },
    onSuccess: invalidate,
  });
}
