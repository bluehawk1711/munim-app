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

/** PUT /api/settings. */
export function useUpdateSettings() {
  const getClient = useApiClient();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (values: SettingsFormValues): Promise<SettingsDto> => {
      const api = await getClient();
      return api.settings.update(values);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.settings });
    },
  });
}
