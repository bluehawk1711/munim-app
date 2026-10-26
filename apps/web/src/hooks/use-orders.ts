"use client"

/**
 * Web order hooks — thin re-exports of the shared @munim/query hooks so all
 * three apps call the API through one layer (keys, caching, invalidation).
 */
import {
  useOrders,
  useOrder,
  useOrderPayments,
  useCreateOrder,
  useUpdateOrder,
  useDeleteOrder,
  useGenerateOrderBill,
  useRecordOrderPayment,
} from "@munim/query"

export {
  useOrders,
  useOrder,
  useOrderPayments,
  useCreateOrder,
  useUpdateOrder,
  useDeleteOrder,
  useGenerateOrderBill,
  useRecordOrderPayment,
}
