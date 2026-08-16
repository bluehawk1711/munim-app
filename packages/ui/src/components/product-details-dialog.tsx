"use client"

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
import { Package, Ruler, Weight, Boxes, IndianRupee, FileText, CalendarDays, Tag, Layers } from "lucide-react";
import { BarcodeSvg } from "./barcode-svg";
import { Badge } from "./badge";
import { Button } from "./button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./dialog";
import { Separator } from "./separator";

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

export function ProductDetailsDialog({
  open,
  onOpenChange,
  product,
  formatCurrency,
  formatWeight,
  formatDate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: ProductDetails | null;
  formatCurrency: (n: number) => string;
  formatWeight: (mg: number | null | undefined) => string;
  formatDate: (date: string | Date) => string;
}) {
  if (!product) return null;

  const status =
    product.stock <= 0
      ? { label: "Out of stock", variant: "destructive" as const }
      : product.stock <= product.lowStockThreshold
        ? { label: "Low stock", variant: "warning" as const }
        : { label: "In stock", variant: "success" as const };

  const rows: { label: string; value: string; icon?: React.ReactNode }[] = [
    { label: "SKU", value: product.sku, icon: <Tag className="h-3.5 w-3.5" /> },
    { label: "Color", value: product.color || "—", icon: <Layers className="h-3.5 w-3.5" /> },
    { label: "Size", value: product.size || "—", icon: <Ruler className="h-3.5 w-3.5" /> },
    { label: "Category", value: product.category || "—", icon: <Boxes className="h-3.5 w-3.5" /> },
    { label: "Weight", value: formatWeight(product.weight), icon: <Weight className="h-3.5 w-3.5" /> },
    { label: "Stock", value: `${product.stock} unit${product.stock !== 1 ? "s" : ""}`, icon: <Package className="h-3.5 w-3.5" /> },
    { label: "Buy price", value: formatCurrency(product.purchasePrice), icon: <IndianRupee className="h-3.5 w-3.5" /> },
    { label: "Selling price", value: formatCurrency(product.sellingPrice), icon: <IndianRupee className="h-3.5 w-3.5" /> },
    { label: "Low stock alert", value: `${product.lowStockThreshold} unit${product.lowStockThreshold !== 1 ? "s" : ""}` },
    { label: "Added", value: formatDate(product.createdAt), icon: <CalendarDays className="h-3.5 w-3.5" /> },
    { label: "Updated", value: formatDate(product.updatedAt), icon: <CalendarDays className="h-3.5 w-3.5" /> },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-start gap-3">
            {product.imageUrl ? (
              <img
                src={product.imageUrl}
                alt={product.name}
                className="h-14 w-14 shrink-0 rounded-xl border object-cover"
              />
            ) : (
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border bg-muted text-muted-foreground">
                <Package className="h-6 w-6" />
              </div>
            )}
            <div className="min-w-0">
              <DialogTitle className="truncate">{product.name}</DialogTitle>
              <DialogDescription className="mt-0.5">
                {product.sku} · <Badge variant={status.variant}>{status.label}</Badge>
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Barcode */}
        {product.barcode ? (
          <div className="flex flex-col items-center gap-1 rounded-lg border bg-muted/30 py-3">
            <BarcodeSvg value={product.barcode} height={40} scale={1.2} />
            <span className="font-mono text-[11px] tracking-widest text-muted-foreground">
              {product.barcode}
            </span>
          </div>
        ) : (
          <div className="flex items-center justify-center rounded-lg border border-dashed py-4 text-xs text-muted-foreground">
            No barcode assigned
          </div>
        )}

        {/* Details grid */}
        <div className="grid grid-cols-1 gap-x-4 gap-y-0 sm:grid-cols-2">
          {rows.map((r) => (
            <div key={r.label} className="flex items-center justify-between gap-2 border-b py-2 text-sm last:border-b-0">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                {r.icon}
                {r.label}
              </span>
              <span className="font-medium tabular-nums">{r.value}</span>
            </div>
          ))}
        </div>

        {product.notes ? (
          <>
            <Separator />
            <div className="space-y-1">
              <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <FileText className="h-3.5 w-3.5" /> Notes
              </p>
              <p className="whitespace-pre-wrap text-sm">{product.notes}</p>
            </div>
          </>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
