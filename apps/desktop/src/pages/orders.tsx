import { useEffect, useMemo, useState } from "react";
import {
  Search,
  ClipboardList,
  Plus,
  Eye,
  Pencil,
  Trash2,
  Banknote,
  FileDown,
  Loader2,
  Receipt,
  Copy,
} from "lucide-react";
import {
  buildBillDocument,
  buildOrderDocument,
  formatDate,
  formatCurrency,
  mergeBillTemplateSettings,
  paymentMethodLabel,
  productMatchesCode,
  type BillShopDetails,
  type OrderDto,
  type OrderFilters,
  type OrderFormValues,
  type OrderItemValues,
} from "@munim/core";
import type { InvoiceDto, SettingsDto } from "@munim/api-client";
import {
  useOrders,
  useOrderPayments,
  useCreateOrder,
  useUpdateOrder,
  useDeleteOrder,
  useGenerateOrderBill,
  useRecordOrderPayment,
  useSettings,
  useGoldRates,
  useAllProducts,
  useParties,
  useQueryState,
  useApiClient,
} from "@munim/query";
import { toast } from "@munim/ui";
import { downloadBillPdf } from "@/lib/billPdf";
import { PageHeader } from "@/components/page-header";
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
  RecordPaymentDialog,
  ConfirmDialog,
  ProductSearchSelect,
  BarcodeLookupInput,
  type ProductOption,
} from "@munim/ui";

type OrderRow = OrderDto;
type OrderStatusValue = OrderDto["status"];

const STATUS_PILLS = [
  { kind: "all" as const, label: "All Orders" },
  { kind: "OPEN" as const, label: "Open" },
  { kind: "COMPLETED" as const, label: "Billed" },
  { kind: "CANCELLED" as const, label: "Cancelled" },
] as const;

let keySeq = 0;
function nextKey(): string {
  keySeq += 1;
  return `l${keySeq}`;
}

type FormLine = {
  key: string;
  productId: string | null;
  productName: string;
  sku: string | null;
  color: string | null;
  size: string | null;
  weight: number | null;
  weightUnit: "gm" | "mg" | null;
  quantity: string;
  price: string;
};

type FormState = {
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  partyId: string;
  discount: string;
  delivery: string;
  paid: string;
  notes: string;
  lines: FormLine[];
};

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
  };
}

function blankForm(): FormState {
  return {
    customerName: "",
    customerPhone: "",
    customerAddress: "",
    partyId: "",
    discount: "",
    delivery: "",
    paid: "0",
    notes: "",
    lines: [blankLine()],
  };
}

function orderToForm(o: OrderRow): FormState {
  return {
    customerName: o.customerName ?? "",
    customerPhone: o.customerPhone ?? "",
    customerAddress: o.customerAddress ?? "",
    partyId: o.partyId ?? "",
    discount: String(o.discount || 0),
    delivery: String(o.deliveryCharge || 0),
    paid: String(o.amountPaid || 0),
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
  };
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
    }));
}

function formTotals(form: FormState) {
  const subtotal = form.lines.reduce(
    (s, l) => s + (Number(l.quantity) || 0) * (Number(l.price) || 0),
    0,
  );
  const discount = Number(form.discount) || 0;
  const delivery = Number(form.delivery) || 0;
  const total = Math.max(0, subtotal - discount + delivery);
  return { subtotal, discount, delivery, total };
}

/* ── Estimate printing + collection display ───────────────────── */

/** Shop letterhead for a printed estimate — same shape the bills use. */
function shopFor(settings: SettingsDto | undefined | null): BillShopDetails {
  return {
    name: settings?.shopName || "My Shop",
    address: settings?.shopAddress ?? null,
    phones: Array.isArray(settings?.shopPhones) ? settings.shopPhones : [],
    email: settings?.shopEmail ?? null,
  };
}

/** Item names + their weights — the weight has to be readable at a glance. */
function itemSummary(o: OrderRow): string {
  const names = o.items
    .slice(0, 2)
    .map((it) =>
      it.weight != null
        ? `${it.productName} (${it.weight}${it.weightUnit ?? "gm"})`
        : it.productName,
    )
    .join(", ");
  const more = o.items.length > 2 ? ` +${o.items.length - 2} more` : "";
  return names ? `${names}${more}` : "";
}

/** How much the party paid vs. how much is still to come. */
function OrderPaymentLine({ order }: { order: OrderRow }) {
  if (order.amountPaid <= 0) {
    return <p className="text-[11px] text-muted-foreground tabular-nums">Nothing received yet</p>;
  }
  const settled = order.paymentStatus === "PAID";
  return (
    <p
      className={`text-[11px] tabular-nums ${
        settled ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"
      }`}
    >
      Paid {formatCurrency(order.amountPaid)}
      {settled ? " · settled" : ` · ${formatCurrency(order.dueAmount)} due`}
    </p>
  );
}

/* ── Create / edit form ───────────────────────────────────────── */

function OrderFormDialog({
  editing,
  onClose,
}: {
  editing: OrderRow | null;
  onClose: () => void;
}) {
  const [form, setForm] = useState<FormState>(() => (editing ? orderToForm(editing) : blankForm()));
  const [saving, setSaving] = useState(false);
  const createOrder = useCreateOrder();
  const updateOrder = useUpdateOrder();
  const { data: allProductsData } = useQueryState(useAllProducts());
  const allProducts = allProductsData;
  const { data: parties } = useQueryState(useParties());
  const getClient = useApiClient();

  const totals = useMemo(() => formTotals(form), [form]);

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function updateLine(i: number, patch: Partial<FormLine>) {
    setForm((prev) => ({
      ...prev,
      lines: prev.lines.map((l, x) => (x === i ? { ...l, ...patch } : l)),
    }));
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
          : l,
      ),
    }));
  }

  async function handleBarcodeAdd(code: string) {
    let row = allProducts?.find((p) => productMatchesCode(p, code)) ?? null;
    if (!row) {
      const api = await getClient();
      row = await api.products.byBarcode(code);
    }
    const found = row;
    if (!found) return;
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
    }));
  }

  async function save() {
    const items = toItems(form.lines);
    if (items.length === 0) {
      toast.error("Add at least one line item");
      return;
    }
    const values: OrderFormValues = {
      customerName: form.customerName.trim() || undefined,
      customerPhone: form.customerPhone.trim() || undefined,
      customerAddress: form.customerAddress.trim() || undefined,
      partyId: form.partyId && form.partyId !== "__none" ? form.partyId : undefined,
      items,
      discount: Number(form.discount) || 0,
      deliveryCharge: Number(form.delivery) || 0,
      // Advance taken at the counter — it rides into the bill when billed.
      amountPaid: Number(form.paid) || 0,
      notes: form.notes.trim() || undefined,
    };
    setSaving(true);
    try {
      if (editing) {
        await updateOrder.mutateAsync({ id: editing.id, values });
        toast.success("Order updated", { description: editing.orderNumber });
      } else {
        const created = await createOrder.mutateAsync(values);
        toast.success("Order created", { description: created.orderNumber });
      }
      onClose();
    } catch (err) {
      toast.error(editing ? "Update failed" : "Could not create order", {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setSaving(false);
    }
  }

  function pickParty(id: string) {
    setField("partyId", id);
    const p = parties?.find((x) => x.id === id);
    if (!p) return;
    setForm((prev) => ({
      ...prev,
      partyId: id,
      customerName: p.name || prev.customerName,
      customerPhone: p.phone || prev.customerPhone,
      customerAddress: p.address || prev.customerAddress,
    }));
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
              <Select value={form.partyId || "__none"} onValueChange={(v) => (v === "__none" ? setField("partyId", "") : pickParty(v))}>
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
              <span className="text-[11px] text-muted-foreground">Quoted prices carry into the bill as-is</span>
            </div>
            <BarcodeLookupInput
              onLookup={handleBarcodeAdd}
              placeholder="Scan barcode or type SKU to add a line"
              className="sm:max-w-[320px]"
            />
            <div className="space-y-2">
              {form.lines.map((line, index) => (
                <div key={line.key} className="bg-muted/50 flex flex-wrap items-end gap-2 rounded-lg border p-3">
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
                    onClick={() => setForm((prev) => ({ ...prev, lines: prev.lines.filter((_, x) => x !== index) }))}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={() => setForm((prev) => ({ ...prev, lines: [...prev.lines, blankLine()] }))}>
                <Plus className="h-4 w-4" /> Add item
              </Button>
            </div>
          </div>

          {/* Adjustments */}
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="of-disc">Discount (₹)</Label>
              <Input id="of-disc" type="number" min={0} value={form.discount} onChange={(e) => setField("discount", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="of-del">Delivery charge (₹)</Label>
              <Input id="of-del" type="number" min={0} value={form.delivery} onChange={(e) => setField("delivery", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="of-paid">Received now (₹)</Label>
              <Input id="of-paid" type="number" min={0} value={form.paid} onChange={(e) => setField("paid", e.target.value)} />
              <p className="text-[11px] text-muted-foreground">
                Advance — carried into the bill when you bill this order
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="of-notes">Notes</Label>
              <Input id="of-notes" value={form.notes} onChange={(e) => setField("notes", e.target.value)} placeholder="e.g. ready after Friday" />
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
            {(Number(form.paid) || 0) > 0 && (
              <>
                <p className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Received now</span>
                  <span className="tabular-nums text-emerald-600 dark:text-emerald-400">
                    -{formatCurrency(Number(form.paid) || 0)}
                  </span>
                </p>
                <p className="flex justify-between border-t pt-1.5">
                  <span className="font-semibold">Balance due</span>
                  <span className="font-bold tabular-nums">
                    {formatCurrency(Math.max(0, totals.total - (Number(form.paid) || 0)))}
                  </span>
                </p>
              </>
            )}
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
  );
}

/* ── Page ─────────────────────────────────────────────────────── */

export function OrdersPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<OrderFilters["status"]>("all");
  const [page, setPage] = useState(1);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<OrderRow | null>(null);
  const [detail, setDetail] = useState<OrderRow | null>(null);
  const { data: orderPayments } = useOrderPayments(detail?.id ?? null);
  const [billing, setBilling] = useState<OrderRow | null>(null);
  const [cancelling, setCancelling] = useState<OrderRow | null>(null);
  const [deleting, setDeleting] = useState<OrderRow | null>(null);
  const [paying, setPaying] = useState<OrderRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);

  const { data, loading, refetching } = useQueryState(
    useOrders({ search, status, page, pageSize: 15 }),
  );
  const orders = useMemo(() => data?.orders ?? [], [data]);
  const pagination = data?.pagination;

  const updateOrder = useUpdateOrder();
  const deleteOrder = useDeleteOrder();
  const generateBill = useGenerateOrderBill();
  const recordPayment = useRecordOrderPayment();
  const { data: settings } = useQueryState(useSettings());
  const { data: goldRates } = useQueryState(useGoldRates());
  const getClient = useApiClient();

  useEffect(() => {
    setPage(1);
  }, [search, status]);

  const pillCounts = useMemo(() => {
    const counts: Record<"all" | OrderStatusValue, number> = {
      all: pagination?.totalCount ?? orders.length,
      OPEN: 0,
      COMPLETED: 0,
      CANCELLED: 0,
    };
    for (const o of orders) counts[o.status] += 1;
    return counts;
  }, [orders, pagination]);

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(o: OrderRow) {
    setDetail(null);
    setEditing(o);
    setFormOpen(true);
  }

  /** The estimate print — the SAME sheet the bill uses, headed "Estimate" and
   *  carrying the quoted total, what the party paid and what's still due.
   *  The day's rate (and its karat, e.g. "24K") prints on the rate row — an
   *  order is quoted AT the rate of the day. `downloadBillPdf` delegates to
   *  core's shared `generateBillPDF` — the same renderer billing uses. */
  async function printEstimate(o: OrderRow) {
    try {
      const doc = buildOrderDocument(o, shopFor(settings), {
        currency: settings?.currency ?? "INR",
        goldRate: goldRates?.baseRatePerGram ?? null,
        goldRateKarat: goldRates?.baseKarat ?? null,
        silverRate: settings?.silverRatePerGram ?? null,
      });
      await downloadBillPdf(doc, mergeBillTemplateSettings({}));
      toast.success("Estimate downloaded", {
        description: `${o.orderNumber} — shows the quoted total, paid and balance.`,
      });
    } catch (err) {
      toast.error("Could not print the estimate", {
        description: err instanceof Error ? err.message : undefined,
      });
    }
  }

  async function confirmPayment(submit: { amount: number; method: string; note: string }) {
    if (!paying) return;
    setSaving(true);
    try {
      const updated = await recordPayment.mutateAsync({
        id: paying.id,
        values: { amount: submit.amount, method: submit.method, note: submit.note || undefined },
      });
      toast.success("Payment recorded", {
        description: `${paying.orderNumber} — ${formatCurrency(updated.amountPaid)} received via ${paymentMethodLabel(submit.method)}, ${formatCurrency(updated.dueAmount)} still due.`,
      });
      setPaying(null);
    } catch (err) {
      toast.error("Could not record the payment", {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setSaving(false);
    }
  }

  async function downloadInvoice(inv: InvoiceDto) {
    const shop: BillShopDetails | null = inv.shopDetails
      ? { name: inv.shopDetails.name, address: inv.shopDetails.address ?? "", phones: inv.shopDetails.phones, email: inv.shopDetails.email ?? "" }
      : settings
        ? { name: settings.shopName, address: settings.shopAddress, phones: Array.isArray(settings.shopPhones) ? settings.shopPhones : [], email: settings.shopEmail }
        : null;
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
          quantity: it.quantity,
          price: it.price,
        })),
        discount: inv.discount,
        deliveryCharge: inv.deliveryCharge,
        amountPaid: inv.amountPaid,
        status: inv.status,
        currency: settings?.currency ?? "INR",
        goldRate: inv.goldRate ?? goldRates?.baseRatePerGram ?? null,
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

  async function confirmBill() {
    if (!billing) return;
    setSaving(true);
    try {
      const result = await generateBill.mutateAsync(billing.id);
      const orderNumber = billing.orderNumber;
      setBilling(null);
      setDetail(null);
      toast.success("Bill created", {
        description: `${result.invoice.invoiceNumber} — ${orderNumber} is now billed.`,
      });
      await downloadInvoice(result.invoice);
    } catch (err) {
      toast.error("Could not bill order", { description: err instanceof Error ? err.message : undefined });
    } finally {
      setSaving(false);
    }
  }

  async function confirmCancel() {
    if (!cancelling) return;
    setSaving(true);
    try {
      await updateOrder.mutateAsync({ id: cancelling.id, values: { status: "CANCELLED" } });
      toast.success("Order cancelled", { description: cancelling.orderNumber });
      setCancelling(null);
      setDetail(null);
    } catch (err) {
      toast.error("Cancel failed", { description: err instanceof Error ? err.message : undefined });
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setSaving(true);
    try {
      await deleteOrder.mutateAsync(deleting.id);
      toast.success("Order deleted", { description: deleting.orderNumber });
      setDeleting(null);
      setDetail(null);
    } catch (err) {
      toast.error("Delete failed", { description: err instanceof Error ? err.message : undefined });
    } finally {
      setSaving(false);
    }
  }

  const openCount = orders.filter((o) => o.status === "OPEN").length;
  const openValue = orders.filter((o) => o.status === "OPEN").reduce((s, o) => s + o.total, 0);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Orders"
        badge="Quotes"
        subtitle="Quote items at locked prices now — bill them later. Stock is checked at billing time."
        actions={
          <Button size="sm" className="gap-1.5" onClick={openCreate}>
            <Plus className="h-3.5 w-3.5" /> New order
          </Button>
        }
      />

      {/* Summary */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sky-500/15 text-sky-600 dark:text-sky-400">
              <Receipt className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Open orders</p>
              <p className="truncate text-lg font-semibold tabular-nums">{openCount}</p>
              <p className="text-[11px] text-muted-foreground">awaiting billing</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <ClipboardList className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Open quoted value</p>
              <p className="truncate text-lg font-semibold tabular-nums">{formatCurrency(openValue)}</p>
              <p className="text-[11px] text-muted-foreground">this page</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <ClipboardList className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Total orders</p>
              <p className="truncate text-lg font-semibold tabular-nums">{pagination?.totalCount ?? orders.length}</p>
              <p className="text-[11px] text-muted-foreground">all time</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pills + search */}
      <Card>
        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-1.5">
            {STATUS_PILLS.map((pill) => {
              const active = status === pill.kind;
              return (
                <button
                  key={pill.kind}
                  type="button"
                  onClick={() => setStatus(pill.kind)}
                  className={
                    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold tabular-nums transition-colors " +
                    (active
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card text-muted-foreground hover:bg-muted/60 hover:text-foreground")
                  }
                >
                  {pill.label}
                  <span
                    className={
                      "rounded-full px-1.5 py-0.5 text-[10px] font-bold " +
                      (active ? "bg-primary-foreground/20" : "bg-muted")
                    }
                  >
                    {pillCounts[pill.kind]}
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
                placeholder="Search order #, customer or item…"
                className="h-9 pl-9 text-sm"
                aria-label="Search orders by number, customer or item name"
              />
            </div>
            {refetching && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          </div>
        </div>
      </Card>

      {/* Order list */}
      {loading ? (
        <Card>
          <CardContent className="space-y-2 p-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
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
              <p className="text-xs text-muted-foreground">Quote an order now, bill it when the customer confirms.</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="border-b px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <div className="grid grid-cols-[140px_1fr_1fr_130px_90px_230px] gap-3">
                <span>Order #</span>
                <span>Customer</span>
                <span>Items</span>
                <span className="text-right">Total</span>
                <span className="text-center">Status</span>
                <span className="text-right">Actions</span>
              </div>
            </div>

            <div className="divide-y">
              {orders.map((o) => {
                const firstItem = o.items[0];
                return (
                  <div key={o.id} className="grid grid-cols-[140px_1fr_1fr_130px_90px_230px] items-center gap-3 px-4 py-3 hover:bg-muted/30">
                    <div>
                      <span className="font-mono text-xs font-medium">{o.orderNumber}</span>
                      <p className="text-[11px] text-muted-foreground">{formatDate(o.date)}</p>
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{o.customerName || "Walk-in customer"}</p>
                      {o.customerPhone && <p className="truncate text-[11px] text-muted-foreground">{o.customerPhone}</p>}
                    </div>
                    <div className="min-w-0">
                      {firstItem ? (
                        <>
                          <p className="truncate text-sm">{itemSummary(o)}</p>
                          <p className="truncate text-[11px] text-muted-foreground">
                            {o.items.length} item{o.items.length !== 1 ? "s" : ""}
                            {firstItem.sku ? ` · ${firstItem.sku}` : ""}
                          </p>
                        </>
                      ) : (
                        <p className="text-[11px] text-muted-foreground">—</p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold tabular-nums">{formatCurrency(o.total)}</p>
                      <OrderPaymentLine order={o} />
                    </div>
                    <div className="flex justify-center">
                      <OrderStatusBadge status={o.status} />
                    </div>
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        title="View details"
                        onClick={() => setDetail(o)}
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        title="Print estimate"
                        aria-label={`Print the estimate for ${o.orderNumber}`}
                        onClick={() => void printEstimate(o)}
                      >
                        <FileDown className="h-3.5 w-3.5" />
                      </Button>
                      {o.status === "OPEN" && o.dueAmount > 0 && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          title="Record payment"
                          aria-label={`Record a payment on ${o.orderNumber}`}
                          onClick={() => setPaying(o)}
                        >
                          <Banknote className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {o.status === "OPEN" && (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            title="Edit order"
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
                            title="Delete order"
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
                          title="Delete order"
                          onClick={() => setDeleting(o)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {o.status === "COMPLETED" && o.invoiceId && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          title="Download invoice PDF"
                          disabled={exporting}
                          onClick={() => void downloadBilledInvoice(o)}
                        >
                          <FileDown className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {pagination && (
              <div className="flex items-center justify-between border-t px-4 py-2.5">
                <p className="text-xs text-muted-foreground">
                  Showing {Math.min((pagination.page - 1) * pagination.pageSize + 1, pagination.totalCount)}–
                  {Math.min(pagination.page * pagination.pageSize, pagination.totalCount)} of {pagination.totalCount} orders
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="h-7" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                    Prev
                  </Button>
                  <Button variant="outline" size="sm" className="h-7" disabled={page >= pagination.totalPages} onClick={() => setPage(page + 1)}>
                    Next
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Create / edit */}
      {formOpen && <OrderFormDialog key={editing?.id ?? "new"} editing={editing} onClose={() => setFormOpen(false)} />}

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
                  <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Customer</p>
                  <p className="font-medium">{detail.customerName || "Walk-in customer"}</p>
                  {detail.customerPhone && <p className="text-xs text-muted-foreground">{detail.customerPhone}</p>}
                  {detail.customerAddress && <p className="text-xs text-muted-foreground">{detail.customerAddress}</p>}
                </div>

                <div className="overflow-hidden rounded-lg border">
                  <div className="bg-muted/50 grid grid-cols-[1fr_60px_90px_90px] gap-2 px-3 py-2 text-xs font-semibold text-muted-foreground">
                    <span>Item</span>
                    <span className="text-right">Qty</span>
                    <span className="text-right">Quoted</span>
                    <span className="text-right">Total</span>
                  </div>
                  <div className="divide-y">
                    {detail.items.map((item) => (
                      <div key={item.id} className="grid grid-cols-[1fr_60px_90px_90px] gap-2 px-3 py-2">
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
                        <span className="text-right tabular-nums">{formatCurrency(item.price)}</span>
                        <span className="text-right font-medium tabular-nums">{formatCurrency(item.total)}</span>
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
                    <span>Quoted total</span>
                    <span className="tabular-nums">{formatCurrency(detail.total)}</span>
                  </div>
                  {detail.amountPaid > 0 && (
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Received</span>
                      <span className="tabular-nums text-emerald-600 dark:text-emerald-400">-{formatCurrency(detail.amountPaid)}</span>
                    </div>
                  )}
                  <div className="flex justify-between border-t pt-1.5 text-sm font-bold">
                    <span>{detail.dueAmount > 0 ? "Balance due" : "Settled in full"}</span>
                    <span className={`tabular-nums ${detail.dueAmount > 0 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                      {formatCurrency(detail.dueAmount)}
                    </span>
                  </div>
                </div>

                {(orderPayments?.length ?? 0) > 0 && (
                  <div className="rounded-lg border p-3">
                    <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Payments</p>
                    <div className="space-y-1.5">
                      {orderPayments?.map((p) => (
                        <div key={p.id} className="flex items-center justify-between gap-2 text-xs">
                          <div className="min-w-0">
                            <p className="font-medium">
                              {formatCurrency(p.amount)}
                              <span className="ml-1.5 rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase text-muted-foreground">
                                {paymentMethodLabel(p.method)}
                              </span>
                            </p>
                            {p.note && <p className="truncate text-[11px] text-muted-foreground">{p.note}</p>}
                          </div>
                          <span className="shrink-0 text-[11px] text-muted-foreground">{formatDate(p.date)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {detail.notes && (
                  <div className="rounded-lg border p-3">
                    <p className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Notes</p>
                    <p className="text-xs">{detail.notes}</p>
                  </div>
                )}
              </div>

              <DialogFooter className="flex-wrap justify-between gap-2 sm:justify-between">
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setDetail(null)}>
                    Close
                  </Button>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" className="gap-1.5" onClick={() => void printEstimate(detail)}>
                    <FileDown className="h-3.5 w-3.5" /> Print estimate
                  </Button>
                  {detail.status === "OPEN" && detail.dueAmount > 0 && (
                    <Button
                      variant="outline"
                      className="gap-1.5"
                      onClick={() => {
                        setDetail(null);
                        setPaying(detail);
                      }}
                    >
                      <Banknote className="h-3.5 w-3.5" /> Record payment
                    </Button>
                  )}
                  {detail.status === "OPEN" && (
                    <>
                      <Button variant="outline" className="gap-1.5" onClick={() => openEdit(detail)}>
                        <Pencil className="h-3.5 w-3.5" /> Edit
                      </Button>
                      <Button
                        variant="outline"
                        className="gap-1.5 text-destructive hover:text-destructive"
                        onClick={() => {
                          setDetail(null);
                          setCancelling(detail);
                        }}
                      >
                        Cancel order
                      </Button>
                      <Button className="gap-1.5" onClick={() => setBilling(detail)}>
                        <Receipt className="h-3.5 w-3.5" /> Generate bill
                      </Button>
                    </>
                  )}
                  {detail.status === "COMPLETED" && detail.invoiceId && (
                    <Button variant="outline" className="gap-1.5" disabled={exporting} onClick={() => void downloadBilledInvoice(detail)}>
                      {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileDown className="h-3.5 w-3.5" />}
                      Download invoice
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
                    <span className="font-semibold tabular-nums">{formatCurrency(billing.total)}</span>
                  </p>
                  {billing.amountPaid > 0 && (
                    <>
                      <p className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Already received</span>
                        <span className="tabular-nums text-emerald-600 dark:text-emerald-400">
                          {formatCurrency(billing.amountPaid)}
                        </span>
                      </p>
                      <p className="flex justify-between text-xs font-semibold">
                        <span>Balance due on the bill</span>
                        <span className="tabular-nums">{formatCurrency(billing.dueAmount)}</span>
                      </p>
                    </>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Quoted prices are carried into the bill as-is
                  {billing.amountPaid > 0
                    ? ", and so is the advance you already took — the bill opens as already part-paid."
                    : ". "}
                  If any item is out of stock the billing fails and the order stays open.
                </p>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setBilling(null)} disabled={saving}>
                  Cancel
                </Button>
                <Button onClick={() => void confirmBill()} disabled={saving} className="gap-1.5">
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
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
        busy={saving}
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
        busy={saving}
        onConfirm={() => void confirmDelete()}
      />

      {/* Record payment — advance / part-payment on an unbilled order */}
      <RecordPaymentDialog
        key={paying?.id ?? "closed"}
        open={!!paying}
        onOpenChange={(open) => !open && setPaying(null)}
        invoice={
          paying
            ? {
                id: paying.id,
                invoiceNumber: paying.orderNumber,
                customerName: paying.customerName,
                total: paying.total,
                amountPaid: paying.amountPaid,
              }
            : null
        }
        busy={saving}
        onConfirm={(submit) => void confirmPayment(submit)}
      />
    </div>
  );

  /** COMPLETED order → fetch its invoice (with items) and download the PDF. */
  async function downloadBilledInvoice(o: OrderRow) {
    if (!o.invoiceId) return;
    try {
      const api = await getClient();
      const inv = await api.invoices.get(o.invoiceId);
      await downloadInvoice(inv);
    } catch (err) {
      toast.error("Could not load invoice", { description: err instanceof Error ? err.message : undefined });
    }
  }
}
