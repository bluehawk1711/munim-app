"use client";

/**
 * ProductSearchSelect — shared web + desktop product picker with a search box
 * and full keyboard navigation (↑/↓ to move, Enter to select, Esc to close).
 *
 * Replaces every per-page product dropdown (billing line items, quick sale,
 * sell dialogs, …) with one component so product search behaves identically
 * everywhere. Presentational only: callers pass the product list and receive
 * the chosen option via `onSelect`.
 *
 * Rows show name + SKU · price · stock (stock pill turns amber/red at low/0),
 * matching the product rows elsewhere in the app.
 */
import * as React from "react";
import { Package, Search, X } from "lucide-react";
import { classifyProduct } from "@munim/core";
import { cn } from "../lib/utils";
import { formatMoney } from "../lib/format";
import { Input } from "./input";

export type ProductOption = {
  id: string;
  name: string;
  sku?: string | null;
  barcode?: string | null;
  color?: string | null;
  size?: string | null;
  /** Product weight + unit — copied onto bill lines for the WEIGHT column. */
  weight?: number | null;
  weightUnit?: string | null;
  sellingPrice: number;
  /** SQL-computed current price (auto gold); falls back to sellingPrice. */
  effectivePrice?: number | null;
  stock: number;
  silverPercentage?: number;
  /** Product type (Gold/Silver/…) — renders the "Gold · 22K" chip. */
  type?: string | null;
  /** Gold karat 0–24 — part of the classification chip. */
  goldKarat?: number | null;
  /** Free-text purity stamp ("22K", "916", "925"). */
  purity?: string | null;
  /** Category name — silver subcategories ("92.5 Stock") live here. */
  category?: string | null;
};

function stockMeta(stock: number): { label: string; className: string } {
  if (stock <= 0) return { label: "Out of stock", className: "text-destructive" };
  if (stock <= 5) return { label: `${stock} left`, className: "text-amber-600 dark:text-amber-400" };
  return { label: `${stock} in stock`, className: "text-muted-foreground" };
}

export function ProductSearchSelect({
  products,
  onSelect,
  placeholder = "Search product by name or SKU…",
  emptyText = "No products match",
  disabled = false,
  disableOutOfStock = false,
  className,
  listClassName,
}: {
  /** Full product list to search within (caller owns fetching/pagination). */
  products: ProductOption[] | null | undefined;
  /** Fired when a product is chosen (click or Enter). */
  onSelect: (product: ProductOption) => void;
  placeholder?: string;
  emptyText?: string;
  disabled?: boolean;
  /** Grey out (and block selecting) products with 0 stock — e.g. quick sale. */
  disableOutOfStock?: boolean;
  className?: string;
  listClassName?: string;
}) {
  const [query, setQuery] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const [activeIndex, setActiveIndex] = React.useState(0);
  const rootRef = React.useRef<HTMLDivElement | null>(null);
  const listRef = React.useRef<HTMLUListElement | null>(null);

  const filtered = React.useMemo(() => {
    const list = products ?? [];
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.sku ?? "").toLowerCase().includes(q) ||
        (p.barcode ?? "").toLowerCase().includes(q) ||
        (p.color ?? "").toLowerCase().includes(q) ||
        (p.size ?? "").toLowerCase().includes(q) ||
        (p.type ?? "").toLowerCase().includes(q) ||
        (p.purity ?? "").toLowerCase().includes(q) ||
        (p.category ?? "").toLowerCase().includes(q),
    );
  }, [products, query]);

  // Keep the active row valid and follow the filtered list.
  React.useEffect(() => {
    setActiveIndex((i) => Math.min(i, Math.max(0, filtered.length - 1)));
  }, [filtered.length]);

  // Close on outside click / focus loss.
  React.useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  function select(p: ProductOption) {
    if (disableOutOfStock && p.stock <= 0) return;
    onSelect(p);
    setQuery("");
    setActiveIndex(0);
    setOpen(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) setOpen(true);
      setActiveIndex((i) => (filtered.length ? (i + 1) % filtered.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) setOpen(true);
      setActiveIndex((i) => (filtered.length ? (i - 1 + filtered.length) % filtered.length : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const pick = filtered[activeIndex];
      if (open && pick) select(pick);
    } else if (e.key === "Escape") {
      if (open) {
        e.stopPropagation();
        setOpen(false);
      }
    } else if (e.key === "Tab") {
      setOpen(false);
    }
  }

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 z-10 h-4 w-4 -translate-y-1/2" />
      <Input
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        aria-controls="product-search-listbox"
        autoComplete="off"
        disabled={disabled}
        className="pl-8"
        placeholder={placeholder}
        value={query}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setActiveIndex(0);
        }}
        onKeyDown={handleKeyDown}
      />
      {query && (
        <button
          type="button"
          tabIndex={-1}
          aria-label="Clear search"
          className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2 z-10 -translate-y-1/2"
          onClick={() => {
            setQuery("");
            setActiveIndex(0);
          }}
        >
          <X className="h-4 w-4" />
        </button>
      )}

      {open && (
        <ul
          id="product-search-listbox"
          ref={listRef}
          role="listbox"
          className={cn(
            "bg-popover text-popover-foreground absolute z-50 mt-1 max-h-72 w-full overflow-auto rounded-lg border shadow-md",
            listClassName,
          )}
        >
          {filtered.length === 0 ? (
            <li className="text-muted-foreground flex items-center gap-2 px-3 py-4 text-sm">
              <Package className="h-4 w-4" />
              {emptyText}
            </li>
          ) : (
            filtered.map((p, i) => {
              const out = disableOutOfStock && p.stock <= 0;
              const stock = stockMeta(p.stock);
              return (
                <li
                  key={p.id}
                  role="option"
                  aria-selected={i === activeIndex}
                  aria-disabled={out || undefined}
                  className={cn(
                    "cursor-pointer px-3 py-2",
                    i === activeIndex && "bg-accent text-accent-foreground",
                    out && "pointer-events-none opacity-50",
                  )}
                  // Keep the highlight in sync with the mouse without
                  // fighting keyboard navigation.
                  onMouseMove={() => setActiveIndex(i)}
                  onMouseDown={(e) => e.preventDefault()} // keep input focus
                  onClick={() => select(p)}
                >
                  <p className="flex items-center gap-1.5 truncate text-sm font-medium">
                    <span className="truncate">{p.name}</span>
                    {p.type ? (
                      <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                        {classifyProduct({
                          type: p.type,
                          goldKarat: p.goldKarat,
                          purity: p.purity,
                          categoryName: p.category,
                        }).text}
                      </span>
                    ) : null}
                  </p>
                  <p className="text-muted-foreground truncate text-xs">
                    {[p.sku, [p.color, p.size].filter(Boolean).join(" / ") || null, formatMoney(p.effectivePrice ?? p.sellingPrice)]
                      .filter(Boolean)
                      .join(" · ")}{" "}
                    · <span className={stock.className}>{stock.label}</span>
                  </p>
                </li>
              );
            })
          )}
        </ul>
      )}
    </div>
  );
}
