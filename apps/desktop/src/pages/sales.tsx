import { useEffect, useMemo, useState } from "react";
import {
  Search, ShoppingCart, Receipt, IndianRupee, TrendingUp, Undo2,
  AlertTriangle, Loader2, Clock, CheckCircle2,
  ArrowUpRight,
} from "lucide-react";
import { formatCurrency } from "@munim/core";
import type { InvoiceDto } from "@munim/api-client";
import {
  useProducts,
  useInvoices,
  useCreateSale,
  useUndoSale,
  useQueryState,
} from "@munim/query";
import { money } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { toast } from "@munim/ui";
import {
  Button, Input, Label, Badge, Card, CardContent, CardHeader, CardTitle, Skeleton,
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@munim/ui";

type RangeKey = "all" | "today" | "7d" | "30d" | "month" | "year";

function rangeToDates(range: RangeKey): { startDate?: string; endDate?: string } {
  if (range === "all") return {};
  const now = new Date();
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  switch (range) {
    case "today":
      return { startDate: start.toISOString().slice(0, 10), endDate: end.toISOString().slice(0, 10) };
    case "7d":
      start.setDate(start.getDate() - 6);
      return { startDate: start.toISOString().slice(0, 10), endDate: end.toISOString().slice(0, 10) };
    case "30d":
      start.setDate(start.getDate() - 29);
      return { startDate: start.toISOString().slice(0, 10), endDate: end.toISOString().slice(0, 10) };
    case "month":
      start.setDate(1);
      return { startDate: start.toISOString().slice(0, 10), endDate: end.toISOString().slice(0, 10) };
    case "year":
      start.setMonth(0, 1);
      return { startDate: start.toISOString().slice(0, 10), endDate: end.toISOString().slice(0, 10) };
  }
}

export function SalesPage() {
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [price, setPrice] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [isPaid, setIsPaid] = useState(true);
  const [saving, setSaving] = useState(false);

  // List filters
  const [search, setSearch] = useState("");
  const [range, setRange] = useState<RangeKey>("all");
  const [undoTarget, setUndoTarget] = useState<InvoiceDto | null>(null);
  const [undoOpen, setUndoOpen] = useState(false);
  const [undoing, setUndoing] = useState(false);

  const { data: allProductsData } = useQueryState(useProducts({ pageSize: 1000 }));
  const allProducts = allProductsData?.products;

  const { startDate, endDate } = rangeToDates(range);
  const { data: recent, loading: loadingRecent, refetching } = useQueryState(
    useInvoices({ search, startDate, endDate, pageSize: 200 }),
  );

  const createSale = useCreateSale();
  const undoSale = useUndoSale();

  useEffect(() => {
    if (allProducts && allProducts.length > 0 && !productId) {
      setProductId(allProducts[0]!.id);
      setPrice(String(allProducts[0]!.sellingPrice));
    }
  }, [allProducts, productId]);

  const selected = useMemo(
    () => allProducts?.find((p) => p.id === productId) ?? null,
    [allProducts, productId],
  );

  const sales = recent?.invoices ?? [];
  const totalRevenue = sales.reduce((s, x) => s + x.total, 0);
  const totalQty = sales.reduce((s, x) => s + x.items.reduce((a, it) => a + it.quantity, 0), 0);
  const avgSale = sales.length > 0 ? totalRevenue / sales.length : 0;
  const avgPerUnit = totalQty > 0 ? totalRevenue / totalQty : 0;

  const lineTotal = (Number(quantity) || 0) * (Number(price) || 0);

  async function handleSell() {
    const qty = Number(quantity);
    const sellPrice = Number(price);
    if (!selected) {
      toast.error("Choose a product");
      return;
    }
    if (!qty || qty <= 0) {
      toast.error("Quantity must be positive");
      return;
    }
    if (sellPrice < 0 || Number.isNaN(sellPrice)) {
      toast.error("Enter a valid price");
      return;
    }
    setSaving(true);
    try {
      const invoice = await createSale.mutateAsync({
        productId: selected.id,
        quantity: qty,
        sellingPrice: sellPrice || undefined,
        customerName: customerName.trim() || undefined,
        customerPhone: customerPhone.trim() || undefined,
        paid: isPaid,
        paymentMethod: isPaid ? "cash" : "credit",
      });
      toast.success(`Sale done — ${invoice.invoiceNumber} (${money(invoice.total)})`);
      setQuantity("1");
      setCustomerName("");
      setCustomerPhone("");
    } catch (err) {
      toast.error("Sale failed", { description: err instanceof Error ? err.message : undefined });
    } finally {
      setSaving(false);
    }
  }

  async function confirmUndo() {
    if (!undoTarget) return;
    setUndoing(true);
    try {
      await undoSale.mutateAsync(undoTarget.id);
      toast.success("Sale undone", { description: `${undoTarget.invoiceNumber} reversed — stock restored.` });
      setUndoOpen(false);
    } catch (err) {
      toast.error("Undo failed", { description: err instanceof Error ? err.message : undefined });
    } finally {
      setUndoing(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* ── Header ─────────────────────────────────────────────── */}
      <PageHeader
        title="Sales Counter & POS Terminal"
        badge="Counter"
        subtitle="Quick counter sales, last n items and returns — unified sales ledger with margin tracking."
      />

      {/* ── Stats tiles ────────────────────────────────────────── */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Receipt className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Total Sales</p>
              <p className="text-lg font-semibold tabular-nums">{sales.length}</p>
              <p className="text-[11px] text-muted-foreground">
                <span className="text-emerald-600 dark:text-emerald-400">
                  <ArrowUpRight className="inline h-3 w-3" />
                </span>
                {" "}in current filter
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <IndianRupee className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Total Revenue</p>
              <p className="text-lg font-semibold tabular-nums">{formatCurrency(totalRevenue)}</p>
              <p className="text-[11px] text-muted-foreground">
                Avg. {formatCurrency(avgSale)} / sale
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400">
              <ShoppingCart className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Units Sold</p>
              <p className="text-lg font-semibold tabular-nums">{totalQty}</p>
              <p className="text-[11px] text-muted-foreground">
                {sales.length > 0 ? `${(totalQty / sales.length).toFixed(1)} avg / txn` : "—"}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Avg. Sale Value</p>
              <p className="text-lg font-semibold tabular-nums">{formatCurrency(avgSale)}</p>
              <p className="text-[11px] text-muted-foreground">
                Weighted {formatCurrency(avgPerUnit)} / unit
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Main content: POS + History ────────────────────────── */}
      <div className="grid gap-5 xl:grid-cols-5">
        {/* ── Left: Quick Sale Terminal ──────────────────────────── */}
        <Card className="xl:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-sm">
                <ShoppingCart className="h-4 w-4" /> Quick Sale Terminal
              </CardTitle>
              <span className="text-muted-foreground text-[11px]">Point of sales</span>
            </div>
            <p className="text-muted-foreground text-xs">
              Record a sale in seconds — search by name, SKU, or <kbd className="bg-muted rounded px-1 py-0.5 text-[10px] font-mono">Scan</kbd> a barcode.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Product search */}
            <div className="space-y-1.5">
              <Label className="text-xs">Select Product / Scan Barcode</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Select value={productId || undefined} onValueChange={(v) => {
                  setProductId(v);
                  const p = allProducts?.find((x) => x.id === v);
                  if (p) setPrice(String(p.sellingPrice));
                }}>
                  <SelectTrigger className="h-10 pl-9 font-mono text-sm">
                    <SelectValue placeholder="Search by name, SKU, or scan barcode…" />
                  </SelectTrigger>
                  <SelectContent>
                    {allProducts?.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        <div className="flex flex-col">
                          <span>{p.name}</span>
                          <span className="text-muted-foreground text-xs">
                            {p.sku} · {money(p.sellingPrice)} · {p.stock} in stock
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {selected && (
                <div className="flex items-center gap-3 rounded-lg border p-2.5">
                  <div className="bg-muted flex h-12 w-12 shrink-0 items-center justify-center rounded-md text-lg font-bold text-primary/60">
                    {selected.name.charAt(0)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{selected.name}</p>
                    <p className="text-muted-foreground text-xs">
                      {selected.sku}
                      {selected.category ? <>, {selected.category}</> : null}
                      {selected.color ? <>, {selected.color}</> : null}
                      {selected.size ? <> · {selected.size}</> : null}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      Weight: {selected.weight != null ? `${(selected.weight / 1000).toFixed(2)} g` : "—"}
                      {" · "}Stock: <span className={selected.stock <= (selected.lowStockThreshold ?? 0) ? "text-amber-600 font-medium" : ""}>{selected.stock} units</span>
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Quantity & Price */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="s-qty" className="text-xs">Quantity</Label>
                <Input
                  id="s-qty"
                  type="number"
                  min={1}
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="h-10 text-sm"
                />
                {selected && (
                  <p className="text-muted-foreground text-[11px]">
                    In stock: {selected.stock}
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="s-price" className="text-xs">Selling Price</Label>
                <Input
                  id="s-price"
                  type="number"
                  min={0}
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="h-10 text-sm"
                />
                {selected && Number(price) > 0 && selected.purchasePrice > 0 && (
                  <p className="text-[11px]">
                    <span className="text-muted-foreground">Margin: </span>
                    <span className={Number(price) > selected.purchasePrice ? "text-emerald-600 dark:text-emerald-400 font-medium" : "text-red-600 dark:text-red-400"}>
                      {money(Number(price) - selected.purchasePrice)}
                    </span>
                  </p>
                )}
              </div>
            </div>

            {/* Customer Khata Profile */}
            <div className="space-y-1.5">
              <Label className="text-xs">Customer Khata Profile</Label>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <Input
                  placeholder="Customer name"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="h-9 text-sm"
                />
                <Input
                  placeholder="Customer phone"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="h-9 text-sm"
                />
              </div>
              <div className="text-muted-foreground flex gap-4 text-[11px]">
                <span>1 name added</span>
                <span>Current balance: {money(0)}</span>
              </div>
            </div>

            {/* Payment Received */}
            <div className="space-y-1.5">
              <Label className="text-xs">Payment Received?</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setIsPaid(true)}
                  className={`flex items-center justify-center gap-1.5 rounded-lg border p-2.5 text-xs font-medium transition-colors ${
                    isPaid
                      ? "border-primary bg-primary/5 text-primary"
                      : "text-muted-foreground hover:bg-muted/50"
                  }`}
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Yes — Paid
                </button>
                <button
                  type="button"
                  onClick={() => setIsPaid(false)}
                  className={`flex items-center justify-center gap-1.5 rounded-lg border p-2.5 text-xs font-medium transition-colors ${
                    !isPaid
                      ? "border-amber-500 bg-amber-500/5 text-amber-600 dark:text-amber-400"
                      : "text-muted-foreground hover:bg-muted/50"
                  }`}
                >
                  <Clock className="h-4 w-4" />
                  No — Credit
                </button>
              </div>
            </div>

            {/* Amount summary */}
            <div className="space-y-1.5 rounded-lg border bg-muted/30 p-3">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Line Amount</span>
                <span className="tabular-nums">{money(lineTotal)}</span>
              </div>
              <div className="border-t pt-1.5">
                <div className="flex justify-between text-sm font-semibold">
                  <span>Total</span>
                  <span className="tabular-nums">{money(lineTotal)}</span>
                </div>
              </div>
            </div>

            {/* Submit */}
            <Button
              className="h-11 w-full text-sm font-semibold"
              onClick={handleSell}
              disabled={saving}
            >
              {saving ? (
                <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Processing…</>
              ) : (
                <>Complete Sale & Print Bill (Ctrl+Enter)</>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* ── Right: Sales History ──────────────────────────────── */}
        <Card className="xl:col-span-3">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Real-Time Sales History</CardTitle>
              <span className="text-muted-foreground text-[11px]">Search and filter by date</span>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Search + range tabs */}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative w-full sm:max-w-xs">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search invoice, product, SKU…"
                  className="h-9 pl-9 text-sm"
                  aria-label="Search sales"
                />
              </div>
              <div className="flex gap-1">
                {(["today", "month", "year", "all"] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRange(r)}
                    className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                      range === r
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {r === "all" ? "All" : r === "today" ? "Today" : r === "month" ? "This Month" : "This Year"}
                  </button>
                ))}
                {refetching && <Loader2 className="ml-1 h-3.5 w-3.5 animate-spin text-muted-foreground" />}
              </div>
            </div>

            {/* Table */}
            {loadingRecent ? (
              <div className="space-y-2">
                {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : (
              <>
                <div className="overflow-x-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="text-xs">Invoice #</TableHead>
                        <TableHead className="text-xs">Customer</TableHead>
                        <TableHead className="text-xs">Product</TableHead>
                        <TableHead className="text-xs">Qty</TableHead>
                        <TableHead className="text-xs text-right">Total</TableHead>
                        <TableHead className="text-xs">Status</TableHead>
                        <TableHead className="text-xs text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sales.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-muted-foreground py-8 text-center text-sm">
                            No sales found.
                          </TableCell>
                        </TableRow>
                      ) : (
                        sales.map((inv) => {
                          const item = inv.items[0];
                          return (
                            <TableRow key={inv.id} className="group">
                              <TableCell className="font-mono text-xs font-medium">{inv.invoiceNumber}</TableCell>
                              <TableCell>
                                <div className="flex flex-col">
                                  <span className="text-sm">{inv.customerName || "—"}</span>
                                  {inv.customerPhone ? <span className="text-muted-foreground text-xs">{inv.customerPhone}</span> : null}
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-col">
                                  <span className="text-sm">{item?.productName ?? "—"}</span>
                                  {item?.sku ? <span className="text-muted-foreground text-xs">{item.sku}</span> : null}
                                </div>
                              </TableCell>
                              <TableCell className="text-xs tabular-nums">×{item?.quantity ?? 0}</TableCell>
                              <TableCell className="text-right text-sm font-medium tabular-nums">{money(inv.total)}</TableCell>
                              <TableCell>
                                <Badge variant={inv.status === "PAID" ? "success" : inv.status === "PARTIAL" ? "warning" : "secondary"} className="text-[10px]">
                                  {inv.status}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  title="Undo sale"
                                  onClick={() => { setUndoTarget(inv); setUndoOpen(true); }}
                                  className="opacity-0 group-hover:opacity-100 text-amber-600 hover:text-amber-600 dark:text-amber-400 transition-opacity"
                                >
                                  <Undo2 className="h-3.5 w-3.5" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
                <div className="text-muted-foreground flex items-center justify-between text-[11px]">
                  <span>Showing 1-{sales.length} of {sales.length} transactions</span>
                  <span>Session Start: {new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })} · Today's total: {money(totalRevenue)}</span>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Undo dialog ────────────────────────────────────────── */}
      <Dialog open={undoOpen} onOpenChange={setUndoOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle>Undo this sale?</DialogTitle>
                <DialogDescription>
                  Sale <strong>{undoTarget?.invoiceNumber}</strong> will be removed and the stock restored. This cannot be undone.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUndoOpen(false)}>Cancel</Button>
            <Button onClick={confirmUndo} disabled={undoing} className="bg-amber-600 text-white hover:bg-amber-600/90">
              {undoing ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Undo2 className="mr-1.5 h-4 w-4" />}
              Undo sale
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
