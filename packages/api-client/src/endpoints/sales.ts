import type { SaleDto, SaleFormValues } from "@munim/core";
import type { HttpClient } from "../http.js";
import type { QueryParams } from "../http.js";

/** Sales list filters — flattened invoices (matches the web /api/sales). */
export type SaleFilters = {
  search?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
};

export function sales(http: HttpClient) {
  return {
    /** GET /api/sales — flattened sale rows (mirrors core listInvoices → serializeSale). */
    list(filters?: SaleFilters): Promise<SaleDto[]> {
      return http.get("/api/sales", { ...filters } as QueryParams);
    },
    /** POST /api/sales — quick single-product sale (mirrors core `createSale`). */
    create(values: SaleFormValues): Promise<SaleDto> {
      return http.post("/api/sales", values);
    },
    /** DELETE /api/sales/:id — undo a sale (stock restore via core `deleteInvoice`). */
    remove(id: string): Promise<{ success: boolean }> {
      return http.del(`/api/sales/${id}`);
    },
  };
}

export type SalesEndpoints = ReturnType<typeof sales>;
