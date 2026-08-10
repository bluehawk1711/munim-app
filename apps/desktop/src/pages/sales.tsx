import { useEffect, useMemo, useState } from "react";
import { ShoppingCart } from "lucide-react";
import { createSale, listInvoices, listAllProducts, formatDate } from "@munim/core";
import { getCore } from "@/lib/core";
import { useAsync } from "@/lib/use-async";
import { money } from "@/lib/format";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export function SalesPage() {
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [price, setPrice] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [paid, setPaid] = useState(true);
  const [saving, setSaving] = useState(false);

  const { data: allProducts, reload: reloadProducts } = useAsync(() => listAllProducts(getCore()), []);
  const { data: recent, loading: loadingRecent, reload: reloadRecent } = useAsync(
    () => listInvoices(getCore(), { pageSize: 20 }),
    [],
  );

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
      const invoice = await createSale(getCore(), {
        productId: selected.id,
        quantity: qty,
        sellingPrice: sellPrice || undefined,
        customerName: customerName.trim() || undefined,
        customerPhone: customerPhone.trim() || undefined,
        paid,
        paymentMethod: "cash",
      });
      if (!invoice) throw new Error("Sale failed");
      toast.success(`Sale done — ${invoice.invoiceNumber} (${money(invoice.total)})`);
      setQuantity("1");
      setCustomerName("");
      setCustomerPhone("");
      reloadProducts();
      reloadRecent();
    } catch (err) {
      toast.error("Sale failed", { description: err instanceof Error ? err.message : undefined });
    } finally {
      setSaving(false);
    }
  }

  return (
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
          <CardTitle className="text-sm">Recent Sales</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Paid</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingRecent ? (
                <TableRow><TableCell colSpan={6} className="text-muted-foreground text-center">Loading…</TableCell></TableRow>
              ) : !recent || recent.invoices.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-muted-foreground text-center">No sales yet</TableCell></TableRow>
              ) : (
                recent.invoices.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-medium">{inv.invoiceNumber}</TableCell>
                    <TableCell>{inv.customerName ?? "Walk-in"}</TableCell>
                    <TableCell>{formatDate(inv.date)}</TableCell>
                    <TableCell className="text-right font-medium">{money(inv.total)}</TableCell>
                    <TableCell className="text-right">{money(inv.amountPaid)}</TableCell>
                    <TableCell>
                      <Badge variant={inv.status === "PAID" ? "success" : inv.status === "PARTIAL" ? "warning" : "secondary"}>
                        {inv.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
