/**
 * Wire types for the Munim API — re-exported from @munim/core (the single
 * source of truth). NEVER redefine a domain type here; if a shape is missing,
 * add it to packages/core/src/serialize (or the service exports) and re-export.
 */
import type {
  ProductDto,
  SaleDto,
  InvoiceDto,
  InvoiceItemDto,
  PartyDto,
  PartyBalanceDto,
  LedgerLineDto,
  AdvanceDto,
  PaymentDto,
  JobLetterDto,
  StockMovementDto,
  ActivityLogDto,
  SettingsDto,
  DashboardDto,
  ReportDto,
  Pagination,
  ProductFilters,
  InvoiceFilters,
  CatalogKind,
  CatalogItem,
  ReportType,
  ReportRow,
  ProductFormValues,
  StockAdjustmentValues,
  SaleFormValues,
  InvoiceFormValues,
  InvoicePaymentValues,
  PartyFormValues,
  PartyUpdateValues,
  PaymentFormValues,
  AdvanceFormValues,
  JobLetterFormValues,
  SettingsFormValues,
  ReportQueryValues,
} from "@munim/core";

export type {
  /* DTOs (serialize module) */
  ProductDto,
  SaleDto,
  InvoiceDto,
  InvoiceItemDto,
  PartyDto,
  PartyBalanceDto,
  LedgerLineDto,
  AdvanceDto,
  PaymentDto,
  JobLetterDto,
  StockMovementDto,
  ActivityLogDto,
  SettingsDto,
  DashboardDto,
  ReportDto,
  Pagination,
  /* Query/filter types (services) */
  ProductFilters,
  InvoiceFilters,
  CatalogKind,
  CatalogItem,
  ReportType,
  ReportRow,
  /* Form value types (validators) */
  ProductFormValues,
  StockAdjustmentValues,
  SaleFormValues,
  InvoiceFormValues,
  InvoicePaymentValues,
  PartyFormValues,
  PartyUpdateValues,
  PaymentFormValues,
  AdvanceFormValues,
  JobLetterFormValues,
  SettingsFormValues,
  ReportQueryValues,
};

/** GET /api/parties?balances=true — the khata "who owes whom" shape. */
export type PartyBalancesResult = {
  balances: PartyBalanceDto[];
  receivables: PartyBalanceDto[];
  payables: PartyBalanceDto[];
};

/** GET /api/parties/:id — party plus its full ledger. */
export type PartyDetail = {
  party: PartyDto;
  ledger: { lines: LedgerLineDto[]; balance: number };
};

/** GET /api/products/meta — the catalog option lists for filters/forms. */
export type ProductMeta = {
  colors: string[];
  sizes: string[];
  categories: string[];
};
