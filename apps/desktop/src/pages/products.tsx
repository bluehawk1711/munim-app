import { useCallback, useEffect, useRef, useState } from "react";
import { Plus, Search, Pencil, Trash2, PackagePlus, UploadCloud, Image as ImageIcon, Loader2, X, Barcode, Tag, Eye } from "lucide-react";
import {
  buildProductLabel,
  type LabelPrinterInfo,
  type LabelPrintSettings,
  type ProductLabel,
} from "@munim/core";
import type { ProductDto } from "@munim/api-client";
import {
  useProducts,
  useCreateProduct,
  useUpdateProduct,
  useDeleteProduct,
  useAdjustStock,
  useBackfillBarcodes,
  useUploadImage,
  useApiClient,
  useQueryState,
} from "@munim/query";
import { money, formatWeight } from "@/lib/format";
import { downloadLabelPdf, printLabelHtml } from "@/lib/labelPdf";
import { getSavedLabelPrinter, getSavedLabelPrintSettings, isDesktopApp, listLabelPrinters, printLabelsToThermal, saveLabelPrinter, saveLabelPrintSettings } from "@/lib/printer";
import { uploadImageDirect } from "@/lib/cloudinary";
import { toast } from "@munim/ui";
import { Button, Input, Label, Badge, Card, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Skeleton, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, BarcodeSvg, BarcodeLookupInput, LabelPrintDialog, ProductDetailsDialog } from "@munim/ui";

type FormState = {
  name: string;
  color: string;
  size: string;
  category: string;
  barcode: string;
  /** Weight in milligrams. */
  weight: string;
  imageUrl: string;
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
  weight: "",
  imageUrl: "",
  stock: "0",
  purchasePrice: "0",
  sellingPrice: "0",
  lowStockThreshold: "5",
  notes: "",
};

function stockVariant(p: ProductDto): "success" | "warning" | "destructive" | "secondary" {
  if (p.stock <= 0) return "destructive";
  if (p.stock <= p.lowStockThreshold) return "warning";
  return "success";
}

export function ProductsPage() {
  const [search, setSearch] = useState("");
  const { data, error, loading, refetching, reload } = useQueryState(useProducts({ search, pageSize: 200 }));
  const products = data?.products ?? [];
  const getClient = useApiClient();
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const deleteProduct = useDeleteProduct();
  const adjustStock = useAdjustStock();
  const backfillBarcodes = useBackfillBarcodes();
  const uploadImage = useUploadImage();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ProductDto | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [adjusting, setAdjusting] = useState<ProductDto | null>(null);
  const [adjustQty, setAdjustQty] = useState("");
  const [adjustReason, setAdjustReason] = useState("");
  const [isAdjustingStock, setIsAdjustingStock] = useState(false);

  const [labelTarget, setLabelTarget] = useState<ProductDto | null>(null);
  const [labelOpen, setLabelOpen] = useState(false);
  const [labelCopies, setLabelCopies] = useState(1);
  const [detailsProduct, setDetailsProduct] = useState<ProductDto | null>(null);
  const [backfilling, setBackfilling] = useState(false);

  // Direct thermal label printing (desktop only — see lib/printer.ts).
  const [labelPrinters, setLabelPrinters] = useState<LabelPrinterInfo[]>([]);
  const [labelPrinterName, setLabelPrinterName] = useState<string | undefined>(() => getSavedLabelPrinter());
  const [labelPrintersLoading, setLabelPrintersLoading] = useState(false);
  const [labelPrintBusy, setLabelPrintBusy] = useState(false);
  const [labelPrintError, setLabelPrintError] = useState<string | null>(null);
  const labelPrintersLoadedRef = useRef(false);

  const loadLabelPrinters = useCallback(async () => {
    setLabelPrintersLoading(true);
    setLabelPrintError(null);
    try {
      const printers = await listLabelPrinters();
      setLabelPrinters(printers);
      const saved = getSavedLabelPrinter();
      const chosen =
        printers.find((p) => p.name === saved)?.name ??
        printers.find((p) => p.isDefault)?.name ??
        printers[0]?.name;
      if (chosen) setLabelPrinterName(chosen);
    } catch (err: unknown) {
      setLabelPrintError(err instanceof Error ? err.message : "Could not list printers");
    } finally {
      labelPrintersLoadedRef.current = true;
      setLabelPrintersLoading(false);
    }
  }, []);

  // Load the OS printer list once, when the label dialog first opens.
  useEffect(() => {
    if (labelOpen && isDesktopApp() && !labelPrintersLoadedRef.current) {
      void loadLabelPrinters();
    }
  }, [labelOpen, loadLabelPrinters]);

  function handleSelectLabelPrinter(name: string) {
    setLabelPrinterName(name);
    saveLabelPrinter(name);
  }

  async function handleLabelDirectPrint(settings: LabelPrintSettings) {
    if (!labelPrinterName) return;
    setLabelPrintBusy(true);
    try {
      await printLabelsToThermal(labelPrinterName, labelLabels, labelCopies, settings);
      toast.success(`Sent ${labelCopies} label${labelCopies !== 1 ? "s" : ""} to ${labelPrinterName}`);
      setLabelOpen(false);
    } catch (err) {
      toast.error("Label print failed", { description: err instanceof Error ? err.message : undefined });
    } finally {
      setLabelPrintBusy(false);
    }
  }

  const missingBarcodes = products.some((p) => !p.barcode);

  function openAdd() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormOpen(true);
  }

  function openEdit(p: ProductDto) {
    setEditing(p);
    setForm({
      name: p.name,
      color: p.color ?? "",
      size: p.size ?? "",
      category: p.category ?? "",
      barcode: p.barcode ?? "",
      weight: p.weight != null ? String(p.weight) : "",
      imageUrl: p.imageUrl ?? "",
      stock: String(p.stock),
      purchasePrice: String(p.purchasePrice),
      sellingPrice: String(p.sellingPrice),
      lowStockThreshold: String(p.lowStockThreshold),
      notes: p.notes ?? "",
    });
    setFormOpen(true);
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file");
      return;
    }
    setUploading(true);
    try {
      // Uploads go through the shared API (server-side Cloudinary signing) —
      // the desktop never touches Cloudinary secrets. When the API upload is
      // unavailable, fall back to the direct unsigned-preset upload baked in
      // at build time (VITE_CLOUDINARY_*).
      let url: string;
      try {
        const res = await uploadImage.mutateAsync(file);
        url = res.url;
      } catch {
        url = await uploadImageDirect(file, file.name);
      }
      setForm((f) => ({ ...f, imageUrl: url }));
      toast.success("Image uploaded");
    } catch (err) {
      toast.error("Upload failed", { description: err instanceof Error ? err.message : undefined });
    } finally {
      setUploading(false);
      e.target.value = "";
    }
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
        // Empty color = no color (optional field).
        color: form.color.trim() || undefined,
        size: form.size.trim() || "Standard",
        category: form.category.trim() || undefined,
        barcode: form.barcode.trim() || undefined,
        weight: form.weight.trim() ? Math.max(0, Number(form.weight) || 0) : undefined,
        imageUrl: form.imageUrl.trim() || undefined,
        stock: Math.max(0, Number(form.stock) || 0),
        purchasePrice: Math.max(0, Number(form.purchasePrice) || 0),
        sellingPrice: Math.max(0, Number(form.sellingPrice) || 0),
        lowStockThreshold: Math.max(0, Number(form.lowStockThreshold) || 0),
        notes: form.notes.trim() || undefined,
      };
      if (editing) {
        await updateProduct.mutateAsync({ id: editing.id, values: input });
        toast.success("Product updated");
      } else {
        await createProduct.mutateAsync(input);
        toast.success("Product created");
      }
      setFormOpen(false);
    } catch (err) {
      toast.error("Failed to save product", { description: err instanceof Error ? err.message : undefined });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(p: ProductDto) {
    if (!window.confirm(`Delete "${p.name}"? This cannot be undone.`)) return;
    try {
      await deleteProduct.mutateAsync(p.id);
      toast.success("Product deleted");
    } catch (err) {
      toast.error("Delete failed", { description: err instanceof Error ? err.message : undefined });
    }
  }

  function openLabelDialog(p: ProductDto) {
    setLabelTarget(p);
    setLabelCopies(1);
    setLabelOpen(true);
  }

  /** Shop-counter path: exact barcode lookup (indexed) → open the product. */
  async function handleBarcodeLookup(code: string) {
    let product: ProductDto;
    try {
      const api = await getClient();
      product = await api.products.byBarcode(code);
    } catch {
      throw new Error(`No product with barcode ${code}`);
    }
    openEdit(product);
    toast.success(`Found ${product.name}`);
  }

  async function handleBackfill() {
    setBackfilling(true);
    try {
      const r = await backfillBarcodes.mutateAsync();
      if (r.updated === 0) {
        toast.info("All products already have barcodes");
      } else {
        toast.success(`Generated ${r.updated} barcode${r.updated !== 1 ? "s" : ""}`);
      }
    } catch (err) {
      toast.error("Backfill failed", { description: err instanceof Error ? err.message : undefined });
    } finally {
      setBackfilling(false);
    }
  }

  // Plain computation — the React compiler memoizes this automatically
  // (manual useMemo here made the compiler skip the whole component).
  const labelLabels: ProductLabel[] = labelTarget
    ? [
        buildProductLabel(
          {
            id: labelTarget.id,
            name: labelTarget.name,
            sku: labelTarget.sku,
            barcode: labelTarget.barcode,
            weight: labelTarget.weight,
            sellingPrice: labelTarget.sellingPrice,
            colorName: labelTarget.color || null,
            sizeName: labelTarget.size || null,
            categoryName: labelTarget.category || null,
          },
          { name: "" },
        ),
      ]
    : []

  function handleLabelPrint(html: string) {
    setLabelOpen(false);
    printLabelHtml(html);
  }

  async function handleLabelDownload(html: string) {
    setLabelOpen(false);
    try {
      await downloadLabelPdf(html);
      toast.success("Label PDF downloaded");
    } catch (err) {
      toast.error("PDF failed", { description: err instanceof Error ? err.message : undefined });
    }
  }

  async function handleAdjust() {
    if (!adjusting) return;
    const qty = Math.round(Number(adjustQty));
    if (!qty) {
      toast.error("Enter a non-zero quantity");
      return;
    }
    setIsAdjustingStock(true);
    try {
      await adjustStock.mutateAsync({ id: adjusting.id, values: { adjustment: qty, reason: adjustReason.trim() || undefined } });
      toast.success("Stock adjusted");
      setAdjusting(null);
      setAdjustQty("");
      setAdjustReason("");
    } catch (err) {
      toast.error("Adjustment failed", { description: err instanceof Error ? err.message : undefined });
    } finally {
      setIsAdjustingStock(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative w-full max-w-sm">
            <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
            <Input
              placeholder="Search by name, SKU, barcode, color or size…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          {/* Scanner-friendly input: USB barcode scanners type here + Enter. */}
          <BarcodeLookupInput onLookup={handleBarcodeLookup} className="w-full sm:max-w-[240px]" />
          {refetching && (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          )}
        </div>
        <div className="flex items-center gap-2">
          {missingBarcodes && (
            <Button variant="outline" onClick={handleBackfill} disabled={backfilling} className="gap-1.5">
              <Barcode className="h-4 w-4" /> {backfilling ? "Generating…" : "Generate barcodes"}
            </Button>
          )}
          <Button onClick={openAdd}>
            <Plus className="h-4 w-4" /> Add Product
          </Button>
        </div>
      </div>

      {error ? (
        <Card className="flex items-center justify-between gap-3 p-6 text-sm text-destructive">
          <span>{error}</span>
          <Button variant="outline" size="sm" onClick={reload}>
            Retry
          </Button>
        </Card>
      ) : loading ? (
        <Card>
          <CardLoading rows={6} />
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Image</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Barcode</TableHead>
                <TableHead>Color / Size</TableHead>
                <TableHead className="text-right">Wt</TableHead>
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
                    <TableCell>
                      {p.imageUrl ? (
                        <img src={p.imageUrl} alt="" className="h-9 w-9 rounded-md border object-cover" />
                      ) : (
                        <div className="bg-muted flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground">
                          <ImageIcon className="h-4 w-4" />
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="max-w-56">
                      <div className="truncate font-medium">{p.name}</div>
                      {p.category ? <div className="text-xs text-muted-foreground">{p.category}</div> : null}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{p.sku}</TableCell>
                    <TableCell>
                      {p.barcode ? (
                        <BarcodeSvg value={p.barcode} height={30} scale={1} />
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {[p.color, p.size].filter(Boolean).join(" / ") || "—"}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground tabular-nums">{formatWeight(p.weight)}</TableCell>
                    <TableCell className="text-right font-medium">{p.stock}</TableCell>
                    <TableCell className="text-right">{money(p.purchasePrice)}</TableCell>
                    <TableCell className="text-right">{money(p.sellingPrice)}</TableCell>
                    <TableCell>
                      <Badge variant={stockVariant(p)}>{p.stock <= 0 ? "Out of stock" : p.stock <= p.lowStockThreshold ? "Low stock" : "In stock"}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon-sm" title="View details" onClick={() => setDetailsProduct(p)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon-sm" title="Print label" onClick={() => openLabelDialog(p)}>
                          <Tag className="h-4 w-4" />
                        </Button>
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
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Product Image</Label>
                <div className="flex items-center gap-3">
                  {form.imageUrl ? (
                    <img src={form.imageUrl} alt="Product preview" className="h-16 w-16 rounded-lg border object-cover" />
                  ) : (
                    <div className="bg-muted text-muted-foreground flex h-16 w-16 items-center justify-center rounded-lg border">
                      <ImageIcon className="h-6 w-6" />
                    </div>
                  )}
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={uploading}
                        onClick={() => fileInputRef.current?.click()}
                        className="gap-1.5"
                      >
                        {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
                        {uploading ? "Uploading…" : form.imageUrl ? "Replace image" : "Upload image"}
                      </Button>
                      {form.imageUrl && (
                        <Button type="button" variant="ghost" size="icon" className="h-8 w-8" aria-label="Remove image" onClick={() => setForm({ ...form, imageUrl: "" })}>
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      JPG, PNG or WebP · up to 5 MB · hosted on Cloudinary
                    </p>
                  </div>
                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                </div>
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
                <Input id="p-barcode" value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} placeholder="Leave blank to auto-generate" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="p-weight">Weight (mg)</Label>
                <Input id="p-weight" type="number" min={0} step="0.1" value={form.weight} onChange={(e) => setForm({ ...form, weight: e.target.value })} placeholder="e.g. 24500 (24.5 g)" />
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
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Saving…</> : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ProductDetailsDialog
        open={detailsProduct !== null}
        onOpenChange={(open) => !open && setDetailsProduct(null)}
        product={
          detailsProduct
            ? {
                id: detailsProduct.id,
                name: detailsProduct.name,
                sku: detailsProduct.sku,
                barcode: detailsProduct.barcode,
                color: detailsProduct.color,
                size: detailsProduct.size,
                category: detailsProduct.category,
                weight: detailsProduct.weight,
                imageUrl: detailsProduct.imageUrl,
                stock: detailsProduct.stock,
                lowStockThreshold: detailsProduct.lowStockThreshold,
                purchasePrice: detailsProduct.purchasePrice,
                sellingPrice: detailsProduct.sellingPrice,
                notes: detailsProduct.notes,
                createdAt: detailsProduct.createdAt,
                updatedAt: detailsProduct.updatedAt,
              }
            : null
        }
        formatCurrency={money}
        formatWeight={formatWeight}
        formatDate={(d) => new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
      />

      <LabelPrintDialog
        open={labelOpen}
        onOpenChange={setLabelOpen}
        labels={labelLabels}
        copies={labelCopies}
        onCopiesChange={setLabelCopies}
        onPrint={handleLabelPrint}
        onDownloadPdf={handleLabelDownload}
        directPrint={
          isDesktopApp()
            ? {
                printers: labelPrinters,
                selected: labelPrinterName,
                onSelect: handleSelectLabelPrinter,
                onPrint: (settings) => void handleLabelDirectPrint(settings),
                onRefresh: () => void loadLabelPrinters(),
                loading: labelPrintersLoading,
                busy: labelPrintBusy,
                error: labelPrintError,
                savedSettings: getSavedLabelPrintSettings(),
                onSaveSettings: (settings) => saveLabelPrintSettings(settings),
              }
            : undefined
        }
      />

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
            <Button onClick={handleAdjust} disabled={isAdjustingStock}>
              {isAdjustingStock ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Adjusting…</> : "Adjust"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Shimmer loading rows for tables (premium alternative to pulse/text). */
function CardLoading({ rows }: { rows: number }) {
  return (
    <div className="space-y-2 p-4">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  );
}
