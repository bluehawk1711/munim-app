import * as React from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import type { SettingsDto, SettingsFormValues } from "@munim/core";
import { useApiClient } from "./provider.js";
import { qk } from "./keys.js";

/** GET /api/settings — shop profile; cached, invalidated on save. */
export function useSettings() {
  const getClient = useApiClient();
  return useQuery({
    queryKey: qk.settings,
    queryFn: async () => {
      const api = await getClient();
      return api.settings.get();
    },
  });
}

/**
 * PUT /api/settings.
 *
 * A settings write feeds the silver rate + shop-default labour into every
 * auto-priced product (and embeds shop name/address on dashboard + invoices),
 * so this mirrors the API's `settings` cache group in full. The invalidations
 * are awaited so `mutateAsync()` resolves only after the fresh data landed.
 */
export function useUpdateSettings() {
  const getClient = useApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (values: SettingsFormValues): Promise<SettingsDto> => {
      const api = await getClient();
      return api.settings.update(values);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: qk.settings });
      await qc.invalidateQueries({ queryKey: qk.goldRates.all });
      await qc.invalidateQueries({ queryKey: qk.products.all });
      await qc.invalidateQueries({ queryKey: qk.dashboard });
      await qc.invalidateQueries({ queryKey: qk.invoices.all });
      await qc.invalidateQueries({ queryKey: qk.sales.all });
      await qc.invalidateQueries({ queryKey: qk.reports.all });
    },
  });
}

/**
 * Debounced settings writes for per-keystroke editors (default labour, silver
 * rate): patches accumulate and flush once, `debounceMs` after the last
 * keystroke, instead of a PUT per key (which spams the API and races). Any
 * pending patch is also flushed when the host unmounts, so closing a dialog
 * never drops an edit. Returns the mutation too (`isPending` for spinners).
 */
export function useDebouncedSettingsUpdate(debounceMs = 600) {
  const mutation = useUpdateSettings();
  const pending = React.useRef<{
    patch: SettingsFormValues;
    onError?: (err: Error) => void;
  } | null>(null);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const mutate = mutation.mutate;

  const flush = React.useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    const next = pending.current;
    pending.current = null;
    if (next) {
      mutate(next.patch, next.onError ? { onError: next.onError } : undefined);
    }
  }, [mutate]);

  const update = React.useCallback(
    (patch: SettingsFormValues, onError?: (err: Error) => void) => {
      pending.current = {
        patch: { ...pending.current?.patch, ...patch },
        onError: onError ?? pending.current?.onError,
      };
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(flush, debounceMs);
    },
    [flush, debounceMs],
  );

  React.useEffect(() => () => flush(), [flush]);

  return { update, flush, ...mutation };
}
