import type { DashboardDto } from "@munim/core";
import type { HttpClient } from "../http.js";

export function dashboard(http: HttpClient) {
  return {
    /** GET /api/dashboard — mirrors core `getDashboard(db)`. */
    get(): Promise<DashboardDto> {
      return http.get("/api/dashboard");
    },
  };
}

export type DashboardEndpoints = ReturnType<typeof dashboard>;
