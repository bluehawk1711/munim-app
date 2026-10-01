import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import type { GoldKaratsBackfillResult, GoldRatesDto, GoldRatesValues } from "@munim/core";
import { useApiClient } from "./provider.js";
import { qk } from "./keys.js";

/**
 * Gold rate table (dynamic karat pricing).
 *
 * A rate edit changes the price of every auto-priced gold product, so the
 * mutations below invalidate the product lists, the dashboard and every report
 * — the same prefixes the API's `goldRates` cache group clears.
 */

/** GET /api/gold-rates — the whole 0–24 karat table (quoted + derived). */
export function useGoldRates(options?: { enabled?: boolean }) {
  const getClient = useApiClient();
  return useQuery({
    queryKey: qk.goldRates.list,
    queryFn: async () => {
      const api = await getClient();
      return api.goldRates.list();
    },
    enabled: options?.enabled,
    staleTime: 30 * 1000,
  });
}

/** PUT /api/gold-rates — saves the table (`isCustom: false` resets a karat). */
export function useSaveGoldRates() {
  const getClient = useApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (values: GoldRatesValues): Promise<GoldRatesDto> => {
      const api = await getClient();
      return api.goldRates.save(values);
    },
    onSuccess: async () => {
      // Awaited so a settings write queued after this one can't race its
      // refetches (both must land in cache order for fresh prices).
      await qc.invalidateQueries({ queryKey: qk.goldRates.all });
      await qc.invalidateQueries({ queryKey: qk.products.all });
      await qc.invalidateQueries({ queryKey: qk.dashboard });
      await qc.invalidateQueries({ queryKey: qk.reports.all });
    },
  });
}

/** POST /api/gold-rates/backfill-karats — fill karats from purity stamps. */
export function useBackfillGoldKarats() {
  const getClient = useApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<GoldKaratsBackfillResult> => {
      const api = await getClient();
      return api.goldRates.backfillKarats();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.goldRates.all });
      qc.invalidateQueries({ queryKey: qk.products.all });
      qc.invalidateQueries({ queryKey: qk.dashboard });
      qc.invalidateQueries({ queryKey: qk.reports.all });
    },
  });
}
