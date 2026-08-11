import { useMemo, useState } from "react";
import { Plus, Trash2, Download, Wallet } from "lucide-react";
import {
  createInvoice,
  getSettings,
  listAllProducts,
  listInvoices,
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
import { toast } from "sonner";
import { Button, Input, Label, Badge, Card, CardContent, CardHeader, CardTitle, Tabs, TabsContent, TabsList, TabsTrigger, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@munim/ui"
;
;
;
;
;
;
;
;
;

type LineState = {
  productId: string;
  productName: string;
  sku: string;
  color: string;
  size: string;
  quantity: string;
  price: string;
};

function emptyLine(): LineState {
  return { productId: "", productName: "", sku: "", color: "", size: "", quantity: "1", price: "0" };
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
  const { data: list, loading: loadingList, reload: reloadList } = useAsync(
    () => listInvoices(getCore(), { pageSize: 100 }),
    [],
  );

  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [discount, setDiscount] = useState("0");
  const [deliveryCharge, setDeliveryCharge] = useState("0");
  const [amountPaid, setAmountPaid] = useState("0");
  const [lines, setLines] = useState<LineState[]>([emptyLine()]);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [preview, setPreview] = useState<BillDocument | null>(null);

  const [payingInvoice, setPayingInvoice] = useState<InvoiceWithItems | null>(null);
  const [payAmount, setPayAmount] = useState("");

  const subtotal = useMemo(
    () => lines.reduce((sum, l) => sum + (Number(l.quantity) || 0) * (Number(l.price) || 0), 0),
    [lines],
  );
  const total = Math.max(0, subtotal - (Number(discount) || 0) + (Number(deliveryCharge) || 0));
  const shop = settings ? settingsToShop(settings) : null;

  function updateLine(index: number, patch: Partial<LineState>) {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  }

  function pickProduct(index: number, productId: string) {
    const p = allProducts?.find((x) => x.id === productId);
    if (!p) return;
    updateLine(index, {
      productId: p.id,
      productName: p.name,
      sku: p.sku,
      color: p.colorName ?? "",
      size: p.sizeName ?? "",
      price: String(p.sellingPrice),
    });
  }

  async function handleCreate() {
    const items = lines
      .map((l) => ({
        productId: l.productId || undefined,
        productName: l.productName.trim(),
        sku: l.sku.trim() || undefined,
        color: l.color.trim() || undefined,
        size: l.size.trim() || undefined,
        quantity: Number(l.quantity) || 0,
        price: Number(l.price) || 0,
      }))
      .filter((it) => it.productName && it.quantity > 0);

    if (items.length === 0) {
      toast.error("Add at least one line item");
      return;
    }

    setSaving(true);
    try {
      const invoice = await createInvoice(getCore(), {
        customerName: customerName.trim() || undefined,
        customerPhone: customerPhone.trim() || undefined,
        customerAddress: customerAddress.trim() || undefined,
        items,
        discount: Number(discount) || 0,
        deliveryCharge: Number(deliveryCharge) || 0,
        amountPaid: Number(amountPaid) || 0,
        paymentMethod: "cash",
        shopDetails: shop ? toInvoiceShop(shop) : undefined,
      });
      if (!invoice) throw new Error("Failed to create invoice");
      const shopForPreview: BillShopDetails = invoice.shopDetails
        ? { name: invoice.shopDetails.name, address: invoice.shopDetails.address, phones: invoice.shopDetails.phones, email: invoice.shopDetails.email }
        : shop ?? { name: "My Shop", address: null, phones: [], email: null };
      const doc = invoiceToBillDocument(invoice, shopForPreview, settings?.currency ?? "INR");
      setPreview(doc);
      setCustomerName("");
      setCustomerPhone("");
      setCustomerAddress("");
      setDiscount("0");
      setDeliveryCharge("0");
      setAmountPaid("0");
      setLines([emptyLine()]);
      reloadList();
      toast.success(`Invoice ${invoice.invoiceNumber} created`);
    } catch (err) {
      toast.error("Failed to create invoice", { description: err instanceof Error ? err.message : undefined });
    } finally {
      setSaving(false);
    }
  }

  async function exportBill(doc: BillDocument) {
    setExporting(true);
    try {
      await downloadBillPdf(doc);
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
    await exportBill(invoiceToBillDocument(inv, shopForInvoice, settings?.currency ?? "INR"));
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
            <Card className="xl:col-span-2">
              <CardHeader>
                <CardTitle className="text-sm">Bill details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="b-cust">Customer</Label>
                    <Input id="b-cust" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="b-phone">Phone</Label>
                    <Input id="b-phone" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="b-addr">Address</Label>
                    <Input id="b-addr" value={customerAddress} onChange={(e) => setCustomerAddress(e.target.value)} />
                  </div>
                </div>

                <div className="space-y-2">
                  {lines.map((line, index) => (
                    <div key={index} className="bg-muted/50 flex flex-wrap items-end gap-2 rounded-lg border p-3">
                      <div className="min-w-44 flex-1 space-y-1.5">
                        <Label>Item {index + 1}</Label>
                        <Select value={line.productId || undefined} onValueChange={(v) => pickProduct(index, v)}>
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
                        <Input value={line.productName} onChange={(e) => updateLine(index, { productName: e.target.value })} />
                      </div>
                      <div className="w-20 space-y-1.5">
                        <Label>Qty</Label>
                        <Input type="number" min={1} value={line.quantity} onChange={(e) => updateLine(index, { quantity: e.target.value })} />
                      </div>
                      <div className="w-28 space-y-1.5">
                        <Label>Price</Label>
                        <Input type="number" min={0} value={line.price} onChange={(e) => updateLine(index, { price: e.target.value })} />
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => setLines((prev) => prev.filter((_, i) => i !== index))}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" onClick={() => setLines((prev) => [...prev, emptyLine()])}>
                    <Plus className="h-4 w-4" /> Add item
                  </Button>
                </div>

                <div className="grid gap-3 sm:grid-cols-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="b-disc">Discount</Label>
                    <Input id="b-disc" type="number" min={0} value={discount} onChange={(e) => setDiscount(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="b-delivery">Delivery</Label>
                    <Input id="b-delivery" type="number" min={0} value={deliveryCharge} onChange={(e) => setDeliveryCharge(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="b-paid">Paid now</Label>
                    <Input id="b-paid" type="number" min={0} value={amountPaid} onChange={(e) => setAmountPaid(e.target.value)} />
                  </div>
                  <div className="flex flex-col justify-end">
                    <div className="rounded-lg border p-3 text-sm">
                      <p className="text-muted-foreground">Total</p>
                      <p className="text-lg font-bold">{money(total)}</p>
                    </div>
                  </div>
                </div>

                <Button className="w-full" onClick={handleCreate} disabled={saving}>
                  {saving ? "Saving…" : `Create invoice — ${money(total)}`}
                </Button>
              </CardContent>
            </Card>

            <Card>
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
                    <Button className="w-full" onClick={() => exportBill(preview)} disabled={exporting}>
                      <Download className="h-4 w-4" /> {exporting ? "Generating…" : "Download PDF"}
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
                    <TableRow><TableCell colSpan={7} className="text-muted-foreground text-center">Loading…</TableCell></TableRow>
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

function SeparatorLine() {
  return <div className="bg-border my-2 h-px" />;
}
