import { useEffect, useMemo, useState } from "react";
import { Search, X, ShoppingCart, Receipt, IndianRupee, TrendingUp, Undo2, AlertTriangle, Loader2 } from "lucide-react";
import { formatDate, formatCurrency } from "@munim/core";
import type { InvoiceDto } from "@munim/api-client";
import {
  useProducts,
  useInvoices,
  useCreateSale,
  useUndoSale,
  useQueryState,
} from "@munim/query";
import { money } from "@/lib/format";
import { toast } from "@munim/ui";
import {
  Button, Input, Label, Badge, Card, CardContent, CardHeader, CardTitle, Skeleton,
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
  SummaryTile,
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

type InvoiceRow = InvoiceDto;

export function SalesPage() {
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [price, setPrice] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [paid, setPaid] = useState(true);
  const [saving, setSaving] = useState(false);

  // List filters (web parity)
  const [search, setSearch] = useState("");
  const [range, setRange] = useState<RangeKey>("all");
  const [undoTarget, setUndoTarget] = useState<InvoiceRow | null>(null);
  const [undoOpen, setUndoOpen] = useState(false);
  const [undoing, setUndoing] = useState(false);

  const { data: allProductsData } = useQueryState(useProducts({ pageSize: 1000 }));
  const allProducts = allProductsData?.products;

  const { startDate, endDate } = rangeToDates(range);
  const { data: recent, loading: loadingRecent } = useQueryState(
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
  const totalQty = sales.reduce((s, x) => s + (x.items[0]?.quantity ?? 0), 0);
  const avgSale = sales.length > 0 ? totalRevenue / sales.length : 0;

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
        paid,
        paymentMethod: "cash",
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

  const hasFilters = !!search || range !== "all";

  return (
    <div className="space-y-4">
      {/* Summary (web parity) */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryTile icon={Receipt} label="Total Sales" value={String(sales.length)} />
        <SummaryTile icon={IndianRupee} label="Total Revenue" value={formatCurrency(totalRevenue)} accent="primary" />
        <SummaryTile icon={ShoppingCart} label="Units Sold" value={String(totalQty)} />
        <SummaryTile icon={TrendingUp} label="Avg. Sale Value" value={formatCurrency(avgSale)} />
      </div>

      {/* Toolbar (web parity) */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative w-full sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search invoice, product, SKU…"
              className="h-9 pl-9"
              aria-label="Search sales"
            />
          </div>
          <Select value={range} onValueChange={(v) => setRange(v as RangeKey)}>
            <SelectTrigger className="h-9 w-[160px]" aria-label="Filter by date range">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All time</SelectItem>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="month">This month</SelectItem>
              <SelectItem value="year">This year</SelectItem>
            </SelectContent>
          </Select>
          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={() => { setSearch(""); setRange("all") }} className="h-9 gap-1">
              <X className="h-3.5 w-3.5" /> Clear
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-5">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <ShoppingCart className="h-4 w-4" /> Quick Sale
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Product</Label>
              <Select value={productId || undefined} onValueChange={(v) => {
                setProductId(v);
                const p = allProducts?.find((x) => x.id === v);
                if (p) setPrice(String(p.sellingPrice));
              }}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choose a product" />
                </SelectTrigger>
                <SelectContent>
                  {allProducts?.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} — {money(p.sellingPrice)} ({p.stock} left)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="s-qty">Quantity</Label>
                <Input id="s-qty" type="number" min={1} value={quantity} onChange={(e) => setQuantity(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="s-price">Selling price</Label>
                <Input id="s-price" type="number" min={0} value={price} onChange={(e) => setPrice(e.target.value)} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="s-customer">Customer name</Label>
              <Input id="s-customer" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="s-phone">Phone</Label>
              <Input id="s-phone" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} />
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={paid} onChange={(e) => setPaid(e.target.checked)} className="h-4 w-4" />
              Payment received (marks invoice PAID)
            </label>

            <Button className="w-full" onClick={handleSell} disabled={saving}>
              {saving ? "Selling…" : `Sell for ${money((Number(quantity) || 0) * (Number(price) || 0))}`}
            </Button>
          </CardContent>
        </Card>

        <Card className="xl:col-span-3">
          <CardHeader>
            <CardTitle className="text-sm">Sales History</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingRecent ? (
              <div className="space-y-2">
                {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sales.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-muted-foreground text-center">No sales found</TableCell></TableRow>
                  ) : (
                    sales.map((inv) => {
                      const item = inv.items[0];
                      return (
                        <TableRow key={inv.id}>
                          <TableCell className="font-mono text-xs font-medium">{inv.invoiceNumber}</TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-medium">{item?.productName ?? inv.customerName ?? "—"}</span>
                              {item?.sku ? <span className="text-xs text-muted-foreground">{item.sku}</span> : null}
                            </div>
                          </TableCell>
                          <TableCell>{formatDate(inv.date)}</TableCell>
                          <TableCell className="text-right tabular-nums">×{item?.quantity ?? 0}</TableCell>
                          <TableCell className="text-right font-medium tabular-nums">{money(inv.total)}</TableCell>
                          <TableCell>
                            <Badge variant={inv.status === "PAID" ? "success" : inv.status === "PARTIAL" ? "warning" : "secondary"}>
                              {inv.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              title="Undo sale"
                              onClick={() => { setUndoTarget(inv); setUndoOpen(true); }}
                              className="text-amber-600 hover:text-amber-600 dark:text-amber-400"
                            >
                              <Undo2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Undo dialog */}
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
