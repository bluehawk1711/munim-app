import type { PaymentDto, PaymentFormValues } from "@munim/core";
import type { HttpClient } from "../http.js";

export function payments(http: HttpClient) {
  return {
    /** GET /api/payments?partyId=… — mirrors core `listPayments(db, partyId)`. */
    list(partyId?: string): Promise<PaymentDto[]> {
      return http.get("/api/payments", { partyId });
    },
    /** POST /api/payments — money in/out against a party (core `recordPayment`). */
    create(values: PaymentFormValues): Promise<PaymentDto> {
      return http.post("/api/payments", values);
    },
  };
}

export type PaymentsEndpoints = ReturnType<typeof payments>;
