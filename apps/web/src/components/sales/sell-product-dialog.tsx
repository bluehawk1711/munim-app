"use client"

import * as React from "react"
import { useForm, type Resolver } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import {
  ShoppingCart,
  Loader2,
  CheckCircle2,
  Minus,
  Plus,
  PackageSearch,
  Receipt,
  Search,
  Package,
  X,
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import { useProducts } from "@/hooks/use-products"
import { useCreateSale } from "@/hooks/use-sales"
import { saleSchema, type SaleFormValues } from "@/lib/validators"
import { useAppStore } from "@/store/view-store"
import { consumePendingSellProduct } from "@/lib/pending-sell"
import { formatCurrency } from "@/lib/format"
import type { Product, Sale } from "@/lib/types"
import { toast } from "sonner"

// Cap how many search results render at once; the search narrows this down.
const MAX_RESULTS = 200

export function SellProductDialog() {
  const open = useAppStore((s) => s.sellDialogOpen)
  const setOpen = useAppStore((s) => s.setSellDialogOpen)
  const setView = useAppStore((s) => s.setView)
  // Fetch the full catalog (not just page 1) so every product — including
  // ones on pages 2+ of the Products view — is searchable and selectable.
  // The query only runs while the dialog is open to avoid an always-on fetch.
  const { data, isLoading } = useProducts({ pageSize: 1000 }, { enabled: open })
  const catalog = data?.products ?? []
  const createSale = useCreateSale()

  const [completedSale, setCompletedSale] = React.useState<Sale | null>(null)
  // Selected product is kept in local state (not derived from the fetched
  // list) so a "Sell" click from any products-table page preselects reliably.
  const [selectedProduct, setSelectedProduct] = React.useState<Product | null>(null)
  const [search, setSearch] = React.useState("")
  const prevOpenRef = React.useRef(false)

  const form = useForm<SaleFormValues>({
    resolver: zodResolver(saleSchema) as unknown as Resolver<SaleFormValues>,
    defaultValues: { productId: "", color: "", size: "", quantity: 1 },
  })

  const quantity = Number(form.watch("quantity")) || 0

  // Reset only on the open rising-edge (false → true). Guarding with the
  // rising edge prevents query invalidation from clobbering the success
  // state mid-sale.
  React.useEffect(() => {
    const justOpened = open && !prevOpenRef.current
    prevOpenRef.current = open
    if (justOpened) {
      setCompletedSale(null)
      const pending = consumePendingSellProduct()
      setSelectedProduct(pending)
      setSearch("")
      form.reset({
        productId: pending?.id ?? "",
        color: pending?.color ?? "",
        size: pending?.size ?? "",
        quantity: 1,
      })
    }
  }, [open, form])

  const maxQty = selectedProduct?.stock ?? 0
  const total = selectedProduct ? selectedProduct.sellingPrice * quantity : 0

  const query = search.trim().toLowerCase()
  const matches = query
    ? catalog.filter((p) =>
        [p.name, p.sku, p.color, p.size, p.barcode ?? ""].some((field) =>
          field.toLowerCase().includes(query)
        )
      )
    : catalog
  const visible = matches.slice(0, MAX_RESULTS)
  const truncated = matches.length > visible.length

  function pickProduct(p: Product) {
    setSelectedProduct(p)
    form.setValue("productId", p.id, { shouldValidate: true })
    form.setValue("color", p.color)
    form.setValue("size", p.size)
  }

  function clearSelection() {
    setSelectedProduct(null)
    setSearch("")
    form.setValue("productId", "")
    form.setValue("color", "")
    form.setValue("size", "")
  }

  async function onSubmit(values: SaleFormValues) {
    if (!selectedProduct) return
    if (values.quantity > selectedProduct.stock) {
      form.setError("quantity", { message: "Quantity exceeds available stock" })
      return
    }
    try {
      const sale = await createSale.mutateAsync(values)
      setCompletedSale(sale)
      toast.success("Sale completed", {
        description: `${values.quantity} × ${selectedProduct.name} — ${formatCurrency(sale.total)}`,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to complete sale"
      toast.error("Sale failed", { description: message })
    }
  }

  function handleClose(open: boolean) {
    setOpen(open)
    if (!open) {
      setTimeout(() => {
        setCompletedSale(null)
        setSelectedProduct(null)
        setSearch("")
        form.reset()
      }, 200)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[480px]">
        {completedSale ? (
          <SaleSuccess sale={completedSale} onClose={() => handleClose(false)} onViewHistory={() => { handleClose(false); setView("sales") }} />
        ) : (
          <>
            <DialogHeader>
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <ShoppingCart className="h-5 w-5" />
                </div>
                <div>
                  <DialogTitle>Sell a Product</DialogTitle>
                  <DialogDescription>Search for a product and enter the quantity to record a sale.</DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="product-search">Product *</Label>

                {selectedProduct ? (
                  <div className="flex items-center gap-3 rounded-lg border bg-muted/40 p-3">
                    {selectedProduct.imageUrl ? (
                      <img
                        src={selectedProduct.imageUrl}
                        alt={selectedProduct.name}
                        className="h-10 w-10 shrink-0 rounded-md border object-cover"
                      />
                    ) : (
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border bg-background text-muted-foreground">
                        <Package className="h-5 w-5" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{selectedProduct.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {selectedProduct.sku} · {selectedProduct.color} / {selectedProduct.size}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-0.5">
                      <span className="text-sm font-semibold tabular-nums">{formatCurrency(selectedProduct.sellingPrice)}</span>
                      <span className="text-xs text-muted-foreground">Available: {selectedProduct.stock}</span>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      onClick={clearSelection}
                      aria-label="Change product"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="product-search"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        onKeyDown={(e) => {
                          // Enter selects the first matching (in-stock) product.
                          if (e.key === "Enter" && visible.length > 0) {
                            e.preventDefault()
                            const first = visible.find((p) => p.stock > 0) ?? visible[0]
                            pickProduct(first)
                          }
                        }}
                        placeholder="Search by name, SKU, color…"
                        className="h-9 pl-9"
                        autoFocus
                      />
                    </div>
                    {isLoading ? (
                      <div className="space-y-2 rounded-md border p-2">
                        {Array.from({ length: 4 }).map((_, i) => (
                          <Skeleton key={i} className="h-10 w-full" />
                        ))}
                      </div>
                    ) : (
                      <ScrollArea className="h-60 rounded-md border">
                        <div className="divide-y divide-border">
                          {visible.length === 0 ? (
                            <p className="px-4 py-6 text-center text-xs text-muted-foreground">
                              {search
                                ? `No products match “${search}”. Try a different name, SKU or color.`
                                : "No products available yet. Add a product first."}
                            </p>
                          ) : (
                            visible.map((p) => (
                              <button
                                type="button"
                                key={p.id}
                                onClick={() => pickProduct(p)}
                                disabled={p.stock <= 0}
                                className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {p.imageUrl ? (
                                  <img
                                    src={p.imageUrl}
                                    alt={p.name}
                                    className="h-9 w-9 shrink-0 rounded-md border object-cover"
                                  />
                                ) : (
                                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border bg-muted text-muted-foreground">
                                    <Package className="h-4 w-4" />
                                  </div>
                                )}
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-sm font-medium">{p.name}</p>
                                  <p className="truncate text-xs text-muted-foreground">
                                    {p.sku} · {p.color} / {p.size}
                                  </p>
                                </div>
                                <div className="shrink-0 text-right">
                                  <p className="text-sm font-semibold tabular-nums">{formatCurrency(p.sellingPrice)}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {p.stock > 0 ? `${p.stock} in stock` : "Out of stock"}
                                  </p>
                                </div>
                              </button>
                            ))
                          )}
                        </div>
                        {truncated && (
                          <p className="border-t px-3 py-2 text-center text-xs text-muted-foreground">
                            {matches.length} matches — refine your search to see more
                          </p>
                        )}
                      </ScrollArea>
                    )}
                  </>
                )}

                {form.formState.errors.productId && (
                  <p className="text-xs text-destructive">{form.formState.errors.productId.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="quantity">Quantity *</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => form.setValue("quantity", Math.max(0.01, quantity - 1))}
                    aria-label="Decrease quantity"
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <Input
                    id="quantity"
                    type="number"
                    min={0.01}
                    step={0.01}
                    max={maxQty}
                    className="text-center"
                    {...form.register("quantity")}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => form.setValue("quantity", Math.min(maxQty, quantity + 1))}
                    aria-label="Increase quantity"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                {form.formState.errors.quantity && (
                  <p className="text-xs text-destructive">{form.formState.errors.quantity.message}</p>
                )}
                {selectedProduct && quantity > maxQty && (
                  <p className="text-xs text-destructive">Only {maxQty} units available.</p>
                )}
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Total Amount</span>
                <span className="text-xl font-semibold tabular-nums">{formatCurrency(total)}</span>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => handleClose(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createSale.isPending || !selectedProduct || selectedProduct.stock <= 0}>
                  {createSale.isPending ? (
                    <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Processing…</>
                  ) : (
                    <><CheckCircle2 className="mr-1.5 h-4 w-4" /> Confirm Sale</>
                  )}
                </Button>
              </DialogFooter>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

function SaleSuccess({ sale, onClose, onViewHistory }: { sale: Sale; onClose: () => void; onViewHistory: () => void }) {
  return (
    <div className="flex flex-col items-center gap-4 py-4 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
        <CheckCircle2 className="h-8 w-8" />
      </div>
      <div>
        <p className="text-base font-semibold">Sale recorded!</p>
        <p className="text-sm text-muted-foreground">Stock has been updated automatically.</p>
      </div>
      <div className="w-full space-y-2 rounded-lg border bg-muted/40 p-4 text-left text-sm">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-muted-foreground"><Receipt className="h-3.5 w-3.5" /> Invoice</span>
          <span className="font-mono font-medium">{sale.invoiceNumber}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-muted-foreground"><PackageSearch className="h-3.5 w-3.5" /> Product</span>
          <span className="font-medium">{sale.productName}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Quantity</span>
          <span className="font-medium">×{sale.quantity}</span>
        </div>
        <Separator />
        <div className="flex items-center justify-between">
          <span className="font-medium">Total</span>
          <span className="text-lg font-semibold">{formatCurrency(sale.total)}</span>
        </div>
      </div>
      <div className="flex w-full gap-2">
        <Button variant="outline" className="flex-1" onClick={onViewHistory}>View history</Button>
        <Button className="flex-1" onClick={onClose}>Done</Button>
      </div>
    </div>
  )
}
