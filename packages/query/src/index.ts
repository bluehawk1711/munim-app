/**
 * @munim/query — shared data layer.
 *
 * One API-calling layer for web, desktop and mobile: TanStack Query hooks over
 * the typed @munim/api-client. Reads are cached queries; writes are mutations
 * that invalidate the right keys. See docs/state-management.md.
 */
export { QueryProvider, useApiClient } from "./provider.js";
export type { GetClient, QueryProviderProps } from "./provider.js";
export { qk } from "./keys.js";
export { useQueryState } from "./use-query-state.js";

export { useDashboard } from "./use-dashboard.js";
export {
  useProducts,
  useProductMeta,
  useProductByBarcode,
  useProductMovements,
  useCreateProduct,
  useUpdateProduct,
  useDeleteProduct,
  useAdjustStock,
  useBackfillBarcodes,
} from "./use-products.js";
export {
  useInvoices,
  useInvoice,
  useCreateInvoice,
  useDeleteInvoice,
  useRecordInvoicePayment,
} from "./use-invoices.js";
export { useSales, useCreateSale, useUndoSale } from "./use-sales.js";
export type { SaleFilters } from "./use-sales.js";
export {
  useParties,
  usePartyBalances,
  useParty,
  useCreateParty,
  useUpdateParty,
  useDeleteParty,
  useAdvances,
  useCreateAdvance,
  useSettleAdvance,
  useDeleteAdvance,
  usePayments,
  useRecordPartyPayment,
} from "./use-parties.js";
export {
  useCatalog,
  useCreateCatalogItem,
  useUpdateCatalogItem,
  useDeleteCatalogItem,
} from "./use-catalog.js";
export type { CatalogItem, CatalogKind } from "./use-catalog.js";
export {
  useJobLetters,
  useSaveJobLetter,
  useDeleteJobLetter,
} from "./use-job-letters.js";
export { useReport } from "./use-reports.js";
export { useSettings, useUpdateSettings } from "./use-settings.js";
export { useUploadImage } from "./use-upload.js";
