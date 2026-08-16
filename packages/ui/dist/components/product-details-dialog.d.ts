/**
 * ProductDetailsDialog — shared read-only product detail view for web + desktop.
 *
 * One dialog, same fields everywhere: image, name, SKU, barcode (rendered with
 * the same BarcodeSvg as the list), color / size / category, weight, stock +
 * status, buy / sell price, low-stock threshold, notes, created / updated.
 *
 * The product shape is normalized at the call site (web Product DTO vs desktop
 * ProductWithMeta) so this component stays app-agnostic.
 */
import * as React from "react";
export type ProductDetails = {
    id: string;
    name: string;
    sku: string;
    barcode: string | null;
    color?: string | null;
    size?: string | null;
    category?: string | null;
    /** Weight in milligrams. */
    weight: number | null;
    imageUrl: string | null;
    stock: number;
    lowStockThreshold: number;
    purchasePrice: number;
    sellingPrice: number;
    notes: string | null;
    createdAt: string;
    updatedAt: string;
};
export declare function ProductDetailsDialog({ open, onOpenChange, product, formatCurrency, formatWeight, formatDate, }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    product: ProductDetails | null;
    formatCurrency: (n: number) => string;
    formatWeight: (mg: number | null | undefined) => string;
    formatDate: (date: string | Date) => string;
}): React.JSX.Element | null;
//# sourceMappingURL=product-details-dialog.d.ts.map