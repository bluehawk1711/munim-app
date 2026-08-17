/**
 * Shared query keys — the cache contract for @munim/query.
 *
 * Keys mirror the API's cache groups (packages/api/src/common/cache.keys.ts):
 * a mutation invalidates the same prefixes the Upstash layer clears, so the
 * client cache and the server cache stay in agreement.
 */
import type {
  ProductFilters,
  InvoiceFilters,
  CatalogKind,
  ReportQueryValues,
} from "@munim/core";

export const qk = {
  dashboard: ["dashboard"] as const,

  products: {
    all: ["products"] as const,
    list: (filters: ProductFilters) => ["products", "list", filters] as const,
    detail: (id: string) => ["products", "detail", id] as const,
    meta: ["products", "meta"] as const,
    movements: (id: string) => ["products", "movements", id] as const,
  },

  invoices: {
    all: ["invoices"] as const,
    list: (filters: InvoiceFilters) =>
      ["invoices", "list", filters] as const,
    detail: (id: string) => ["invoices", "detail", id] as const,
  },

  sales: {
    all: ["sales"] as const,
    list: (filters: Record<string, unknown>) =>
      ["sales", "list", filters] as const,
  },

  parties: {
    all: ["parties"] as const,
    balances: ["parties", "balances"] as const,
    list: (type?: string, search?: string) =>
      ["parties", "list", type ?? "all", search ?? ""] as const,
    detail: (id: string) => ["parties", "detail", id] as const,
  },

  advances: {
    all: ["advances"] as const,
    list: (partyId?: string) => ["advances", partyId ?? "all"] as const,
  },

  payments: {
    all: ["payments"] as const,
    list: (partyId?: string) => ["payments", partyId ?? "all"] as const,
  },

  jobLetters: {
    all: ["job-letters"] as const,
  },

  catalog: {
    all: ["catalog"] as const,
    list: (kind: CatalogKind) => ["catalog", kind] as const,
  },

  reports: {
    all: ["reports"] as const,
    get: (query: ReportQueryValues) => ["reports", "get", query] as const,
  },

  settings: ["settings"] as const,
};
