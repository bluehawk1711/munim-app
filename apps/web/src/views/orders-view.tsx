"use client"

import * as React from "react"
import {
  Search,
  Receipt,
  ClipboardList,
  Plus,
  Eye,
  Pencil,
  Trash2,
  Loader2,
  Copy,
} from "lucide-react"
import type { OrderDto, OrderFormValues, OrderItemValues } from "@munim/core"
import { useApiClient } from "@munim/query"
import {
  Button,
  Input,
  Label,
  Card,
  CardContent,
  Skeleton,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  OrderStatusBadge,
  ConfirmDialog,
  ProductSearchSelect,
  BarcodeLookupInput,
  SummaryTile,
  type ProductOption,
  toast,
} from "@munim/ui"
import {
  useOrders,
  useCreateOrder,
  useUpdateOrder,
  useDeleteOrder,
  useGenerateOrderBill,
} from "@/hooks/use-orders"
import { useProducts } from "@/hooks/use-products"
import { useParties } from "@/hooks/use-parties"
import { useAppStore } from "@/store/view-store"
import { formatCurrency, formatDate } from "@/lib/format"

type OrderRow = OrderDto
type OrderStatusValue = OrderDto["status"]

let keySeq = 0
function nextKey(): string {
  keySeq += 1
  return `l${keySeq}`
}

type FormLine = {
  key: string
  productId: string | null
  productName: string
  sku: string | null
  color: string | null
  size: string | null
  weight: number | null
  weightUnit: "gm" | "mg" | null
  quantity: string
  price: string
}

type FormState = {
  customerName: string
  customerPhone: string
  customerAddress: string
  partyId: string
  discount: string
  delivery: string
  notes: string
  lines: FormLine[]
}

function blankLine(): FormLine {
  return {
    key: nextKey(),
    productId: null,
    productName: "",
    sku: null,
    color: null,
    size: null,
    weight: null,
    weightUnit: null,
    quantity: "1",
    price: "0",
  }
}

function blankForm(): FormState {
  return {
    customerName: "",
    customerPhone: "",
    customerAddress: "",
    partyId: "",
    discount: "",
    delivery: "",
    notes: "",
    lines: [blankLine()],
  }
}

function orderToForm(o: OrderRow): FormState {
  return {
    customerName: o.customerName ?? "",
    customerPhone: o.customerPhone ?? "",
    customerAddress: o.customerAddress ?? "",
    partyId: o.partyId ?? "",
    discount: String(o.discount || 0),
    delivery: String(o.deliveryCharge || 0),
    notes: o.notes ?? "",
    lines: o.items.map((it) => ({
      key: nextKey(),
      productId: it.productId ?? null,
      productName: it.productName,
      sku: it.sku ?? null,
      color: it.color ?? null,
      size: it.size ?? null,
      weight: it.weight ?? null,
      weightUnit: it.weightUnit === "mg" ? "mg" : it.weightUnit === "gm" ? "gm" : null,
      quantity: String(it.quantity),
      price: String(it.price),
    })),
  }
}

function toItems(lines: FormLine[]): OrderItemValues[] {
  return lines
    .filter((l) => l.productName.trim())
    .map((l) => ({
      productId: l.productId ?? undefined,
      productName: l.productName.trim(),
      sku: l.sku ?? undefined,
      color: l.color ?? undefined,
      size: l.size ?? undefined,
      weight: l.weight ?? undefined,
      weightUnit: l.weightUnit ?? undefined,
      quantity: Number(l.quantity) || 1,
      price: Number(l.price) || 0,
    }))
}

function formTotals(form: FormState) {
  const subtotal = form.lines.reduce(
    (s, l) => s + (Number(l.quantity) || 0) * (Number(l.price) || 0),
    0
  )
  const discount = Number(form.discount) || 0
  const delivery = Number(form.delivery) || 0
  const total = Math.max(0, subtotal - discount + delivery)
  return { subtotal, discount, delivery, total }
}

/* ── Create / edit form ───────────────────────────────────────── */

function OrderFormDialog({
  editing,
  onClose,
}: {
  editing: OrderRow | null
  onClose: () => void
}) {
  const [form, setForm] = React.useState<FormState>(() =>
    editing ? orderToForm(editing) : blankForm()
  )
  const createOrder = useCreateOrder()
  const updateOrder = useUpdateOrder()
  const saving = createOrder.isPending || updateOrder.isPending
  const { data: allProductsData } = useProducts({ pageSize: 1000 })
  const allProducts = allProductsData?.products
  const { data: parties } = useParties()
  const getClient = useApiClient()

  const totals = React.useMemo(() => formTotals(form), [form])

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function updateLine(i: number, patch: Partial<FormLine>) {
    setForm((prev) => ({
      ...prev,
      lines: prev.lines.map((l, x) => (x === i ? { ...l, ...patch } : l)),
    }))
  }

  function pickProduct(i: number, p: ProductOption) {
    setForm((prev) => ({
      ...prev,
      lines: prev.lines.map((l, x) =>
        x === i
          ? {
              ...l,
              productId: p.id,
              productName: p.name,
              sku: p.sku ?? null,
              color: p.color ?? null,
              size: p.size ?? null,
              weight: p.weight ?? null,
              weightUnit: p.weightUnit === "mg" ? "mg" : "gm",
              price: String(p.effectivePrice ?? p.sellingPrice),
            }
          : l
      ),
    }))
  }

  async function handleBarcodeAdd(code: string) {
    const api = await getClient()
    const found = await api.products.byBarcode(code)
    if (!found) return
    setForm((prev) => ({
      ...prev,
      lines: [
        ...prev.lines,
        {
          ...blankLine(),
          productId: found.id,
          productName: found.name,
          sku: found.sku ?? null,
          color: found.color ?? null,
          size: found.size ?? null,
          weight: found.weight ?? null,
          weightUnit: found.weightUnit === "mg" ? "mg" : "gm",
          price: String(found.effectivePrice ?? found.sellingPrice),
        },
      ],
    }))
  }

  function pickParty(id: string) {
    const p = parties?.find((x) => x.id === id)
    setForm((prev) => ({
      ...prev,
      partyId: id,
      customerName: p?.name || prev.customerName,
      customerPhone: p?.phone || prev.customerPhone,
      customerAddress: p?.address || prev.customerAddress,
    }))
  }

  async function save() {
    const items = toItems(form.lines)
    if (items.length === 0) {
      toast.error("Add at least one line item")
      return
    }
    const values: OrderFormValues = {
      customerName: form.customerName.trim() || undefined,
      customerPhone: form.customerPhone.trim() || undefined,
      customerAddress: form.customerAddress.trim() || undefined,
      partyId: form.partyId && form.partyId !== "__none" ? form.partyId : undefined,
      items,
      discount: Number(form.discount) || 0,
      deliveryCharge: Number(form.delivery) || 0,
      notes: form.notes.trim() || undefined,
    }
    try {
      if (editing) {
        await updateOrder.mutateAsync({ id: editing.id, values })
        toast.success("Order updated", { description: editing.orderNumber })
      } else {
        const created = await createOrder.mutateAsync(values)
        toast.success("Order created", { description: created.orderNumber })
      }
      onClose()
    } catch (err) {
      toast.error(editing ? "Update failed" : "Could not create order", {
        description: err instanceof Error ? err.message : undefined,
      })
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="h-4 w-4" />
            {editing ? `Edit ${editing.orderNumber}` : "New order"}
          </DialogTitle>
          <DialogDescription>
            Quote items at locked prices — stock is checked only when you bill it.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          {/* Customer */}
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="of-cust">Customer</Label>
              <Input
                id="of-cust"
                value={form.customerName}
                onChange={(e) => setField("customerName", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="of-phone">Phone</Label>
              <Input
                id="of-phone"
                value={form.customerPhone}
                onChange={(e) => setField("customerPhone", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="of-addr">Address</Label>
              <Input
                id="of-addr"
                value={form.customerAddress}
                onChange={(e) => setField("customerAddress", e.target.value)}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-3">
              <Label htmlFor="of-party">Link to khata party</Label>
              <Select
                value={form.partyId || "__none"}
                onValueChange={(v) => (v === "__none" ? setField("partyId", "") : pickParty(v))}
              >
                <SelectTrigger id="of-party" className="w-full">
                  <SelectValue placeholder="None (walk-in)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">None (walk-in)</SelectItem>
                  {parties?.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Lines */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Items</Label>
              <span className="text-[11px] text-muted-foreground">
                Quoted prices carry into the bill as-is
              </span>
            </div>
            <BarcodeLookupInput
              onLookup={handleBarcodeAdd}
              placeholder="Scan barcode or type SKU to add a line"
              className="sm:max-w-[320px]"
            />
            <div className="space-y-2">
              {form.lines.map((line, index) => (
                <div
                  key={line.key}
                  className="bg-muted/50 flex flex-wrap items-end gap-2 rounded-lg border p-3"
                >
                  <div className="min-w-56 flex-1 space-y-1.5">
                    <div className="flex items-center gap-1.5">
                      <Label>Item {index + 1}</Label>
                      {line.sku && (
                        <span className="inline-flex items-center gap-1 rounded border bg-background px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                          {line.sku}
                          <button
                            type="button"
                            aria-label="Copy SKU"
                            onClick={() => void navigator.clipboard.writeText(line.sku ?? "")}
                            className="text-muted-foreground transition-colors hover:text-foreground"
                          >
                            <Copy className="h-3 w-3" />
                          </button>
                        </span>
                      )}
                      {line.weight != null && (
                        <span className="text-[10px] text-muted-foreground">
                          {line.weight}
                          {line.weightUnit ?? "gm"}
                        </span>
                      )}
                    </div>
                    <ProductSearchSelect
                      products={allProducts}
                      onSelect={(p) => pickProduct(index, p)}
                      placeholder={line.productId ? "Swap product…" : "Search from stock…"}
                    />
                  </div>
                  <div className="min-w-40 flex-1 space-y-1.5">
                    <Label>Or type item name</Label>
                    <Input
                      value={line.productName}
                      onChange={(e) => updateLine(index, { productName: e.target.value })}
                    />
                  </div>
                  <div className="w-20 space-y-1.5">
                    <Label>Qty</Label>
                    <Input
                      type="number"
                      min={1}
                      value={line.quantity}
                      onChange={(e) => updateLine(index, { quantity: e.target.value })}
                    />
                  </div>
                  <div className="w-28 space-y-1.5">
                    <Label>Quoted ₹</Label>
                    <Input
                      type="number"
                      min={0}
                      value={line.price}
                      onChange={(e) => updateLine(index, { price: e.target.value })}
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove item ${index + 1}`}
                    onClick={() =>
                      setForm((prev) => ({ ...prev, lines: prev.lines.filter((_, x) => x !== index) }))
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setForm((prev) => ({ ...prev, lines: [...prev.lines, blankLine()] }))}
              >
                <Plus className="h-4 w-4" /> Add item
              </Button>
            </div>
          </div>

          {/* Adjustments */}
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="of-disc">Discount (₹)</Label>
              <Input
                id="of-disc"
                type="number"
                min={0}
                value={form.discount}
                onChange={(e) => setField("discount", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="of-del">Delivery charge (₹)</Label>
              <Input
                id="of-del"
                type="number"
                min={0}
                value={form.delivery}
                onChange={(e) => setField("delivery", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="of-notes">Notes</Label>
              <Input
                id="of-notes"
                value={form.notes}
                onChange={(e) => setField("notes", e.target.value)}
                placeholder="e.g. ready after Friday"
              />
            </div>
          </div>

          {/* Totals */}
          <div className="bg-muted/50 space-y-1.5 rounded-lg border p-3 text-sm">
            <p className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="tabular-nums">{formatCurrency(totals.subtotal)}</span>
            </p>
            {totals.discount > 0 && (
              <p className="flex justify-between">
                <span className="text-muted-foreground">Discount</span>
                <span className="tabular-nums">-{formatCurrency(totals.discount)}</span>
              </p>
            )}
            {totals.delivery > 0 && (
              <p className="flex justify-between">
                <span className="text-muted-foreground">Delivery</span>
                <span className="tabular-nums">+{formatCurrency(totals.delivery)}</span>
              </p>
            )}
            <p className="flex justify-between border-t pt-1.5">
              <span className="font-semibold">Quoted total</span>
              <span className="font-bold tabular-nums">{formatCurrency(totals.total)}</span>
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={() => void save()} disabled={saving} className="gap-1.5">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {editing ? "Save changes" : "Create order"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ── Page ─────────────────────────────────────────────────────── */

export function OrdersView() {
  const setView = useAppStore((s) => s.setActiveView)
  const [search, setSearch] = React.useState("")
  const [status, setStatus] = React.useState<"all" | OrderStatusValue>("all")
  const [page, setPage] = React.useState(1)

  const [formOpen, setFormOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<OrderRow | null>(null)
  const [detail, setDetail] = React.useState<OrderRow | null>(null)
  const [billing, setBilling] = React.useState<OrderRow | null>(null)
  const [cancelling, setCancelling] = React.useState<OrderRow | null>(null)
  const [deleting, setDeleting] = React.useState<OrderRow | null>(null)

  const { data, isLoading } = useOrders({ search, status, page, pageSize: 15 })
  const orders = React.useMemo(() => data?.orders ?? [], [data])
  const pagination = data?.pagination

  const createOrder = useCreateOrder()
  const updateOrder = useUpdateOrder()
  const deleteOrder = useDeleteOrder()
  const generateBill = useGenerateOrderBill()

  const openOrders = orders.filter((o) => o.status === "OPEN")
  const openValue = openOrders.reduce((s, o) => s + o.total, 0)

  function openCreate() {
    setEditing(null)
    setFormOpen(true)
  }

  function openEdit(o: OrderRow) {
    setDetail(null)
    setEditing(o)
    setFormOpen(true)
  }

  async function confirmBill() {
    if (!billing) return
    try {
      const result = await generateBill.mutateAsync(billing.id)
      const orderNumber = billing.orderNumber
      setBilling(null)
      setDetail(null)
      toast.success("Bill created", {
        description: `${result.invoice.invoiceNumber} — ${orderNumber} is now billed. Open Invoices to view it.`,
      })
    } catch (err) {
      toast.error("Could not bill order", {
        description: err instanceof Error ? err.message : undefined,
      })
    }
  }

  async function confirmCancel() {
    if (!cancelling) return
    try {
      await updateOrder.mutateAsync({ id: cancelling.id, values: { status: "CANCELLED" } })
      toast.success("Order cancelled", { description: cancelling.orderNumber })
      setCancelling(null)
      setDetail(null)
    } catch (err) {
      toast.error("Cancel failed", {
        description: err instanceof Error ? err.message : undefined,
      })
    }
  }

  async function confirmDelete() {
    if (!deleting) return
    try {
      await deleteOrder.mutateAsync(deleting.id)
      toast.success("Order deleted", { description: deleting.orderNumber })
      setDeleting(null)
      setDetail(null)
    } catch (err) {
      toast.error("Delete failed", {
        description: err instanceof Error ? err.message : undefined,
      })
    }
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div className="flex w-full flex-col gap-2">
          <div className="relative w-full sm:max-w-xs">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
              placeholder="Search order #, customer…"
              className="h-9 pl-9"
              aria-label="Search orders"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border/60 bg-muted/30 px-2.5 py-2">
            <Select
              value={status}
              onValueChange={(v) => {
                setStatus(v as typeof status)
                setPage(1)
              }}
            >
              <SelectTrigger className="h-9 w-[150px]" aria-label="Filter by status">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="OPEN">Open</SelectItem>
                <SelectItem value="COMPLETED">Billed</SelectItem>
                <SelectItem value="CANCELLED">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <Button onClick={openCreate} className="h-9 gap-1.5">
          <Plus className="h-4 w-4" /> New order
        </Button>
      </div>

      {/* Summary strip */}
      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryTile
          label="Open quoted value"
          value={formatCurrency(openValue)}
          icon={ClipboardList}
          size="sm"
        />
        <SummaryTile
          label="Open orders"
          value={String(openOrders.length)}
          icon={Receipt}
          accent="amber"
          size="sm"
        />
        <SummaryTile
          label="Total orders"
          value={String(pagination?.totalCount ?? orders.length)}
          icon={Receipt}
          accent="emerald"
          size="sm"
        />
      </div>

      {/* List */}
      {isLoading ? (
        <Card>
          <CardContent className="space-y-2 p-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </CardContent>
        </Card>
      ) : orders.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <ClipboardList className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-semibold">No orders found</p>
              <p className="text-xs text-muted-foreground">
                Quote an order now, bill it when the customer confirms.
              </p>
            </div>
            <Button size="sm" onClick={openCreate} className="gap-1.5">
              <Plus className="h-4 w-4" /> New order
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y">
              {orders.map((o) => (
                <div
                  key={o.id}
                  className="flex flex-col gap-2 px-4 py-3 hover:bg-muted/30 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                      <ClipboardList className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-medium">{o.orderNumber}</span>
                        <OrderStatusBadge status={o.status} />
                      </div>
                      <p className="truncate text-sm font-medium">
                        {o.customerName || "Walk-in customer"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(o.date)} · {o.items.length} item
                        {o.items.length !== 1 ? "s" : ""}
                        {o.items[0]?.productName ? ` · ${o.items[0].productName}` : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-3 sm:flex-col sm:items-end sm:gap-0.5">
                    <p className="text-sm font-semibold tabular-nums">{formatCurrency(o.total)}</p>
                    <div className="mt-1 flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        aria-label={`View ${o.orderNumber}`}
                        onClick={() => setDetail(o)}
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                      {o.status === "OPEN" && (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            aria-label={`Edit ${o.orderNumber}`}
                            onClick={() => openEdit(o)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 gap-1 text-xs"
                            onClick={() => setBilling(o)}
                          >
                            <Receipt className="h-3.5 w-3.5" /> Bill
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            aria-label={`Delete ${o.orderNumber}`}
                            onClick={() => setDeleting(o)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      )}
                      {o.status === "CANCELLED" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          aria-label={`Delete ${o.orderNumber}`}
                          onClick={() => setDeleting(o)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {pagination && pagination.totalPages > 1 && (
              <div className="flex items-center justify-between border-t px-4 py-2.5">
                <p className="text-xs text-muted-foreground">
                  Page {pagination.page} of {pagination.totalPages} · {pagination.totalCount}{" "}
                  orders
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7"
                    disabled={page <= 1}
                    onClick={() => setPage(page - 1)}
                  >
                    Prev
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7"
                    disabled={page >= pagination.totalPages}
                    onClick={() => setPage(page + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Create / edit */}
      {formOpen && (
        <OrderFormDialog
          key={editing?.id ?? "new"}
          editing={editing}
          onClose={() => setFormOpen(false)}
        />
      )}

      {/* Detail */}
      <Dialog open={!!detail} onOpenChange={(open) => !open && setDetail(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          {detail && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <ClipboardList className="h-4 w-4" /> {detail.orderNumber}
                </DialogTitle>
                <DialogDescription>
                  {formatDate(detail.date)} · <OrderStatusBadge status={detail.status} />
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 text-sm">
                <div className="space-y-1 rounded-lg border p-3">
                  <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                    Customer
                  </p>
                  <p className="font-medium">{detail.customerName || "Walk-in customer"}</p>
                  {detail.customerPhone && (
                    <p className="text-xs text-muted-foreground">{detail.customerPhone}</p>
                  )}
                  {detail.customerAddress && (
                    <p className="text-xs text-muted-foreground">{detail.customerAddress}</p>
                  )}
                </div>

                <div className="overflow-hidden rounded-lg border">
                  <div className="bg-muted/50 grid grid-cols-[1fr_50px_80px_85px] gap-2 px-3 py-2 text-xs font-semibold text-muted-foreground">
                    <span>Item</span>
                    <span className="text-right">Qty</span>
                    <span className="text-right">Quoted</span>
                    <span className="text-right">Total</span>
                  </div>
                  <div className="divide-y">
                    {detail.items.map((item) => (
                      <div
                        key={item.id}
                        className="grid grid-cols-[1fr_50px_80px_85px] gap-2 px-3 py-2"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-medium">{item.productName}</p>
                          <p className="truncate text-[11px] text-muted-foreground">
                            {item.sku}
                            {item.color ? ` · ${item.color}` : ""}
                            {item.size ? ` · ${item.size}` : ""}
                            {item.weight != null ? ` · ${item.weight}${item.weightUnit ?? "gm"}` : ""}
                          </p>
                        </div>
                        <span className="text-right tabular-nums">{item.quantity}</span>
                        <span className="text-right tabular-nums">
                          {formatCurrency(item.price)}
                        </span>
                        <span className="text-right font-medium tabular-nums">
                          {formatCurrency(item.total)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5 rounded-lg border p-3">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="tabular-nums">{formatCurrency(detail.subtotal)}</span>
                  </div>
                  {detail.discount > 0 && (
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Discount</span>
                      <span className="tabular-nums text-red-600 dark:text-red-400">
                        -{formatCurrency(detail.discount)}
                      </span>
                    </div>
                  )}
                  {detail.deliveryCharge > 0 && (
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Delivery</span>
                      <span className="tabular-nums">+{formatCurrency(detail.deliveryCharge)}</span>
                    </div>
                  )}
                  <div className="flex justify-between border-t pt-1.5 text-sm font-bold">
                    <span>Quoted total</span>
                    <span className="tabular-nums">{formatCurrency(detail.total)}</span>
                  </div>
                </div>

                {detail.notes && (
                  <div className="rounded-lg border p-3">
                    <p className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                      Notes
                    </p>
                    <p className="text-xs">{detail.notes}</p>
                  </div>
                )}
              </div>

              <DialogFooter className="flex-wrap justify-between gap-2 sm:justify-between">
                <Button variant="outline" onClick={() => setDetail(null)}>
                  Close
                </Button>
                <div className="flex flex-wrap gap-2">
                  {detail.status === "OPEN" && (
                    <>
                      <Button variant="outline" className="gap-1.5" onClick={() => openEdit(detail)}>
                        <Pencil className="h-3.5 w-3.5" /> Edit
                      </Button>
                      <Button
                        variant="outline"
                        className="gap-1.5 text-destructive hover:text-destructive"
                        onClick={() => {
                          setDetail(null)
                          setCancelling(detail)
                        }}
                      >
                        Cancel order
                      </Button>
                      <Button className="gap-1.5" onClick={() => setBilling(detail)}>
                        <Receipt className="h-3.5 w-3.5" /> Generate bill
                      </Button>
                    </>
                  )}
                  {detail.status === "COMPLETED" && (
                    <Button
                      variant="outline"
                      className="gap-1.5"
                      onClick={() => {
                        setDetail(null)
                        setView("invoices")
                      }}
                    >
                      View invoices
                    </Button>
                  )}
                </div>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Bill confirmation — prefilled summary */}
      <Dialog open={!!billing} onOpenChange={(open) => !open && setBilling(null)}>
        <DialogContent className="sm:max-w-md">
          {billing && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Receipt className="h-4 w-4" /> Bill {billing.orderNumber}?
                </DialogTitle>
                <DialogDescription>
                  Creates a real invoice from this quote. Stock is checked right now.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3 text-sm">
                <div className="bg-muted/50 space-y-1.5 rounded-lg border p-3">
                  <p className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Customer</span>
                    <span>{billing.customerName || "Walk-in customer"}</span>
                  </p>
                  <p className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Items</span>
                    <span>
                      {billing.items.length} line{billing.items.length !== 1 ? "s" : ""}
                    </span>
                  </p>
                  <p className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Quoted total</span>
                    <span className="font-semibold tabular-nums">
                      {formatCurrency(billing.total)}
                    </span>
                  </p>
                </div>
                <p className="text-xs text-muted-foreground">
                  Quoted prices are carried into the bill as-is. If any item is out of stock the
                  billing fails and the order stays open.
                </p>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setBilling(null)} disabled={generateBill.isPending}>
                  Cancel
                </Button>
                <Button
                  onClick={() => void confirmBill()}
                  disabled={generateBill.isPending}
                  className="gap-1.5"
                >
                  {generateBill.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  Generate bill
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Cancel confirm */}
      <ConfirmDialog
        open={!!cancelling}
        onOpenChange={(open) => !open && setCancelling(null)}
        title="Cancel order?"
        description={
          <>
            <strong>{cancelling?.orderNumber}</strong> will be marked cancelled. You can still
            delete it afterwards.
          </>
        }
        confirmLabel="Cancel order"
        busy={updateOrder.isPending}
        onConfirm={() => void confirmCancel()}
      />

      {/* Delete confirm */}
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Delete order?"
        description={
          <>
            <strong>{deleting?.orderNumber}</strong> will be removed permanently. Billed orders
            cannot be deleted.
          </>
        }
        confirmLabel="Delete"
        busy={deleteOrder.isPending}
        onConfirm={() => void confirmDelete()}
      />
    </div>
  )
}
