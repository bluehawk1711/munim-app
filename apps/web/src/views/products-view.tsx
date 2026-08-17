"use client"

import * as React from "react"
import {
  Plus,
  Search,
  Filter,
  X,
  Package,
  Sparkles,
  ShoppingCart,
  Download,
  FileSpreadsheet,
  Barcode,
} from "lucide-react"
import { Button, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Card, CardContent, Skeleton, Badge, BarcodeLookupInput, LabelPrintDialog, ProductDetailsDialog } from "@munim/ui"
import { buildProductLabel, type ProductLabel } from "@munim/core"






import { ProductsTable } from "@/components/products/products-table"
import { ProductFormDialog } from "@/components/products/product-form-dialog"
import { StockAdjustmentDialog } from "@/components/products/stock-adjustment-dialog"
import { DeleteProductDialog } from "@/components/products/delete-product-dialog"
import { setPendingSellProduct } from "@/lib/pending-sell"
import { useProducts, useBackfillBarcodes } from "@/hooks/use-products"
import { useApiClient } from "@munim/query"
import { useSettings } from "@/hooks/use-settings"
import { useProductMeta } from "@/hooks/use-meta"
import { useAppStore } from "@/store/view-store"
import { exportProductsToExcel, exportProductsToCsv } from "@/lib/export"
import { downloadLabelPdf, printLabelHtml } from "@/lib/label-pdf"
import { formatCurrency, formatDate, formatWeight } from "@/lib/format"

import type { Product, StockStatus } from "@/lib/types"
import { toast } from "@munim/ui"

export function ProductsView() {
  const globalSearch = useAppStore((s) => s.globalSearch)
  const setGlobalSearchStore = useAppStore((s) => s.setGlobalSearch)
  const setSellDialogOpen = useAppStore((s) => s.setSellDialogOpen)
  const setView = useAppStore((s) => s.setActiveView)

  // Filters live in the store so shortcuts from other views (e.g. Catalog)
  // can pre-filter this view. The view remounts on navigation, so the local
  // state picks up the latest store values on mount and mirrors changes back.
  const productColorFilter = useAppStore((s) => s.productColorFilter)
  const productSizeFilter = useAppStore((s) => s.productSizeFilter)
  const productCategoryFilter = useAppStore((s) => s.productCategoryFilter)
  const productStatusFilter = useAppStore((s) => s.productStatusFilter)
  const setProductColorFilter = useAppStore((s) => s.setProductColorFilter)
  const setProductSizeFilter = useAppStore((s) => s.setProductSizeFilter)
  const setProductCategoryFilter = useAppStore((s) => s.setProductCategoryFilter)
  const setProductStatusFilter = useAppStore((s) => s.setProductStatusFilter)

  const [color, setColor] = React.useState<string>(productColorFilter)
  const [size, setSize] = React.useState<string>(productSizeFilter)
  const [category, setCategory] = React.useState<string>(productCategoryFilter)
  const [status, setStatus] = React.useState<StockStatus | "all">(productStatusFilter as StockStatus | "all")
  const [page, setPage] = React.useState(1)
  const pageSize = 20

  function setGlobalSearch(value: string) {
    setGlobalSearchStore(value)
    setPage(1)
  }

  function changeColor(value: string) {
    setColor(value)
    setProductColorFilter(value)
    setPage(1)
  }
  function changeSize(value: string) {
    setSize(value)
    setProductSizeFilter(value)
    setPage(1)
  }
  function changeCategory(value: string) {
    setCategory(value)
    setProductCategoryFilter(value)
    setPage(1)
  }
  function changeStatus(value: StockStatus | "all") {
    setStatus(value)
    setProductStatusFilter(value)
    setPage(1)
  }

  const [formOpen, setFormOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<Product | null>(null)
  const [adjusting, setAdjusting] = React.useState<Product | null>(null)
  const [adjustOpen, setAdjustOpen] = React.useState(false)
  const [deleting, setDeleting] = React.useState<Product | null>(null)
  const [deleteOpen, setDeleteOpen] = React.useState(false)
  const [labelTarget, setLabelTarget] = React.useState<Product | null>(null)
  const [labelOpen, setLabelOpen] = React.useState(false)
  const [labelCopies, setLabelCopies] = React.useState(1)
  const [detailsProduct, setDetailsProduct] = React.useState<Product | null>(null)

  const { data: meta } = useProductMeta()
  const { data: settings } = useSettings()
  const backfill = useBackfillBarcodes()
  const getClient = useApiClient()

  const filters = {
    search: globalSearch,
    color,
    size,
    category,
    status,
    page,
    pageSize,
  }
  const { data, isLoading } = useProducts(filters)
  const products = data?.products ?? []
  const pagination = data?.pagination

  const hasActiveFilters = color !== "all" || size !== "all" || category !== "all" || status !== "all" || !!globalSearch

  function clearFilters() {
    setGlobalSearch("")
    changeColor("all")
    changeSize("all")
    changeCategory("all")
    changeStatus("all")
    setPage(1)
  }

  function handlePageChange(newPage: number) {
    setPage(newPage)
  }

  function handleEdit(p: Product) {
    setEditing(p)
    setFormOpen(true)
  }
  function handleAdd() {
    setEditing(null)
    setFormOpen(true)
  }
  function handleAdjust(p: Product) {
    setAdjusting(p)
    setAdjustOpen(true)
  }
  function handleDelete(p: Product) {
    setDeleting(p)
    setDeleteOpen(true)
  }
  function handleSell(p: Product) {
    // Stash the selected product so the global sell dialog can preselect it.
    setPendingSellProduct(p)
    setSellDialogOpen(true)
  }

  function openLabelDialog(p: Product) {
    setLabelTarget(p)
    setLabelCopies(1)
    setLabelOpen(true)
  }

  function openDetails(p: Product) {
    setDetailsProduct(p)
  }

  /** Shop-counter path: exact barcode lookup (indexed) → open the product. */
  async function handleBarcodeLookup(code: string) {
    const api = await getClient()
    const product = await api.products.byBarcode(code)
    handleEdit(product)
    toast.success(`Found ${product.name}`)
  }

  async function handleBackfill() {
    try {
      const r = await backfill.mutateAsync()
      if (r.updated === 0) {
        toast.info("All products already have barcodes")
      } else {
        toast.success(`Generated ${r.updated} barcode${r.updated !== 1 ? "s" : ""}`)
      }
    } catch (err) {
      toast.error("Backfill failed", { description: err instanceof Error ? err.message : undefined })
    }
  }

  const labelLabels = React.useMemo<ProductLabel[]>(
    () =>
      labelTarget
        ? [
            buildProductLabel(
              {
                id: labelTarget.id,
                name: labelTarget.name,
                sku: labelTarget.sku,
                barcode: labelTarget.barcode,
                weight: labelTarget.weight,
                sellingPrice: labelTarget.sellingPrice,
                colorName: labelTarget.color || null,
                sizeName: labelTarget.size || null,
                categoryName: labelTarget.category ?? null,
              },
              { name: settings?.shopName ?? "" },
            ),
          ]
        : [],
    [labelTarget, settings],
  )

  function handleLabelPrint(html: string) {
    setLabelOpen(false)
    printLabelHtml(html)
  }

  async function handleLabelDownload(html: string) {
    setLabelOpen(false)
    try {
      await downloadLabelPdf(html)
      toast.success("Label PDF downloaded")
    } catch (err) {
      toast.error("PDF failed", { description: err instanceof Error ? err.message : undefined })
    }
  }

  const missingBarcodes = products.some((p) => !p.barcode)

  async function handleExportExcel() {
    if (!products || products.length === 0) {
      toast.error("Nothing to export", { description: "No products match the current filters." })
      return
    }
    try {
      await exportProductsToExcel(products)
      toast.success("Excel exported", { description: `${products.length} products` })
    } catch (e) {
      toast.error("Export failed", { description: e instanceof Error ? e.message : "Unknown error" })
    }
  }

  async function handleExportCsv() {
    if (!products || products.length === 0) {
      toast.error("Nothing to export", { description: "No products match the current filters." })
      return
    }
    try {
      exportProductsToCsv(products)
      toast.success("CSV exported", { description: `${products.length} products` })
    } catch (e) {
      toast.error("Export failed", { description: e instanceof Error ? e.message : "Unknown error" })
    }
  }

  return (
    <div className="space-y-4">
      {/* Toolbar — search on row 1, filters on row 2, actions right */}
      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div className="flex w-full flex-col gap-2">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative w-full sm:max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
                placeholder="Search by name, SKU, barcode, color…"
                className="h-9 pl-9"
                aria-label="Search products"
              />
            </div>
            {/* Scanner-friendly input: USB barcode scanners type here + Enter. */}
            <BarcodeLookupInput
              onLookup={handleBarcodeLookup}
              className="w-full sm:max-w-[240px]"
              autoFocus={false}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border/60 bg-muted/30 px-2.5 py-2">
            <Select value={color} onValueChange={changeColor}>
              <SelectTrigger className="h-9 w-[130px]" aria-label="Filter by color">
                <SelectValue placeholder="Color" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All colors</SelectItem>
                {meta?.colors.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={size} onValueChange={changeSize}>
              <SelectTrigger className="h-9 w-[130px]" aria-label="Filter by size">
                <SelectValue placeholder="Size" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All sizes</SelectItem>
                {meta?.sizes.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={category} onValueChange={changeCategory}>
              <SelectTrigger className="h-9 w-[150px]" aria-label="Filter by category">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {meta?.categories.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={(v) => changeStatus(v as StockStatus | "all")}>
              <SelectTrigger className="h-9 w-[150px]" aria-label="Filter by stock status">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All status</SelectItem>
                <SelectItem value="in_stock">In Stock</SelectItem>
                <SelectItem value="low_stock">Low Stock</SelectItem>
                <SelectItem value="out_of_stock">Out of Stock</SelectItem>
              </SelectContent>
            </Select>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9 gap-1">
                <X className="h-3.5 w-3.5" /> Clear
              </Button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {missingBarcodes && (
            <Button variant="outline" size="sm" onClick={handleBackfill} disabled={backfill.isPending} className="h-9 gap-1.5">
              <Barcode className="h-4 w-4" /> {backfill.isPending ? "Generating…" : "Generate barcodes"}
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={handleExportCsv} className="h-9 gap-1.5">
            <Download className="h-4 w-4" /> CSV
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportExcel} className="h-9 gap-1.5">
            <FileSpreadsheet className="h-4 w-4" /> Excel
          </Button>
          <Button onClick={handleAdd} className="h-9 gap-1.5">
            <Plus className="h-4 w-4" /> Add Product
          </Button>
        </div>
      </div>

      {/* Active filter summary */}
      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Filter className="h-3.5 w-3.5" />
          <span>Filters:</span>
          {globalSearch && <Badge variant="secondary">Search: “{globalSearch}”</Badge>}
          {color !== "all" && <Badge variant="secondary">Color: {color}</Badge>}
          {size !== "all" && <Badge variant="secondary">Size: {size}</Badge>}
          {category !== "all" && <Badge variant="secondary">Category: {category}</Badge>}
          {status !== "all" && <Badge variant="secondary">Status: {status.replace("_", " ")}</Badge>}
        </div>
      )}

      {/* Content */}
      {isLoading ? (
        <Card>
          <CardContent className="space-y-2 p-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </CardContent>
        </Card>
      ) : products && products.length === 0 && !hasActiveFilters ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Sparkles className="h-7 w-7" />
            </div>
            <div>
              <p className="text-sm font-semibold">Your inventory is empty</p>
              <p className="text-xs text-muted-foreground">
                Add your first product or load sample data to explore.
              </p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleAdd} className="gap-1.5">
                <Plus className="h-4 w-4" /> Add product
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <ProductsTable
          products={products ?? []}
          onEdit={handleEdit}
          onAdjust={handleAdjust}
          onDelete={handleDelete}
          onSell={handleSell}
          onPrintLabel={openLabelDialog}
          onViewDetails={openDetails}
          pagination={pagination}
          onPageChange={handlePageChange}
        />
      )}

      <ProductDetailsDialog
        open={detailsProduct !== null}
        onOpenChange={(open) => !open && setDetailsProduct(null)}
        product={detailsProduct}
        formatCurrency={formatCurrency}
        formatWeight={formatWeight}
        formatDate={formatDate}
      />
      <ProductFormDialog open={formOpen} onOpenChange={setFormOpen} product={editing} />
      <StockAdjustmentDialog open={adjustOpen} onOpenChange={setAdjustOpen} product={adjusting} />
      <DeleteProductDialog open={deleteOpen} onOpenChange={setDeleteOpen} product={deleting} />
      <LabelPrintDialog
        open={labelOpen}
        onOpenChange={setLabelOpen}
        labels={labelLabels}
        copies={labelCopies}
        onCopiesChange={setLabelCopies}
        onPrint={handleLabelPrint}
        onDownloadPdf={handleLabelDownload}
      />
    </div>
  )
}
