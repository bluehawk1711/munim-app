import { count, desc, eq, sql } from "drizzle-orm";
import type { DbClient } from "../db/client.js";
import * as schema from "../db/schema.js";
import { logActivity } from "./activity.js";
import { ProductError, effectivePriceSql } from "./products.js";

/**
 * Articles — a product classification that behaves exactly like a category
 * (dedicated table + `products.articleId` FK, duplicate-guarded CRUD, delete
 * blocked while in use) plus the optional `code` and `description` fields.
 * SHARED by all three apps; `getArticlesAnalytics` powers the Articles page
 * analytics section (stock, sold units/weight, revenue, last sale, 6-month
 * trend) reusing the invoice-item aggregation patterns from dashboard/reports.
 */

export type ArticleDto = {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  /** Products currently linked to this article. */
  productCount: number;
};

export type ArticleInput = {
  name: string;
  code?: string | null;
  description?: string | null;
};

function toDto(row: {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
  productCount: number;
}): ArticleDto {
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    description: row.description,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    productCount: row.productCount,
  };
}

export async function listArticles(db: DbClient): Promise<ArticleDto[]> {
  const rows = await db
    .select({
      id: schema.articles.id,
      name: schema.articles.name,
      code: schema.articles.code,
      description: schema.articles.description,
      createdAt: schema.articles.createdAt,
      updatedAt: schema.articles.updatedAt,
      productCount: count(schema.products.id),
    })
    .from(schema.articles)
    .leftJoin(schema.products, eq(schema.products.articleId, schema.articles.id))
    .groupBy(
      schema.articles.id,
      schema.articles.name,
      schema.articles.code,
      schema.articles.description,
      schema.articles.createdAt,
      schema.articles.updatedAt,
    )
    .orderBy(desc(schema.articles.createdAt));
  return rows.map(toDto);
}

async function getArticleRow(db: DbClient, id: string): Promise<ArticleDto | null> {
  const rows = await db
    .select({
      id: schema.articles.id,
      name: schema.articles.name,
      code: schema.articles.code,
      description: schema.articles.description,
      createdAt: schema.articles.createdAt,
      updatedAt: schema.articles.updatedAt,
      productCount: count(schema.products.id),
    })
    .from(schema.articles)
    .leftJoin(schema.products, eq(schema.products.articleId, schema.articles.id))
    .where(eq(schema.articles.id, id))
    .groupBy(
      schema.articles.id,
      schema.articles.name,
      schema.articles.code,
      schema.articles.description,
      schema.articles.createdAt,
      schema.articles.updatedAt,
    );
  const row = rows[0];
  return row ? toDto(row) : null;
}

export async function createArticle(db: DbClient, input: ArticleInput): Promise<ArticleDto> {
  const name = input.name.trim();
  if (!name) throw new ProductError("Article name is required", "INVALID", 400);
  const code = input.code?.trim() || null;
  const description = input.description?.trim() || null;

  const dup = await db.select({ id: schema.articles.id }).from(schema.articles).where(eq(schema.articles.name, name));
  if (dup[0]) throw new ProductError(`Article "${name}" already exists`, "DUPLICATE", 409);

  const [created] = await db
    .insert(schema.articles)
    .values({ name, code, description })
    .returning();
  if (!created) throw new ProductError("Failed to create article", "CREATE_FAILED", 500);
  await logActivity(db, "ARTICLE_CREATED", `Created article "${name}"`);
  const dto = await getArticleRow(db, created.id);
  if (!dto) throw new ProductError("Article not found", "NOT_FOUND", 404);
  return dto;
}

export async function updateArticle(db: DbClient, id: string, input: ArticleInput): Promise<ArticleDto> {
  const existing = await db.select().from(schema.articles).where(eq(schema.articles.id, id));
  if (!existing[0]) throw new ProductError("Article not found", "NOT_FOUND", 404);

  const name = input.name.trim();
  if (!name) throw new ProductError("Article name is required", "INVALID", 400);
  const dup = await db.select({ id: schema.articles.id }).from(schema.articles).where(eq(schema.articles.name, name));
  if (dup[0] && dup[0].id !== id) throw new ProductError(`Article "${name}" already exists`, "DUPLICATE", 409);

  const code = input.code?.trim() || null;
  const description = input.description?.trim() || null;
  await db
    .update(schema.articles)
    .set({ name, code, description, updatedAt: new Date() })
    .where(eq(schema.articles.id, id));

  const changed = existing[0].name !== name;
  await logActivity(
    db,
    "ARTICLE_UPDATED",
    changed ? `Renamed article "${existing[0].name}" → "${name}"` : `Updated article "${name}"`,
  );
  const dto = await getArticleRow(db, id);
  if (!dto) throw new ProductError("Article not found", "NOT_FOUND", 404);
  return dto;
}

export async function deleteArticle(db: DbClient, id: string): Promise<{ success: boolean }> {
  const existing = await db.select().from(schema.articles).where(eq(schema.articles.id, id));
  if (!existing[0]) throw new ProductError("Article not found", "NOT_FOUND", 404);

  const inUse = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.products)
    .where(eq(schema.products.articleId, id));
  if ((inUse[0]?.n ?? 0) > 0) {
    throw new ProductError(
      `Cannot delete "${existing[0].name}" — it is used by ${inUse[0]?.n} product(s).`,
      "IN_USE",
      400,
    );
  }

  await db.delete(schema.articles).where(eq(schema.articles.id, id));
  await logActivity(db, "ARTICLE_DELETED", `Deleted article "${existing[0].name}"`);
  return { success: true };
}

/* ── Analytics ────────────────────────────────────────────────── */

/** One row of per-article analytics for the Articles page. */
export type ArticleAnalyticsRow = {
  articleId: string;
  name: string;
  code: string | null;
  description: string | null;
  /** Products linked to the article. */
  productCount: number;
  /** Units on hand (sum of product stock). */
  stockUnits: number;
  /** On-hand weight, GRAMS (mg rows converted). */
  stockWeightGm: number;
  /** On-hand value — stock × effective price (auto price when priced). */
  stockValue: number;
  /** Units sold in the last 6 months. */
  soldUnits: number;
  /** Weight sold in the last 6 months, GRAMS — line-level frozen pricing. */
  soldWeightGm: number;
  /** Revenue in the last 6 months (invoice-line totals). */
  revenue: number;
  /** When a product of this article last sold (all time), ISO or null. */
  lastSaleAt: string | null;
  /** Revenue per month for `monthLabels` (oldest → newest). */
  trend: number[];
};

export type ArticlesAnalytics = {
  /** 6 month labels (e.g. "May") aligned with every row's `trend`. */
  monthLabels: string[];
  rows: ArticleAnalyticsRow[];
};

function monthRanges(now = new Date()): { label: string; start: Date; end: Date }[] {
  return Array.from({ length: 6 }, (_, i) => {
    const start = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
    const end = new Date(now.getFullYear(), now.getMonth() - 4 + i, 1);
    return {
      label: start.toLocaleDateString("en-IN", { month: "short" }),
      start,
      end,
    };
  });
}

/**
 * Per-article stock + sales analytics. Three parallel aggregations merged in
 * TS so articles without products/sales still appear (zeroed):
 *   1. stock (products grouped by articleId)
 *   2. last sale (all-time max invoice date per article)
 *   3. 6-month sold/revenue/trend (invoice items through the product)
 */
export async function getArticlesAnalytics(db: DbClient): Promise<ArticlesAnalytics> {
  const ranges = monthRanges();
  const windowStart = ranges[0]!.start;
  const windowEnd = ranges[5]!.end;

  const [articleRows, stockRows, soldRows, lastSaleRows, trendRows] = await Promise.all([
    db
      .select({
        id: schema.articles.id,
        name: schema.articles.name,
        code: schema.articles.code,
        description: schema.articles.description,
      })
      .from(schema.articles)
      .orderBy(desc(schema.articles.createdAt)),
    db
      .select({
        articleId: schema.products.articleId,
        productCount: count(schema.products.id),
        stockUnits: sql<number>`coalesce(sum(${schema.products.stock}),0)::float8`,
        stockWeightGm: sql<number>`coalesce(sum(${schema.products.stock} * case when ${schema.products.weightUnit} = 'mg' then coalesce(${schema.products.weight},0)/1000.0 else coalesce(${schema.products.weight},0) end),0)::float8`,
        stockValue: sql<number>`coalesce(sum(${schema.products.stock} * ${effectivePriceSql}),0)::float8`,
      })
      .from(schema.products)
      .where(sql`${schema.products.articleId} is not null`)
      .groupBy(schema.products.articleId),
    db
      .select({
        articleId: schema.products.articleId,
        soldUnits: sql<number>`coalesce(sum(${schema.invoiceItems.quantity}),0)::float8`,
        soldWeightGm: sql<number>`coalesce(sum(coalesce((${schema.invoiceItems.pricing} ->> 'weightGm')::float8, case when ${schema.invoiceItems.weightUnit} = 'mg' then ${schema.invoiceItems.weight}/1000.0 else ${schema.invoiceItems.weight} end) * ${schema.invoiceItems.quantity}),0)::float8`,
        revenue: sql<number>`coalesce(sum(${schema.invoiceItems.total}),0)::float8`,
      })
      .from(schema.invoiceItems)
      .innerJoin(schema.invoices, eq(schema.invoices.id, schema.invoiceItems.invoiceId))
      .innerJoin(schema.products, eq(schema.products.id, schema.invoiceItems.productId))
      .where(
        sql`${schema.products.articleId} is not null
            and ${schema.invoices.date} >= ${windowStart}
            and ${schema.invoices.date} < ${windowEnd}`,
      )
      .groupBy(schema.products.articleId),
    db
      .select({
        articleId: schema.products.articleId,
        lastSaleAt: sql<string | null>`max(${schema.invoices.date})`,
      })
      .from(schema.invoiceItems)
      .innerJoin(schema.invoices, eq(schema.invoices.id, schema.invoiceItems.invoiceId))
      .innerJoin(schema.products, eq(schema.products.id, schema.invoiceItems.productId))
      .where(sql`${schema.products.articleId} is not null`)
      .groupBy(schema.products.articleId),
    Promise.all(
      ranges.map((r) =>
        db
          .select({
            articleId: schema.products.articleId,
            revenue: sql<number>`coalesce(sum(${schema.invoiceItems.total}),0)::float8`,
          })
          .from(schema.invoiceItems)
          .innerJoin(schema.invoices, eq(schema.invoices.id, schema.invoiceItems.invoiceId))
          .innerJoin(schema.products, eq(schema.products.id, schema.invoiceItems.productId))
          .where(
            sql`${schema.products.articleId} is not null
                and ${schema.invoices.date} >= ${r.start}
                and ${schema.invoices.date} < ${r.end}`,
          )
          .groupBy(schema.products.articleId),
      ),
    ),
  ]);

  const stockBy = new Map(stockRows.map((r) => [r.articleId, r]));
  const soldBy = new Map(soldRows.map((r) => [r.articleId, r]));
  const lastBy = new Map(lastSaleRows.map((r) => [r.articleId, r.lastSaleAt]));
  // month index → { articleId → revenue }
  const trendMaps = trendRows.map((rows) => new Map(rows.map((r) => [r.articleId, r.revenue])));

  const round2 = (n: number) => Math.round(n * 100) / 100;
  const rows: ArticleAnalyticsRow[] = articleRows.map((a) => {
    const stock = stockBy.get(a.id);
    const sold = soldBy.get(a.id);
    return {
      articleId: a.id,
      name: a.name,
      code: a.code,
      description: a.description,
      productCount: stock?.productCount ?? 0,
      stockUnits: round2(stock?.stockUnits ?? 0),
      stockWeightGm: round2(stock?.stockWeightGm ?? 0),
      stockValue: round2(stock?.stockValue ?? 0),
      soldUnits: round2(sold?.soldUnits ?? 0),
      soldWeightGm: round2(sold?.soldWeightGm ?? 0),
      revenue: round2(sold?.revenue ?? 0),
      lastSaleAt: lastBy.get(a.id) ?? null,
      trend: trendMaps.map((m) => round2(m.get(a.id) ?? 0)),
    };
  });

  rows.sort((a, b) => b.revenue - a.revenue || b.stockValue - a.stockValue);

  return { monthLabels: ranges.map((r) => r.label), rows };
}
