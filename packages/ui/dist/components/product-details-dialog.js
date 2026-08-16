"use client";
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { Package, Ruler, Weight, Boxes, IndianRupee, FileText, CalendarDays, Tag, Layers } from "lucide-react";
import { BarcodeSvg } from "./barcode-svg";
import { Badge } from "./badge";
import { Button } from "./button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, } from "./dialog";
import { Separator } from "./separator";
export function ProductDetailsDialog({ open, onOpenChange, product, formatCurrency, formatWeight, formatDate, }) {
    if (!product)
        return null;
    const status = product.stock <= 0
        ? { label: "Out of stock", variant: "destructive" }
        : product.stock <= product.lowStockThreshold
            ? { label: "Low stock", variant: "warning" }
            : { label: "In stock", variant: "success" };
    const rows = [
        { label: "SKU", value: product.sku, icon: _jsx(Tag, { className: "h-3.5 w-3.5" }) },
        { label: "Color", value: product.color || "—", icon: _jsx(Layers, { className: "h-3.5 w-3.5" }) },
        { label: "Size", value: product.size || "—", icon: _jsx(Ruler, { className: "h-3.5 w-3.5" }) },
        { label: "Category", value: product.category || "—", icon: _jsx(Boxes, { className: "h-3.5 w-3.5" }) },
        { label: "Weight", value: formatWeight(product.weight), icon: _jsx(Weight, { className: "h-3.5 w-3.5" }) },
        { label: "Stock", value: `${product.stock} unit${product.stock !== 1 ? "s" : ""}`, icon: _jsx(Package, { className: "h-3.5 w-3.5" }) },
        { label: "Buy price", value: formatCurrency(product.purchasePrice), icon: _jsx(IndianRupee, { className: "h-3.5 w-3.5" }) },
        { label: "Selling price", value: formatCurrency(product.sellingPrice), icon: _jsx(IndianRupee, { className: "h-3.5 w-3.5" }) },
        { label: "Low stock alert", value: `${product.lowStockThreshold} unit${product.lowStockThreshold !== 1 ? "s" : ""}` },
        { label: "Added", value: formatDate(product.createdAt), icon: _jsx(CalendarDays, { className: "h-3.5 w-3.5" }) },
        { label: "Updated", value: formatDate(product.updatedAt), icon: _jsx(CalendarDays, { className: "h-3.5 w-3.5" }) },
    ];
    return (_jsx(Dialog, { open: open, onOpenChange: onOpenChange, children: _jsxs(DialogContent, { className: "sm:max-w-lg", children: [_jsx(DialogHeader, { children: _jsxs("div", { className: "flex items-start gap-3", children: [product.imageUrl ? (_jsx("img", { src: product.imageUrl, alt: product.name, className: "h-14 w-14 shrink-0 rounded-xl border object-cover" })) : (_jsx("div", { className: "flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border bg-muted text-muted-foreground", children: _jsx(Package, { className: "h-6 w-6" }) })), _jsxs("div", { className: "min-w-0", children: [_jsx(DialogTitle, { className: "truncate", children: product.name }), _jsxs(DialogDescription, { className: "mt-0.5", children: [product.sku, " \u00B7 ", _jsx(Badge, { variant: status.variant, children: status.label })] })] })] }) }), product.barcode ? (_jsxs("div", { className: "flex flex-col items-center gap-1 rounded-lg border bg-muted/30 py-3", children: [_jsx(BarcodeSvg, { value: product.barcode, height: 40, scale: 1.2 }), _jsx("span", { className: "font-mono text-[11px] tracking-widest text-muted-foreground", children: product.barcode })] })) : (_jsx("div", { className: "flex items-center justify-center rounded-lg border border-dashed py-4 text-xs text-muted-foreground", children: "No barcode assigned" })), _jsx("div", { className: "grid grid-cols-1 gap-x-4 gap-y-0 sm:grid-cols-2", children: rows.map((r) => (_jsxs("div", { className: "flex items-center justify-between gap-2 border-b py-2 text-sm last:border-b-0", children: [_jsxs("span", { className: "flex items-center gap-1.5 text-muted-foreground", children: [r.icon, r.label] }), _jsx("span", { className: "font-medium tabular-nums", children: r.value })] }, r.label))) }), product.notes ? (_jsxs(_Fragment, { children: [_jsx(Separator, {}), _jsxs("div", { className: "space-y-1", children: [_jsxs("p", { className: "flex items-center gap-1.5 text-xs font-medium text-muted-foreground", children: [_jsx(FileText, { className: "h-3.5 w-3.5" }), " Notes"] }), _jsx("p", { className: "whitespace-pre-wrap text-sm", children: product.notes })] })] })) : null, _jsx(DialogFooter, { children: _jsx(Button, { variant: "outline", onClick: () => onOpenChange(false), children: "Close" }) })] }) }));
}
//# sourceMappingURL=product-details-dialog.js.map