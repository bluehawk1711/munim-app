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
  Pencil,
  MoreHorizontal,
} from "lucide-react";
import { buildBillDocument, formatDate, formatCurrency, mergeBillTemplateSettings, paymentMethodLabel, type BillShopDetails } from "@munim/core";
import type { InvoiceDto, InvoiceFilters, SettingsDto } from "@munim/api-client";
import {
  useInvoices,
  useDeleteInvoice,
  useRecordInvoicePayment,
  useInvoicePayments,
  useSettings,
  useQueryState,
  useGoldRates,
  useParties,
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
  InvoicePaymentLine,
  InvoiceDetailBody,
  type RecordPaymentSubmit,
  RecordPaymentDialog,
  ConfirmDialog,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@munim/ui";

type InvoiceRow = InvoiceDto;

const STATUS_PILLS = [
  { kind: "all" as const, label: "All Invoices" },
  { kind: "PAID" as const, label: "Paid" },
  { kind: "PARTIAL" as const, label: "Partial" },
  { kind: "UNPAID" as const, label: "Unpaid / Drafts" },
] as const;

export function InvoicesPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<InvoiceFilters["status"]>("all");
  const [pillFilter, setPillFilter] = useState<"all" | "PAID" | "PARTIAL" | "UNPAID">("all");
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
  // Payment trail for the open detail dialog — how much, when, cash/online.
  const { data: detailPayments } = useInvoicePayments(detailTarget?.id ?? null);
  const { data: settings } = useQueryState(useSettings());
  const { data: goldRates } = useQueryState(useGoldRates());
  const { data: parties } = useQueryState(useParties());
  const detailPartyName = parties?.find((p) => p.id === detailTarget?.partyId)?.name ?? null;

  function openPayment(inv: InvoiceRow) {
    setPaying(inv);
  }

  /** EDIT BILL — the New Bill page in edit mode (`?edit=<id>`): same form,
   *  pre-filled with this bill, saving PUTs it back. */
  function openEdit(inv: InvoiceRow) {
    setDetailTarget(null);
    navigate(`/billing?edit=${inv.id}`);
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

  async function confirmPayment(submit: RecordPaymentSubmit) {
    if (!paying) return;
    setSaving(true);
    try {
      await recordPayment.mutateAsync({
        amount: submit.amount,
        method: submit.method,
        note: submit.note || undefined,
      });
      toast.success("Payment recorded", {
        description: `${formatCurrency(submit.amount)} received · ${paymentMethodLabel(submit.method)}`,
      });
      setPaying(null);
    } catch (err) {
      toast.error("Payment failed", { description: err instanceof Error ? err.message : undefined });
    } finally {
      setSaving(false);
    }
  }

  function settingsToShop(s: SettingsDto): BillShopDetails {
    return { name: s.shopName, address: s.shopAddress, phones: Array.isArray(s.shopPhones) ? s.shopPhones : [], email: s.shopEmail };
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
        // Purity of the quoted rate — the "24K" suffix on the gold rate row.
        goldRateKarat: goldRates?.baseKarat ?? null,
        silverRate: inv.silverRate ?? settings?.silverRatePerGram ?? null,
      });
      await downloadBillPdf(bill, mergeBillTemplateSettings(inv.templateSettings));
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
  // Partial bills get their OWN pill (an advance was received, balance due).
  const partialCount = invoices.filter((i) => i.status === "PARTIAL").length;
  const unpaidCount = invoices.filter((i) => i.status === "UNPAID" || i.status === "DRAFT").length;

  const pillCounts = useMemo(() => ({
    all: pagination?.totalCount ?? invoices.length,
    PAID: paidCount,
    PARTIAL: partialCount,
    UNPAID: unpaidCount,
  }), [pagination, invoices.length, paidCount, partialCount, unpaidCount]);

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
              <p className="text-[11px] text-muted-foreground">{paidCount} paid · {unpaidCount + partialCount} pending</p>
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
              <div className="grid grid-cols-[140px_1fr_1fr_100px_90px_48px] gap-3">
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
                  <div key={inv.id} className="grid grid-cols-[140px_1fr_1fr_100px_90px_48px] items-center gap-3 px-4 py-3 hover:bg-muted/30">
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

                    {/* Amount — Orders-style money line: Paid ₹5,000/- · due,
                        or the green tick once fully settled. */}
                    <div className="text-right">
                      <p className="text-sm font-semibold tabular-nums">{formatCurrency(inv.total)}</p>
                      <InvoicePaymentLine total={inv.total} amountPaid={inv.amountPaid} className="justify-end" />
                    </div>

                    {/* Status */}
                    <div className="flex justify-center">
                      <InvoiceStatusBadge status={inv.status} />
                    </div>

                    {/* Actions — all options behind one menu so nothing
                        overlaps the status column. */}
                    <div className="flex justify-end">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            aria-label={`Actions for ${inv.invoiceNumber}`}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuLabel className="font-mono text-[11px]">
                            {inv.invoiceNumber}
                          </DropdownMenuLabel>
                          <DropdownMenuItem onSelect={() => setDetailTarget(inv)}>
                            <Eye className="h-4 w-4" /> View details
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => openEdit(inv)}>
                            <Pencil className="h-4 w-4" /> Edit bill
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onSelect={() => handleDownload(inv)}
                            disabled={exporting}
                          >
                            {exporting ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <FileDown className="h-4 w-4" />
                            )}
                            Download PDF
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onSelect={() => openPayment(inv)}
                            disabled={outstanding <= 0}
                          >
                            <IndianRupee className="h-4 w-4" /> Record payment
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            variant="destructive"
                            onSelect={() => setDeleting(inv)}
                          >
                            <Trash2 className="h-4 w-4" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
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
        onConfirm={(submit) => void confirmPayment(submit)}
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
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
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

              <InvoiceDetailBody
                invoice={detailTarget}
                payments={detailPayments}
                partyName={detailPartyName}
              />

              <DialogFooter>
                <Button variant="outline" onClick={() => openEdit(detailTarget)} className="gap-1.5">
                  <Pencil className="h-4 w-4" />
                  Edit bill
                </Button>
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
