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
  Printer,
  RefreshCw,
  Pencil,
  MoreHorizontal,
} from "lucide-react"
import {
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Card,
  CardContent,
  Skeleton,
  Badge,
  BarcodeLookupInput,
  LabelPrintDialog,
  LabelPrintSelectDialog,
  type LabelPrintSelectProduct,
  ProductDetailsDialog,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@munim/ui"
import { buildProductLabel, type ProductLabel } from "@munim/core"






import { ProductsTable } from "@/components/products/products-table"
import { ProductFormDialog } from "@/components/products/product-form-dialog"
import { StockAdjustmentDialog } from "@/components/products/stock-adjustment-dialog"
import { DeleteProductDialog } from "@/components/products/delete-product-dialog"
import { BulkEditDialog } from "@/components/products/bulk-edit-dialog"
import { CameraScanButton } from "@/components/camera-scan-button"
import { setPendingSellProduct } from "@/lib/pending-sell"
import { useProducts, useBackfillBarcodes, useSyncProductPrices } from "@/hooks/use-products"
import { useArticles } from "@/hooks/use-articles"
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
  const productArticleFilter = useAppStore((s) => s.productArticleFilter)
  const productStatusFilter = useAppStore((s) => s.productStatusFilter)
  const productTypeFilter = useAppStore((s) => s.productTypeFilter)
  const setProductColorFilter = useAppStore((s) => s.setProductColorFilter)
  const setProductSizeFilter = useAppStore((s) => s.setProductSizeFilter)
  const setProductCategoryFilter = useAppStore((s) => s.setProductCategoryFilter)
  const setProductArticleFilter = useAppStore((s) => s.setProductArticleFilter)
  const setProductStatusFilter = useAppStore((s) => s.setProductStatusFilter)
  const setProductTypeFilter = useAppStore((s) => s.setProductTypeFilter)

  const [color, setColor] = React.useState<string>(productColorFilter)
  const [size, setSize] = React.useState<string>(productSizeFilter)
  const [category, setCategory] = React.useState<string>(productCategoryFilter)
  const [article, setArticle] = React.useState<string>(productArticleFilter)
  const [status, setStatus] = React.useState<StockStatus | "all">(productStatusFilter as StockStatus | "all")
  const [type, setType] = React.useState<string>(productTypeFilter)
  const [priceMode, setPriceMode] = React.useState<"all" | "auto" | "manual">("all")
  const [page, setPage] = React.useState(1)
  const pageSize = 20

  // Sync local filter state from the store when external views (e.g. Catalog)
  // write a filter value and navigate here. Adjust-during-render (React's
  // recommended alternative to a sync effect): when a store value changes
  // under an already-mounted instance, mirror it before painting.
  const [prevFilters, setPrevFilters] = React.useState({
    color: productColorFilter,
    size: productSizeFilter,
    category: productCategoryFilter,
    article: productArticleFilter,
    status: productStatusFilter,
    type: productTypeFilter,
  })
  if (
    prevFilters.color !== productColorFilter ||
    prevFilters.size !== productSizeFilter ||
    prevFilters.category !== productCategoryFilter ||
    prevFilters.article !== productArticleFilter ||
    prevFilters.status !== productStatusFilter ||
    prevFilters.type !== productTypeFilter
  ) {
    setPrevFilters({
      color: productColorFilter,
      size: productSizeFilter,
      category: productCategoryFilter,
      article: productArticleFilter,
      status: productStatusFilter,
      type: productTypeFilter,
    })
    setColor(productColorFilter)
    setSize(productSizeFilter)
    setCategory(productCategoryFilter)
    setArticle(productArticleFilter)
    setStatus(productStatusFilter as StockStatus | "all")
    setType(productTypeFilter)
  }

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
  function changeArticle(value: string) {
    setArticle(value)
    setProductArticleFilter(value)
    setPage(1)
  }
  function changeStatus(value: StockStatus | "all") {
    setStatus(value)
    setProductStatusFilter(value)
    setPage(1)
  }
  function changeType(value: string) {
    setType(value)
    setProductTypeFilter(value)
    setPage(1)
  }
  function changePriceMode(value: "all" | "auto" | "manual") {
    setPriceMode(value)
    setPage(1)
  }

  const [formOpen, setFormOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<Product | null>(null)
  const [adjusting, setAdjusting] = React.useState<Product | null>(null)
  const [adjustOpen, setAdjustOpen] = React.useState(false)
  const [deleting, setDeleting] = React.useState<Product | null>(null)
  const [deleteOpen, setDeleteOpen] = React.useState(false)
  const [labelTarget, setLabelTarget] = React.useState<Product | null>(null)
  const [labelTargets, setLabelTargets] = React.useState<Product[]>([])
  const [labelSelectOpen, setLabelSelectOpen] = React.useState(false)
  const [labelOpen, setLabelOpen] = React.useState(false)
  const [labelCopies, setLabelCopies] = React.useState(1)
  const [detailsProduct, setDetailsProduct] = React.useState<Product | null>(null)
  // Bulk edit: selected row ids (across pages) + dialog state.
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set())
  const [bulkOpen, setBulkOpen] = React.useState(false)

  const { data: meta } = useProductMeta()
  const { data: articleList } = useArticles()
  const { data: settings } = useSettings()
  const backfill = useBackfillBarcodes()
  const syncPrices = useSyncProductPrices()
  const getClient = useApiClient()

  const filters = {
    search: globalSearch,
    color,
    size,
    category,
    article,
    status,
    type,
    priceMode,
    page,
    pageSize,
  }
  const { data, isLoading } = useProducts(filters)
  const products = data?.products ?? []
  const pagination = data?.pagination

  const hasActiveFilters =
    color !== "all" || size !== "all" || category !== "all" || article !== "all" || status !== "all" || type !== "all" || priceMode !== "all" || !!globalSearch

  function clearFilters() {
    setGlobalSearch("")
    changeColor("all")
    changeSize("all")
    changeCategory("all")
    changeStatus("all")
    changeType("all")
    changePriceMode("all")
    changeArticle("all")
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
    setLabelTargets([])
    setLabelTarget(p)
    setLabelCopies(1)
    setLabelOpen(true)
  }

  function handleLabelSelect(selected: LabelPrintSelectProduct[]) {
    // Items were built from this page's products, so the downcast is safe
    // (same pattern as desktop's handleLabelSelect).
    setLabelTargets(selected as Product[])
    setLabelTarget(null)
    setLabelCopies(1)
    setLabelSelectOpen(false)
    setLabelOpen(true)
  }

  function openDetails(p: Product) {
    setDetailsProduct(p)
  }

  function clearSelection() {
    setSelectedIds(new Set())
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

  async function handleSyncPrices() {
    try {
      const r = await syncPrices.mutateAsync()
      if (r.scanned === 0) {
        toast.info("No auto-priced products yet — nothing to recalculate")
      } else if (r.updated === 0) {
        toast.info("Prices already match the current rates")
      } else {
        toast.success(`Re-priced ${r.updated} of ${r.scanned} auto-priced product${r.scanned !== 1 ? "s" : ""}`)
      }
    } catch (err) {
      toast.error("Recalculation failed", { description: err instanceof Error ? err.message : undefined })
    }
  }

  const labelLabels = React.useMemo<ProductLabel[]>(() => {
    const labelSources = labelTargets.length > 0 ? labelTargets : labelTarget ? [labelTarget] : []
    return labelSources.map((p) =>
      buildProductLabel(
        {
          id: p.id,
          name: p.name,
          sku: p.sku,
          barcode: p.barcode,
          type: p.type,
          weight: p.weight,
          weightUnit: p.weightUnit,
          grossWeight: p.grossWeight ?? null,
          nagLessWeight: p.nagLessWeight ?? null,
          nagRate: p.nagRate ?? null,
          chejatWeight: p.chejatWeight ?? null,
          netWeight: p.netWeight ?? null,
          purity: p.purity,
          sellingPrice: p.effectivePrice,
          labourType: p.labourType,
          labourValue: p.labourValue,
          colorName: p.color || null,
          sizeName: p.size || null,
          categoryName: p.category ?? null,
          subCategoryName: p.subCategory ?? null,
        },
        { name: settings?.shopName ?? "" },
      ),
    )
  }, [labelTarget, labelTargets, settings])

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
      {/* Toolbar — search + actions on row 1, filters on row 2 */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
          <div className="relative w-full lg:max-w-sm">
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
          <div className="flex items-center gap-2">
            <BarcodeLookupInput
              onLookup={handleBarcodeLookup}
              className="w-full sm:w-[240px]"
              autoFocus={false}
            />
            {/* Camera scan — mobile's scan-to-act on a phone/laptop camera. */}
            <CameraScanButton onDetected={handleBarcodeLookup} label="Scan barcode" />
          </div>
          <div className="flex items-center gap-2 max-sm:w-full lg:ml-auto">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="h-9 gap-1.5">
                  <MoreHorizontal className="h-4 w-4" /> More
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem onSelect={handleSyncPrices} disabled={syncPrices.isPending}>
                  <RefreshCw className={syncPrices.isPending ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
                  {syncPrices.isPending ? "Recalculating…" : "Recalculate prices"}
                </DropdownMenuItem>
                {missingBarcodes && (
                  <DropdownMenuItem onSelect={handleBackfill} disabled={backfill.isPending}>
                    <Barcode className="h-4 w-4" />
                    {backfill.isPending ? "Generating…" : "Generate barcodes"}
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onSelect={() => setLabelSelectOpen(true)}>
                  <Printer className="h-4 w-4" /> Print label
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={handleExportCsv}>
                  <Download className="h-4 w-4" /> Export CSV
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={handleExportExcel}>
                  <FileSpreadsheet className="h-4 w-4" /> Export Excel
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button onClick={handleAdd} className="h-9 flex-1 gap-1.5 sm:flex-none">
              <Plus className="h-4 w-4" /> Add Product
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-2 rounded-xl border border-border/60 bg-muted/30 p-2.5 sm:flex-row sm:flex-wrap sm:items-center">
          <span className="flex items-center gap-1.5 px-1 text-xs font-medium text-muted-foreground">
            <Filter className="h-3.5 w-3.5" /> Filters
          </span>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-1 sm:flex-wrap">
            <Select value={color} onValueChange={changeColor}>
              <SelectTrigger className="h-9 w-full sm:w-[140px]" aria-label="Filter by color">
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
              <SelectTrigger className="h-9 w-full sm:w-[140px]" aria-label="Filter by size">
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
              <SelectTrigger className="h-9 w-full sm:w-[140px]" aria-label="Filter by category">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {meta?.categories.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={article} onValueChange={changeArticle}>
              <SelectTrigger className="h-9 w-full sm:w-[140px]" aria-label="Filter by article">
                <SelectValue placeholder="Article" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All articles</SelectItem>
                {(articleList ?? []).map((a) => (
                  <SelectItem key={a.id} value={a.name}>{a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={type} onValueChange={changeType}>
              <SelectTrigger className="h-9 w-full sm:w-[140px]" aria-label="Filter by type">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                <SelectItem value="Gold">Gold</SelectItem>
                <SelectItem value="Silver">Silver</SelectItem>
                <SelectItem value="Diamond">Diamond</SelectItem>
                <SelectItem value="Platinum">Platinum</SelectItem>
                <SelectItem value="Other">Other</SelectItem>
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={(v) => changeStatus(v as StockStatus | "all")}>
              <SelectTrigger className="h-9 w-full sm:w-[140px]" aria-label="Filter by stock status">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All status</SelectItem>
                <SelectItem value="in_stock">In Stock</SelectItem>
                <SelectItem value="low_stock">Low Stock</SelectItem>
                <SelectItem value="out_of_stock">Out of Stock</SelectItem>
              </SelectContent>
            </Select>
            <Select value={priceMode} onValueChange={(v) => changePriceMode(v as "all" | "auto" | "manual")}>
              <SelectTrigger className="h-9 w-full sm:w-[140px]" aria-label="Filter by price mode">
                <SelectValue placeholder="Pricing" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All pricing</SelectItem>
                <SelectItem value="auto">Auto-priced</SelectItem>
                <SelectItem value="manual">Manual price</SelectItem>
              </SelectContent>
            </Select>
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="col-span-2 h-9 gap-1 sm:col-span-1 sm:ml-auto"
              >
                <X className="h-3.5 w-3.5" /> Clear
              </Button>
            )}
          </div>
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
          {article !== "all" && <Badge variant="secondary">Article: {article}</Badge>}
          {type !== "all" && <Badge variant="secondary">Type: {type}</Badge>}
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
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
        />
      )}

      {/* Bulk action bar — appears when rows are selected */}
      {selectedIds.size > 0 && (
        <div className="sticky bottom-4 z-30 flex items-center justify-between gap-3 rounded-xl border bg-card p-3 shadow-lg">
          <span className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">{selectedIds.size}</span>{" "}
            product{selectedIds.size !== 1 ? "s" : ""} selected
          </span>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={clearSelection} className="h-9">
              Clear selection
            </Button>
            <Button size="sm" onClick={() => setBulkOpen(true)} className="h-9 gap-1.5">
              <Pencil className="h-4 w-4" /> Edit selected
            </Button>
          </div>
        </div>
      )}

      <ProductDetailsDialog
        open={detailsProduct !== null}
        onOpenChange={(open) => !open && setDetailsProduct(null)}
        product={detailsProduct}
        formatCurrency={formatCurrency}
        formatWeight={formatWeight}
        formatDate={formatDate}
      />
      <ProductFormDialog open={formOpen} onOpenChange={setFormOpen} product={editing} defaultType={type} />
      <BulkEditDialog
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        selectedIds={[...selectedIds]}
        onDone={clearSelection}
      />
      <StockAdjustmentDialog open={adjustOpen} onOpenChange={setAdjustOpen} product={adjusting} />
      <DeleteProductDialog open={deleteOpen} onOpenChange={setDeleteOpen} product={deleting} />
      <LabelPrintSelectDialog
        open={labelSelectOpen}
        onOpenChange={setLabelSelectOpen}
        products={(products ?? []).map((p) => ({
          id: p.id,
          name: p.name,
          sku: p.sku,
          barcode: p.barcode,
          sellingPrice: p.effectivePrice,
          weight: p.weight,
          color: p.color,
          size: p.size,
          category: p.category,
        }))}
        onSelect={handleLabelSelect}
      />
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
