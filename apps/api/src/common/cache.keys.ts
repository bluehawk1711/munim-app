import { createHash } from "node:crypto";
import type { CacheService } from "./cache.service.js";

/** TTLs (seconds). Safety nets — every write path invalidates explicitly. */
export const CACHE_TTL = {
  /** Dashboard aggregates shift with every transaction. */
  dashboard: 30,
  /** Lists (invoices, sales, parties, advances, payments, job letters). */
  lists: 120,
  /** Reports — cached per type + date range. */
  reports: 120,
  /** Single rows / lookups. */
  detail: 300,
  /** Catalog + settings are near-static. */
  static: 300,
} as const;

/** Stable short hash of a filter object (undefined/empty keys skipped). */
export function hashFilters(obj: Record<string, unknown>): string {
  const parts = Object.entries(obj)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${String(v)}`);
  if (parts.length === 0) return "all";
  return createHash("sha1").update(parts.join("&")).digest("hex").slice(0, 12);
}

/** Logical cache keys (the CacheService adds the `munim:` namespace). */
export const cacheKeys = {
  productsList: (f: Record<string, unknown>) => `products:list:${hashFilters(f)}`,
  product: (id: string) => `products:get:${id}`,
  productsMeta: "products:meta",
  productLookup: (barcode: string) => `products:lookup:${hashFilters({ barcode })}`,
  productMovements: (id: string) => `products:movements:${id}`,
  dashboard: "dashboard:get",
  catalogList: (kind: string) => `catalog:${kind}:list`,
  settings: "settings:get",
  report: (q: Record<string, unknown>) => `reports:${hashFilters(q)}`,
  invoicesList: (f: Record<string, unknown>) => `invoices:list:${hashFilters(f)}`,
  invoice: (id: string) => `invoices:get:${id}`,
  salesList: (f: Record<string, unknown>) => `sales:list:${hashFilters(f)}`,
  partiesList: (f: Record<string, unknown>) => `parties:list:${hashFilters(f)}`,
  partiesBalances: "parties:balances",
  party: (id: string) => `parties:get:${id}`,
  advancesList: (partyId?: string) => `advances:list:${partyId ?? "all"}`,
  paymentsList: (partyId?: string) => `payments:list:${partyId ?? "all"}`,
  jobLetters: "job-letters:list",
} as const;

/**
 * Invalidation groups. A write must invalidate every prefix that could hold
 * derived data. Deliberately conservative: a stale cache is worse than a
 * re-fetch, so each group leans toward "everything that touches the row".
 */
export const CACHE_GROUPS = {
  /** Product row / stock / barcode changes. */
  products: ["products", "dashboard", "reports"] as const,
  /** Invoice + payment writes (sales are invoices). */
  invoices: ["invoices", "sales", "parties", "advances", "payments", "dashboard", "reports"] as const,
  /** Party / ledger writes. */
  parties: ["parties", "advances", "payments", "dashboard", "reports"] as const,
  /** Advance + payment (money in/out) writes. */
  money: ["advances", "payments", "parties", "dashboard", "reports"] as const,
  /** Job letter writes. */
  jobLetters: ["job-letters", "dashboard"] as const,
  /** Catalog names are embedded in product rows. */
  catalog: ["catalog", "products"] as const,
  /** Settings — shop name/address render on dashboard + invoices. */
  settings: ["settings", "dashboard", "invoices", "sales"] as const,
} as const;

/** Invalidate all prefixes of the given groups (parallel, best-effort). */
export async function invalidate(cache: CacheService, groups: readonly (keyof typeof CACHE_GROUPS)[]): Promise<void> {
  const prefixes = groups.flatMap((g) => CACHE_GROUPS[g]);
  await Promise.all(prefixes.map((p) => cache.delByPrefix(p)));
}
