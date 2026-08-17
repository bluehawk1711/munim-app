import { useQuery } from "@tanstack/react-query";
import type { ReportType } from "@munim/core";
import { useApiClient } from "./provider.js";

/** GET /api/reports — cached per (type, startDate, endDate) tuple. */
export function useReport(
  type: ReportType | null,
  startDate?: string,
  endDate?: string,
) {
  const getClient = useApiClient();
  return useQuery({
    queryKey: [
      "reports",
      "get",
      type ?? "none",
      startDate ?? "",
      endDate ?? "",
    ] as const,
    queryFn: async () => {
      if (!type) throw new Error("Report type is required");
      const api = await getClient();
      return api.reports.get({
        type,
        startDate: startDate ?? undefined,
        endDate: endDate ?? undefined,
      });
    },
    enabled: !!type,
    staleTime: 5 * 60 * 1000,
  });
}
