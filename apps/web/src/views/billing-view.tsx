"use client"

import * as React from "react"
import { Plus, Save, Zap, FileText, X, Loader2, Trash2, Printer, Receipt } from "lucide-react"
import { Button, Input, Label, Card, CardContent, Separator, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Badge } from "@munim/ui"
import { useCreateInvoice, type CreateInvoiceInput } from "@/hooks/use-invoices"
import { useParties } from "@/hooks/use-parties"
import { useSettings } from "@/hooks/use-settings"
import { useProducts } from "@/hooks/use-products"
import { buildBillDocument, type BillDocument } from "@munim/core"
import { generateBillPDF, type BillTemplateSettings } from "@/lib/billing/generatePDF"
import { useAppStore } from "@/store/view-store"
import { formatCurrency } from "@/lib/format"
import { cn } from "@/lib/utils"
import { toast } from "sonner"


type LineItem = {
  productId?: string
  productName: string
  sku?: string
  color?: string
  size?: string
  description: string
  quantity: number
  price: number
}

const emptyLine = (): LineItem => ({
  productName: "",
  description: "",
  quantity: 1,
  price: 0,
})

type PickableProduct = {
  id: string
  name: string
  sku: string | null
  color: string | null
  size: string | null
  stock: number
  sellingPrice: number
}

export function BillingView() {
  const setView = useAppStore((s) => s.setView)
  const createInvoice = useCreateInvoice()
  const { data: settings } = useSettings()
  const { data: parties } = useParties()
  const { data: productData } = useProducts({ pageSize: 1000 })
  const products = productData?.products ?? []

  const shop = settings ?? {
    shopName: "JEWELLERY WALA",
    shopAddress: "Jhalamand Circle, Jodhpur",
    shopPhones: ["8094681299", "9460343208"],
    shopEmail: "jewellerywalaonline@gmail.com",
  }

  const [customerName, setCustomerName] = React.useState("")
  const [customerPhone, setCustomerPhone] = React.useState("")
  const [customerAddress, setCustomerAddress] = React.useState("")
  const [partyId, setPartyId] = React.useState("")
  const [date, setDate] = React.useState(new Date().toISOString().slice(0, 10))
  const [items, setItems] = React.useState<LineItem[]>([emptyLine()])
  const [deliveryCharge, setDeliveryCharge] = React.useState(0)
  const [discount, setDiscount] = React.useState(0)
  const [notes, setNotes] = React.useState("")
  const [amountPaid, setAmountPaid] = React.useState(0)
  const [template, setTemplate] = React.useState<"jewellery" | "ecommerce">("jewellery")
  const [classicColor, setClassicColor] = React.useState<"red" | "yellow">("red")
  const [twoInOne, setTwoInOne] = React.useState(false)
  const [mode, setMode] = React.useState<"duplicate" | "distinct">("duplicate")

  // Second bill — only used in 2-in-1 "Separate" mode.
  const [secondCustomerName, setSecondCustomerName] = React.useState("")
  const [secondCustomerPhone, setSecondCustomerPhone] = React.useState("")
  const [secondCustomerAddress, setSecondCustomerAddress] = React.useState("")
  const [secondPartyId, setSecondPartyId] = React.useState("")
  const [secondItems, setSecondItems] = React.useState<LineItem[]>([emptyLine()])
  const [secondDeliveryCharge, setSecondDeliveryCharge] = React.useState(0)
  const [secondDiscount, setSecondDiscount] = React.useState(0)
  const [secondAmountPaid, setSecondAmountPaid] = React.useState(0)

  const distinct = twoInOne && mode === "distinct"

  const subtotal = items.reduce((s, it) => s + it.quantity * it.price, 0)
  const total = Math.max(0, subtotal + deliveryCharge - discount)
  const paid = Math.min(amountPaid, total)

  const secondSubtotal = secondItems.reduce((s, it) => s + it.quantity * it.price, 0)
  const secondTotal = Math.max(0, secondSubtotal + secondDeliveryCharge - secondDiscount)
  const secondPaid = Math.min(secondAmountPaid, secondTotal)

  function updateItem(index: number, patch: Partial<LineItem>) {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)))
  }

  function addItem() {
    setItems((prev) => [...prev, emptyLine()])
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index))
  }

  function pickProduct(productId: string) {
    const p = products.find((x) => x.id === productId)
    if (!p) return
    // Fill the first empty item row, otherwise append
    const idx = items.findIndex((it) => !it.productName.trim())
    const item: LineItem = {
      productId: p.id,
      productName: p.name,
      sku: p.sku ?? undefined,
      color: p.color ?? undefined,
      size: p.size ?? undefined,
      description: "",
      quantity: 1,
      price: p.sellingPrice,
    }
    if (idx >= 0) {
      setItems((prev) => prev.map((it, i) => (i === idx ? item : it)))
    } else {
      setItems((prev) => [...prev, item])
    }
  }

  function buildSettings(): BillTemplateSettings {
    return { template, classicColor, twoInOne, mode }
  }

  /** Builds a SHARED BillDocument (core) — the same model desktop & mobile render. */
  function buildBill(opts: {
    customerName: string
    customerPhone: string
    customerAddress: string
    items: LineItem[]
    deliveryCharge: number
    discount: number
    amountPaid: number
  }): BillDocument {
    return buildBillDocument({
      billNo: "NEW",
      date,
      customerName: opts.customerName,
      customerPhone: opts.customerPhone,
      customerAddress: opts.customerAddress,
      shop: {
        name: shop.shopName,
        address: shop.shopAddress ?? null,
        phones: shop.shopPhones ?? [],
        email: shop.shopEmail ?? null,
      },
      lines: opts.items.map((it) => ({
        productName: it.productName,
        description: it.description || undefined,
        sku: it.sku,
        color: it.color,
        size: it.size,
        quantity: it.quantity,
        price: it.price,
      })),
      deliveryCharge: opts.deliveryCharge,
      discount: opts.discount,
      amountPaid: opts.amountPaid,
      currency: "INR",
    })
  }

  function buildFirstBill(): BillDocument {
    return buildBill({
      customerName,
      customerPhone,
      customerAddress,
      items,
      deliveryCharge,
      discount,
      amountPaid: paid,
    })
  }

  function buildSecondBill(): BillDocument {
    return buildBill({
      customerName: secondCustomerName,
      customerPhone: secondCustomerPhone,
      customerAddress: secondCustomerAddress,
      items: secondItems,
      deliveryCharge: secondDeliveryCharge,
      discount: secondDiscount,
      amountPaid: secondPaid,
    })
  }

  async function handleSaveAndPrint() {
    if (!items.some((it) => it.productName.trim())) {
      toast.error("Add at least one line item")
      return
    }
    if (distinct && !secondItems.some((it) => it.productName.trim())) {
      toast.error("Add at least one line item to the second bill")
      return
    }

    const basePayload = {
      customerPhone,
      customerAddress,
      date,
      notes,
      paymentMethod: "cash" as const,
      shopDetails: {
        name: shop.shopName,
        address: shop.shopAddress ?? "",
        phones: shop.shopPhones ?? [],
        email: shop.shopEmail ?? "",
      },
      templateSettings: buildSettings(),
    }

    const payload: CreateInvoiceInput = {
      ...basePayload,
      customerName,
      partyId: partyId && partyId !== "__none" ? partyId : undefined,
      items: items
        .filter((it) => it.productName.trim())
        .map((it) => ({ ...it, quantity: it.quantity, price: it.price })),
      deliveryCharge,
      discount,
      amountPaid: paid,
    }

    try {
      const invoice = await createInvoice.mutateAsync(payload)
      const bill = buildFirstBill()
      bill.billNo = invoice.invoiceNumber

      if (distinct) {
        const secondPayload: CreateInvoiceInput = {
          ...basePayload,
          customerName: secondCustomerName,
          partyId: secondPartyId && secondPartyId !== "__none" ? secondPartyId : undefined,
          items: secondItems
            .filter((it) => it.productName.trim())
            .map((it) => ({ ...it, quantity: it.quantity, price: it.price })),
          deliveryCharge: secondDeliveryCharge,
          discount: secondDiscount,
          amountPaid: secondPaid,
        }
        const secondInvoice = await createInvoice.mutateAsync(secondPayload)
        const secondBill = buildSecondBill()
        secondBill.billNo = secondInvoice.invoiceNumber
        generateBillPDF(bill, buildSettings(), secondBill)
        toast.success("2 bills saved", { description: `${invoice.invoiceNumber} + ${secondInvoice.invoiceNumber}` })
      } else {
        generateBillPDF(bill, buildSettings())
        toast.success("Bill saved", { description: invoice.invoiceNumber })
      }

      reset()
      setView("invoices")
    } catch (err) {
      toast.error("Failed to save bill", { description: err instanceof Error ? err.message : "Unknown error" })
    }
  }

  function reset() {
    setCustomerName("")
    setCustomerPhone("")
    setCustomerAddress("")
    setPartyId("")
    setItems([emptyLine()])
    setDeliveryCharge(0)
    setDiscount(0)
    setNotes("")
    setAmountPaid(0)
    setSecondCustomerName("")
    setSecondCustomerPhone("")
    setSecondCustomerAddress("")
    setSecondPartyId("")
    setSecondItems([emptyLine()])
    setSecondDeliveryCharge(0)
    setSecondDiscount(0)
    setSecondAmountPaid(0)
  }

  return (
    <div className="space-y-4">
      {/* Header settings */}
      <Card>
        <CardContent className="space-y-4 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-semibold">New Bill / Invoice</h2>
                <p className="text-xs text-muted-foreground">Template · {shop.shopName}</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Select
                value={template}
                onValueChange={(v) => {
                  const next = v as "jewellery" | "ecommerce"
                  setTemplate(next)
                  toast.success(next === "jewellery" ? "Classic Jewellery template" : "Modern E-commerce template", {
                    description: "Applied to this bill",
                  })
                }}
              >
                <SelectTrigger className="h-8 w-[180px] text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="jewellery">Classic Jewellery</SelectItem>
                  <SelectItem value="ecommerce">Modern E-commerce</SelectItem>
                </SelectContent>
              </Select>
              {template === "jewellery" && (
                <Select
                  value={classicColor}
                  onValueChange={(v) => {
                    const next = v as "red" | "yellow"
                    setClassicColor(next)
                    toast.success(next === "red" ? "Red theme" : "Yellow theme", {
                      description: "Bill accent color updated",
                    })
                  }}
                >
                  <SelectTrigger className="h-8 w-[150px] text-xs">
                    <span className="flex items-center gap-2">
                      <span
                        className={cn(
                          "h-3.5 w-3.5 rounded-full",
                          classicColor === "red" ? "bg-red-600" : "bg-yellow-500"
                        )}
                      />
                      {classicColor === "red" ? "Red theme" : "Yellow theme"}
                    </span>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="red">
                      <span className="flex items-center gap-2">
                        <span className="h-3.5 w-3.5 rounded-full bg-red-600" /> Red theme
                      </span>
                    </SelectItem>
                    <SelectItem value="yellow">
                      <span className="flex items-center gap-2">
                        <span className="h-3.5 w-3.5 rounded-full bg-yellow-500" /> Yellow theme
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              )}
              <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={twoInOne}
                  onChange={(e) => {
                    const next = e.target.checked
                    setTwoInOne(next)
                    toast.success(next ? "2-in-1 bill enabled" : "2-in-1 bill disabled")
                  }}
                  className="accent-amber-500"
                />
                2-in-1 bill
              </label>
              {twoInOne && (
                <Select
                  value={mode}
                  onValueChange={(v) => {
                    const next = v as "duplicate" | "distinct"
                    setMode(next)
                    toast.success(next === "duplicate" ? "Duplicate mode" : "Separate mode", {
                      description: next === "duplicate" ? "Two identical bills on one page" : "Two different bills on one page",
                    })
                  }}
                >
                  <SelectTrigger className="h-8 w-[140px] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="duplicate">Duplicate</SelectItem>
                    <SelectItem value="distinct">Separate</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>

          <Separator />

          {/* Bill to / details */}
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Bill To</p>
              <div className="space-y-2">
                <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Customer name" className="h-9" />
                <Input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="Phone" className="h-9" />
                <Input value={customerAddress} onChange={(e) => setCustomerAddress(e.target.value)} placeholder="Address" className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Link to khata party</Label>
                <Select value={partyId} onValueChange={(v) => {
                  setPartyId(v)
                  const p = parties?.find((x) => x.id === v)
                  if (p) {
                    setCustomerName(p.name)
                    if (p.phone) setCustomerPhone(p.phone)
                    if (p.address) setCustomerAddress(p.address)
                  }
                }}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="None (walk-in)" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">None (walk-in)</SelectItem>
                    {parties?.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Invoice Details</p>
              <div className="space-y-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">Date</Label>
                  <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-9" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Delivery charge (₹)</Label>
                  <Input type="number" min={0} value={deliveryCharge || ""} onChange={(e) => setDeliveryCharge(Number(e.target.value))} className="h-9" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Discount (₹)</Label>
                  <Input type="number" min={0} value={discount || ""} onChange={(e) => setDiscount(Number(e.target.value))} className="h-9" />
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">From {shop.shopName}</p>
              <div className="rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">
                <p className="font-medium text-foreground">{shop.shopName}</p>
                <p className="mt-1">{shop.shopAddress}</p>
                <p className="mt-1">Ph: {(shop.shopPhones ?? []).join(" · ")}</p>
                {shop.shopEmail && <p className="mt-1">{shop.shopEmail}</p>}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bill 1 line items */}
      <BillItemsCard title={distinct ? "Bill 1" : undefined} items={items} setItems={setItems} products={products} />

      {/* Second bill — only when 2-in-1 "Separate" is selected */}
      {distinct && (
        <>
          <Card>
            <CardContent className="space-y-4 p-5">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Receipt className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-semibold">Second Bill — separate</h3>
                    <Badge variant="secondary">Bill 2</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    A different customer &amp; items; printed on the bottom half of the 2-in-1 page.
                  </p>
                </div>
              </div>
              <div className="grid gap-4 lg:grid-cols-3">
                <div className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Bill To</p>
                  <div className="space-y-2">
                    <Input value={secondCustomerName} onChange={(e) => setSecondCustomerName(e.target.value)} placeholder="Customer name" className="h-9" />
                    <Input value={secondCustomerPhone} onChange={(e) => setSecondCustomerPhone(e.target.value)} placeholder="Phone" className="h-9" />
                    <Input value={secondCustomerAddress} onChange={(e) => setSecondCustomerAddress(e.target.value)} placeholder="Address" className="h-9" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Link to khata party</Label>
                    <Select value={secondPartyId} onValueChange={(v) => {
                      setSecondPartyId(v)
                      const p = parties?.find((x) => x.id === v)
                      if (p) {
                        setSecondCustomerName(p.name)
                        if (p.phone) setSecondCustomerPhone(p.phone)
                        if (p.address) setSecondCustomerAddress(p.address)
                      }
                    }}>
                      <SelectTrigger className="h-9"><SelectValue placeholder="None (walk-in)" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none">None (walk-in)</SelectItem>
                        {parties?.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Details</p>
                  <div className="space-y-2">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Delivery charge (₹)</Label>
                      <Input type="number" min={0} value={secondDeliveryCharge || ""} onChange={(e) => setSecondDeliveryCharge(Number(e.target.value))} className="h-9" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Discount (₹)</Label>
                      <Input type="number" min={0} value={secondDiscount || ""} onChange={(e) => setSecondDiscount(Number(e.target.value))} className="h-9" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Amount paid now (₹)</Label>
                      <Input type="number" min={0} value={secondAmountPaid || ""} onChange={(e) => setSecondAmountPaid(Number(e.target.value))} className="h-9" />
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Summary</p>
                  <div className="rounded-lg border bg-muted/40 p-3 text-xs">
                    <Row label="Subtotal" value={formatCurrency(secondSubtotal)} />
                    {secondDeliveryCharge > 0 && <Row label="Delivery" value={formatCurrency(secondDeliveryCharge)} />}
                    {secondDiscount > 0 && <Row label="Discount" value={`−${formatCurrency(secondDiscount)}`} />}
                    <div className="mt-1.5 flex items-center justify-between border-t pt-1.5">
                      <span className="font-semibold">Total</span>
                      <span className="text-base font-bold tabular-nums">{formatCurrency(secondTotal)}</span>
                    </div>
                    {secondPaid > 0 && (
                      <p className="mt-1 text-muted-foreground">
                        Paying now: {formatCurrency(secondPaid)} · Balance: {formatCurrency(secondTotal - secondPaid)}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          <BillItemsCard title="Bill 2" items={secondItems} setItems={setSecondItems} products={products} />
        </>
      )}

      {/* Summary + actions */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardContent className="space-y-3 p-4">
            <Label className="text-xs">Notes / terms</Label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Thank you for your business!"
              rows={4}
              className="w-full resize-none rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring"
            />
            <div className="space-y-1.5">
              <Label className="text-xs">Amount paid now (₹)</Label>
              <Input type="number" min={0} value={amountPaid || ""} onChange={(e) => setAmountPaid(Number(e.target.value))} className="h-9" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-2.5 p-4">
            <Row label="Subtotal" value={formatCurrency(subtotal)} />
            {deliveryCharge > 0 && <Row label="Delivery" value={formatCurrency(deliveryCharge)} />}
            {discount > 0 && <Row label="Discount" value={`−${formatCurrency(discount)}`} />}
            <Separator />
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">Total</span>
              <span className="text-2xl font-bold tabular-nums">{formatCurrency(total)}</span>
            </div>
            {distinct && (
              <p className="text-xs text-muted-foreground">
                + Second bill total: <span className="font-semibold text-foreground">{formatCurrency(secondTotal)}</span>
              </p>
            )}
            {paid > 0 && <p className="text-xs text-muted-foreground">Paying now: {formatCurrency(paid)} · Balance: {formatCurrency(total - paid)}</p>}
            <div className="flex flex-wrap gap-2 pt-2">
              <Button variant="outline" onClick={reset} className="gap-1.5"><Trash2 className="h-4 w-4" /> Clear</Button>
              <Button
                variant="outline"
                onClick={() => {
                  const settings = buildSettings()
                  if (distinct) {
                    generateBillPDF(buildFirstBill(), settings, buildSecondBill())
                  } else {
                    generateBillPDF(buildFirstBill(), settings)
                  }
                }}
                className="gap-1.5"
              >
                <Printer className="h-4 w-4" /> Preview PDF
              </Button>
              <Button onClick={handleSaveAndPrint} className="ml-auto gap-1.5" disabled={createInvoice.isPending}>
                {createInvoice.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                Save &amp; Generate Bill
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

/**
 * Product picker + line-items table. Shared by Bill 1 and the second bill in
 * 2-in-1 "Separate" mode so both bills get the same editing experience.
 */
function BillItemsCard({
  title,
  items,
  setItems,
  products,
}: {
  title?: string
  items: LineItem[]
  setItems: React.Dispatch<React.SetStateAction<LineItem[]>>
  products: PickableProduct[]
}) {
  function updateItem(index: number, patch: Partial<LineItem>) {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)))
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index))
  }

  function pickProduct(productId: string) {
    const p = products.find((x) => x.id === productId)
    if (!p) return
    const idx = items.findIndex((it) => !it.productName.trim())
    const item: LineItem = {
      productId: p.id,
      productName: p.name,
      sku: p.sku ?? undefined,
      color: p.color ?? undefined,
      size: p.size ?? undefined,
      description: "",
      quantity: 1,
      price: p.sellingPrice,
    }
    if (idx >= 0) {
      setItems((prev) => prev.map((it, i) => (i === idx ? item : it)))
    } else {
      setItems((prev) => [...prev, item])
    }
  }

  return (
    <>
      {title && (
        <p className="px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </p>
      )}
      <Card>
        <CardContent className="p-4">
          <Label className="text-xs">Add from stock (auto-fills price & details)</Label>
          <Select value="" onValueChange={(v) => v && pickProduct(v)}>
            <SelectTrigger className="mt-1.5 h-9"><SelectValue placeholder="Search product…" /></SelectTrigger>
            <SelectContent>
              {products.map((p) => (
                <SelectItem key={p.id} value={p.id} disabled={p.stock <= 0}>
                  {p.name} · {p.sku} · {p.color}/{p.size} — {formatCurrency(p.sellingPrice)} ({p.stock} in stock)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="hidden grid-cols-[1fr_70px_110px_110px_40px] gap-3 border-b px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground sm:grid">
            <span>Product / description</span>
            <span className="text-center">Qty</span>
            <span className="text-center">Rate</span>
            <span className="text-right">Amount</span>
            <span />
          </div>
          <div className="divide-y">
            {items.map((item, idx) => (
              <div key={idx} className="grid grid-cols-1 gap-2 px-4 py-3 sm:grid-cols-[1fr_70px_110px_110px_40px] sm:items-center">
                <div className="space-y-1.5">
                  <Input
                    value={item.productName}
                    onChange={(e) => updateItem(idx, { productName: e.target.value })}
                    placeholder="Product name"
                    className="h-9"
                  />
                  <Input
                    value={item.description}
                    onChange={(e) => updateItem(idx, { description: e.target.value })}
                    placeholder="Description (optional)"
                    className="h-8 text-xs"
                  />
                </div>
                <Input
                  type="number"
                  min={0}
                  value={item.quantity || ""}
                  onChange={(e) => updateItem(idx, { quantity: Number(e.target.value) })}
                  className="h-9 text-center"
                />
                <Input
                  type="number"
                  min={0}
                  value={item.price || ""}
                  onChange={(e) => updateItem(idx, { price: Number(e.target.value) })}
                  className="h-9 text-center"
                />
                <div className="flex items-center justify-between sm:justify-end">
                  <span className="text-sm font-semibold tabular-nums sm:hidden">Amount</span>
                  <span className="text-sm font-semibold tabular-nums">{formatCurrency(item.quantity * item.price)}</span>
                </div>
                <button
                  type="button"
                  onClick={() => removeItem(idx)}
                  className="justify-self-end text-muted-foreground transition-colors hover:text-destructive sm:justify-self-center"
                  aria-label="Remove item"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
          <div className="border-t p-3">
            <Button variant="outline" size="sm" onClick={() => setItems((prev) => [...prev, emptyLine()])} className="gap-1.5">
              <Plus className="h-4 w-4" /> Add line item
            </Button>
          </div>
        </CardContent>
      </Card>
    </>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  )
}
