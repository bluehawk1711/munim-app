"use client"

/**
 * LabelPrintSelectDialog — product selector for label printing.
 *
 * Shows a searchable, paginated list of products with checkboxes.
 * On confirm, calls `onSelect(products)` with the chosen items.
 */
import * as React from "react";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "../lib/utils";
import { Button } from "./button";
import { Checkbox } from "./checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./dialog";
import { Input } from "./input";
import { ScrollArea } from "./scroll-area";

export interface LabelPrintSelectProduct {
  id: string;
  name: string;
  sku: string;
  barcode?: string | null;
  sellingPrice?: number | null;
  weight?: number | null;
  color?: string | null;
  size?: string | null;
  category?: string | null;
}

const PAGE_SIZE = 20;

export function LabelPrintSelectDialog({
  open,
  onOpenChange,
  products,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products: LabelPrintSelectProduct[];
  onSelect: (products: LabelPrintSelectProduct[]) => void;
}) {
  const [query, setQuery] = React.useState("");
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [page, setPage] = React.useState(0);

  // Reset state on open
  React.useEffect(() => {
    if (open) {
      setQuery("");
      setSelected(new Set());
      setPage(0);
    }
  }, [open]);

  const filtered = React.useMemo(() => {
    if (!query.trim()) return products;
    const q = query.toLowerCase();
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        (p.barcode && p.barcode.toLowerCase().includes(q)),
    );
  }, [products, query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pageItems = filtered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  // Select-all toggles the current page
  const allOnPageSelected = pageItems.length > 0 && pageItems.every((p) => selected.has(p.id));

  function togglePage() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allOnPageSelected) {
        for (const p of pageItems) next.delete(p.id);
      } else {
        for (const p of pageItems) next.add(p.id);
      }
      return next;
    });
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleConfirm() {
    const chosen = products.filter((p) => selected.has(p.id));
    if (chosen.length > 0) {
      onSelect(chosen);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Select products to print</DialogTitle>
          <DialogDescription>
            {selected.size} of {products.length} selected
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by name, SKU, or barcode…"
              value={query}
              onChange={(e) => { setQuery(e.target.value); setPage(0); }}
              className="h-9 pl-8 text-sm"
            />
          </div>

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{filtered.length} product{filtered.length !== 1 ? "s" : ""}</span>
            <button
              type="button"
              onClick={togglePage}
              className="font-medium text-primary hover:underline"
            >
              {allOnPageSelected ? "Deselect page" : "Select page"}
            </button>
          </div>

          <ScrollArea className="h-[320px]">
            <div className="space-y-0.5 pr-3">
              {pageItems.length === 0 && (
                <p className="py-8 text-center text-sm text-muted-foreground">No products found</p>
              )}
              {pageItems.map((p) => (
                <label
                  key={p.id}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2 text-sm transition-colors hover:bg-muted/50",
                    selected.has(p.id) && "border-primary/40 bg-primary/5",
                  )}
                >
                  <Checkbox
                    checked={selected.has(p.id)}
                    onCheckedChange={() => toggleOne(p.id)}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{p.name}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {p.sku}
                      {p.color ? ` · ${p.color}` : ""}
                      {p.size ? ` · ${p.size}` : ""}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </ScrollArea>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <Button
                variant="outline"
                size="icon"
                className="h-7 w-7"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={safePage === 0}
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <span className="text-xs text-muted-foreground tabular-nums">
                {safePage + 1} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="icon"
                className="h-7 w-7"
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={safePage >= totalPages - 1}
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={selected.size === 0}>
            Print {selected.size > 0 ? `${selected.size} label${selected.size !== 1 ? "s" : ""}` : "Labels"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
