"use client"

/**
 * Web order hooks — thin re-exports of the shared @munim/query hooks so all
 * three apps call the API through one layer (keys, caching, invalidation).
 */
import {
  useOrders,
  useOrder,
  useCreateOrder,
  useUpdateOrder,
  useDeleteOrder,
  useGenerateOrderBill,
} from "@munim/query"

export {
  useOrders,
  useOrder,
  useCreateOrder,
  useUpdateOrder,
  useDeleteOrder,
  useGenerateOrderBill,
}
