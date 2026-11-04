import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  NotFoundException,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from "@nestjs/common";
import {
  adjustStock,
  backfillBarcodes,
  bulkProductSchema,
  bulkUpdateProducts,
  createProduct,
  deleteProduct,
  findProductByCode,
  getCategoryBreakdown,
  getInventoryStats,
  getProduct,
  listMeta,
  listProducts,
  listStockMovements,
  productSchema,
  serializeProduct,
  stockAdjustmentSchema,
  syncProductPrices,
  updateProduct,
  type DbClient,
  type ProductFilters,
  type ProductFormValues,
  type StockAdjustmentValues,
} from "@munim/core";
import { DRIZZLE } from "../db/drizzle.provider.js";
import { ZodValidationPipe } from "../common/validation.pipe.js";
import { CacheService } from "../common/cache.service.js";
import { CACHE_TTL, cacheKeys, invalidate } from "../common/cache.keys.js";

/** The product filter params every product endpoint accepts (list, stats, by-category). */
type ProductFilterQuery = {
  search?: string;
  type?: string;
  color?: string;
  size?: string;
  category?: string;
  article?: string;
  status?: string;
  priceMode?: string;
  uncategorized?: string;
};

/** Pagination-free filters — shared by the list and the aggregates so both
 *  describe the same slice of the catalog. */
function productFiltersFrom(q: ProductFilterQuery): ProductFilters {
  return {
    search: q.search,
    type: q.type,
    color: q.color,
    size: q.size,
    category: q.category,
    article: q.article,
    status: (q.status ?? undefined) as ProductFilters["status"],
    priceMode: q.priceMode === "auto" || q.priceMode === "manual" ? q.priceMode : undefined,
    uncategorized: q.uncategorized === "true" || q.uncategorized === "1" ? true : undefined,
  };
}

@Controller("products")
export class ProductsController {
  constructor(
    @Inject(DRIZZLE) private readonly db: DbClient,
    @Inject(CacheService) private readonly cache: CacheService,
  ) {}

  @Get()
  async list(
    @Query("search") search?: string,
    @Query("type") type?: string,
    @Query("color") color?: string,
    @Query("size") size?: string,
    @Query("category") category?: string,
    @Query("article") article?: string,
    @Query("status") status?: string,
    @Query("priceMode") priceMode?: string,
    @Query("uncategorized") uncategorized?: string,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
  ) {
    const filters: ProductFilters = {
      ...productFiltersFrom({ search, type, color, size, category, article, status, priceMode, uncategorized }),
      page: page ? Math.max(1, parseInt(page, 10) || 1) : undefined,
      pageSize: pageSize ? Math.max(1, Math.min(1000, parseInt(pageSize, 10) || 20)) : undefined,
    };
    return this.cache.cacheAside(cacheKeys.productsList(filters), CACHE_TTL.static, async () => {
      const { products, pagination } = await listProducts(this.db, filters);
      return {
        products: products.map((p) => serializeProduct(p)),
        pagination,
      };
    });
  }

  @Get("meta")
  async meta() {
    return this.cache.cacheAside(cacheKeys.productsMeta, CACHE_TTL.static, () => listMeta(this.db));
  }

  /** Aggregate header stats for the products page (valuation, weight, health…).
   *  Accepts the page's filters so the tiles follow the active filter set. */
  @Get("stats")
  async stats(
    @Query("search") search?: string,
    @Query("type") type?: string,
    @Query("color") color?: string,
    @Query("size") size?: string,
    @Query("category") category?: string,
    @Query("article") article?: string,
    @Query("status") status?: string,
    @Query("priceMode") priceMode?: string,
    @Query("uncategorized") uncategorized?: string,
  ) {
    const filters = productFiltersFrom({ search, type, color, size, category, article, status, priceMode, uncategorized });
    return this.cache.cacheAside(cacheKeys.productsStats(filters), CACHE_TTL.dashboard, () =>
      getInventoryStats(this.db, filters),
    );
  }

  /** Per-category inventory breakdown — drives the donut chart on the products page. */
  @Get("by-category")
  async byCategory(
    @Query("search") search?: string,
    @Query("type") type?: string,
    @Query("color") color?: string,
    @Query("size") size?: string,
    @Query("category") category?: string,
    @Query("article") article?: string,
    @Query("status") status?: string,
    @Query("priceMode") priceMode?: string,
    @Query("uncategorized") uncategorized?: string,
  ) {
    const filters = productFiltersFrom({ search, type, color, size, category, article, status, priceMode, uncategorized });
    return this.cache.cacheAside(cacheKeys.productsByCategory(filters), CACHE_TTL.dashboard, () =>
      getCategoryBreakdown(this.db, filters),
    );
  }

  @Get("lookup")
  async lookup(@Query("barcode") barcode?: string) {
    if (!barcode?.trim()) {
      throw new NotFoundException("Missing barcode or SKU");
    }
    const product = await this.cache.cacheAside(
      cacheKeys.productLookup(barcode),
      CACHE_TTL.detail,
      () => findProductByCode(this.db, barcode),
    );
    if (!product) throw new NotFoundException("No product with that barcode or SKU");
    return serializeProduct(product);
  }

  @Get(":id")
  async get(@Param("id") id: string) {
    const product = await this.cache.cacheAside(cacheKeys.product(id), CACHE_TTL.detail, () =>
      getProduct(this.db, id),
    );
    if (!product) throw new NotFoundException("Product not found");
    return serializeProduct(product);
  }

  @Post()
  async create(@Body(new ZodValidationPipe(productSchema)) values: ProductFormValues) {
    const product = await createProduct(this.db, values);
    if (!product) throw new Error("Product creation returned no row");
    await invalidate(this.cache, ["products"]);
    return serializeProduct(product);
  }

  @Put(":id")
  async update(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(productSchema)) values: ProductFormValues,
  ) {
    const product = await updateProduct(this.db, id, values);
    if (!product) throw new Error("Product update returned no row");
    await invalidate(this.cache, ["products"]);
    return serializeProduct(product);
  }

  /** PATCH /api/products/bulk — apply one patch to many selected products
   *  (bulk edit). Declared before the parameterised :id routes. */
  @Patch("bulk")
  async bulkUpdate(@Body(new ZodValidationPipe(bulkProductSchema)) values: {
    ids: string[];
    patch: Parameters<typeof bulkUpdateProducts>[1]["patch"];
  }) {
    const result = await bulkUpdateProducts(this.db, values);
    await invalidate(this.cache, ["products"]);
    return result;
  }

  @Patch(":id/stock")
  async adjust(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(stockAdjustmentSchema)) values: StockAdjustmentValues,
  ) {
    const product = await adjustStock(this.db, id, values);
    if (!product) throw new Error("Stock adjustment returned no row");
    await invalidate(this.cache, ["products"]);
    return serializeProduct(product);
  }

  @Get(":id/movements")
  async movements(@Param("id") id: string) {
    return this.cache.cacheAside(cacheKeys.productMovements(id), CACHE_TTL.lists, () =>
      listStockMovements(this.db, id),
    );
  }

  @Delete(":id")
  async remove(@Param("id") id: string) {
    const product = await getProduct(this.db, id);
    if (!product) throw new NotFoundException("Product not found");
    await deleteProduct(this.db, id);
    await invalidate(this.cache, ["products"]);
    return { success: true };
  }

  @Post("backfill-barcodes")
  async backfill() {
    const result = await backfillBarcodes(this.db);
    await invalidate(this.cache, ["products"]);
    return result;
  }

  /**
   * POST /api/products/sync-prices — "Recalculate prices" on every app.
   *
   * Auto-priced metal products compute their price on read; this freezes the
   * CURRENT computed price into `selling_price` (idempotent, skips rows that
   * already match) so lists, exports and fallbacks reflect today's rates.
   */
  @Post("sync-prices")
  async syncPrices() {
    const result = await syncProductPrices(this.db);
    await invalidate(this.cache, ["products"]);
    return result;
  }
}
