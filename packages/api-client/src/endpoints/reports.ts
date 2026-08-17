import type { ReportDto, ReportQueryValues } from "@munim/core";
import type { HttpClient } from "../http.js";

export function reports(http: HttpClient) {
  return {
    /** GET /api/reports — mirrors core `getReport(db, type, startDate, endDate)`. */
    get(query: ReportQueryValues): Promise<ReportDto> {
      return http.get("/api/reports", { ...query });
    },
    /** GET /api/reports?format=csv — the shared `reportToCsv` output. */
    csv(query: ReportQueryValues): Promise<string> {
      return http.getText("/api/reports", { ...query, format: "csv" });
    },
  };
}

export type ReportsEndpoints = ReturnType<typeof reports>;
