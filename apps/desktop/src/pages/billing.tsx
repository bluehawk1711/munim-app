import { useMemo, useState } from "react";
import { Plus, Trash2, Download, Loader2, FileDown, CheckCircle2 } from "lucide-react";
import {
  buildBillDocument,
  type BillDocument,
  type BillShopDetails,
} from "@munim/core";
import type { InvoiceDto, SettingsDto } from "@munim/api-client";
import {
  useSettings,
  useProducts,
  useParties,
  useCreateInvoice,
  useRecordInvoicePayment,
  useQueryState,
} from "@munim/query";
import { money } from "@/lib/format";
import { downloadBillPdf } from "@/lib/billPdf";
import { toast } from "@munim/ui";
import { PageHeader } from "@/components/page-header";
import {
  Button,
  Input,
  Label,
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Checkbox,
  ProductSearchSelect,
  type ProductOption,
  BillTemplateOptions,
  type BillTemplate,
  type BillClassicColor,
  type BillMode,
} from "@munim/ui";

type LineState = {
  productId: string;
  productName: string;
  sku: string;
  color: string;
  size: string;
  description: string;
  quantity: string;
  price: string;
};

function emptyLine(): LineState {
  return { productId: "", productName: "", sku: "", color: "", size: "", description: "", quantity: "1", price: "0" };
}

function settingsToShop(s: SettingsDto): BillShopDetails {
  return {
    name: s.shopName,
    address: s.shopAddress,
    phones: s.shopPhones,
    email: s.shopEmail,
  };
}

function toInvoiceShop(s: BillShopDetails): { name: string; address: string; phones: string[]; email: string } {
  return { name: s.name, address: s.address ?? "", phones: s.phones, email: s.email ?? "" };
}

function invoiceToBillDocument(inv: InvoiceDto, shop: BillShopDetails, currency: string): BillDocument {
  return buildBillDocument({
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
    currency,
  });
}

export function BillingPage() {
  const { data: settings } = useQueryState(useSettings());
  const { data: allProductsData } = useQueryState(useProducts({ pageSize: 1000 }));
  const allProducts = allProductsData?.products;
  const { data: parties } = useQueryState(useParties());
  // const { data: list, loading: loadingList } = useQueryState(useInvoices({ pageSize: 100 }));
  const createInvoice = useCreateInvoice();

  // ── Bill 1 ──────────────────────────────────────────────────────────────
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [partyId, setPartyId] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [discount, setDiscount] = useState("0");
  const [deliveryCharge, setDeliveryCharge] = useState("0");
  const [amountPaid, setAmountPaid] = useState("0");
  const [lines, setLines] = useState<LineState[]>([emptyLine()]);

  // ── Template options (shared with web — bill-template-options) ─────────
  const [template, setTemplate] = useState<BillTemplate>("jewellery");
  const [classicColor, setClassicColor] = useState<BillClassicColor>("red");
  const [twoInOne, setTwoInOne] = useState(false);
  const [mode, setMode] = useState<BillMode>("duplicate");

  // ── Second bill — only used in 2-in-1 "Separate" mode ─────────────────
  const [secondCustomerName, setSecondCustomerName] = useState("");
  const [secondCustomerPhone, setSecondCustomerPhone] = useState("");
  const [secondCustomerAddress, setSecondCustomerAddress] = useState("");
  const [secondPartyId, setSecondPartyId] = useState("");
  const [secondDiscount, setSecondDiscount] = useState("0");
  const [secondDeliveryCharge, setSecondDeliveryCharge] = useState("0");
  const [secondAmountPaid, setSecondAmountPaid] = useState("0");
  const [secondLines, setSecondLines] = useState<LineState[]>([emptyLine()]);

  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [preview, setPreview] = useState<BillDocument | null>(null);
  const [secondPreview, setSecondPreview] = useState<BillDocument | null>(null);

  // ── Creation options (user-selectable per bill run) ────────────────────
  // Auto-download the PDF right after saving; mark the invoice(s) fully paid
  // on creation (amountPaid = total → status PAID) instead of the Paid-now
  // field. Defaults: auto-save ON (the common case), mark-paid OFF.
  const [autoSavePdf, setAutoSavePdf] = useState(true);
  const [markPaid, setMarkPaid] = useState(false);

  const [payingInvoice, setPayingInvoice] = useState<InvoiceDto | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [recordingPayment, setRecordingPayment] = useState(false);
  const recordPayment = useRecordInvoicePayment(payingInvoice?.id ?? "");

  const distinct = twoInOne && mode === "distinct";

  const subtotal = useMemo(
    () => lines.reduce((sum, l) => sum + (Number(l.quantity) || 0) * (Number(l.price) || 0), 0),
    [lines],
  );
  const total = Math.max(0, subtotal - (Number(discount) || 0) + (Number(deliveryCharge) || 0));
  const secondSubtotal = useMemo(
    () => secondLines.reduce((sum, l) => sum + (Number(l.quantity) || 0) * (Number(l.price) || 0), 0),
    [secondLines],
  );
  const secondTotal = Math.max(0, secondSubtotal - (Number(secondDiscount) || 0) + (Number(secondDeliveryCharge) || 0));
  const shop = settings ? settingsToShop(settings) : null;

  function updateLine(index: number, patch: Partial<LineState>) {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  }

  function updateSecondLine(index: number, patch: Partial<LineState>) {
    setSecondLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  }

  function pickProduct(index: number, p: ProductOption, target: "first" | "second" = "first") {
    const patch = {
      productId: p.id,
      productName: p.name,
      sku: p.sku ?? "",
      color: p.color ?? "",
      size: p.size ?? "",
      price: String(p.sellingPrice),
    };
    if (target === "second") updateSecondLine(index, patch);
    else updateLine(index, patch);
  }

  function lineItems(list: LineState[]) {
    return list
      .map((l) => ({
        productId: l.productId || undefined,
        productName: l.productName.trim(),
        sku: l.sku.trim() || undefined,
        color: l.color.trim() || undefined,
        size: l.size.trim() || undefined,
        description: l.description.trim() || undefined,
        quantity: Number(l.quantity) || 0,
        price: Number(l.price) || 0,
      }))
      .filter((it) => it.productName && it.quantity > 0);
  }

  function resetForm() {
    setCustomerName("");
    setCustomerPhone("");
    setCustomerAddress("");
    setPartyId("");
    setDiscount("0");
    setDeliveryCharge("0");
    setAmountPaid("0");
    setLines([emptyLine()]);
    setSecondCustomerName("");
    setSecondCustomerPhone("");
    setSecondCustomerAddress("");
    setSecondPartyId("");
    setSecondDiscount("0");
    setSecondDeliveryCharge("0");
    setSecondAmountPaid("0");
    setSecondLines([emptyLine()]);
    setPreview(null);
    setSecondPreview(null);
  }

  async function handleCreate() {
    const items = lineItems(lines);
    if (items.length === 0) {
      toast.error("Add at least one line item");
      return;
    }
    if (distinct && lineItems(secondLines).length === 0) {
      toast.error("Add at least one line item to the second bill");
      return;
    }
    if (!customerName.trim()) {
      toast.error("Customer name is required");
      return;
    }
    if (distinct && !secondCustomerName.trim()) {
      toast.error("Second bill customer name is required");
      return;
    }
    const zeroPrice = items.findIndex((it) => !(it.price > 0));
    if (zeroPrice >= 0) {
      toast.error(`Set a price above 0 for item ${zeroPrice + 1} — picking a product auto-fills its selling price`);
      return;
    }
    if (total <= 0) {
      toast.error("Bill total must be above 0 — check item prices, discount and delivery charge");
      return;
    }
    if (distinct) {
      const secondItems = lineItems(secondLines);
      const secondZero = secondItems.findIndex((it) => !(it.price > 0));
      if (secondZero >= 0) {
        toast.error(`Bill 2: set a price above 0 for item ${secondZero + 1}`);
        return;
      }
      if (secondTotal <= 0) {
        toast.error("Bill 2 total must be above 0");
        return;
      }
    }

    setSaving(true);
    try {
      const base = {
        date,
        notes: notes.trim() || undefined,
        paymentMethod: "cash" as const,
        shopDetails: shop ? toInvoiceShop(shop) : undefined,
      };
      const invoice = await createInvoice.mutateAsync({
        ...base,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim() || undefined,
        customerAddress: customerAddress.trim() || undefined,
        partyId: partyId && partyId !== "__none" ? partyId : undefined,
        items,
        discount: Number(discount) || 0,
        deliveryCharge: Number(deliveryCharge) || 0,
        // "Mark as paid" wins over the Paid-now field — the invoice is saved
        // with its full total as paid, so it lands as PAID (not UNPAID).
        amountPaid: markPaid ? total : Number(amountPaid) || 0,
      });

      const shopForPreview: BillShopDetails = invoice.shopDetails
        ? { name: invoice.shopDetails.name, address: invoice.shopDetails.address, phones: invoice.shopDetails.phones, email: invoice.shopDetails.email }
        : shop ?? { name: "My Shop", address: null, phones: [], email: null };
      const doc = invoiceToBillDocument(invoice, shopForPreview, settings?.currency ?? "INR");
      setPreview(doc);

      let secondInvoice: InvoiceDto | null = null;
      if (distinct) {
        try {
          secondInvoice = await createInvoice.mutateAsync({
            ...base,
            customerName: secondCustomerName.trim(),
            customerPhone: secondCustomerPhone.trim() || undefined,
            customerAddress: secondCustomerAddress.trim() || undefined,
            partyId: secondPartyId && secondPartyId !== "__none" ? secondPartyId : undefined,
            items: lineItems(secondLines),
            discount: Number(secondDiscount) || 0,
            deliveryCharge: Number(secondDeliveryCharge) || 0,
            amountPaid: markPaid ? secondTotal : Number(secondAmountPaid) || 0,
          });
          if (secondInvoice) {
            setSecondPreview(invoiceToBillDocument(secondInvoice, shopForPreview, settings?.currency ?? "INR"));
          }
        } catch (err) {
          // First bill was already saved — surface the partial result clearly.
          toast.error(`Bill 1 (${invoice.invoiceNumber}) saved, but Bill 2 failed`,
            { description: err instanceof Error ? err.message : undefined });
          resetForm();
          return;
        }
      }

      toast.success(
        distinct && secondInvoice
          ? `2 bills saved — ${invoice.invoiceNumber} + ${secondInvoice.invoiceNumber}`
          : `Invoice ${invoice.invoiceNumber} created`,
      );

      // Auto-save the PDF right after the invoice lands (same shared
      // renderer as the preview's Download button).
      if (autoSavePdf) {
        try {
          await downloadBillPdf(doc, {
            twoInOne,
            mode,
            secondBill: distinct ? secondPreview ?? undefined : undefined,
            classicColor,
          });
        } catch (err) {
          toast.error("Bill saved, but the PDF could not be generated", {
            description: err instanceof Error ? err.message : undefined,
          });
        }
      }

      resetForm();
    } catch (err) {
      toast.error("Failed to create invoice", { description: err instanceof Error ? err.message : undefined });
    } finally {
      setSaving(false);
    }
  }

  async function exportBill(doc: BillDocument) {
    setExporting(true);
    try {
      await downloadBillPdf(doc, {
        twoInOne,
        mode,
        secondBill: secondPreview ?? undefined,
        classicColor,
      });
      toast.success("PDF downloaded");
    } catch (err) {
      toast.error("Could not generate PDF", { description: err instanceof Error ? err.message : undefined });
    } finally {
      setExporting(false);
    }
  }

  async function handleRecordPayment() {
    if (!payingInvoice) return;
    const amount = Number(payAmount);
    if (!amount || amount <= 0) {
      toast.error("Enter a positive amount");
      return;
    }
    setRecordingPayment(true);
    try {
      await recordPayment.mutateAsync({ amount, method: "cash" });
      toast.success("Payment recorded");
      setPayingInvoice(null);
      setPayAmount("");
    } catch (err) {
      toast.error("Payment failed", { description: err instanceof Error ? err.message : undefined });
    } finally {
      setRecordingPayment(false);
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="New Bill"
        badge="Billing"
        subtitle="Create invoices with the same shared bill engine as web & mobile — jewellery or e-commerce templates, 2-in-1 supported."
      />
      <div className="grid gap-5 xl:grid-cols-3">
        <div className="space-y-5 xl:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Bill details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <BillTemplateOptions
                    template={template}
                    classicColor={classicColor}
                    twoInOne={twoInOne}
                    mode={mode}
                    onTemplate={(next) => {
                      setTemplate(next);
                      toast.success(next === "jewellery" ? "Classic Jewellery template" : "Modern E-commerce template");
                    }}
                    onClassicColor={(next) => {
                      setClassicColor(next);
                      toast.success(next === "red" ? "Red theme" : "Yellow theme", { description: "Bill accent color updated" });
                    }}
                    onTwoInOne={(next) => {
                      setTwoInOne(next);
                      toast.success(next ? "2-in-1 bill enabled" : "2-in-1 bill disabled");
                    }}
                    onMode={(next) => {
                      setMode(next);
                      toast.success(next === "duplicate" ? "Duplicate mode" : "Separate mode", {
                        description: next === "duplicate" ? "Two identical bills on one page" : "Two different bills on one page",
                      });
                    }}
                  />

                  <CustomerFields
                    name={customerName}
                    phone={customerPhone}
                    address={customerAddress}
                    partyId={partyId}
                    parties={parties}
                    onName={setCustomerName}
                    onPhone={setCustomerPhone}
                    onAddress={setCustomerAddress}
                    onParty={setPartyId}
                    idPrefix="b"
                  />

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="b-date">Date</Label>
                      <Input id="b-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="b-notes">Notes / terms</Label>
                      <Input id="b-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Thank you for your business!" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Items</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <LineItemsEditor
                    lines={lines}
                    allProducts={allProducts}
                    update={updateLine}
                    remove={(i) => setLines((prev) => prev.filter((_, x) => x !== i))}
                    add={() => setLines((prev) => [...prev, emptyLine()])}
                    pick={(i, p) => pickProduct(i, p, "first")}
                  />
                  <SeparatorLine />
                  <AdjustmentFields
                    discount={discount}
                    delivery={deliveryCharge}
                    paid={amountPaid}
                    onDiscount={setDiscount}
                    onDelivery={setDeliveryCharge}
                    onPaid={setAmountPaid}
                    idPrefix="b"
                  />
                  <TotalsSummary
                    subtotal={subtotal}
                    discount={Number(discount) || 0}
                    delivery={Number(deliveryCharge) || 0}
                    total={total}
                    paid={Number(amountPaid) || 0}
                  />
                </CardContent>
              </Card>

              {distinct && (
                <Card className="border-primary/30">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-sm">
                      Second Bill — separate <Badge variant="secondary">Bill 2</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <CustomerFields
                      name={secondCustomerName}
                      phone={secondCustomerPhone}
                      address={secondCustomerAddress}
                      partyId={secondPartyId}
                      parties={parties}
                      onName={setSecondCustomerName}
                      onPhone={setSecondCustomerPhone}
                      onAddress={setSecondCustomerAddress}
                      onParty={setSecondPartyId}
                      idPrefix="sb"
                    />
                    <LineItemsEditor
                      lines={secondLines}
                      allProducts={allProducts}
                      update={updateSecondLine}
                      remove={(i) => setSecondLines((prev) => prev.filter((_, x) => x !== i))}
                      add={() => setSecondLines((prev) => [...prev, emptyLine()])}
                      pick={(i, p) => pickProduct(i, p, "second")}
                    />
                    <SeparatorLine />
                    <AdjustmentFields
                      discount={secondDiscount}
                      delivery={secondDeliveryCharge}
                      paid={secondAmountPaid}
                      onDiscount={setSecondDiscount}
                      onDelivery={setSecondDeliveryCharge}
                      onPaid={setSecondAmountPaid}
                      idPrefix="sb"
                    />
                    <TotalsSummary
                      subtotal={secondSubtotal}
                      discount={Number(secondDiscount) || 0}
                      delivery={Number(secondDeliveryCharge) || 0}
                      total={secondTotal}
                      paid={Number(secondAmountPaid) || 0}
                    />
                  </CardContent>
                </Card>
              )}

              {/* Creation options — auto-save the PDF and/or mark fully paid */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">On save</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <label className="flex items-center gap-2.5 text-sm">
                    <Checkbox
                      checked={autoSavePdf}
                      onCheckedChange={setAutoSavePdf}
                      aria-label="Auto-save the bill PDF after creating the invoice"
                    />
                    <FileDown className="text-muted-foreground h-4 w-4" />
                    <span>Auto-save the PDF after creating</span>
                  </label>
                  <label className="flex items-center gap-2.5 text-sm">
                    <Checkbox
                      checked={markPaid}
                      onCheckedChange={setMarkPaid}
                      aria-label="Mark the invoice as fully paid on creation"
                    />
                    <CheckCircle2 className="text-muted-foreground h-4 w-4" />
                    <span>
                      Mark as paid{' '}
                      <span className="text-muted-foreground">
                        (total {money(total)} received now{distinct ? ` · bill 2 ${money(secondTotal)}` : ""})
                      </span>
                    </span>
                  </label>
                </CardContent>
              </Card>

              <Button className="w-full" onClick={handleCreate} disabled={saving}>
                {saving ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Saving…</> : `Create invoice — ${money(total)}${distinct ? ` + ${money(secondTotal)}` : ""}`}
              </Button>
            </div>

            <Card className="h-fit">
              <CardHeader>
                <CardTitle className="text-sm">Bill preview</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {preview ? (
                  <>
                    <div className="rounded-lg border p-3 text-sm">
                      <p className="font-semibold">{preview.shop.name}</p>
                      <p className="text-muted-foreground">{preview.billNo} · {preview.date}</p>
                      <p className="text-muted-foreground">{preview.customerName ?? "Walk-in Customer"}</p>
                      <SeparatorLine />
                      {preview.lines.map((l, i) => (
                        <p key={i} className="flex justify-between text-xs">
                          <span className="truncate pr-2">{l.quantity} × {l.productName}</span>
                          <span>{money(l.total)}</span>
                        </p>
                      ))}
                      <SeparatorLine />
                      <p className="flex justify-between"><span className="text-muted-foreground">Total</span><span className="font-bold">{money(preview.total)}</span></p>
                      <p className="mt-2 text-xs italic text-muted-foreground">{preview.amountInWords}</p>
                    </div>
                    {secondPreview && distinct && (
                      <div className="rounded-lg border border-primary/30 p-3 text-sm">
                        <p className="font-semibold">Bill 2 — {secondPreview.billNo}</p>
                        <p className="text-muted-foreground">{secondPreview.customerName ?? "Walk-in Customer"}</p>
                        <SeparatorLine />
                        {secondPreview.lines.map((l, i) => (
                          <p key={i} className="flex justify-between text-xs">
                            <span className="truncate pr-2">{l.quantity} × {l.productName}</span>
                            <span>{money(l.total)}</span>
                          </p>
                        ))}
                        <SeparatorLine />
                        <p className="flex justify-between"><span className="text-muted-foreground">Total</span><span className="font-bold">{money(secondPreview.total)}</span></p>
                      </div>
                    )}
                    <Button className="w-full" onClick={() => exportBill(preview)} disabled={exporting}>
                      <Download className="h-4 w-4" /> {exporting ? "Generating…" : twoInOne ? "Download 2-in-1 PDF" : "Download PDF"}
                    </Button>
                  </>
                ) : (
                  <p className="text-muted-foreground text-sm">Create a bill to see the shared preview here.</p>
                )}
              </CardContent>
            </Card>
        </div>

      <Dialog open={payingInvoice !== null} onOpenChange={(open) => !open && setPayingInvoice(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Record payment — {payingInvoice?.invoiceNumber}</DialogTitle>
            <DialogDescription>
              Outstanding: {payingInvoice ? money(payingInvoice.total - payingInvoice.amountPaid) : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="pay-amount">Amount</Label>
            <Input id="pay-amount" type="number" min={0} value={payAmount} onChange={(e) => setPayAmount(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayingInvoice(null)}>Cancel</Button>
            <Button onClick={handleRecordPayment} disabled={recordingPayment}>
              {recordingPayment ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Recording…</> : "Record payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

type PartyOption = { id: string; name: string; phone: string | null; address: string | null };

/** Customer identity fields — always first in the flow. */
function CustomerFields({
  name,
  phone,
  address,
  partyId,
  parties,
  onName,
  onPhone,
  onAddress,
  onParty,
  idPrefix,
}: {
  name: string;
  phone: string;
  address: string;
  partyId: string;
  parties: PartyOption[] | null | undefined;
  onName: (v: string) => void;
  onPhone: (v: string) => void;
  onAddress: (v: string) => void;
  onParty: (v: string) => void;
  idPrefix: string;
}) {
  function pickParty(id: string) {
    onParty(id);
    const p = parties?.find((x) => x.id === id);
    if (!p) return;
    if (p.name) onName(p.name);
    if (p.phone) onPhone(p.phone);
    if (p.address) onAddress(p.address);
  }

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-cust`}>Customer</Label>
        <Input id={`${idPrefix}-cust`} value={name} onChange={(e) => onName(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-phone`}>Phone</Label>
        <Input id={`${idPrefix}-phone`} value={phone} onChange={(e) => onPhone(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-addr`}>Address</Label>
        <Input id={`${idPrefix}-addr`} value={address} onChange={(e) => onAddress(e.target.value)} />
      </div>
      <div className="space-y-1.5 sm:col-span-3">
        <Label htmlFor={`${idPrefix}-party`}>Link to khata party</Label>
        <Select value={partyId} onValueChange={pickParty}>
          <SelectTrigger id={`${idPrefix}-party`} className="w-full">
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
  );
}

/** Charges & payment — sit BELOW the items they adjust. */
function AdjustmentFields({
  discount,
  delivery,
  paid,
  onDiscount,
  onDelivery,
  onPaid,
  idPrefix,
}: {
  discount: string;
  delivery: string;
  paid: string;
  onDiscount: (v: string) => void;
  onDelivery: (v: string) => void;
  onPaid: (v: string) => void;
  idPrefix: string;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-disc`}>Discount (₹)</Label>
        <Input id={`${idPrefix}-disc`} type="number" min={0} value={discount} onChange={(e) => onDiscount(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-delivery`}>Delivery charge (₹)</Label>
        <Input id={`${idPrefix}-delivery`} type="number" min={0} value={delivery} onChange={(e) => onDelivery(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-paid`}>Paid now (₹)</Label>
        <Input id={`${idPrefix}-paid`} type="number" min={0} value={paid} onChange={(e) => onPaid(e.target.value)} />
      </div>
    </div>
  );
}

/** Live math: subtotal − discount + delivery = total, so the auto-calc is visible. */
function TotalsSummary({
  subtotal,
  discount,
  delivery,
  total,
  paid,
}: {
  subtotal: number;
  discount: number;
  delivery: number;
  total: number;
  paid: number;
}) {
  const due = Math.max(0, total - paid);
  return (
    <div className="bg-muted/50 space-y-1.5 rounded-lg border p-3 text-sm">
      <p className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span className="tabular-nums">{money(subtotal)}</span></p>
      {discount > 0 && <p className="flex justify-between"><span className="text-muted-foreground">Discount</span><span className="tabular-nums">−{money(discount)}</span></p>}
      {delivery > 0 && <p className="flex justify-between"><span className="text-muted-foreground">Delivery</span><span className="tabular-nums">+{money(delivery)}</span></p>}
      <p className="flex justify-between border-t pt-1.5"><span className="font-semibold">Total</span><span className="font-bold tabular-nums">{money(total)}</span></p>
      <p className="flex justify-between"><span className="text-muted-foreground">Paid now</span><span className="tabular-nums">{money(paid)}</span></p>
      <p className="flex justify-between"><span className="text-muted-foreground">Balance due</span><span className="font-semibold tabular-nums">{money(due)}</span></p>
    </div>
  );
}

function LineItemsEditor({
  lines,
  update,
  remove,
  add,
  pick,
  allProducts,
}: {
  lines: LineState[];
  update: (i: number, patch: Partial<LineState>) => void;
  remove: (i: number) => void;
  add: () => void;
  pick: (i: number, p: ProductOption) => void;
  allProducts: ProductOption[] | null | undefined;
}) {
  return (
    <div className="space-y-2">
      {lines.map((line, index) => (
        <div key={index} className="bg-muted/50 flex flex-wrap items-end gap-2 rounded-lg border p-3">
          <div className="min-w-56 flex-1 space-y-1.5">
            <Label>Item {index + 1}</Label>
            <ProductSearchSelect
              products={allProducts}
              onSelect={(p) => pick(index, p)}
              placeholder={line.productId ? "Swap product…" : "Search from stock…"}
            />
          </div>
          <div className="min-w-40 flex-1 space-y-1.5">
            <Label>Or type item name</Label>
            <Input value={line.productName} onChange={(e) => update(index, { productName: e.target.value })} />
            <Input
              value={line.description}
              onChange={(e) => update(index, { description: e.target.value })}
              placeholder="Description (optional)"
              className="h-8 text-xs"
            />
          </div>
          <div className="w-20 space-y-1.5">
            <Label>Qty</Label>
            <Input type="number" min={1} value={line.quantity} onChange={(e) => update(index, { quantity: e.target.value })} />
          </div>
          <div className="w-28 space-y-1.5">
            <Label>Price</Label>
            <Input type="number" min={0} value={line.price} onChange={(e) => update(index, { price: e.target.value })} />
          </div>
          <Button variant="ghost" size="icon" onClick={() => remove(index)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={add}>
        <Plus className="h-4 w-4" /> Add item
      </Button>
    </div>
  );
}

function SeparatorLine() {
  return <div className="bg-border my-2 h-px" />;
}
