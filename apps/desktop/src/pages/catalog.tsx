import { useMemo, useState } from "react";
import { Palette, Ruler, FolderTree, Plus, Pencil, Trash2, Loader2, Search, Layers, X, Package, ImageIcon, Barcode, AlertTriangle, Tag } from "lucide-react";
import {
  swatchColor,
  type CatalogItem,
  type CatalogKind,
} from "@munim/core";
import {
  useCatalog,
  useCreateCatalogItem,
  useUpdateCatalogItem,
  useDeleteCatalogItem,
  useProducts,
  useQueryState,
} from "@munim/query";
import { toast } from "@munim/ui";
import { PageHeader } from "@/components/page-header";
import { Button, Input, Label, Badge, Card, CardContent, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Skeleton } from "@munim/ui";
import PieChart from "@/components/charts/pie-chart";
import { PieSlice } from "@/components/charts/pie-slice";
import { PieCenter } from "@/components/charts/pie-center";
import { Legend, LegendItem, LegendMarker, LegendLabel, LegendValue } from "@/components/charts/legend";

type DialogState =
  | { kind: CatalogKind; mode: "add"; item?: undefined }
  | { kind: CatalogKind; mode: "rename"; item: CatalogItem }
  | null;

type StatusFilter = "all" | "in_use" | "unused";

/** One master column (Colors / Sizes / Categories) in the 3-way layout. */
function MasterColumn({
  kind,
  icon: Icon,
  title,
  blurb,
  items,
  loading,
  error,
  onReload,
  onAdd,
  onRename,
  onDelete,
  search,
  status,
}: {
  kind: CatalogKind;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  blurb: string;
  items: CatalogItem[];
  loading: boolean;
  error: string | null;
  onReload: () => void;
  onAdd: () => void;
  onRename: (item: CatalogItem) => void;
  onDelete: (item: CatalogItem) => void;
  search: string;
  status: StatusFilter;
}) {
  const q = search.trim().toLowerCase();
  const filtered = items.filter((item) => {
    if (q && !item.name.toLowerCase().includes(q)) return false;
    if (status === "in_use" && item.productCount <= 0) return false;
    if (status === "unused" && item.productCount > 0) return false;
    return true;
  });

  return (
    <Card className="flex flex-col">
      <div className="flex items-start justify-between gap-2 p-4 pb-3">
        <div className="flex items-start gap-2.5">
          <div className="bg-primary/10 text-primary flex h-9 w-9 shrink-0 items-center justify-center rounded-lg">
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="truncate text-sm font-bold">{title}</h3>
              <span className="bg-muted rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums">{items.length}</span>
            </div>
            <p className="text-muted-foreground mt-0.5 text-[11px] leading-snug">{blurb}</p>
          </div>
        </div>
      </div>
      <div className="px-4 pb-3">
        <Button size="sm" variant="outline" onClick={onAdd} className="h-8 w-full gap-1.5">
          <Plus className="h-3.5 w-3.5" /> Add {kind === "color" ? "Color Swatch" : kind === "size" ? "Size Specification" : "Category Master"}
        </Button>
      </div>
      <CardContent className="min-h-0 flex-1 p-0 pt-0">
        {error ? (
          <p className="px-4 py-6 text-center text-xs text-destructive">{error}</p>
        ) : loading ? (
          <div className="space-y-2 p-4 pt-0">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        ) : filtered.length > 0 ? (
          <ul className="max-h-[26rem] space-y-1.5 overflow-y-auto px-4 pb-3">
            {filtered.map((item, i) => {
              const inUse = item.productCount > 0;
              return (
                <li
                  key={item.id}
                  className="group flex items-center gap-3 rounded-xl border p-2.5 transition-colors hover:bg-muted/50"
                >
                  {kind === "color" ? (
                    <span
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border text-[9px] font-bold text-white/90 shadow-inner"
                      style={{ backgroundColor: swatchColor(item.name) }}
                      aria-hidden
                    >
                      Aa
                    </span>
                  ) : kind === "size" ? (
                    <span className="bg-muted text-muted-foreground flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-bold tabular-nums" aria-hidden>
                      {i + 1}
                    </span>
                  ) : (
                    <span className="bg-primary/10 text-primary flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" aria-hidden>
                      <FolderTree className="h-4 w-4" />
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-sm font-semibold">{item.name}</span>
                      {kind === "color" ? (
                        <span className="bg-muted text-muted-foreground shrink-0 rounded px-1 py-px font-mono text-[9px] uppercase">
                          {swatchColor(item.name)}
                        </span>
                      ) : null}
                    </div>
                    <p className="text-muted-foreground text-[11px]">
                      {inUse ? `${item.productCount} product${item.productCount !== 1 ? "s" : ""} linked` : "No products linked"}
                    </p>
                  </div>
                  <Badge variant={inUse ? "warning" : "secondary"} className="shrink-0 gap-1">
                    {inUse ? "In Use" : "Unused"}
                  </Badge>
                  <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      aria-label={`Rename ${item.name}`}
                      onClick={() => onRename(item)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive disabled:opacity-40"
                      aria-label={`Delete ${item.name}`}
                      title={inUse ? `In use by ${item.productCount} product(s)` : `Delete ${item.name}`}
                      disabled={inUse}
                      onClick={() => onDelete(item)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="px-4 pb-6 pt-2 text-center text-xs text-muted-foreground">
            {items.length === 0 ? `No ${title.toLowerCase()} yet — add the first one.` : "Nothing matches the current search/filter."}
          </p>
        )}
      </CardContent>
      {!error && !loading ? (
        <div className="border-t px-4 py-1.5">
          <button type="button" onClick={onReload} className="text-muted-foreground text-xs transition-colors hover:text-foreground">
            Refresh list
          </button>
        </div>
      ) : null}
    </Card>
  );
}

export function CatalogPage() {
  const colors = useQueryState(useCatalog("color"));
  const sizes = useQueryState(useCatalog("size"));
  const categories = useQueryState(useCatalog("category"));

  const createColor = useCreateCatalogItem("color");
  const createSize = useCreateCatalogItem("size");
  const createCategory = useCreateCatalogItem("category");
  const renameColor = useUpdateCatalogItem("color");
  const renameSize = useUpdateCatalogItem("size");
  const renameCategory = useUpdateCatalogItem("category");
  const deleteColor = useDeleteCatalogItem("color");
  const deleteSize = useDeleteCatalogItem("size");
  const deleteCategory = useDeleteCatalogItem("category");

  const colorItems = colors.data ?? [];
  const sizeItems = sizes.data ?? [];
  const categoryItems = categories.data ?? [];

  // Cheap cached call — the pagination header carries the real product count.
  const productsQ = useQueryState(useProducts({ pageSize: 1000 }));
  const totalProducts = productsQ.data?.pagination.totalCount ?? 0;
  const allProducts = productsQ.data?.products ?? [];

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [dialog, setDialog] = useState<DialogState>(null);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [pieHovered, setPieHovered] = useState<number | null>(null);

  const totalVariants = colorItems.length + sizeItems.length + categoryItems.length;
  const inUseCount = [...colorItems, ...sizeItems, ...categoryItems].filter((c) => c.productCount > 0).length;
  const unusedCount = totalVariants - inUseCount;

  // Catalog health stats from actual product data
  const catalogHealth = useMemo(() => {
    const withImage = allProducts.filter((p) => p.imageUrl).length;
    const withBarcode = allProducts.filter((p) => p.barcode).length;
    const lowStock = allProducts.filter((p) => p.stock <= (p.lowStockThreshold ?? 0)).length;
    const uncategorized = allProducts.filter((p) => !p.category).length;
    return { withImage, withBarcode, lowStock, uncategorized };
  }, [allProducts]);

  // Composition donut — products linked per category (deterministic swatch colors).
  const composition = useMemo(() => {
    const withProducts = categoryItems
      .filter((c) => c.productCount > 0)
      .sort((a, b) => b.productCount - a.productCount);
    const total = withProducts.reduce((a, c) => a + c.productCount, 0);
    return {
      slices: withProducts.map((c) => ({ label: c.name, value: c.productCount, color: swatchColor(c.name) })),
      legend: withProducts.map((c) => ({ label: c.name, value: c.productCount, color: swatchColor(c.name), maxValue: total })),
      total,
    };
  }, [categoryItems]);

  function openAdd(kind: CatalogKind) {
    setName("");
    setDialog({ kind, mode: "add" });
  }

  function openRename(kind: CatalogKind, item: CatalogItem) {
    setName(item.name);
    setDialog({ kind, mode: "rename", item });
  }

  async function handleSubmit() {
    if (!dialog) return;
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Name is required");
      return;
    }
    setSaving(true);
    try {
      if (dialog.mode === "rename") {
        const rename = dialog.kind === "color" ? renameColor : dialog.kind === "size" ? renameSize : renameCategory;
        await rename.mutateAsync({ id: dialog.item.id, name: trimmed });
        toast.success(`${dialog.kind} renamed`, { description: trimmed });
      } else {
        const create = dialog.kind === "color" ? createColor : dialog.kind === "size" ? createSize : createCategory;
        await create.mutateAsync(trimmed);
        toast.success(`${dialog.kind} created`, { description: trimmed });
      }
      setDialog(null);
    } catch (err) {
      toast.error("Failed to save", { description: err instanceof Error ? err.message : undefined });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(kind: CatalogKind, item: CatalogItem) {
    const confirmed = window.confirm(`Delete "${item.name}"? This cannot be undone.`);
    if (!confirmed) return;
    try {
      const del = kind === "color" ? deleteColor : kind === "size" ? deleteSize : deleteCategory;
      await del.mutateAsync(item.id);
      toast.success(`${kind} deleted`, { description: item.name });
    } catch (err) {
      toast.error("Delete failed", {
        description: err instanceof Error ? err.message : undefined,
      });
    }
  }

  const statusChips: { key: StatusFilter; label: string; count: number }[] = [
    { key: "all", label: "All Masters", count: totalVariants },
    { key: "in_use", label: "In Use Only", count: inUseCount },
    { key: "unused", label: "Unused / Idle", count: unusedCount },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Product Catalog & Attribute Master"
        badge="Catalog Master"
        subtitle="Manage variant palettes, sizing standards, and inventory taxonomy — renames cascade across web, desktop and mobile through the shared catalog service."
        actions={
          <span className="text-muted-foreground rounded-full border bg-card px-3 py-1.5 text-xs font-semibold tabular-nums">
            {totalVariants} variants total
          </span>
        }
      />

      {/* ── Toolbar: search + status chips ─────────────────────────── */}
      <Card>
        <CardContent className="flex flex-col gap-3 p-3 lg:flex-row lg:items-center">
          <div className="relative w-full max-w-sm">
            <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
            <Input
              placeholder="Search masters, color, hex or size…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-8"
            />
            {search ? (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => setSearch("")}
                className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2.5 -translate-y-1/2"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-1.5 lg:ml-auto">
            {statusChips.map((chip) => {
              const active = status === chip.key;
              return (
                <button
                  key={chip.key}
                  type="button"
                  onClick={() => setStatus(chip.key)}
                  className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                    active ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {chip.label}
                  <span className={`rounded-full px-1.5 text-[10px] tabular-nums ${active ? "bg-primary-foreground/20" : "bg-muted"}`}>{chip.count}</span>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* ── Catalog health summary + composition donut ───────── */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Package className="text-primary h-4 w-4" />
              <h2 className="text-sm font-bold">Catalog Health Overview</h2>
            </div>
            <p className="text-muted-foreground mt-1 text-xs">
              Quick snapshot of product data quality — spot gaps in images, barcodes, stock levels, and category coverage.
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                { label: "Total Products", value: totalProducts, icon: Package, color: "text-primary bg-primary/10" },
                { label: "With Images", value: catalogHealth.withImage, icon: ImageIcon, color: "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10" },
                { label: "With Barcodes", value: catalogHealth.withBarcode, icon: Barcode, color: "text-blue-600 dark:text-blue-400 bg-blue-500/10" },
                { label: "Low Stock", value: catalogHealth.lowStock, icon: AlertTriangle, color: catalogHealth.lowStock > 0 ? "text-amber-600 dark:text-amber-400 bg-amber-500/10" : "text-muted-foreground bg-muted/50" },
              ].map((s) => {
                const Icon = s.icon;
                return (
                  <div key={s.label} className="rounded-lg border p-2.5">
                    <div className="flex items-center gap-1.5">
                      <div className={`flex h-5 w-5 items-center justify-center rounded ${s.color}`}>
                        <Icon className="h-3 w-3" />
                      </div>
                      <p className="text-muted-foreground text-[10px] font-semibold tracking-wide uppercase">{s.label}</p>
                    </div>
                    <p className="mt-1 text-lg font-bold tabular-nums">{s.value}</p>
                  </div>
                );
              })}
            </div>
            {catalogHealth.uncategorized > 0 && (
              <div className="mt-2 flex items-center gap-1.5 rounded-md border border-amber-500/30 bg-amber-500/5 px-2.5 py-1.5 text-xs">
                <Tag className="h-3 w-3 text-amber-600 dark:text-amber-400" />
                <span className="text-amber-700 dark:text-amber-300">
                  {catalogHealth.uncategorized} product{catalogHealth.uncategorized !== 1 ? "s" : ""} without a category —{" "}
                  <button type="button" onClick={() => setStatus("all")} className="underline underline-offset-2">
                    assign them
                  </button>
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold">Linked Products by Category</h2>
              <span className="text-muted-foreground text-xs tabular-nums">{composition.total} linked</span>
            </div>
            {composition.slices.length === 0 ? (
              <p className="text-muted-foreground py-8 text-center text-xs">
                Link products to categories to see the composition here.
              </p>
            ) : (
              <div className="mt-2 flex flex-col items-center gap-3">
                <PieChart data={composition.slices} innerRadius={52} size={170} hoverOffset={7} hoveredIndex={pieHovered} onHoverChange={setPieHovered}>
                  {composition.slices.map((slice, i) => (
                    <PieSlice key={slice.label} index={i} color={slice.color} />
                  ))}
                  <PieCenter>
                    {({ value, label }) => (
                      <div className="max-w-20 text-center">
                        <p className="text-muted-foreground truncate text-[10px] font-semibold uppercase">{label}</p>
                        <p className="text-sm font-bold tabular-nums">{value}</p>
                      </div>
                    )}
                  </PieCenter>
                </PieChart>
                <Legend items={composition.legend} className="w-full">
                  <LegendItem className="rounded-lg px-2 py-1 transition-colors hover:bg-muted/60">
                    <LegendMarker />
                    <LegendLabel className="min-w-0 flex-1 truncate text-xs" />
                    <LegendValue className="text-xs" />
                  </LegendItem>
                </Legend>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── 3-way master columns ───────────────────────────────────── */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <MasterColumn
          kind="color"
          icon={Palette}
          title="Colors & Enamels"
          blurb="Deterministic swatch tokens — rename or extend without breaking product links."
          items={colorItems}
          loading={colors.loading}
          error={colors.error}
          onReload={colors.reload}
          onAdd={() => openAdd("color")}
          onRename={(item) => openRename("color", item)}
          onDelete={(item) => handleDelete("color", item)}
          search={search}
          status={status}
        />
        <MasterColumn
          kind="size"
          icon={Ruler}
          title="Sizes & Standards"
          blurb="Sizing standards for rings, bangles and apparel — linked to every variant."
          items={sizeItems}
          loading={sizes.loading}
          error={sizes.error}
          onReload={sizes.reload}
          onAdd={() => openAdd("size")}
          onRename={(item) => openRename("size", item)}
          onDelete={(item) => handleDelete("size", item)}
          search={search}
          status={status}
        />
        <MasterColumn
          kind="category"
          icon={FolderTree}
          title="Categories & Metals"
          blurb="Inventory taxonomy — powers reports, category splits and filters."
          items={categoryItems}
          loading={categories.loading}
          error={categories.error}
          onReload={categories.reload}
          onAdd={() => openAdd("category")}
          onRename={(item) => openRename("category", item)}
          onDelete={(item) => handleDelete("category", item)}
          search={search}
          status={status}
        />
      </div>

      {/* ── Footer strip ───────────────────────────────────────────── */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-x-6 gap-y-2 p-3 text-xs">
          <span className="flex items-center gap-1.5 font-semibold">
            <Layers className="text-primary h-3.5 w-3.5" />
            {totalProducts} products reference this catalog
          </span>
          <span className="text-muted-foreground">
            Renames cascade to every linked product · deletes are blocked while a master is in use
          </span>
          <span className="text-muted-foreground ml-auto tabular-nums">
            {totalVariants} masters · {inUseCount} in use · {unusedCount} idle
          </span>
        </CardContent>
      </Card>

      <Dialog open={dialog !== null} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>
              {dialog?.mode === "rename" ? `Rename ${dialog?.kind}` : `Add ${dialog?.kind ?? ""}`}
            </DialogTitle>
            <DialogDescription>
              {dialog?.mode === "rename"
                ? `Rename "${dialog?.item.name}" — all products using it will update.`
                : "This becomes available to products in the Products page."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="catalog-name">Name *</Label>
              <Input
                id="catalog-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={
                  dialog?.kind === "color" ? "e.g. Midnight Blue" : dialog?.kind === "size" ? "e.g. 3XL" : "e.g. Jewellery"
                }
                autoFocus
                maxLength={40}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialog(null)}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={saving || !name.trim()}>
                {saving ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Saving…</> : dialog?.mode === "rename" ? "Save" : "Create"}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
