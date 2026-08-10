import { count, desc, eq, sql } from "drizzle-orm";
import type { DbClient } from "../db/client";
import * as schema from "../db/schema";
import { logActivity } from "./activity";
import { addColor, addSize, ProductError } from "./products";

/**
 * Catalog (colors / sizes) management — SHARED by all three apps.
 *
 * The web app previously had this logic inline in its API routes; desktop and
 * mobile had none. This module is the single source of truth:
 *
 *   - listCatalogItems(db, kind)  → items with a productCount (real row ids)
 *   - createCatalogItem(...)      → duplicate-guarded create (reuses addColor/addSize)
 *   - renameCatalogItem(...)      → duplicate + existence guarded rename
 *   - deleteCatalogItem(...)      → refuses to delete colors/sizes still in use
 *
 * All mutations write an activity log so the trail is consistent everywhere.
 */

export type CatalogKind = "color" | "size";

export type CatalogItem = {
  id: string;
  name: string;
  createdAt: string;
  productCount: number;
};

function tableFor(kind: CatalogKind) {
  return kind === "color" ? schema.colors : schema.sizes;
}

function fkFor(kind: CatalogKind) {
  return kind === "color" ? schema.products.colorId : schema.products.sizeId;
}

const LABELS: Record<CatalogKind, string> = { color: "color", size: "size" };

export async function listCatalogItems(db: DbClient, kind: CatalogKind): Promise<CatalogItem[]> {
  const table = tableFor(kind);
  const fk = fkFor(kind);
  const rows = await db
    .select({
      id: table.id,
      name: table.name,
      createdAt: table.createdAt,
      productCount: count(schema.products.id),
    })
    .from(table)
    .leftJoin(schema.products, eq(fk, table.id))
    .groupBy(table.id, table.name, table.createdAt)
    .orderBy(desc(table.createdAt));
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    createdAt: r.createdAt.toISOString(),
    productCount: r.productCount,
  }));
}

async function getCatalogItem(db: DbClient, kind: CatalogKind, id: string): Promise<CatalogItem | null> {
  const table = tableFor(kind);
  const fk = fkFor(kind);
  const rows = await db
    .select({
      id: table.id,
      name: table.name,
      createdAt: table.createdAt,
      productCount: count(schema.products.id),
    })
    .from(table)
    .leftJoin(schema.products, eq(fk, table.id))
    .where(eq(table.id, id))
    .groupBy(table.id, table.name, table.createdAt);
  const r = rows[0];
  return r
    ? { id: r.id, name: r.name, createdAt: r.createdAt.toISOString(), productCount: r.productCount }
    : null;
}

export async function createCatalogItem(db: DbClient, kind: CatalogKind, name: string): Promise<CatalogItem> {
  const trimmed = name.trim();
  const row = kind === "color" ? await addColor(db, trimmed) : await addSize(db, trimmed);
  if (!row) throw new ProductError(`Failed to create ${LABELS[kind]}`, "CREATE_FAILED", 500);
  return { id: row.id, name: row.name, createdAt: row.createdAt.toISOString(), productCount: 0 };
}

export async function renameCatalogItem(db: DbClient, kind: CatalogKind, id: string, name: string): Promise<CatalogItem> {
  const table = tableFor(kind);
  const trimmed = name.trim();
  const label = LABELS[kind];

  const existing = await db.select().from(table).where(eq(table.id, id));
  if (!existing[0]) throw new ProductError(`${label} not found`, "NOT_FOUND", 404);

  const dup = await db.select().from(table).where(eq(table.name, trimmed));
  if (dup[0] && dup[0].id !== id) {
    throw new ProductError(`${label} "${trimmed}" already exists`, "DUPLICATE", 409);
  }

  await db.update(table).set({ name: trimmed }).where(eq(table.id, id));
  await logActivity(
    db,
    kind === "color" ? "COLOR_RENAMED" : "SIZE_RENAMED",
    `Renamed ${label} "${existing[0].name}" → "${trimmed}"`,
  );
  const updated = await getCatalogItem(db, kind, id);
  if (!updated) throw new ProductError(`${label} not found`, "NOT_FOUND", 404);
  return updated;
}

export async function deleteCatalogItem(db: DbClient, kind: CatalogKind, id: string): Promise<{ success: boolean }> {
  const table = tableFor(kind);
  const fk = fkFor(kind);
  const label = LABELS[kind];

  const existing = await db.select().from(table).where(eq(table.id, id));
  if (!existing[0]) throw new ProductError(`${label} not found`, "NOT_FOUND", 404);

  const inUse = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.products)
    .where(eq(fk, id));
  if ((inUse[0]?.count ?? 0) > 0) {
    throw new ProductError(
      `Cannot delete "${existing[0].name}" — it is used by ${inUse[0]?.count} product(s).`,
      "IN_USE",
      400,
    );
  }

  await db.delete(table).where(eq(table.id, id));
  await logActivity(db, kind === "color" ? "COLOR_DELETED" : "SIZE_DELETED", `Deleted ${label} "${existing[0].name}"`);
  return { success: true };
}
