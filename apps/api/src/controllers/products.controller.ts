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
  createProduct,
  deleteProduct,
  findProductByBarcode,
  getProduct,
  listMeta,
  listProducts,
  listStockMovements,
  productSchema,
  serializeProduct,
  stockAdjustmentSchema,
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

@Controller("products")
export class ProductsController {
  constructor(
    @Inject(DRIZZLE) private readonly db: DbClient,
    @Inject(CacheService) private readonly cache: CacheService,
  ) {}

  @Get()
  async list(
    @Query("search") search?: string,
    @Query("color") color?: string,
    @Query("size") size?: string,
    @Query("category") category?: string,
    @Query("status") status?: string,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
  ) {
    const filters: ProductFilters = {
      search,
      color,
      size,
      category,
      status: (status ?? undefined) as ProductFilters["status"],
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

  @Get("lookup")
  async lookup(@Query("barcode") barcode?: string) {
    if (!barcode?.trim()) {
      throw new NotFoundException("Missing barcode");
    }
    const product = await this.cache.cacheAside(
      cacheKeys.productLookup(barcode),
      CACHE_TTL.detail,
      () => findProductByBarcode(this.db, barcode),
    );
    if (!product) throw new NotFoundException("No product with that barcode");
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
}
