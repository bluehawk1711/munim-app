import { useQuery } from "@tanstack/react-query";
import type { ReportFilters } from "@munim/core";
import { useApiClient } from "./provider.js";
import { qk } from "./keys.js";

/**
 * GET /api/reports — cached per full filter object. Pass `null` until the user
 * has generated a report. The filter shape is shared with web, desktop and
 * mobile, so every platform asks the API the same question.
 */
export function useReport(query: ReportFilters | null) {
  const getClient = useApiClient();
  return useQuery({
    queryKey: qk.reports.get(query),
    queryFn: async () => {
      if (!query) throw new Error("Report query is required");
      const api = await getClient();
      return api.reports.get(query);
    },
    enabled: !!query,
    staleTime: 5 * 60 * 1000,
  });
}
