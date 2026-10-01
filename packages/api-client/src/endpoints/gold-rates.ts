import type { GoldKaratsBackfillResult, GoldRatesDto, GoldRatesValues } from "@munim/core";
import type { HttpClient } from "../http.js";

export function goldRates(http: HttpClient) {
  return {
    /** GET /api/gold-rates — the whole 0–24 karat table (quoted + derived). */
    list(): Promise<GoldRatesDto> {
      return http.get("/api/gold-rates");
    },
    /** PUT /api/gold-rates — save the table (`isCustom: false` resets a karat). */
    save(values: GoldRatesValues): Promise<GoldRatesDto> {
      return http.put("/api/gold-rates", values);
    },
    /** POST /api/gold-rates/backfill-karats — fill karats from purity stamps. */
    backfillKarats(): Promise<GoldKaratsBackfillResult> {
      return http.post("/api/gold-rates/backfill-karats");
    },
  };
}

export type GoldRatesEndpoints = ReturnType<typeof goldRates>;
