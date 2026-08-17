import type {
  InvoiceDto,
  InvoiceFilters,
  InvoiceFormValues,
  InvoicePaymentValues,
  Pagination,
} from "@munim/core";
import type { HttpClient } from "../http.js";

export function invoices(http: HttpClient) {
  return {
    /** GET /api/invoices — mirrors core `listInvoices(db, filters)`. */
    list(filters?: InvoiceFilters): Promise<{ invoices: InvoiceDto[]; pagination: Pagination }> {
      return http.get("/api/invoices", { ...filters });
    },
    /** GET /api/invoices/:id */
    get(id: string): Promise<InvoiceDto> {
      return http.get(`/api/invoices/${id}`);
    },
    /** POST /api/invoices — mirrors core `createInvoice(db, values)`. */
    create(values: InvoiceFormValues): Promise<InvoiceDto> {
      return http.post("/api/invoices", values);
    },
    /** POST /api/invoices/:id/payment — mirrors core `recordInvoicePayment`. */
    recordPayment(id: string, values: InvoicePaymentValues): Promise<InvoiceDto> {
      return http.post(`/api/invoices/${id}/payment`, values);
    },
    /** DELETE /api/invoices/:id — restores stock (core `deleteInvoice`). */
    remove(id: string): Promise<{ success: boolean }> {
      return http.del(`/api/invoices/${id}`);
    },
  };
}

export type InvoicesEndpoints = ReturnType<typeof invoices>;
