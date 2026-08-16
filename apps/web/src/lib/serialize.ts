import type { Product as CoreProduct } from "@munim/core";
import type { Product as ProductDto } from "@/lib/types";

// Core product rows carry colorName/sizeName (from joins). This serializer
// flattens them into the string shape the client components expect.
export type ProductWithNames = CoreProduct & {
  colorName: string | null;
  sizeName: string | null;
  categoryName?: string | null;
};

export function serializeProduct(p: ProductWithNames): ProductDto {
  return {
    id: p.id,
    sku: p.sku,
    name: p.name,
    color: p.colorName ?? "",
    size: p.sizeName ?? "",
    category: p.categoryName ?? "",
    barcode: p.barcode,
    weight: p.weight,
    imageUrl: p.imageUrl,
    stock: p.stock,
    purchasePrice: p.purchasePrice,
    sellingPrice: p.sellingPrice,
    notes: p.notes,
    lowStockThreshold: p.lowStockThreshold,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}
