import type { HttpClient } from "../http.js";

export function health(http: HttpClient) {
  return {
    /** GET /healthz — liveness (public, no key needed). */
    health(): Promise<{ status: "ok" }> {
      return http.get("/healthz");
    },
    /** GET /readyz — readiness (DB ping; 503 when unreachable). */
    ready(): Promise<{ status: "ok" }> {
      return http.get("/readyz");
    },
  };
}

export type HealthEndpoints = ReturnType<typeof health>;
