import type { DbClient } from "../db/client";
import * as schema from "../db/schema";
export declare function resolveColorId(db: DbClient, name: string): Promise<string>;
export declare function resolveSizeId(db: DbClient, name: string): Promise<string>;
export declare function resolveCategoryId(db: DbClient, name: string): Promise<string | null>;
export type ProductFilters = {
    search?: string;
    color?: string;
    size?: string;
    category?: string;
    status?: "in_stock" | "low_stock" | "out_of_stock" | "all";
    page?: number;
    pageSize?: number;
};
export type ProductWithMeta = schema.Product & {
    colorName: string | null;
    sizeName: string | null;
    categoryName: string | null;
};
export declare function listProducts(db: DbClient, filters?: ProductFilters): Promise<{
    products: {
        colorName: string | null;
        sizeName: string | null;
        categoryName: string | null;
        id: string;
        sku: string;
        name: string;
        barcode: string | null;
        imageUrl: string | null;
        stock: number;
        purchasePrice: number;
        sellingPrice: number;
        notes: string | null;
        lowStockThreshold: number;
        colorId: string | null;
        sizeId: string | null;
        categoryId: string | null;
        createdAt: Date;
        updatedAt: Date;
    }[];
    pagination: {
        page: number;
        pageSize: number;
        totalCount: number;
        totalPages: number;
    };
}>;
export declare function getProduct(db: DbClient, id: string): Promise<{
    colorName: string | null;
    sizeName: string | null;
    categoryName: string | null;
    id: string;
    sku: string;
    name: string;
    barcode: string | null;
    imageUrl: string | null;
    stock: number;
    purchasePrice: number;
    sellingPrice: number;
    notes: string | null;
    lowStockThreshold: number;
    colorId: string | null;
    sizeId: string | null;
    categoryId: string | null;
    createdAt: Date;
    updatedAt: Date;
} | null>;
export declare function listAllProducts(db: DbClient): Promise<ProductWithMeta[]>;
export type ProductInput = {
    name: string;
    color: string;
    size: string;
    category?: string;
    barcode?: string;
    imageUrl?: string;
    stock?: number;
    purchasePrice?: number;
    sellingPrice?: number;
    lowStockThreshold?: number;
    notes?: string;
};
export declare class ProductError extends Error {
    code: string;
    status: number;
    constructor(message: string, code: string, status?: number);
}
export declare function createProduct(db: DbClient, input: ProductInput): Promise<{
    colorName: string | null;
    sizeName: string | null;
    categoryName: string | null;
    id: string;
    sku: string;
    name: string;
    barcode: string | null;
    imageUrl: string | null;
    stock: number;
    purchasePrice: number;
    sellingPrice: number;
    notes: string | null;
    lowStockThreshold: number;
    colorId: string | null;
    sizeId: string | null;
    categoryId: string | null;
    createdAt: Date;
    updatedAt: Date;
} | null>;
export declare function updateProduct(db: DbClient, id: string, input: ProductInput): Promise<{
    colorName: string | null;
    sizeName: string | null;
    categoryName: string | null;
    id: string;
    sku: string;
    name: string;
    barcode: string | null;
    imageUrl: string | null;
    stock: number;
    purchasePrice: number;
    sellingPrice: number;
    notes: string | null;
    lowStockThreshold: number;
    colorId: string | null;
    sizeId: string | null;
    categoryId: string | null;
    createdAt: Date;
    updatedAt: Date;
} | null>;
export declare function deleteProduct(db: DbClient, id: string): Promise<{
    success: boolean;
}>;
export type StockAdjustmentInput = {
    adjustment: number;
    reason?: string;
};
export declare function adjustStock(db: DbClient, id: string, input: StockAdjustmentInput): Promise<{
    colorName: string | null;
    sizeName: string | null;
    categoryName: string | null;
    id: string;
    sku: string;
    name: string;
    barcode: string | null;
    imageUrl: string | null;
    stock: number;
    purchasePrice: number;
    sellingPrice: number;
    notes: string | null;
    lowStockThreshold: number;
    colorId: string | null;
    sizeId: string | null;
    categoryId: string | null;
    createdAt: Date;
    updatedAt: Date;
} | null>;
export declare function listStockMovements(db: DbClient, productId?: string, limit?: number): Promise<{
    id: string;
    productId: string;
    type: "PURCHASE" | "SALE" | "ADJUSTMENT" | "RETURN" | "WASTE";
    quantity: number;
    stockAfter: number;
    referenceType: string | null;
    referenceId: string | null;
    note: string | null;
    createdAt: Date;
}[]>;
export declare function seedProducts(db: DbClient): Promise<{
    success: boolean;
    count: number;
}>;
export declare function listMeta(db: DbClient): Promise<{
    colors: string[];
    sizes: string[];
    categories: string[];
}>;
export declare function addColor(db: DbClient, name: string): Promise<{
    id: string;
    name: string;
    createdAt: Date;
} | undefined>;
export declare function addSize(db: DbClient, name: string): Promise<{
    id: string;
    name: string;
    createdAt: Date;
} | undefined>;
export declare function addCategory(db: DbClient, name: string): Promise<{
    id: string;
    name: string;
    createdAt: Date;
} | undefined>;
//# sourceMappingURL=products.d.ts.map