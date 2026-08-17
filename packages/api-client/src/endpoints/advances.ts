import type { AdvanceDto, AdvanceFormValues } from "@munim/core";
import type { HttpClient } from "../http.js";

export function advances(http: HttpClient) {
  return {
    /** GET /api/advances?partyId=… — mirrors core `listAdvances(db, partyId)`. */
    list(partyId?: string): Promise<AdvanceDto[]> {
      return http.get("/api/advances", { partyId });
    },
    /** POST /api/advances — mirrors core `createAdvance(db, values)`. */
    create(values: AdvanceFormValues): Promise<AdvanceDto> {
      return http.post("/api/advances", values);
    },
    /** POST /api/advances/:id/settle — mirrors core `settleAdvance`. */
    settle(id: string): Promise<AdvanceDto> {
      return http.post(`/api/advances/${id}/settle`);
    },
    /** DELETE /api/advances/:id */
    remove(id: string): Promise<{ success: boolean }> {
      return http.del(`/api/advances/${id}`);
    },
  };
}

export type AdvancesEndpoints = ReturnType<typeof advances>;
