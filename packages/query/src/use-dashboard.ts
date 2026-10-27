import { useQuery } from "@tanstack/react-query";
import type { DashboardPeriod } from "@munim/core";
import { useApiClient } from "./provider.js";
import { qk } from "./keys.js";

/**
 * GET /api/dashboard — cached; invalidated by every mutation.
 *
 * `period` scopes the headline KPI tiles (dashboard chips: Today / This week /
 * This month / Custom → `{from,to}` ISO bounds). The key includes the period so
 * chip switches are cached per range, while `invalidateQueries(qk.dashboard)`
 * still clears every range (key-prefix match).
 */
export function useDashboard(period?: DashboardPeriod) {
  const getClient = useApiClient();
  return useQuery({
    queryKey: [...qk.dashboard, period ?? {}],
    queryFn: async () => {
      const api = await getClient();
      return api.dashboard.get(period);
    },
    placeholderData: (previous) => previous,
  });
}
