import { useMemo, useState } from "react";
import { Plus, Trash2, Download, Wallet } from "lucide-react";
import {
  createInvoice,
  getSettings,
  listAllProducts,
  listInvoices,
  listParties,
  recordInvoicePayment,
  buildBillDocument,
  type BillDocument,
  type BillShopDetails,
  type InvoiceWithItems,
} from "@munim/core";
import { getCore } from "@/lib/core";
import { useAsync } from "@/lib/use-async";
import { money, formatDate } from "@/lib/format";
import { downloadBillPdf } from "@/lib/billPdf";
import { toast } from "@munim/ui";
import {
  Button,
  Input,
  Label,
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Skeleton,
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

function settingsToShop(s: Awaited<ReturnType<typeof getSettings>>): BillShopDetails {
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

function invoiceToBillDocument(inv: InvoiceWithItems, shop: BillShopDetails, currency: string): BillDocument {
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
  const { data: settings } = useAsync(() => getSettings(getCore()), []);
  const { data: allProducts } = useAsync(() => listAllProducts(getCore()), []);
  const { data: parties } = useAsync(() => listParties(getCore()), []);
  const { data: list, loading: loadingList, reload: reloadList } = useAsync(
    () => listInvoices(getCore(), { pageSize: 100 }),
    [],
  );

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

  const [payingInvoice, setPayingInvoice] = useState<InvoiceWithItems | null>(null);
  const [payAmount, setPayAmount] = useState("");

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

  function pickProduct(index: number, productId: string, target: "first" | "second" = "first") {
    const p = allProducts?.find((x) => x.id === productId);
    if (!p) return;
    const patch = {
      productId: p.id,
      productName: p.name,
      sku: p.sku,
      color: p.colorName ?? "",
      size: p.sizeName ?? "",
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

    setSaving(true);
    try {
      const base = {
        date,
        notes: notes.trim() || undefined,
        paymentMethod: "cash" as const,
        shopDetails: shop ? toInvoiceShop(shop) : undefined,
      };
      const invoice = await createInvoice(getCore(), {
        ...base,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim() || undefined,
        customerAddress: customerAddress.trim() || undefined,
        partyId: partyId && partyId !== "__none" ? partyId : undefined,
        items,
        discount: Number(discount) || 0,
        deliveryCharge: Number(deliveryCharge) || 0,
        amountPaid: Number(amountPaid) || 0,
      });
      if (!invoice) throw new Error("Failed to create invoice");

      const shopForPreview: BillShopDetails = invoice.shopDetails
        ? { name: invoice.shopDetails.name, address: invoice.shopDetails.address, phones: invoice.shopDetails.phones, email: invoice.shopDetails.email }
        : shop ?? { name: "My Shop", address: null, phones: [], email: null };
      const doc = invoiceToBillDocument(invoice, shopForPreview, settings?.currency ?? "INR");
      setPreview(doc);

      let secondInvoice: InvoiceWithItems | null = null;
      if (distinct) {
        try {
          secondInvoice = await createInvoice(getCore(), {
            ...base,
            customerName: secondCustomerName.trim(),
            customerPhone: secondCustomerPhone.trim() || undefined,
            customerAddress: secondCustomerAddress.trim() || undefined,
            partyId: secondPartyId && secondPartyId !== "__none" ? secondPartyId : undefined,
            items: lineItems(secondLines),
            discount: Number(secondDiscount) || 0,
            deliveryCharge: Number(secondDeliveryCharge) || 0,
            amountPaid: Number(secondAmountPaid) || 0,
          });
          if (secondInvoice) {
            setSecondPreview(invoiceToBillDocument(secondInvoice, shopForPreview, settings?.currency ?? "INR"));
          }
        } catch (err) {
          // First bill was already saved — surface the partial result clearly.
          toast.error(`Bill 1 (${invoice.invoiceNumber}) saved, but Bill 2 failed`,
            { description: err instanceof Error ? err.message : undefined });
          resetForm();
          reloadList();
          return;
        }
      }

      toast.success(
        distinct && secondInvoice
          ? `2 bills saved — ${invoice.invoiceNumber} + ${secondInvoice.invoiceNumber}`
          : `Invoice ${invoice.invoiceNumber} created`,
      );
      resetForm();
      reloadList();
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
    } catch (err) {
      toast.error("Could not generate PDF", { description: err instanceof Error ? err.message : undefined });
    } finally {
      setExporting(false);
    }
  }

  async function handleDownload(inv: InvoiceWithItems) {
    const shopForInvoice: BillShopDetails | null = inv.shopDetails
      ? { name: inv.shopDetails.name, address: inv.shopDetails.address, phones: inv.shopDetails.phones, email: inv.shopDetails.email }
      : shop;
    if (!shopForInvoice) {
      toast.error("Shop settings not loaded — open Settings first");
      return;
    }
    setExporting(true);
    try {
      await downloadBillPdf(invoiceToBillDocument(inv, shopForInvoice, settings?.currency ?? "INR"));
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
    try {
      await recordInvoicePayment(getCore(), payingInvoice.id, { amount, method: "cash" });
      toast.success("Payment recorded");
      setPayingInvoice(null);
      setPayAmount("");
      reloadList();
    } catch (err) {
      toast.error("Payment failed", { description: err instanceof Error ? err.message : undefined });
    }
  }

  return (
    <div className="space-y-5">
      <Tabs defaultValue="create">
        <TabsList>
          <TabsTrigger value="create">Create Bill</TabsTrigger>
          <TabsTrigger value="invoices">Invoices ({list?.invoices.length ?? 0})</TabsTrigger>
        </TabsList>

        <TabsContent value="create" className="mt-3">
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

                  <BillFields
                    name={customerName}
                    phone={customerPhone}
                    address={customerAddress}
                    discount={discount}
                    delivery={deliveryCharge}
                    paid={amountPaid}
                    partyId={partyId}
                    parties={parties}
                    onName={setCustomerName}
                    onPhone={setCustomerPhone}
                    onAddress={setCustomerAddress}
                    onParty={setPartyId}
                    onDiscount={setDiscount}
                    onDelivery={setDeliveryCharge}
                    onPaid={setAmountPaid}
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
                <CardContent>
                  <LineItemsEditor
                    lines={lines}
                    allProducts={allProducts}
                    update={updateLine}
                    remove={(i) => setLines((prev) => prev.filter((_, x) => x !== i))}
                    add={() => setLines((prev) => [...prev, emptyLine()])}
                    pick={(i, id) => pickProduct(i, id, "first")}
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
                    <BillFields
                      name={secondCustomerName}
                      phone={secondCustomerPhone}
                      address={secondCustomerAddress}
                      discount={secondDiscount}
                      delivery={secondDeliveryCharge}
                      paid={secondAmountPaid}
                      partyId={secondPartyId}
                      parties={parties}
                      onName={setSecondCustomerName}
                      onPhone={setSecondCustomerPhone}
                      onAddress={setSecondCustomerAddress}
                      onParty={setSecondPartyId}
                      onDiscount={setSecondDiscount}
                      onDelivery={setSecondDeliveryCharge}
                      onPaid={setSecondAmountPaid}
                      idPrefix="sb"
                    />
                    <LineItemsEditor
                      lines={secondLines}
                      allProducts={allProducts}
                      update={updateSecondLine}
                      remove={(i) => setSecondLines((prev) => prev.filter((_, x) => x !== i))}
                      add={() => setSecondLines((prev) => [...prev, emptyLine()])}
                      pick={(i, id) => pickProduct(i, id, "second")}
                    />
                  </CardContent>
                </Card>
              )}

              <Button className="w-full" onClick={handleCreate} disabled={saving}>
                {saving ? "Saving…" : `Create invoice — ${money(total)}${distinct ? ` + ${money(secondTotal)}` : ""}`}
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
        </TabsContent>

        <TabsContent value="invoices" className="mt-3">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Paid</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingList ? (
                    <TableRow>
                      <TableCell colSpan={7} className="p-4">
                        <div className="space-y-2">
                          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : !list || list.invoices.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-muted-foreground text-center">No invoices yet</TableCell></TableRow>
                  ) : (
                    list.invoices.map((inv) => (
                      <TableRow key={inv.id}>
                        <TableCell className="font-medium">{inv.invoiceNumber}</TableCell>
                        <TableCell>{inv.customerName ?? "—"}</TableCell>
                        <TableCell>{formatDate(inv.date)}</TableCell>
                        <TableCell className="text-right font-medium">{money(inv.total)}</TableCell>
                        <TableCell className="text-right">{money(inv.amountPaid)}</TableCell>
                        <TableCell>
                          <Badge variant={inv.status === "PAID" ? "success" : inv.status === "PARTIAL" ? "warning" : "secondary"}>
                            {inv.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            {inv.status !== "PAID" && (
                              <Button variant="ghost" size="icon-sm" title="Record payment" onClick={() => { setPayingInvoice(inv); setPayAmount(String(inv.total - inv.amountPaid)); }}>
                                <Wallet className="h-4 w-4" />
                              </Button>
                            )}
                            <Button variant="ghost" size="icon-sm" title="Download PDF" onClick={() => handleDownload(inv)} disabled={exporting}>
                              <Download className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

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
            <Button onClick={handleRecordPayment}>Record payment</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

type PartyOption = { id: string; name: string; phone: string | null; address: string | null };

function BillFields({
  name,
  phone,
  address,
  discount,
  delivery,
  paid,
  partyId,
  parties,
  onName,
  onPhone,
  onAddress,
  onParty,
  onDiscount,
  onDelivery,
  onPaid,
  idPrefix,
}: {
  name: string;
  phone: string;
  address: string;
  discount: string;
  delivery: string;
  paid: string;
  partyId: string;
  parties: PartyOption[] | null | undefined;
  onName: (v: string) => void;
  onPhone: (v: string) => void;
  onAddress: (v: string) => void;
  onParty: (v: string) => void;
  onDiscount: (v: string) => void;
  onDelivery: (v: string) => void;
  onPaid: (v: string) => void;
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
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-disc`}>Discount</Label>
        <Input id={`${idPrefix}-disc`} type="number" min={0} value={discount} onChange={(e) => onDiscount(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-delivery`}>Delivery</Label>
        <Input id={`${idPrefix}-delivery`} type="number" min={0} value={delivery} onChange={(e) => onDelivery(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-paid`}>Paid now</Label>
        <Input id={`${idPrefix}-paid`} type="number" min={0} value={paid} onChange={(e) => onPaid(e.target.value)} />
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
  pick: (i: number, id: string) => void;
  allProducts: { id: string; name: string; stock: number }[] | null | undefined;
}) {
  return (
    <div className="space-y-2">
      {lines.map((line, index) => (
        <div key={index} className="bg-muted/50 flex flex-wrap items-end gap-2 rounded-lg border p-3">
          <div className="min-w-44 flex-1 space-y-1.5">
            <Label>Item {index + 1}</Label>
            <Select value={line.productId || undefined} onValueChange={(v) => pick(index, v)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Choose from stock…" />
              </SelectTrigger>
              <SelectContent>
                {allProducts?.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} — {p.stock} in stock
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
