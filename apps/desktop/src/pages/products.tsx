import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ElementType } from "react";
import {
  ArrowUpRight,
  Barcode,
  CheckCircle2,
  Eye,
  EyeOff,
  FileDown,
  Image as ImageIcon,
  IndianRupee,
  Loader2,
  MoreVertical,
  PackagePlus,
  Pencil,
  Plus,
  Printer,
  Scale,
  Search,
  ShoppingCart,
  Tag,
  Trash2,
  UploadCloud,
  Wallet,
  X,
} from "lucide-react";
import {
  buildProductLabel,
  formatNumber,
  formatWeight,
  type LabelPrinterInfo,
  type LabelPrintSettings,
  type ProductLabel,
} from "@munim/core";
import type { ProductDto } from "@munim/api-client";
import {
  useAdjustStock,
  useApiClient,
  useBackfillBarcodes,
  useCategoryBreakdown,
  useCreateProduct,
  useCreateSale,
  useDeleteProduct,
  useInventoryStats,
  useProductMeta,
  useProducts,
  useQueryState,
  useUpdateProduct,
  useUploadImage,
} from "@munim/query";
import { money } from "@/lib/format";
import { downloadLabelPdf, printLabelHtml } from "@/lib/labelPdf";
import {
  getSavedLabelPrinter,
  getSavedLabelPrintSettings,
  isDesktopApp,
  listLabelPrinters,
  printLabelsToThermal,
  saveLabelPrinter,
  saveLabelPrintSettings,
} from "@/lib/printer";
import { uploadImageDirect } from "@/lib/cloudinary";
import { toast } from "@munim/ui";
import { PageHeader } from "@/components/page-header";
import { BarChart } from "@/components/charts/bar-chart";
import { Bar } from "@/components/charts/bar";
import { PieChart } from "@/components/charts/pie-chart";
import { PieSlice } from "@/components/charts/pie-slice";
import { PieCenter } from "@/components/charts/pie-center";
import { BarChartLoading } from "@/components/charts/bar-chart-loading";
import {
  Badge,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  BarcodeLookupInput,
  BarcodeSvg,
  LabelPrintDialog,
  LabelPrintSelectDialog,
  ProductDetailsDialog,
} from "@munim/ui";

/* ─── Form state (mirrors the original inline form) ────────────── */

type FormState = {
  name: string;
  type: string;
  color: string;
  size: string;
  category: string;
  barcode: string;
  weight: string;
  weightUnit: "mg" | "gm";
  grossWeight: string;
  nagLessWeight: string;
  chejatWeight: string;
  netWeight: string;
  purity: string;
  imageUrl: string;
  stock: string;
  purchasePrice: string;
  sellingPrice: string;
  lowStockThreshold: string;
  notes: string;
};

const EMPTY_FORM: FormState = {
  name: "",
  type: "Gold",
  color: "",
  size: "",
  category: "",
  barcode: "",
  weight: "",
  weightUnit: "gm",
  grossWeight: "",
  nagLessWeight: "",
  chejatWeight: "",
  netWeight: "",
  purity: "",
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

/** Quick-filter category chips on the products page. */
type FilterChip =
  | { kind: "all"; label: string; value: number }
  | { kind: "instock"; label: string; value: number }
  | { kind: "low"; label: string; value: number }
  | { kind: "out"; label: string; value: number }
  | { kind: "uncategorized"; label: string; value: number };

/* ─── Page ─────────────────────────────────────────────────────── */

export function ProductsPage() {
  const [search, setSearch] = useState("");
  const [tablePage, setTablePage] = useState(1);
  const TABLE_PAGE_SIZE = 40;
  const { data, error, loading, refetching, reload } = useQueryState(useProducts({ search, page: tablePage, pageSize: TABLE_PAGE_SIZE }));
  const products = data?.products ?? [];
  const pagination = data?.pagination;

  const metaQ = useProductMeta();
  const meta = metaQ.data;

  const DEFAULT_COLORS = ["Black", "White", "Navy", "Blue", "Red", "Green", "Grey", "Brown", "Olive", "Silver", "Teal", "Amber"];
  const DEFAULT_SIZES = ["XS", "S", "M", "L", "XL", "XXL", "Standard", "30", "32", "34", "36", "8", "9", "10", "11"];
  const colors = useMemo(() => Array.from(new Set([...DEFAULT_COLORS, ...(meta?.colors ?? [])])), [meta?.colors]);
  const sizes = useMemo(() => Array.from(new Set([...DEFAULT_SIZES, ...(meta?.sizes ?? [])])), [meta?.sizes]);
  const categories = useMemo(() => Array.from(new Set(meta?.categories ?? [])), [meta?.categories]);

  const statsQ = useInventoryStats();
  const stats = statsQ.data;

  const categoryQ = useCategoryBreakdown();
  const categoryRows = categoryQ.data ?? [];

  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const deleteProduct = useDeleteProduct();
  const adjustStock = useAdjustStock();
  const backfillBarcodes = useBackfillBarcodes();
  const uploadImage = useUploadImage();
  const getClient = useApiClient();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ProductDto | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [customColor, setCustomColor] = useState(false);
  const [customSize, setCustomSize] = useState(false);
  const [customCategory, setCustomCategory] = useState(false);

  const [adjusting, setAdjusting] = useState<ProductDto | null>(null);
  const [adjustQty, setAdjustQty] = useState("");
  const [adjustReason, setAdjustReason] = useState("");
  const [isAdjustingStock, setIsAdjustingStock] = useState(false);

  const [labelTarget, setLabelTarget] = useState<ProductDto | null>(null);
  const [labelTargets, setLabelTargets] = useState<ProductDto[]>([]);
  const [labelOpen, setLabelOpen] = useState(false);
  const [labelCopies, setLabelCopies] = useState(1);
  const [labelSelectOpen, setLabelSelectOpen] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(() => {
    try { return localStorage.getItem("munim-products-analytics") !== "hidden"; } catch { return true; }
  });
  const [detailsProduct, setDetailsProduct] = useState<ProductDto | null>(null);

  // Quick-sale dialog state
  const [saleTarget, setSaleTarget] = useState<ProductDto | null>(null);
  const [saleOpen, setSaleOpen] = useState(false);
  const [saleQty, setSaleQty] = useState("1");
  const [salePrice, setSalePrice] = useState("");
  const [saleCustomerName, setSaleCustomerName] = useState("");
  const [saleCustomerPhone, setSaleCustomerPhone] = useState("");
  const [saleIsPaid, setSaleIsPaid] = useState(true);
  const [saleSaving, setSaleSaving] = useState(false);
  const createSale = useCreateSale();
  const [backfilling, setBackfilling] = useState(false);

  const [activeCategory, setActiveCategory] = useState<FilterChip>({ kind: "all", label: "All SKUs", value: 0 });

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

  useEffect(() => {
    if (labelOpen && isDesktopApp() && !labelPrintersLoadedRef.current) {
      void loadLabelPrinters();
    }
  }, [labelOpen, loadLabelPrinters]);

  function handleSelectLabelPrinter(name: string) {
    setLabelPrinterName(name);
    saveLabelPrinter(name);
  }

  async function handleLabelDirectPrint(printSettings: LabelPrintSettings) {
    if (!labelPrinterName) return;
    setLabelPrintBusy(true);
    try {
      await printLabelsToThermal(labelPrinterName, labelLabels, labelCopies, printSettings);
      toast.success(`Sent ${labelCopies} label${labelCopies !== 1 ? "s" : ""} to ${labelPrinterName}`);
      setLabelOpen(false);
    } catch (err) {
      toast.error("Label print failed", { description: err instanceof Error ? err.message : undefined });
    } finally {
      setLabelPrintBusy(false);
    }
  }

  const missingBarcodes = products.some((p) => !p.barcode);

  /* ── Computed: counts + category stock breakdown ─────────────── */

  const totalCount = stats?.totalSkus ?? products.length;
  const lowCount = stats?.lowStockCount ?? products.filter((p) => p.stock > 0 && p.stock <= p.lowStockThreshold).length;
  const outCount = stats?.outOfStockCount ?? products.filter((p) => p.stock <= 0).length;
  const inCount = stats?.inStockCount ?? products.filter((p) => p.stock > p.lowStockThreshold).length;
  const withBarcode = stats?.withBarcodeCount ?? products.filter((p) => !!p.barcode).length;
  const barcodeCoverage = totalCount > 0 ? Math.round((withBarcode / totalCount) * 100) : 0;
  const velocityScore = totalCount > 0 ? Math.round((inCount / totalCount) * 100) : 0;
  const velocityLabel = velocityScore >= 90 ? "OPTIMAL" : velocityScore >= 70 ? "STEADY" : "SLOW";

  const chips = useMemo<FilterChip[]>(() => {
    const uncatCount = products.filter((p) => !p.category || !p.category.trim()).length;
    return [
      { kind: "all", label: "All SKUs", value: totalCount },
      { kind: "instock", label: "In Stock", value: inCount },
      { kind: "low", label: "Low Stock", value: lowCount },
      { kind: "out", label: "Out of Stock", value: outCount },
      { kind: "uncategorized", label: "Uncategorized", value: uncatCount },
    ];
  }, [totalCount, inCount, lowCount, outCount, products]);

  // Derived values for Select+custom-input combos
  const colorIsCustom = customColor || (!!form.color && !colors.includes(form.color));
  const sizeIsCustom = customSize || (!!form.size && !sizes.includes(form.size));
  const categoryIsCustom = customCategory || (!!form.category && !categories.includes(form.category));
  const colorSelectValue = colorIsCustom ? "__custom" : form.color || "__none";
  const sizeSelectValue = sizeIsCustom ? "__custom" : form.size || "__none";
  const categorySelectValue = categoryIsCustom ? "__custom" : form.category || "__none";

  const visibleProducts = useMemo(() => {
    if (activeCategory.kind === "all") return products;
    if (activeCategory.kind === "instock") {
      return products.filter((p) => p.stock > p.lowStockThreshold);
    }
    if (activeCategory.kind === "low") {
      return products.filter((p) => p.stock > 0 && p.stock <= p.lowStockThreshold);
    }
    if (activeCategory.kind === "out") {
      return products.filter((p) => p.stock <= 0);
    }
    if (activeCategory.kind === "uncategorized") {
      return products.filter((p) => !p.category || !p.category.trim());
    }
    return products;
  }, [products, activeCategory]);

  /* ── Donut + allocation chart data ───────────────────────────── */

  const pieData = useMemo(() => {
    const filtered = categoryRows.filter((c) => c.value > 0);
    return filtered.slice(0, 6).map((c) => ({
      label: c.category,
      value: c.value,
      color: c.color,
    }));
  }, [categoryRows]);

  const totalCatalogValue = pieData.reduce((s, d) => s + d.value, 0);

  const allocationData = useMemo(() => {
    return categoryRows
      .filter((c) => c.units > 0)
      .slice(0, 6)
      .map((c) => ({
        name: c.category,
        units: c.units,
      }));
  }, [categoryRows]);

  /* ── Handlers ──────────────────────────────────────────────── */

  function openAdd() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setCustomColor(false);
    setCustomSize(false);
    setCustomCategory(false);
    setFormOpen(true);
  }

  function openEdit(p: ProductDto) {
    setEditing(p);
    setCustomColor(false);
    setCustomSize(false);
    setCustomCategory(false);
    setForm({
      name: p.name,
      type: p.type ?? "Gold",
      color: p.color ?? "",
      size: p.size ?? "",
      category: p.category ?? "",
      barcode: p.barcode ?? "",
      weight: p.weight != null ? String(p.weight) : "",
      weightUnit: (p.weightUnit === "mg" || p.weightUnit === "gm") ? p.weightUnit : "gm",
      grossWeight: p.grossWeight ?? "",
      nagLessWeight: p.nagLessWeight ?? "",
      chejatWeight: p.chejatWeight ?? "",
      netWeight: p.netWeight ?? "",
      purity: p.purity ?? "",
      imageUrl: p.imageUrl ?? "",
      stock: String(p.stock),
      purchasePrice: String(p.purchasePrice),
      sellingPrice: String(p.sellingPrice),
      lowStockThreshold: String(p.lowStockThreshold),
      notes: p.notes ?? "",
    });
    setFormOpen(true);
  }

  function handleColorSelect(value: string) {
    if (value === "__custom") {
      setCustomColor(true);
      setForm((f) => ({ ...f, color: "" }));
    } else if (value === "__none") {
      setCustomColor(false);
      setForm((f) => ({ ...f, color: "" }));
    } else {
      setCustomColor(false);
      setForm((f) => ({ ...f, color: value }));
    }
  }

  function handleSizeSelect(value: string) {
    if (value === "__custom") {
      setCustomSize(true);
      setForm((f) => ({ ...f, size: "" }));
    } else if (value === "__none") {
      setCustomSize(false);
      setForm((f) => ({ ...f, size: "" }));
    } else {
      setCustomSize(false);
      setForm((f) => ({ ...f, size: value }));
    }
  }

  function handleCategorySelect(value: string) {
    if (value === "__custom") {
      setCustomCategory(true);
      setForm((f) => ({ ...f, category: "" }));
    } else if (value === "__none") {
      setCustomCategory(false);
      setForm((f) => ({ ...f, category: "" }));
    } else {
      setCustomCategory(false);
      setForm((f) => ({ ...f, category: value }));
    }
  }

  function toggleAnalytics() {
    const next = !showAnalytics;
    setShowAnalytics(next);
    try { localStorage.setItem("munim-products-analytics", next ? "visible" : "hidden"); } catch { /* noop */ }
  }

  function openQuickSale(p: ProductDto) {
    setSaleTarget(p);
    setSaleQty("1");
    setSalePrice(String(p.sellingPrice));
    setSaleCustomerName("");
    setSaleCustomerPhone("");
    setSaleIsPaid(true);
    setSaleOpen(true);
  }

  async function handleQuickSale() {
    if (!saleTarget) return;
    const qty = Number(saleQty);
    const price = Number(salePrice);
    if (!qty || qty <= 0) { toast.error("Quantity must be positive"); return; }
    if (price < 0 || Number.isNaN(price)) { toast.error("Enter a valid price"); return; }
    setSaleSaving(true);
    try {
      const invoice = await createSale.mutateAsync({
        productId: saleTarget.id,
        quantity: qty,
        sellingPrice: price || undefined,
        customerName: saleCustomerName.trim() || undefined,
        customerPhone: saleCustomerPhone.trim() || undefined,
        paid: saleIsPaid,
        paymentMethod: saleIsPaid ? "cash" : "credit",
      });
      toast.success(`Sale done — ${invoice.invoiceNumber} (${money(invoice.total)})`);
      setSaleOpen(false);
    } catch (err) {
      toast.error("Sale failed", { description: err instanceof Error ? err.message : undefined });
    } finally {
      setSaleSaving(false);
    }
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
    const buyVal = Number(form.purchasePrice) || 0;
    const sellVal = Number(form.sellingPrice) || 0;
    if (buyVal <= 0) { toast.error("Buy price must be greater than 0"); return; }
    if (sellVal <= 0) { toast.error("Sell price must be greater than 0"); return; }
    setSaving(true);
    try {
      const input = {
        name: form.name.trim(),
        type: form.type as "Gold" | "Silver" | "Diamond" | "Platinum" | "Other",
        color: form.color.trim() || undefined,
        size: form.size.trim() || "Standard",
        category: form.category.trim() || undefined,
        barcode: form.barcode.trim() || undefined,
        weight: form.weight.trim() ? Math.max(0, Number(form.weight) || 0) : undefined,
        weightUnit: form.weightUnit,
        grossWeight: form.grossWeight.trim() || undefined,
        nagLessWeight: form.nagLessWeight.trim() || undefined,
        chejatWeight: form.chejatWeight.trim() || undefined,
        netWeight: form.netWeight.trim() || undefined,
        purity: form.purity.trim() || undefined,
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
    setLabelTargets([]);
    setLabelTarget(p);
    setLabelCopies(1);
    setLabelOpen(true);
  }

  function handleLabelSelect(selected: { id: string; name: string; sku: string; barcode?: string | null; sellingPrice?: number | null; weight?: number | null; color?: string | null; size?: string | null; category?: string | null }[]) {
    const dtos = selected as ProductDto[];
    setLabelTarget(null);
    setLabelTargets(dtos);
    setLabelCopies(1);
    setLabelSelectOpen(false);
    setLabelOpen(true);
  }

  /** Shop-counter path: exact barcode lookup → open the product. */
  async function handleBarcodeLookup(code: string) {
    try {
      const api = await getClient();
      const product = await api.products.byBarcode(code);
      openEdit(product);
      toast.success(`Found ${product.name}`);
    } catch (err) {
      toast.error("Barcode lookup failed", {
        description: err instanceof Error ? err.message : undefined,
      });
    }
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

  function handleCsvExport() {
    const rows = visibleProducts;
    if (rows.length === 0) {
      toast.info("Nothing to export");
      return;
    }
    const header = [
      "SKU",
      "Name",
      "Color",
      "Size",
      "Category",
      "Barcode",
      "Stock",
      "Weight (mg)",
      "Buy",
      "Sell",
      "Status",
    ];
    const csv = [
      header.join(","),
      ...rows.map((p) =>
        [
          p.sku,
          `"${(p.name ?? "").replace(/"/g, '""')}"`,
          p.color ?? "",
          p.size ?? "",
          p.category ?? "",
          p.barcode ?? "",
          p.stock,
          p.weight ?? "",
          p.purchasePrice,
          p.sellingPrice,
          p.stock <= 0 ? "Out" : p.stock <= p.lowStockThreshold ? "Low" : "In",
        ].join(","),
      ),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `products-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success(`Exported ${rows.length} products to CSV`);
  }

  const labelSources = labelTargets.length > 0 ? labelTargets : labelTarget ? [labelTarget] : [];
  const labelLabels: ProductLabel[] = labelSources.map((p) =>
    buildProductLabel(
      {
        id: p.id,
        name: p.name,
        sku: p.sku,
        barcode: p.barcode,
        weight: p.weight,
        weightUnit: p.weightUnit ?? "gm",
        purity: p.purity,
        sellingPrice: p.sellingPrice,
        colorName: p.color || null,
        sizeName: p.size || null,
        categoryName: p.category || null,
      },
      { name: "" },
    ),
  );

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
      await adjustStock.mutateAsync({
        id: adjusting.id,
        values: { adjustment: qty, reason: adjustReason.trim() || undefined },
      });
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

  /* ── Render ────────────────────────────────────────────────── */

  return (
    <div className="space-y-5">
      <PageHeader
        title="Products & Stock"
        badge="Inventory"
        subtitle="Manage your catalog, SKUs, barcodes, karigar specifications and barcode printing."
        actions={
          <>
            {(lowCount > 0 || outCount > 0) ? (
              <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400 tabular-nums">
                {lowCount} low · {outCount} out of stock
              </span>
            ) : null}
            <span className="text-muted-foreground rounded-full border bg-card px-3 py-1.5 text-xs font-semibold tabular-nums">
              {formatNumber(totalCount)} SKUs
            </span>
          </>
        }
      />

      {/* Search + filter card */}
      <Card>
        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full max-w-sm flex-1">
            <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
            <Input
              placeholder="Search by product name, SKU, 13-digit code…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setTablePage(1); }}
              className="h-9 pl-9 text-sm"
            />
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {chips.map((chip) => {
              const active = chip.kind === activeCategory.kind;
              return (
                <button
                  key={chip.kind}
                  type="button"
                  onClick={() => { setActiveCategory(chip); setTablePage(1); }}
                  className={
                    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold tabular-nums transition-colors " +
                    (active
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card text-muted-foreground hover:bg-muted/60 hover:text-foreground")
                  }
                >
                  {chip.label}
                  <span className={
                    "rounded-full px-1.5 py-0.5 text-[10px] font-bold " +
                    (active ? "bg-primary-foreground/20" : "bg-muted")
                  }>
                    {chip.value}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </Card>

      {/* Action buttons row */}
      <div className="flex flex-wrap items-center gap-2">
        <Button variant={showAnalytics ? "default" : "outline"} size="sm" onClick={toggleAnalytics} className="gap-1.5">
          {showAnalytics ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          {showAnalytics ? "Hide" : "Show"} Analytics
        </Button>
        {missingBarcodes && (
          <Button variant="outline" size="sm" onClick={handleBackfill} disabled={backfilling} className="gap-1.5">
            <Barcode className="h-3.5 w-3.5" /> {backfilling ? "Generating…" : "Generate barcodes"}
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={() => setLabelSelectOpen(true)} className="gap-1.5">
          <Printer className="h-3.5 w-3.5" /> Print Label
        </Button>
        <Button variant="outline" size="sm" onClick={handleCsvExport} className="gap-1.5">
          <FileDown className="h-3.5 w-3.5" /> Export CSV
        </Button>
        <div className="ml-auto flex items-center gap-2">
          <BarcodeLookupInput onLookup={handleBarcodeLookup} className="h-9 w-full sm:max-w-[200px]" />
          {refetching ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : null}
          <Button size="sm" onClick={openAdd} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" /> Add New Product
          </Button>
        </div>
      </div>

      {showAnalytics && (
        <>
          {/* Stat tile strip. */}
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Total Stock Valuation"
          value={money(stats?.stockValuationSelling ?? 0)}
          icon={Wallet}
          accent="primary"
          loading={statsQ.isLoading}
        />
        <StatTile
          label="Products / Material Weight"
          value={formatWeight(stats?.totalWeightMg ?? 0)}
          icon={Scale}
          accent="amber"
          loading={statsQ.isLoading}
        />
        <StatTile
          label="Stock Health & Velocity"
          value={`${velocityScore}`}
          unit={velocityLabel}
          icon={ArrowUpRight}
          accent={velocityScore >= 90 ? "emerald" : velocityScore >= 70 ? "primary" : "red"}
          loading={statsQ.isLoading}
          progress={velocityScore / 100}
        />
        <StatTile
          label="Barcode Coverage"
          value={`${barcodeCoverage}%`}
          unit="logged"
          icon={Barcode}
          accent="primary"
          loading={statsQ.isLoading}
          progress={barcodeCoverage / 100}
          subline={`${withBarcode} of ${totalCount} products`}
        />
      </div>

      {/* Charts row: allocation bar chart + category donut. */}
      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <SectionHeader title="Stock Allocation" subtitle="Units on hand across categories" />
          <CardContent className="space-y-3">
            {categoryQ.isLoading ? (
              <BarChartLoading aspectRatio="3 / 1" />
            ) : allocationData.length === 0 ? (
              <div className="text-muted-foreground flex h-36 items-center justify-center text-sm">
                No stock allocated yet — add a product to see the allocation chart.
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground font-semibold">Stock Allocated · by Category</span>
                  <span className="text-primary font-semibold">
                    Peak: {allocationData.reduce((best, c) => (c.units > best.units ? c : best), allocationData[0]!).name}
                  </span>
                </div>
                <BarChart data={allocationData} xDataKey="name" aspectRatio="3 / 1" className="w-full">
                  <Bar dataKey="units" fill="var(--chart-1)" groupGap={2} lineCap={6} stackGap={0} />
                </BarChart>
                <p className="text-muted-foreground text-[11px]">
                  Live counter-style allocation · {formatNumber(allocationData.reduce((s, c) => s + c.units, 0))} units across {allocationData.length} categories
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <SectionHeader title="Category Value" subtitle="Retail value by category" />
          <CardContent>
            {categoryQ.isLoading ? (
              <Skeleton className="mx-auto h-44 w-44 rounded-full" />
            ) : pieData.length === 0 ? (
              <div className="text-muted-foreground flex h-44 items-center justify-center text-sm">No value yet</div>
            ) : (
              <PieChart data={pieData} innerRadius={48} cornerRadius={4} padAngle={0.02}>
                {pieData.map((d, i) => (
                  <PieSlice color={d.color} index={i} key={`slice-${d.label}`} />
                ))}
                <PieCenter
                  defaultLabel="Catalog"
                  formatOptions={{ notation: "compact", maximumFractionDigits: 1 }}
                  prefix="₹"
                />
              </PieChart>
            )}
            <ul className="mt-4 space-y-1.5 text-xs">
              {pieData.slice(0, 4).map((d) => (
                <li key={d.label} className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: d.color }} />
                  <span className="truncate">{d.label}</span>
                  <span className="text-muted-foreground ml-auto shrink-0 tabular-nums">
                    {totalCatalogValue > 0 ? Math.round((d.value / totalCatalogValue) * 100) : 0}%
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
      </>
      )}

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
                <TableHead>Product Name & Karigar</TableHead>
                <TableHead>SKU & Barcode</TableHead>
                <TableHead>Variant Specs</TableHead>
                <TableHead>Weight Breakdown</TableHead>
                <TableHead>Stock Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleProducts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-muted-foreground text-center">
                    No products found
                  </TableCell>
                </TableRow>
              ) : (
                visibleProducts.map((p) => (
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
                      {p.category ? (
                        <div className="text-muted-foreground text-xs">{p.category}</div>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <div className="text-muted-foreground text-xs">{p.sku}</div>
                      <div className="mt-0.5">
                        {p.barcode ? (
                          <BarcodeSvg value={p.barcode} height={26} scale={1} />
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      <div>{[p.color, p.size ? `Size ${p.size}` : null].filter(Boolean).join(" / ") || "—"}</div>
                      {p.purity ? <div className="font-medium">Purity {p.purity}</div> : null}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      <div>{formatWeight(p.weight ?? 0, p.weightUnit)}</div>
                      <div className="text-[11px]">per piece</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={stockVariant(p)}>
                        {p.stock <= 0 ? "Out of stock" : p.stock <= p.lowStockThreshold ? "Low stock" : "In stock"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon-sm" title="Sell" onClick={() => openQuickSale(p)}>
                          <ShoppingCart className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon-sm" title="Print label" onClick={() => openLabelDialog(p)}>
                          <Tag className="h-4 w-4" />
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon-sm" title="More actions">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setDetailsProduct(p)}>
                              <Eye className="mr-2 h-4 w-4" /> View details
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setAdjusting(p)}>
                              <PackagePlus className="mr-2 h-4 w-4" /> Adjust stock
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openEdit(p)}>
                              <Pencil className="mr-2 h-4 w-4" /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(p)}>
                              <Trash2 className="mr-2 h-4 w-4" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between border-t px-4 py-2">
              <span className="text-muted-foreground text-xs">
                {((pagination.page - 1) * pagination.pageSize) + 1}–{Math.min(pagination.page * pagination.pageSize, pagination.totalCount)} of {pagination.totalCount}
              </span>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="sm" className="h-7" disabled={tablePage <= 1} onClick={() => setTablePage((p) => p - 1)}>Prev</Button>
                <span className="text-muted-foreground px-2 text-xs">Page {tablePage} of {pagination.totalPages}</span>
                <Button variant="outline" size="sm" className="h-7" disabled={tablePage >= pagination.totalPages} onClick={() => setTablePage((p) => p + 1)}>Next</Button>
              </div>
            </div>
          )}
        </Card>
      )}

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Product" : "Add Product"}</DialogTitle>
            <DialogDescription>SKU is auto-generated by the shared core.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            {/* Row 1: Name (full width) */}
            <div className="space-y-1.5">
              <Label htmlFor="p-name">Name *</Label>
              <Input id="p-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>

            {/* Row 2: Type (full width) */}
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Gold">Gold</SelectItem>
                  <SelectItem value="Silver">Silver</SelectItem>
                  <SelectItem value="Diamond">Diamond</SelectItem>
                  <SelectItem value="Platinum">Platinum</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Row 3: Image (full width, bigger) */}
            <div className="space-y-1.5">
              <Label>Product Image</Label>
              <div className="flex items-center gap-4">
                {form.imageUrl ? (
                  <img src={form.imageUrl} alt="Product preview" className="h-24 w-24 rounded-lg border object-cover" />
                ) : (
                  <div className="bg-muted text-muted-foreground flex h-24 w-24 items-center justify-center rounded-lg border">
                    <ImageIcon className="h-8 w-8" />
                  </div>
                )}
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => fileInputRef.current?.click()} className="gap-1.5">
                      {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
                      {uploading ? "Uploading…" : form.imageUrl ? "Replace image" : "Upload image"}
                    </Button>
                    {form.imageUrl && (
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => setForm({ ...form, imageUrl: "" })}>
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground">JPG, PNG or WebP · up to 5 MB</p>
                </div>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
              </div>
            </div>

            {/* Row 4: Color + Size */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Color</Label>
                <Select value={colorSelectValue} onValueChange={handleColorSelect}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Select color" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">No color</SelectItem>
                    {colors.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                    <SelectItem value="__custom"><span className="flex items-center gap-1.5"><Plus className="h-3.5 w-3.5" /> New…</span></SelectItem>
                  </SelectContent>
                </Select>
                {colorIsCustom && (
                  <Input placeholder="Type new color…" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} className="h-9" />
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Size</Label>
                <Select value={sizeSelectValue} onValueChange={handleSizeSelect}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Select size" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">No size</SelectItem>
                    {sizes.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                    <SelectItem value="__custom"><span className="flex items-center gap-1.5"><Plus className="h-3.5 w-3.5" /> New…</span></SelectItem>
                  </SelectContent>
                </Select>
                {sizeIsCustom && (
                  <Input placeholder="Type new size…" value={form.size} onChange={(e) => setForm({ ...form, size: e.target.value })} className="h-9" />
                )}
              </div>
            </div>

            {/* Row 5: Category + Barcode */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select value={categorySelectValue} onValueChange={handleCategorySelect}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Select category" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">No category</SelectItem>
                    {categories.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                    <SelectItem value="__custom"><span className="flex items-center gap-1.5"><Plus className="h-3.5 w-3.5" /> New…</span></SelectItem>
                  </SelectContent>
                </Select>
                {categoryIsCustom && (
                  <Input placeholder="Type new category…" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="h-9" />
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="p-barcode">Barcode</Label>
                <Input id="p-barcode" value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} placeholder="Auto-generate if blank" />
              </div>
            </div>

            {/* Row 6: Weight + Purity */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="p-weight">Weight</Label>
                <div className="flex gap-2">
                  <Input id="p-weight" type="number" min={0} step="0.1" value={form.weight} onChange={(e) => setForm({ ...form, weight: e.target.value })} placeholder="e.g. 24.5" className="flex-1" />
                  <Select value={form.weightUnit} onValueChange={(v) => setForm({ ...form, weightUnit: v as "mg" | "gm" })}>
                    <SelectTrigger className="w-[72px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gm">gm</SelectItem>
                      <SelectItem value="mg">mg</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="p-purity">Purity</Label>
                <Input id="p-purity" value={form.purity} onChange={(e) => setForm({ ...form, purity: e.target.value })} placeholder="e.g. 24K / 925" maxLength={20} />
              </div>
            </div>

            {/* Row 7: Gross weight + Nag less weight */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="p-gross-weight">Gross weight</Label>
                <Input id="p-gross-weight" value={form.grossWeight} onChange={(e) => setForm({ ...form, grossWeight: e.target.value })} placeholder="e.g. 10+5" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="p-nag-less-weight">Nag less weight</Label>
                <Input id="p-nag-less-weight" value={form.nagLessWeight} onChange={(e) => setForm({ ...form, nagLessWeight: e.target.value })} placeholder="e.g. 2.5" />
              </div>
            </div>

            {/* Row 8: Chejat weight + Net weight */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="p-chejat-weight">Chejat weight</Label>
                <Input id="p-chejat-weight" value={form.chejatWeight} onChange={(e) => setForm({ ...form, chejatWeight: e.target.value })} placeholder="e.g. 3" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="p-net-weight">Net weight</Label>
                <Input id="p-net-weight" value={form.netWeight} onChange={(e) => setForm({ ...form, netWeight: e.target.value })} placeholder="e.g. 19" />
              </div>
            </div>

            {/* Row 9: Stock + Buy price */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="p-stock">Stock</Label>
                <Input id="p-stock" type="number" min={0} value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="p-buy">Buy price</Label>
                <Input id="p-buy" type="number" min={0} value={form.purchasePrice} onChange={(e) => setForm({ ...form, purchasePrice: e.target.value })} />
              </div>
            </div>

            {/* Row 10: Sell price + Low stock alert */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="p-sell">Sell price</Label>
                <Input id="p-sell" type="number" min={0} value={form.sellingPrice} onChange={(e) => setForm({ ...form, sellingPrice: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="p-threshold">Low stock alert</Label>
                <Input id="p-threshold" type="number" min={0} value={form.lowStockThreshold} onChange={(e) => setForm({ ...form, lowStockThreshold: e.target.value })} />
              </div>
            </div>

            {/* Row 11: Notes */}
            <div className="space-y-1.5">
              <Label htmlFor="p-notes">Notes</Label>
              <Input id="p-notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Saving…
                </>
              ) : (
                "Save"
              )}
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
                type: detailsProduct.type ?? "Gold",
                barcode: detailsProduct.barcode,
                color: detailsProduct.color,
                size: detailsProduct.size,
                category: detailsProduct.category,
                weight: detailsProduct.weight,
                weightUnit: detailsProduct.weightUnit ?? "gm",
                purity: detailsProduct.purity,
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
        formatDate={(d) =>
          new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
        }
      />

      <LabelPrintSelectDialog
        open={labelSelectOpen}
        onOpenChange={setLabelSelectOpen}
        products={products.map((p) => ({
          id: p.id,
          name: p.name,
          sku: p.sku,
          barcode: p.barcode,
          sellingPrice: p.sellingPrice,
          weight: p.weight,
          color: p.color,
          size: p.size,
          category: p.category,
        }))}
        onSelect={handleLabelSelect}
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
              <Input
                id="a-qty"
                type="number"
                value={adjustQty}
                onChange={(e) => setAdjustQty(e.target.value)}
                placeholder="e.g. 10 or -2"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="a-reason">Reason</Label>
              <Input
                id="a-reason"
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
                placeholder="e.g. New purchase / damaged"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjusting(null)}>
              Cancel
            </Button>
            <Button onClick={handleAdjust} disabled={isAdjustingStock}>
              {isAdjustingStock ? (
                <>
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Adjusting…
                </>
              ) : (
                "Adjust"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quick Sale Dialog */}
      <Dialog open={saleOpen} onOpenChange={setSaleOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShoppingCart className="h-4 w-4" /> Quick Sale
            </DialogTitle>
            <DialogDescription>
              {saleTarget ? (
                <>Selling <strong>{saleTarget.name}</strong> {saleTarget.sku ? `(${saleTarget.sku})` : ""}</>
              ) : (
                "Record a quick sale"
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {saleTarget && (
              <div className="flex items-center gap-3 rounded-lg border p-2.5">
                <div className="bg-muted flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-sm font-bold text-primary/60">
                  {saleTarget.name.charAt(0)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{saleTarget.name}</p>
                  <p className="text-muted-foreground text-xs">
                    {saleTarget.sku}
                    {saleTarget.color ? <>, {saleTarget.color}</> : null}
                    {saleTarget.size ? <> · {saleTarget.size}</> : null}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    Stock: <span className={saleTarget.stock <= (saleTarget.lowStockThreshold ?? 0) ? "text-amber-600 font-medium" : ""}>{saleTarget.stock} units</span>
                  </p>
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="sale-qty" className="text-xs">Quantity</Label>
                <Input
                  id="sale-qty"
                  type="number"
                  min={1}
                  value={saleQty}
                  onChange={(e) => setSaleQty(e.target.value)}
                  className="h-10 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sale-price" className="text-xs">Selling Price</Label>
                <Input
                  id="sale-price"
                  type="number"
                  min={0}
                  value={salePrice}
                  onChange={(e) => setSalePrice(e.target.value)}
                  className="h-10 text-sm"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Customer Name</Label>
                <Input
                  placeholder="Optional"
                  value={saleCustomerName}
                  onChange={(e) => setSaleCustomerName(e.target.value)}
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Customer Phone</Label>
                <Input
                  placeholder="Optional"
                  value={saleCustomerPhone}
                  onChange={(e) => setSaleCustomerPhone(e.target.value)}
                  className="h-9 text-sm"
                />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Label className="text-xs">Payment</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={saleIsPaid ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSaleIsPaid(true)}
                  className="gap-1.5"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" /> Paid
                </Button>
                <Button
                  type="button"
                  variant={!saleIsPaid ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSaleIsPaid(false)}
                  className="gap-1.5"
                >
                  Credit
                </Button>
              </div>
            </div>
            {saleTarget && Number(salePrice) > 0 && saleTarget.purchasePrice > 0 && (
              <div className="rounded-md bg-muted/50 px-3 py-2 text-xs">
                <span className="text-muted-foreground">Margin: </span>
                <span className={Number(salePrice) > saleTarget.purchasePrice ? "text-emerald-600 dark:text-emerald-400 font-medium" : "text-red-600 dark:text-red-400"}>
                  {money(Number(salePrice) - saleTarget.purchasePrice)}
                </span>
                <span className="text-muted-foreground"> per unit</span>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaleOpen(false)}>Cancel</Button>
            <Button onClick={handleQuickSale} disabled={saleSaving} className="gap-1.5">
              {saleSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <IndianRupee className="h-4 w-4" />}
              {saleSaving ? "Processing…" : "Complete Sale"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ─── Sub-components (private to this page) ─────────────────── */

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="flex flex-col gap-0.5 px-5 pt-4">
      <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
      {subtitle ? <p className="text-muted-foreground text-xs">{subtitle}</p> : null}
    </div>
  );
}

function StatTile({
  label,
  value,
  unit,
  subline,
  icon: Icon,
  accent = "primary",
  progress,
  loading = false,
}: {
  label: string;
  value: string;
  unit?: string;
  subline?: string;
  icon: ElementType;
  accent?: "primary" | "amber" | "emerald" | "red";
  progress?: number;
  loading?: boolean;
}) {
  const accentClass = {
    primary: "bg-primary/10 text-primary",
    amber: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
    emerald: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
    red: "bg-red-500/15 text-red-600 dark:text-red-400",
  }[accent];
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-3 p-4">
        <div className="min-w-0 flex-1">
          <p className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">{label}</p>
          {loading ? (
            <Skeleton className="mt-2 h-7 w-32" />
          ) : (
            <p className="mt-1 flex items-baseline gap-1.5 text-xl font-bold tracking-tight tabular-nums">
              {value}
              {unit ? <span className="text-muted-foreground text-xs font-semibold uppercase">{unit}</span> : null}
            </p>
          )}
          {subline ? <p className="text-muted-foreground mt-1 text-xs">{subline}</p> : null}
          {progress != null ? (
            <div className="bg-muted mt-2 h-1.5 w-full overflow-hidden rounded-full">
              <div
                className={"h-full rounded-full transition-all " + (accent === "red" ? "bg-destructive" : "bg-primary")}
                style={{ width: `${Math.round(Math.min(1, Math.max(0, progress)) * 100)}%` }}
              />
            </div>
          ) : null}
        </div>
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${accentClass}`}>
          <Icon className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
  );
}

/** Shimmer loading rows for the products table (premium alternative to pulse/text). */
function CardLoading({ rows }: { rows: number }) {
  return (
    <div className="space-y-2 p-4">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  );
}
