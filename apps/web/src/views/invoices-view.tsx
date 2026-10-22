"use client"

import * as React from "react"
import {
  Search,
  Receipt,
  Plus,
  Trash2,
  IndianRupee,
  CheckCircle2,
  Clock,
  XCircle,
  FileText,
  Printer,
  Eye,
  FileDown,
  Loader2,
  Pencil,
} from "lucide-react"
import { Button, Input, Card, CardContent, Skeleton, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SummaryTile, InvoiceStatusBadge, InvoicePaymentLine, RecordPaymentDialog, ConfirmDialog, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, type RecordPaymentSubmit } from "@munim/ui"
import { buildBillDocument, generateBillPDF, mergeBillTemplateSettings, type BillShopDetails, type InvoiceDto } from "@munim/core"
import { useGoldRates } from "@munim/query"

import { useInvoices, useDeleteInvoice, useRecordPayment, useInvoicePayments } from "@/hooks/use-invoices"
import { useSettings, type ShopSettings } from "@/hooks/use-settings"
import { useAppStore } from "@/store/view-store"
import { formatCurrency, formatDate } from "@/lib/format"
import type { Invoice } from "@/lib/types"
import { toast } from "@munim/ui"

/** Shop letterhead for a reprinted bill — same shape the bills use. */
function settingsToShop(s: ShopSettings): BillShopDetails {
  return { name: s.shopName, address: s.shopAddress, phones: Array.isArray(s.shopPhones) ? s.shopPhones : [], email: s.shopEmail }
}

/** Invoice status pills — All / Paid / Partial / Unpaid / Draft (the Partial
 *  pill surfaces bills with an advance received but balance still due). */
const INVOICE_STATUS_PILLS = [
  { kind: "all" as const, label: "All" },
  { kind: "PAID" as const, label: "Paid" },
  { kind: "PARTIAL" as const, label: "Partial" },
  { kind: "UNPAID" as const, label: "Unpaid" },
  { kind: "DRAFT" as const, label: "Draft" },
] as const

/** Load a stored bill into the New Bill screen for editing — the URL becomes
 *  `?view=billing&edit=<id>` (the same flow desktop and mobile use). The
 *  `edit` param is written FIRST so the store's own `?view=` sync preserves it. */
function openBillEditor(id: string) {
  const url = new URL(window.location.href)
  url.searchParams.set("edit", id)
  window.history.pushState({}, "", url)
  useAppStore.getState().setActiveView("billing")
}

export function InvoicesView() {
  const setView = useAppStore((s) => s.setActiveView)
  const [search, setSearch] = React.useState("")
  const [status, setStatus] = React.useState<"DRAFT" | "UNPAID" | "PARTIAL" | "PAID" | "all">("all")
  const [page, setPage] = React.useState(1)

  const { data, isLoading } = useInvoices({ search, status, page, pageSize: 15 })
  const invoices = data?.invoices ?? []
  const pagination = data?.pagination

  const [paying, setPaying] = React.useState<Invoice | null>(null)
  const [deleting, setDeleting] = React.useState<Invoice | null>(null)
  const [detail, setDetail] = React.useState<InvoiceDto | null>(null)
  const [exporting, setExporting] = React.useState<string | null>(null)

  const deleteInvoice = useDeleteInvoice()
  const recordPayment = useRecordPayment(paying?.id ?? "")
  const { data: settings } = useSettings()
  const { data: goldRates } = useGoldRates()
  // Payment trail for the open detail dialog — how much, when, cash/online.
  const { data: detailPayments } = useInvoicePayments(detail?.id ?? null)

  function openPayment(inv: Invoice) {
    setPaying(inv)
  }

  async function confirmDelete() {
    if (!deleting) return
    try {
      await deleteInvoice.mutateAsync(deleting.id)
      toast.success("Invoice deleted", { description: `${deleting.invoiceNumber} removed and stock restored.` })
      setDeleting(null)
    } catch (err) {
      toast.error("Delete failed", { description: err instanceof Error ? err.message : "Unknown error" })
    }
  }

  async function confirmPayment(submit: RecordPaymentSubmit) {
    if (!paying) return
    try {
      await recordPayment.mutateAsync({
        amount: submit.amount,
        method: submit.method,
        note: submit.note || undefined,
      })
      toast.success("Payment recorded", {
        description: `${formatCurrency(submit.amount)} received · ${submit.method === "online" ? "Online" : "Cash"}`,
      })
      setPaying(null)
    } catch (err) {
      toast.error("Payment failed", { description: err instanceof Error ? err.message : "Unknown error" })
    }
  }

  async function handleDownload(inv: InvoiceDto) {
    const shop = inv.shopDetails
      ? { name: inv.shopDetails.name, address: inv.shopDetails.address ?? "", phones: inv.shopDetails.phones, email: inv.shopDetails.email ?? "" }
      : settings
        ? settingsToShop(settings)
        : null
    if (!shop) {
      toast.error("Shop settings not loaded — open Settings first")
      return
    }
    setExporting(inv.id)
    try {
      // Yield a frame so the per-row spinner paints before the synchronous
      // jsPDF render blocks the main thread.
      await new Promise<void>((resolve) => setTimeout(resolve, 0))
      const bill = buildBillDocument({
        billNo: inv.invoiceNumber,
        date: inv.date,
        customerName: inv.customerName,
        customerPhone: inv.customerPhone,
        customerAddress: inv.customerAddress,
        shop,
        lines: inv.items.map((it) => ({
          productName: it.productName,
          description: it.description,
          sku: it.sku,
          color: it.color,
          size: it.size,
          weight: it.weight,
          weightUnit: it.weightUnit,
          purity: it.purity,
          grossWeight: it.grossWeight,
          nagLessWeight: it.nagLessWeight,
          chejatWeight: it.chejatWeight,
          pricing: it.pricing,
          quantity: it.quantity,
          price: it.price,
        })),
        discount: inv.discount,
        deliveryCharge: inv.deliveryCharge,
        materialReturnedWeight: inv.materialReturnedWeight,
        materialReturnedValue: inv.materialReturnedValue,
        materialReturnedTitle: inv.materialReturnedTitle,
        amountPaid: inv.amountPaid,
        status: inv.status,
        currency: settings?.currency ?? "INR",
        goldRate: inv.goldRate ?? goldRates?.baseRatePerGram ?? null,
        // Purity of the quoted rate — the "24 carat" line (current base karat;
        // no column exists to freeze it per-bill, same fallback the rate uses).
        goldRateKarat: goldRates?.baseKarat ?? null,
        silverRate: inv.silverRate ?? settings?.silverRatePerGram ?? null,
      })
      generateBillPDF(bill, mergeBillTemplateSettings(inv.templateSettings))
      toast.success("PDF downloaded", { description: inv.invoiceNumber })
    } catch (err) {
      toast.error("Could not generate PDF", { description: err instanceof Error ? err.message : "Unknown error" })
    } finally {
      setExporting(null)
    }
  }

  return (
    <div className="space-y-4">
      {/* Toolbar — search on row 1, filters on row 2, actions right */}
      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div className="flex w-full flex-col gap-2">
          <div className="relative w-full sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              placeholder="Search invoice #, customer…"
              className="h-9 pl-9"
              aria-label="Search invoices"
            />
          </div>
          {/* Status pills — same style as Orders / desktop: a Partial pill so
              advance-received bills are one tap away. */}
          <div className="flex flex-wrap items-center gap-1.5">
            {INVOICE_STATUS_PILLS.map((pill) => {
              const active = status === pill.kind
              return (
                <button
                  key={pill.kind}
                  type="button"
                  onClick={() => { setStatus(pill.kind); setPage(1) }}
                  className={
                    "inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors " +
                    (active
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card text-muted-foreground hover:bg-muted/60 hover:text-foreground")
                  }
                >
                  {pill.label}
                </button>
              )
            })}
          </div>
        </div>
        <Button onClick={() => setView("billing")} className="h-9 gap-1.5">
          <Plus className="h-4 w-4" /> New Bill
        </Button>
      </div>

      {/* Summary strip */}
      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryTile label="Total invoices" value={formatCurrency(invoices.reduce((s, i) => s + i.total, 0))} icon={Receipt} size="sm" />
        <SummaryTile label="Unpaid balance" value={formatCurrency(invoices.reduce((s, i) => s + (i.total - i.amountPaid), 0))} icon={Clock} accent="amber" size="sm" />
        <SummaryTile label="Collected" value={formatCurrency(invoices.reduce((s, i) => s + i.amountPaid, 0))} icon={CheckCircle2} accent="emerald" size="sm" />
      </div>

      {/* List */}
      {isLoading ? (
        <Card>
          <CardContent className="space-y-2 p-4">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
          </CardContent>
        </Card>
      ) : invoices.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <FileText className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-semibold">No invoices found</p>
              <p className="text-xs text-muted-foreground">Create your first bill to start tracking money.</p>
            </div>
            <Button size="sm" onClick={() => setView("billing")} className="gap-1.5">
              <Plus className="h-4 w-4" /> Create bill
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y">
              {invoices.map((inv) => {
                const outstanding = inv.total - inv.amountPaid
                return (
                  <div key={inv.id} className="flex flex-col gap-2 px-4 py-3 hover:bg-muted/30 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                        <Receipt className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs font-medium">{inv.invoiceNumber}</span>
                          <InvoiceStatusBadge status={inv.status} />
                        </div>
                        <p className="truncate text-sm font-medium">{inv.customerName || "Walk-in customer"}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(inv.date)} · {inv.items.length} item{inv.items.length !== 1 ? "s" : ""}
                          {inv.items[0]?.productName ? ` · ${inv.items[0].productName}` : ""}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-3 sm:flex-col sm:items-end sm:gap-0.5">
                      <p className="text-sm font-semibold tabular-nums">{formatCurrency(inv.total)}</p>
                      {/* Orders-style money line — Paid ₹5,000/- · ₹7,200/- due,
                          or the green tick once fully settled. */}
                      <InvoicePaymentLine total={inv.total} amountPaid={inv.amountPaid} />
                      <div className="mt-1 flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          title="View details"
                          onClick={() => setDetail(inv)}
                          aria-label={`View ${inv.invoiceNumber}`}
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          title="Edit bill"
                          onClick={() => openBillEditor(inv.id)}
                          aria-label={`Edit ${inv.invoiceNumber}`}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          title="Download PDF"
                          onClick={() => void handleDownload(inv)}
                          disabled={exporting !== null}
                          aria-label={`Download PDF ${inv.invoiceNumber}`}
                        >
                          {exporting === inv.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileDown className="h-3.5 w-3.5" />}
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={() => openPayment(inv)} disabled={outstanding <= 0}>
                          <IndianRupee className="h-3.5 w-3.5" /> Pay
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => setDeleting(inv)}
                          aria-label={`Delete ${inv.invoiceNumber}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {pagination && pagination.totalPages > 1 && (
              <div className="flex items-center justify-between border-t px-4 py-2.5">
                <p className="text-xs text-muted-foreground">
                  Page {pagination.page} of {pagination.totalPages} · {pagination.totalCount} invoices
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="h-7" disabled={page <= 1} onClick={() => setPage(page - 1)}>Prev</Button>
                  <Button variant="outline" size="sm" className="h-7" disabled={page >= pagination.totalPages} onClick={() => setPage(page + 1)}>Next</Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Payment dialog */}
      <RecordPaymentDialog
        key={paying?.id ?? "closed"}
        open={!!paying}
        onOpenChange={(open) => !open && setPaying(null)}
        invoice={paying}
        busy={recordPayment.isPending}
        onConfirm={(amount) => void confirmPayment(amount)}
      />

      {/* Delete dialog */}
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Delete invoice?"
        description={
          <>
            <strong>{deleting?.invoiceNumber}</strong> will be removed and its stock restored.
          </>
        }
        confirmLabel="Delete"
        busy={deleteInvoice.isPending}
        onConfirm={() => void confirmDelete()}
      />

      {/* Invoice detail dialog */}
      <Dialog open={!!detail} onOpenChange={(open) => !open && setDetail(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          {detail && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Receipt className="h-4 w-4" /> {detail.invoiceNumber}
                </DialogTitle>
                <DialogDescription>
                  {formatDate(detail.date)} · <InvoiceStatusBadge status={detail.status} />
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 text-sm">
                {/* Customer */}
                <div className="space-y-1 rounded-lg border p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Customer</p>
                  <p className="font-medium">{detail.customerName || "Walk-in customer"}</p>
                  {detail.customerPhone && <p className="text-xs text-muted-foreground">{detail.customerPhone}</p>}
                  {detail.customerAddress && <p className="text-xs text-muted-foreground">{detail.customerAddress}</p>}
                </div>

                {/* Line items */}
                <div className="overflow-hidden rounded-lg border">
                  <div className="bg-muted/50 grid grid-cols-[1fr_60px_80px_90px] gap-2 px-3 py-2 text-xs font-semibold text-muted-foreground">
                    <span>Item</span>
                    <span className="text-right">Qty</span>
                    <span className="text-right">Price</span>
                    <span className="text-right">Total</span>
                  </div>
                  <div className="divide-y">
                    {detail.items.map((item) => (
                      <div key={item.id} className="grid grid-cols-[1fr_60px_80px_90px] gap-2 px-3 py-2">
                        <div className="min-w-0">
                          <p className="truncate font-medium">{item.productName}</p>
                          <p className="truncate text-[11px] text-muted-foreground">
                            {item.sku}{item.color ? ` · ${item.color}` : ""}{item.size ? ` · ${item.size}` : ""}
                          </p>
                        </div>
                        <span className="text-right tabular-nums">{item.quantity}</span>
                        <span className="text-right tabular-nums">{formatCurrency(item.price)}</span>
                        <span className="text-right font-medium tabular-nums">{formatCurrency(item.total)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Totals */}
                <div className="space-y-1.5 rounded-lg border p-3">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="tabular-nums">{formatCurrency(detail.subtotal)}</span>
                  </div>
                  {detail.discount > 0 && (
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Discount</span>
                      <span className="tabular-nums text-red-600 dark:text-red-400">-{formatCurrency(detail.discount)}</span>
                    </div>
                  )}
                  {detail.deliveryCharge > 0 && (
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Delivery</span>
                      <span className="tabular-nums">+{formatCurrency(detail.deliveryCharge)}</span>
                    </div>
                  )}
                  <div className="flex justify-between border-t pt-1.5 text-sm font-bold">
                    <span>Total</span>
                    <span className="tabular-nums">{formatCurrency(detail.total)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Paid</span>
                    <span className="tabular-nums">{formatCurrency(detail.amountPaid)}</span>
                  </div>
                  {detail.total - detail.amountPaid > 0 && (
                    <div className="flex justify-between text-xs font-medium">
                      <span className="text-amber-600 dark:text-amber-400">Outstanding</span>
                      <span className="tabular-nums text-amber-600 dark:text-amber-400">{formatCurrency(detail.total - detail.amountPaid)}</span>
                    </div>
                  )}
                </div>

                {detail.notes && (
                  <div className="rounded-lg border p-3">
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Notes</p>
                    <p className="text-xs">{detail.notes}</p>
                  </div>
                )}

                {/* Payments — the full trail: how much, when, and HOW (cash/online). */}
                {(detailPayments?.length ?? 0) > 0 && (
                  <div className="rounded-lg border p-3">
                    <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Payments</p>
                    <div className="space-y-1.5">
                      {detailPayments?.map((p) => (
                        <div key={p.id} className="flex items-center justify-between gap-2 text-xs">
                          <div className="min-w-0">
                            <p className="font-medium capitalize">
                              {formatCurrency(p.amount)}
                              <span className="ml-1.5 rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase text-muted-foreground">
                                {p.method || "cash"}
                              </span>
                            </p>
                            {p.note && p.note !== `Payment for ${detail.invoiceNumber}` && (
                              <p className="truncate text-[11px] text-muted-foreground">{p.note}</p>
                            )}
                          </div>
                          <span className="shrink-0 text-[11px] text-muted-foreground">{formatDate(p.date)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setDetail(null)}>Close</Button>
                <Button
                  variant="outline"
                  className="gap-1.5"
                  onClick={() => openBillEditor(detail.id)}
                >
                  <Pencil className="h-4 w-4" />
                  Edit bill
                </Button>
                <Button onClick={() => void handleDownload(detail)} disabled={exporting !== null} className="gap-1.5">
                  {exporting === detail.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
                  Download PDF
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
