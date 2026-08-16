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
} from "lucide-react"
import { Button, Input, Card, CardContent, Skeleton, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SummaryTile, InvoiceStatusBadge, RecordPaymentDialog, ConfirmDialog } from "@munim/ui"








import { useInvoices, useDeleteInvoice, useRecordPayment } from "@/hooks/use-invoices"
import { useAppStore } from "@/store/view-store"
import { formatCurrency, formatDate } from "@/lib/format"
import type { Invoice } from "@/lib/types"
import { toast } from "@munim/ui"

export function InvoicesView() {
  const setView = useAppStore((s) => s.setView)
  const [search, setSearch] = React.useState("")
  const [status, setStatus] = React.useState("all")
  const [page, setPage] = React.useState(1)

  const { data, isLoading } = useInvoices({ search, status, page, pageSize: 15 })
  const invoices = data?.invoices ?? []
  const pagination = data?.pagination

  const [paying, setPaying] = React.useState<Invoice | null>(null)
  const [deleting, setDeleting] = React.useState<Invoice | null>(null)

  const deleteInvoice = useDeleteInvoice()
  const recordPayment = useRecordPayment(paying?.id ?? "")

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

  async function confirmPayment(amount: number) {
    if (!paying) return
    try {
      await recordPayment.mutateAsync({ amount, method: "cash" })
      toast.success("Payment recorded", { description: `${formatCurrency(amount)} received` })
      setPaying(null)
    } catch (err) {
      toast.error("Payment failed", { description: err instanceof Error ? err.message : "Unknown error" })
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
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border/60 bg-muted/30 px-2.5 py-2">
            <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1) }}>
              <SelectTrigger className="h-9 w-[150px]" aria-label="Filter by status">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="PAID">Paid</SelectItem>
                <SelectItem value="PARTIAL">Partially paid</SelectItem>
                <SelectItem value="UNPAID">Unpaid</SelectItem>
                <SelectItem value="DRAFT">Draft</SelectItem>
              </SelectContent>
            </Select>
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
                      {outstanding > 0 ? (
                        <p className="text-xs text-amber-600 dark:text-amber-400">
                          Due: {formatCurrency(outstanding)}
                        </p>
                      ) : (
                        <p className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" /> Paid
                        </p>
                      )}
                      <div className="mt-1 flex items-center gap-1">
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
    </div>
  )
}
