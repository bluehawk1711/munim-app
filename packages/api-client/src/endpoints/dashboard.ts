import type { DashboardDto } from "@munim/core";
import type { HttpClient } from "../http.js";

export function dashboard(http: HttpClient) {
  return {
    /** GET /api/dashboard — mirrors core `getDashboard(db, period)`.
     *  `from`/`to` scope the period KPI tiles (dashboard chips). */
    get(period?: { from?: string; to?: string }): Promise<DashboardDto> {
      return http.get("/api/dashboard", { ...period });
    },
  };
}

export type DashboardEndpoints = ReturnType<typeof dashboard>;
