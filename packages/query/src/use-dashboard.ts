import { useQuery } from "@tanstack/react-query";
import { useApiClient } from "./provider.js";
import { qk } from "./keys.js";

/** GET /api/dashboard — cached; invalidated by every mutation. */
export function useDashboard() {
  const getClient = useApiClient();
  return useQuery({
    queryKey: qk.dashboard,
    queryFn: async () => {
      const api = await getClient();
      return api.dashboard.get();
    },
  });
}
