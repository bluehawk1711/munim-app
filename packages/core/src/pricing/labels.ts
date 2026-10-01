/**
 * Product classification labels — the ONE place the UI derives
 * "Gold · 22K" / "Silver · 92.5 Stock" style labels from a product row, so
 * web, desktop and mobile never invent their own wording (spec §8).
 *
 * Classification rules (no new schema — reuses what the row already carries):
 *   Gold   → sub = `goldKarat` (e.g. "22K"), falling back to parsing the
 *            free-text `purity` stamp ("22K" / "916").
 *   Silver → sub = the category name (the shop's silver subcategories —
 *            "92.5 Stock", "92.5 Rodium", "Silver Items", or any category it
 *            creates later), falling back to the purity stamp ("925").
 *   Other types (Diamond/Platinum/Other) → metal only.
 */
import { karatFromPurity, toGoldKarat } from "./gold.js";

export type ProductClassification = {
  /** Metal line: "Gold" | "Silver" | "Diamond" | "Platinum" | "Other". */
  metal: string;
  /** Karat / silver subcategory text, or null when the product has none. */
  sub: string | null;
  /** Ready-to-render label, e.g. "Gold · 22K" or "Silver · 92.5 Stock". */
  text: string;
};

export type ClassifiableProduct = {
  type: string | null;
  /** Gold karat 0–24 (null when unset / backfill pending). */
  goldKarat?: number | null;
  /** Free-text purity stamp — "22K", "916", "925"… */
  purity?: string | null;
  /** Joined category name (silver subcategories live here). */
  categoryName?: string | null;
};

export function classifyProduct(product: ClassifiableProduct): ProductClassification {
  const metal = product.type?.trim() || "Other";

  if (metal === "Gold") {
    const karat = toGoldKarat(product.goldKarat) ?? karatFromPurity(product.purity);
    const sub = karat === null ? null : `${karat}K`;
    return { metal, sub, text: sub ? `${metal} · ${sub}` : metal };
  }

  if (metal === "Silver") {
    const category = product.categoryName?.trim() || null;
    const sub = (category ?? product.purity?.trim()) || null;
    return { metal, sub, text: sub ? `${metal} · ${sub}` : metal };
  }

  return { metal, sub: null, text: metal };
}

/**
 * Short badge text (fits chips/tables): "22K" for gold, the silver
 * subcategory for silver, otherwise the bare type.
 */
export function productBadgeLabel(product: ClassifiableProduct): string {
  return classifyProduct(product).text;
}
