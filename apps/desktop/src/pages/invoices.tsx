import { useEffect, useMemo, useState } from "react";
import {
  Search,
  Receipt,
  Trash2,
  IndianRupee,
  CheckCircle2,
  FileText,
  FileDown,
  Loader2,
  Plus,
  AlertTriangle,
  TrendingUp,
  Eye,
} from "lucide-react";
import { buildBillDocument, formatDate, formatCurrency, type BillShopDetails } from "@munim/core";
import type { InvoiceDto, InvoiceFilters, SettingsDto } from "@munim/api-client";
import {
  useInvoices,
  useDeleteInvoice,
  useRecordInvoicePayment,
  useSettings,
  useQueryState,
} from "@munim/query";
import { toast } from "@munim/ui";
import { downloadBillPdf } from "@/lib/billPdf";
import { PageHeader } from "@/components/page-header";
import { navigate } from "@/lib/navigation";
import {
  Button,
  Input,
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
  InvoiceStatusBadge,
  RecordPaymentDialog,
  ConfirmDialog,
} from "@munim/ui";

type InvoiceRow = InvoiceDto;

const STATUS_PILLS = [
  { kind: "all" as const, label: "All Invoices" },
  { kind: "PAID" as const, label: "Paid" },
  { kind: "UNPAID" as const, label: "Unpaid / Drafts" },
] as const;

export function InvoicesPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<InvoiceFilters["status"]>("all");
  const [pillFilter, setPillFilter] = useState<"all" | "PAID" | "UNPAID">("all");
  const [page, setPage] = useState(1);

  const { data, loading, refetching } = useQueryState(
    useInvoices({ search, status, page, pageSize: 15 }),
  );

  useEffect(() => {
    setPage(1);
  }, [search, status]);

  // Sync pill filter → status filter
  useEffect(() => {
    if (pillFilter === "all") setStatus("all");
    else setStatus(pillFilter);
  }, [pillFilter]);

  const invoices = data?.invoices ?? [];
  const pagination = data?.pagination;

  const [paying, setPaying] = useState<InvoiceRow | null>(null);
  const [deleting, setDeleting] = useState<InvoiceRow | null>(null);
  const [detailTarget, setDetailTarget] = useState<InvoiceRow | null>(null);
  const [exporting, setExporting] = useState(false);
  const [saving, setSaving] = useState(false);
  const deleteInvoice = useDeleteInvoice();
  const recordPayment = useRecordInvoicePayment(paying?.id ?? "");
  const { data: settings } = useQueryState(useSettings());

  function openPayment(inv: InvoiceRow) {
    setPaying(inv);
  }

  async function confirmDelete() {
    if (!deleting) return;
    setSaving(true);
    try {
      await deleteInvoice.mutateAsync(deleting.id);
      toast.success("Invoice deleted", { description: `${deleting.invoiceNumber} removed and stock restored.` });
      setDeleting(null);
    } catch (err) {
      toast.error("Delete failed", { description: err instanceof Error ? err.message : undefined });
    } finally {
      setSaving(false);
    }
  }

  async function confirmPayment(amount: number) {
    if (!paying) return;
    setSaving(true);
    try {
      await recordPayment.mutateAsync({ amount, method: "cash" });
      toast.success("Payment recorded", { description: `${formatCurrency(amount)} received` });
      setPaying(null);
    } catch (err) {
      toast.error("Payment failed", { description: err instanceof Error ? err.message : undefined });
    } finally {
      setSaving(false);
    }
  }

  function settingsToShop(s: SettingsDto): BillShopDetails {
    return { name: s.shopName, address: s.shopAddress, phones: s.shopPhones, email: s.shopEmail };
  }

  async function handleDownload(inv: InvoiceRow) {
    const shop = inv.shopDetails
      ? { name: inv.shopDetails.name, address: inv.shopDetails.address ?? "", phones: inv.shopDetails.phones, email: inv.shopDetails.email ?? "" }
      : settings ? settingsToShop(settings) : null;
    if (!shop) {
      toast.error("Shop settings not loaded — open Settings first");
      return;
    }
    setExporting(true);
    try {
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
          quantity: it.quantity,
          price: it.price,
        })),
        discount: inv.discount,
        deliveryCharge: inv.deliveryCharge,
        amountPaid: inv.amountPaid,
        status: inv.status,
        currency: settings?.currency ?? "INR",
      });
      await downloadBillPdf(bill);
      toast.success("PDF downloaded", { description: inv.invoiceNumber });
    } catch (err) {
      toast.error("Could not generate PDF", { description: err instanceof Error ? err.message : undefined });
    } finally {
      setExporting(false);
    }
  }

  const totalValue = invoices.reduce((s, i) => s + i.total, 0);
  const unpaidValue = invoices.reduce((s, i) => s + (i.total - i.amountPaid), 0);
  const collectedValue = invoices.reduce((s, i) => s + i.amountPaid, 0);
  const avgValue = invoices.length > 0 ? totalValue / invoices.length : 0;

  const paidCount = invoices.filter((i) => i.status === "PAID").length;
  const unpaidCount = invoices.filter((i) => i.status === "UNPAID" || i.status === "DRAFT" || i.status === "PARTIAL").length;

  const pillCounts = useMemo(() => ({
    all: pagination?.totalCount ?? invoices.length,
    PAID: paidCount,
    UNPAID: unpaidCount,
  }), [pagination, invoices.length, paidCount, unpaidCount]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <PageHeader
        title="Invoices & Billing Register"
        badge="Ledger"
        subtitle="Every bill generated at the counter — payment status and PDFs, shared with web & mobile."
        actions={
          <Button size="sm" className="gap-1.5" onClick={() => navigate("/billing")}>
            <Plus className="h-3.5 w-3.5" /> New Bill
          </Button>
        }
      />

      {/* Summary stat cards */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Receipt className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Total Bills This Period</p>
              <p className="truncate text-lg font-semibold tabular-nums">{formatCurrency(totalValue)}</p>
              <p className="text-[11px] text-muted-foreground">{pagination?.totalCount ?? invoices.length} bills</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Unpaid / Overdue</p>
              <p className="truncate text-lg font-semibold tabular-nums">{formatCurrency(unpaidValue)}</p>
              <p className="text-[11px] text-muted-foreground">{unpaidCount} need{unpaidCount !== 1 ? "" : "s"} settling</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Collected Revenue</p>
              <p className="truncate text-lg font-semibold tabular-nums">{formatCurrency(collectedValue)}</p>
              <p className="text-[11px] text-muted-foreground">UPI · Cash · Card</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Avg Bill Value</p>
              <p className="truncate text-lg font-semibold tabular-nums">{formatCurrency(avgValue)}</p>
              <p className="text-[11px] text-muted-foreground">{paidCount} paid · {unpaidCount} pending</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter pills + search + dropdowns */}
      <Card>
        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-1.5">
            {STATUS_PILLS.map((pill) => {
              const active = pillFilter === pill.kind;
              const count = pillCounts[pill.kind];
              return (
                <button
                  key={pill.kind}
                  type="button"
                  onClick={() => setPillFilter(pill.kind)}
                  className={
                    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold tabular-nums transition-colors " +
                    (active
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card text-muted-foreground hover:bg-muted/60 hover:text-foreground")
                  }
                >
                  {pill.label}
                  <span className={
                    "rounded-full px-1.5 py-0.5 text-[10px] font-bold " +
                    (active ? "bg-primary-foreground/20" : "bg-muted")
                  }>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-2">
            <div className="relative w-full max-w-[200px]">
              <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search invoice #, customer…"
                className="h-9 pl-9 text-sm"
                aria-label="Search invoices"
              />
            </div>
            {refetching && (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            )}
            <Select value={status} onValueChange={(v) => setStatus(v as InvoiceFilters["status"])}>
              <SelectTrigger className="h-9 w-[130px]" aria-label="Filter by status">
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
      </Card>

      {/* Invoice list */}
      {loading ? (
        <Card>
          <CardContent className="space-y-2 p-4">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
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
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            {/* Table header */}
            <div className="border-b px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <div className="grid grid-cols-[140px_1fr_1fr_100px_90px_140px] gap-3">
                <span>Invoice #</span>
                <span>Customer / Party</span>
                <span>Items &amp; Notes</span>
                <span className="text-right">Amount</span>
                <span className="text-center">Status</span>
                <span className="text-right">Actions</span>
              </div>
            </div>

            <div className="divide-y">
              {invoices.map((inv) => {
                const outstanding = inv.total - inv.amountPaid;
                const firstItem = inv.items[0];
                return (
                  <div key={inv.id} className="grid grid-cols-[140px_1fr_1fr_100px_90px_140px] items-center gap-3 px-4 py-3 hover:bg-muted/30">
                    {/* Invoice # */}
                    <div>
                      <span className="font-mono text-xs font-medium">{inv.invoiceNumber}</span>
                      <p className="text-[11px] text-muted-foreground">{formatDate(inv.date)}</p>
                    </div>

                    {/* Customer */}
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{inv.customerName || "Walk-in customer"}</p>
                    </div>

                    {/* Items */}
                    <div className="min-w-0">
                      {firstItem ? (
                        <>
                          <p className="truncate text-sm">{firstItem.productName}</p>
                          <p className="truncate text-[11px] text-muted-foreground">
                            {inv.items.length} item{inv.items.length !== 1 ? "s" : ""}
                            {firstItem.sku ? ` · ${firstItem.sku}` : ""}
                          </p>
                        </>
                      ) : (
                        <p className="text-[11px] text-muted-foreground">—</p>
                      )}
                    </div>

                    {/* Amount */}
                    <div className="text-right">
                      <p className="text-sm font-semibold tabular-nums">{formatCurrency(inv.total)}</p>
                    </div>

                    {/* Status */}
                    <div className="flex justify-center">
                      <InvoiceStatusBadge status={inv.status} />
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        title="View details"
                        onClick={() => setDetailTarget(inv)}
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        title="Download PDF"
                        onClick={() => handleDownload(inv)}
                        disabled={exporting}
                      >
                        <FileDown className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 gap-1 text-xs"
                        onClick={() => openPayment(inv)}
                        disabled={outstanding <= 0}
                      >
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
                );
              })}
            </div>

            {/* Pagination */}
            {pagination && (
              <div className="flex items-center justify-between border-t px-4 py-2.5">
                <p className="text-xs text-muted-foreground">
                  Showing {Math.min((pagination.page - 1) * pagination.pageSize + 1, pagination.totalCount)}–{Math.min(pagination.page * pagination.pageSize, pagination.totalCount)} of {pagination.totalCount} invoices
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
        busy={saving}
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
        busy={saving}
        onConfirm={() => void confirmDelete()}
      />

      {/* Invoice detail dialog */}
      <Dialog open={!!detailTarget} onOpenChange={(open) => !open && setDetailTarget(null)}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          {detailTarget && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Receipt className="h-4 w-4" /> {detailTarget.invoiceNumber}
                </DialogTitle>
                <DialogDescription>
                  {formatDate(detailTarget.date)} · <InvoiceStatusBadge status={detailTarget.status} />
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 text-sm">
                {/* Customer */}
                <div className="rounded-lg border p-3 space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Customer</p>
                  <p className="font-medium">{detailTarget.customerName || "Walk-in customer"}</p>
                  {detailTarget.customerPhone && <p className="text-muted-foreground text-xs">{detailTarget.customerPhone}</p>}
                  {detailTarget.customerAddress && <p className="text-muted-foreground text-xs">{detailTarget.customerAddress}</p>}
                </div>

                {/* Line items */}
                <div className="rounded-lg border overflow-hidden">
                  <div className="bg-muted/50 grid grid-cols-[1fr_60px_80px_90px] gap-2 px-3 py-2 text-xs font-semibold text-muted-foreground">
                    <span>Item</span>
                    <span className="text-right">Qty</span>
                    <span className="text-right">Price</span>
                    <span className="text-right">Total</span>
                  </div>
                  <div className="divide-y">
                    {detailTarget.items.map((item) => (
                      <div key={item.id} className="grid grid-cols-[1fr_60px_80px_90px] gap-2 px-3 py-2">
                        <div className="min-w-0">
                          <p className="truncate font-medium">{item.productName}</p>
                          <p className="text-[11px] text-muted-foreground truncate">
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
                <div className="rounded-lg border p-3 space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="tabular-nums">{formatCurrency(detailTarget.subtotal)}</span>
                  </div>
                  {detailTarget.discount > 0 && (
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Discount</span>
                      <span className="text-red-600 dark:text-red-400 tabular-nums">-{formatCurrency(detailTarget.discount)}</span>
                    </div>
                  )}
                  {detailTarget.deliveryCharge > 0 && (
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Delivery</span>
                      <span className="tabular-nums">+{formatCurrency(detailTarget.deliveryCharge)}</span>
                    </div>
                  )}
                  <div className="border-t pt-1.5 flex justify-between text-sm font-bold">
                    <span>Total</span>
                    <span className="tabular-nums">{formatCurrency(detailTarget.total)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Paid</span>
                    <span className="tabular-nums">{formatCurrency(detailTarget.amountPaid)}</span>
                  </div>
                  {detailTarget.total - detailTarget.amountPaid > 0 && (
                    <div className="flex justify-between text-xs font-medium">
                      <span className="text-amber-600 dark:text-amber-400">Outstanding</span>
                      <span className="text-amber-600 dark:text-amber-400 tabular-nums">{formatCurrency(detailTarget.total - detailTarget.amountPaid)}</span>
                    </div>
                  )}
                </div>

                {detailTarget.notes && (
                  <div className="rounded-lg border p-3">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Notes</p>
                    <p className="text-xs">{detailTarget.notes}</p>
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setDetailTarget(null)}>Close</Button>
                <Button variant="outline" onClick={() => handleDownload(detailTarget)} disabled={exporting} className="gap-1.5">
                  {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
                  Download PDF
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
