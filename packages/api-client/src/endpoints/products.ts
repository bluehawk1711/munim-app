import type {
  ProductDto,
  ProductFilters,
  ProductFormValues,
  StockAdjustmentValues,
  StockMovementDto,
  Pagination,
} from "@munim/core";
import type { HttpClient } from "../http.js";
import type { ProductMeta } from "../types.js";

export function products(http: HttpClient) {
  return {
    /** GET /api/products — mirrors core `listProducts(db, filters)`. */
    list(filters?: ProductFilters): Promise<{ products: ProductDto[]; pagination: Pagination }> {
      return http.get("/api/products", { ...filters });
    },
    /** GET /api/products/meta — colors/sizes/categories option lists. */
    meta(): Promise<ProductMeta> {
      return http.get("/api/products/meta");
    },
    /** GET /api/products/lookup?barcode=… — fast shop-counter lookup. */
    byBarcode(barcode: string): Promise<ProductDto> {
      return http.get("/api/products/lookup", { barcode });
    },
    /** GET /api/products/:id */
    get(id: string): Promise<ProductDto> {
      return http.get(`/api/products/${id}`);
    },
    /** POST /api/products — mirrors core `createProduct(db, values)`. */
    create(values: ProductFormValues): Promise<ProductDto> {
      return http.post("/api/products", values);
    },
    /** PUT /api/products/:id — mirrors core `updateProduct(db, id, values)`. */
    update(id: string, values: ProductFormValues): Promise<ProductDto> {
      return http.put(`/api/products/${id}`, values);
    },
    /** PATCH /api/products/:id/stock — mirrors core `adjustStock`. */
    adjustStock(id: string, values: StockAdjustmentValues): Promise<ProductDto> {
      return http.patch(`/api/products/${id}/stock`, values);
    },
    /** GET /api/products/:id/movements — stock audit trail. */
    movements(id: string): Promise<StockMovementDto[]> {
      return http.get(`/api/products/${id}/movements`);
    },
    /** DELETE /api/products/:id */
    remove(id: string): Promise<{ success: boolean }> {
      return http.del(`/api/products/${id}`);
    },
    /** POST /api/products/backfill-barcodes — safe backfill for old rows. */
    backfillBarcodes(): Promise<{ updated: number; total: number }> {
      return http.post("/api/products/backfill-barcodes");
    },
  };
}

export type ProductsEndpoints = ReturnType<typeof products>;
