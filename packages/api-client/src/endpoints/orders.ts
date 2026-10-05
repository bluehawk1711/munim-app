import type {
  BillFromOrderResult,
  InvoiceDto,
  OrderDto,
  OrderFilters,
  OrderFormValues,
  OrderUpdateValues,
  Pagination,
} from "@munim/core";
import type { HttpClient } from "../http.js";

export function orders(http: HttpClient) {
  return {
    /** GET /api/orders — mirrors core `listOrders(db, filters)`. */
    list(filters?: OrderFilters): Promise<{ orders: OrderDto[]; pagination: Pagination }> {
      return http.get("/api/orders", { ...filters });
    },
    /** GET /api/orders/:id */
    get(id: string): Promise<OrderDto> {
      return http.get(`/api/orders/${id}`);
    },
    /** POST /api/orders — mirrors core `createOrder(db, values)`. */
    create(values: OrderFormValues): Promise<OrderDto> {
      return http.post("/api/orders", values);
    },
    /** PATCH /api/orders/:id — edit an open order (blocked after billing). */
    update(id: string, values: OrderUpdateValues): Promise<OrderDto> {
      return http.patch(`/api/orders/${id}`, values);
    },
    /** POST /api/orders/:id/bill — quoted lines → invoice (stock checked now). */
    generateBill(id: string): Promise<BillFromOrderResult> {
      return http.post(`/api/orders/${id}/bill`, {});
    },
    /** DELETE /api/orders/:id — blocked once a bill exists. */
    remove(id: string): Promise<{ success: boolean }> {
      return http.del(`/api/orders/${id}`);
    },
  };
}

export type OrdersEndpoints = ReturnType<typeof orders>;
