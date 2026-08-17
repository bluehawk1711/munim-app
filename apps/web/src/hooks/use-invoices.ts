"use client"

/**
 * Web invoice hooks — thin re-exports of the shared @munim/query hooks.
 * `useRecordPayment` is aliased to the shared invoice-payment hook (the
 * shared package splits invoice vs party payments into two hooks).
 */
import type { InvoiceFormValues } from "@munim/core"
import {
  useInvoices,
  useInvoice,
  useCreateInvoice,
  useDeleteInvoice,
  useRecordInvoicePayment,
} from "@munim/query"

export { useInvoices, useInvoice, useCreateInvoice, useDeleteInvoice }
export { useRecordInvoicePayment as useRecordPayment }

/** The shared create-invoice input — same shape web's billing view already builds. */
export type CreateInvoiceInput = InvoiceFormValues
