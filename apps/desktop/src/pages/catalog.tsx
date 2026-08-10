import { useState } from "react";
import { Palette, Ruler, Plus, Pencil, Trash2, Package } from "lucide-react";
import {
  listCatalogItems,
  createCatalogItem,
  renameCatalogItem,
  deleteCatalogItem,
  swatchColor,
  ProductError,
  type CatalogItem,
  type CatalogKind,
} from "@munim/core";
import { getCore } from "@/lib/core";
import { useAsync } from "@/lib/use-async";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type DialogState =
  | { kind: CatalogKind; mode: "add"; item?: undefined }
  | { kind: CatalogKind; mode: "rename"; item: CatalogItem }
  | null;

function CatalogCard({
  kind,
  icon: Icon,
  title,
  description,
  items,
  loading,
  error,
  onReload,
  onAdd,
  onRename,
  onDelete,
}: {
  kind: CatalogKind;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  items: CatalogItem[] | null;
  loading: boolean;
  error: string | null;
  onReload: () => void;
  onAdd: () => void;
  onRename: (item: CatalogItem) => void;
  onDelete: (item: CatalogItem) => void;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="bg-primary/10 text-primary flex h-9 w-9 items-center justify-center rounded-lg">
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-base">{title}</CardTitle>
            <CardDescription className="text-xs">{description}</CardDescription>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="font-normal">
            {items?.length ?? 0}
          </Badge>
          <Button size="sm" variant="outline" onClick={onAdd} className="h-8 gap-1.5">
            <Plus className="h-3.5 w-3.5" /> Add
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {error ? (
          <p className="px-4 py-6 text-center text-xs text-destructive">{error}</p>
        ) : loading ? (
          <p className="px-4 py-6 text-center text-xs text-muted-foreground">Loading…</p>
        ) : items && items.length > 0 ? (
          <ul className="divide-y">
            {items.map((item) => (
              <li key={item.id} className="group flex items-center justify-between gap-3 px-4 py-2.5">
                <div className="flex min-w-0 items-center gap-2.5">
                  {kind === "color" && (
                    <span
                      className="h-4 w-4 shrink-0 rounded-full border border-border"
                      style={{ backgroundColor: swatchColor(item.name) }}
                      aria-hidden
                    />
                  )}
                  <span className="truncate text-sm font-medium">{item.name}</span>
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full border bg-muted/50 px-2 py-0.5 text-[11px] font-medium tabular-nums text-muted-foreground">
                    <Package className="h-3 w-3" />
                    {item.productCount}
                  </span>
                </div>
                <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    aria-label={`Rename ${item.name}`}
                    onClick={() => onRename(item)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive disabled:opacity-40"
                    aria-label={`Delete ${item.name}`}
                    title={item.productCount > 0 ? `In use by ${item.productCount} product(s)` : `Delete ${item.name}`}
                    disabled={item.productCount > 0}
                    onClick={() => onDelete(item)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-4 py-8 text-center text-xs text-muted-foreground">
            No {title.toLowerCase()} yet. Click “Add” to create one.
          </p>
        )}
        {!error && !loading && (
          <div className="border-t px-4 py-1.5">
            <button type="button" onClick={onReload} className="text-xs text-muted-foreground transition-colors hover:text-foreground">
              Refresh list
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function CatalogPage() {
  const { data, error, loading, reload } = useAsync(
    async () => {
      const db = getCore();
      const [colors, sizes] = await Promise.all([listCatalogItems(db, "color"), listCatalogItems(db, "size")]);
      return { colors, sizes };
    },
    [],
  );

  const [dialog, setDialog] = useState<DialogState>(null);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

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
        await renameCatalogItem(getCore(), dialog.kind, dialog.item.id, trimmed);
        toast.success(`${dialog.kind} renamed`, { description: trimmed });
      } else {
        await createCatalogItem(getCore(), dialog.kind, trimmed);
        toast.success(`${dialog.kind} created`, { description: trimmed });
      }
      setDialog(null);
      reload();
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
      await deleteCatalogItem(getCore(), kind, item.id);
      toast.success(`${kind} deleted`, { description: item.name });
      reload();
    } catch (err) {
      toast.error("Delete failed", {
        description: err instanceof ProductError ? err.message : err instanceof Error ? err.message : undefined,
      });
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <CatalogCard
          kind="color"
          icon={Palette}
          title="Colors"
          description="Color variants available for products"
          items={data?.colors ?? null}
          loading={loading}
          error={error}
          onReload={reload}
          onAdd={() => openAdd("color")}
          onRename={(item) => openRename("color", item)}
          onDelete={(item) => handleDelete("color", item)}
        />
        <CatalogCard
          kind="size"
          icon={Ruler}
          title="Sizes"
          description="Size variants available for products"
          items={data?.sizes ?? null}
          loading={loading}
          error={error}
          onReload={reload}
          onAdd={() => openAdd("size")}
          onRename={(item) => openRename("size", item)}
          onDelete={(item) => handleDelete("size", item)}
        />
      </div>

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
                placeholder={dialog?.kind === "color" ? "e.g. Midnight Blue" : "e.g. 3XL"}
                autoFocus
                maxLength={40}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialog(null)}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={saving || !name.trim()}>
                {saving ? "Saving…" : dialog?.mode === "rename" ? "Save" : "Create"}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
