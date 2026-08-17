import type { PartyDto, PartyFormValues, PartyUpdateValues } from "@munim/core";
import type { HttpClient } from "../http.js";
import type { PartyBalancesResult, PartyDetail } from "../types.js";

/** GET /api/parties filters. */
export type PartyFilters = {
  type?: string;
  search?: string;
};

export function parties(http: HttpClient) {
  return {
    /** GET /api/parties — mirrors core `listParties(db, type, search)`. */
    list(filters?: PartyFilters): Promise<PartyDto[]> {
      return http.get("/api/parties", { ...filters });
    },
    /** GET /api/parties?balances=true — the khata "who owes whom" view. */
    balances(): Promise<PartyBalancesResult> {
      return http.get("/api/parties", { balances: "true" });
    },
    /** GET /api/parties/:id — party plus its full ledger. */
    get(id: string): Promise<PartyDetail> {
      return http.get(`/api/parties/${id}`);
    },
    /** POST /api/parties — mirrors core `createParty(db, values)`. */
    create(values: PartyFormValues): Promise<PartyDto> {
      return http.post("/api/parties", values);
    },
    /** PUT /api/parties/:id — mirrors core `updateParty(db, id, values)`. */
    update(id: string, values: PartyUpdateValues): Promise<PartyDto> {
      return http.put(`/api/parties/${id}`, values);
    },
    /** DELETE /api/parties/:id */
    remove(id: string): Promise<{ success: boolean }> {
      return http.del(`/api/parties/${id}`);
    },
  };
}

export type PartiesEndpoints = ReturnType<typeof parties>;
