import { useMemo, useState } from "react";
import { Plus, Search, Pencil, Trash2, PackagePlus } from "lucide-react";
import {
  listProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  adjustStock,
  type ProductWithMeta,
} from "@munim/core";
import { getCore } from "@/lib/core";
import { useAsync } from "@/lib/use-async";
import { money } from "@/lib/format";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type FormState = {
  name: string;
  color: string;
  size: string;
  category: string;
  barcode: string;
  stock: string;
  purchasePrice: string;
  sellingPrice: string;
  lowStockThreshold: string;
  notes: string;
};

const EMPTY_FORM: FormState = {
  name: "",
  color: "",
  size: "",
  category: "",
  barcode: "",
  stock: "0",
  purchasePrice: "0",
  sellingPrice: "0",
  lowStockThreshold: "5",
  notes: "",
};

function stockVariant(p: ProductWithMeta): "success" | "warning" | "destructive" | "secondary" {
  if (p.stock <= 0) return "destructive";
  if (p.stock <= p.lowStockThreshold) return "warning";
  return "success";
}

export function ProductsPage() {
  const [search, setSearch] = useState("");
  const { data, error, loading, reload } = useAsync(
    () => listProducts(getCore(), { search, pageSize: 200 }),
    [search],
  );

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ProductWithMeta | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const [adjusting, setAdjusting] = useState<ProductWithMeta | null>(null);
  const [adjustQty, setAdjustQty] = useState("");
  const [adjustReason, setAdjustReason] = useState("");

  const products = useMemo(() => data?.products ?? [], [data]);

  function openAdd() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormOpen(true);
  }

  function openEdit(p: ProductWithMeta) {
    setEditing(p);
    setForm({
      name: p.name,
      color: p.colorName ?? "",
      size: p.sizeName ?? "",
      category: p.categoryName ?? "",
      barcode: p.barcode ?? "",
      stock: String(p.stock),
      purchasePrice: String(p.purchasePrice),
      sellingPrice: String(p.sellingPrice),
      lowStockThreshold: String(p.lowStockThreshold),
      notes: p.notes ?? "",
    });
    setFormOpen(true);
  }

  async function handleSave() {
    if (!form.name.trim()) {
      toast.error("Product name is required");
      return;
    }
    setSaving(true);
    try {
      const input = {
        name: form.name.trim(),
        color: form.color.trim() || "Standard",
        size: form.size.trim() || "Standard",
        category: form.category.trim() || undefined,
        barcode: form.barcode.trim() || undefined,
        stock: Math.max(0, Number(form.stock) || 0),
        purchasePrice: Math.max(0, Number(form.purchasePrice) || 0),
        sellingPrice: Math.max(0, Number(form.sellingPrice) || 0),
        lowStockThreshold: Math.max(0, Number(form.lowStockThreshold) || 0),
        notes: form.notes.trim() || undefined,
      };
      if (editing) {
        await updateProduct(getCore(), editing.id, input);
        toast.success("Product updated");
      } else {
        await createProduct(getCore(), input);
        toast.success("Product created");
      }
      setFormOpen(false);
      reload();
    } catch (err) {
      toast.error("Failed to save product", { description: err instanceof Error ? err.message : undefined });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(p: ProductWithMeta) {
    if (!window.confirm(`Delete "${p.name}"? This cannot be undone.`)) return;
    try {
      await deleteProduct(getCore(), p.id);
      toast.success("Product deleted");
      reload();
    } catch (err) {
      toast.error("Delete failed", { description: err instanceof Error ? err.message : undefined });
    }
  }

  async function handleAdjust() {
    if (!adjusting) return;
    const qty = Math.round(Number(adjustQty));
    if (!qty) {
      toast.error("Enter a non-zero quantity");
      return;
    }
    try {
      await adjustStock(getCore(), adjusting.id, { adjustment: qty, reason: adjustReason.trim() || undefined });
      toast.success("Stock adjusted");
      setAdjusting(null);
      setAdjustQty("");
      setAdjustReason("");
      reload();
    } catch (err) {
      toast.error("Adjustment failed", { description: err instanceof Error ? err.message : undefined });
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="relative w-full max-w-sm">
          <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
          <Input
            placeholder="Search by name, SKU, barcode, color or size…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button onClick={openAdd}>
          <Plus className="h-4 w-4" /> Add Product
        </Button>
      </div>

      {error ? (
        <Card className="p-6 text-sm text-destructive">{error}</Card>
      ) : loading ? (
        <p className="text-muted-foreground p-6 text-sm">Loading products…</p>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Color / Size</TableHead>
                <TableHead className="text-right">Stock</TableHead>
                <TableHead className="text-right">Buy</TableHead>
                <TableHead className="text-right">Sell</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-muted-foreground text-center">
                    No products found
                  </TableCell>
                </TableRow>
              ) : (
                products.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="max-w-56 truncate font-medium">{p.name}</TableCell>
                    <TableCell className="text-muted-foreground">{p.sku}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {[p.colorName, p.sizeName].filter(Boolean).join(" / ") || "—"}
                    </TableCell>
                    <TableCell className="text-right font-medium">{p.stock}</TableCell>
                    <TableCell className="text-right">{money(p.purchasePrice)}</TableCell>
                    <TableCell className="text-right">{money(p.sellingPrice)}</TableCell>
                    <TableCell>
                      <Badge variant={stockVariant(p)}>{p.stock <= 0 ? "Out of stock" : p.stock <= p.lowStockThreshold ? "Low stock" : "In stock"}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon-sm" title="Adjust stock" onClick={() => setAdjusting(p)}>
                          <PackagePlus className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon-sm" title="Edit" onClick={() => openEdit(p)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon-sm" title="Delete" onClick={() => handleDelete(p)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      )}

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Product" : "Add Product"}</DialogTitle>
            <DialogDescription>SKU is auto-generated by the shared core.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="p-name">Name *</Label>
                <Input id="p-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="p-color">Color</Label>
                <Input id="p-color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="p-size">Size</Label>
                <Input id="p-size" value={form.size} onChange={(e) => setForm({ ...form, size: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="p-cat">Category</Label>
                <Input id="p-cat" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="p-barcode">Barcode</Label>
                <Input id="p-barcode" value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="p-stock">Stock</Label>
                <Input id="p-stock" type="number" min={0} value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="p-buy">Buy price</Label>
                <Input id="p-buy" type="number" min={0} value={form.purchasePrice} onChange={(e) => setForm({ ...form, purchasePrice: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="p-sell">Sell price</Label>
                <Input id="p-sell" type="number" min={0} value={form.sellingPrice} onChange={(e) => setForm({ ...form, sellingPrice: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="p-threshold">Low stock alert at</Label>
                <Input id="p-threshold" type="number" min={0} value={form.lowStockThreshold} onChange={(e) => setForm({ ...form, lowStockThreshold: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-notes">Notes</Label>
              <Input id="p-notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={adjusting !== null} onOpenChange={(open) => !open && setAdjusting(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Adjust stock — {adjusting?.name}</DialogTitle>
            <DialogDescription>Use + to add stock (purchase) or − to remove (damage/loss).</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="a-qty">Quantity (+/−)</Label>
              <Input id="a-qty" type="number" value={adjustQty} onChange={(e) => setAdjustQty(e.target.value)} placeholder="e.g. 10 or -2" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="a-reason">Reason</Label>
              <Input id="a-reason" value={adjustReason} onChange={(e) => setAdjustReason(e.target.value)} placeholder="e.g. New purchase / damaged" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjusting(null)}>Cancel</Button>
            <Button onClick={handleAdjust}>Adjust</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
