"use client"

import * as React from "react"
import {
  Palette,
  Ruler,
  FolderTree,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  AlertTriangle,
  Package,
  ChevronLeft,
  ChevronRight,
  Filter,
} from "lucide-react"
import { Button, Input, Label, Card, CardContent, CardDescription, CardHeader, CardTitle, Badge, Skeleton, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@munim/ui"








import {
  useCatalog,
  useCreateCatalogItem,
  useUpdateCatalogItem,
  useDeleteCatalogItem,
  type CatalogItem,
  type CatalogKind,
} from "@/hooks/use-catalog"
import { swatchColor } from "@munim/core"
import { useAppStore } from "@/store/view-store"
import { formatDate } from "@/lib/format"
import { LOW_STOCK_THRESHOLD } from "@/lib/types"
import { cn } from "@/lib/utils"
import { toast } from "@munim/ui"

const PAGE_SIZE = 8

type DialogState = {
  kind: CatalogKind
  mode: "add" | "rename"
  item?: CatalogItem
} | null

type DeleteState = {
  kind: CatalogKind
  item: CatalogItem
} | null

export function CatalogView() {
  const colors = useCatalog("color")
  const sizes = useCatalog("size")
  const categories = useCatalog("category")

  const setView = useAppStore((s) => s.setView)
  const setProductColorFilter = useAppStore((s) => s.setProductColorFilter)
  const setProductSizeFilter = useAppStore((s) => s.setProductSizeFilter)
  const setProductCategoryFilter = useAppStore((s) => s.setProductCategoryFilter)
  const setProductStatusFilter = useAppStore((s) => s.setProductStatusFilter)

  const [dialog, setDialog] = React.useState<DialogState>(null)
  const [deleting, setDeleting] = React.useState<DeleteState>(null)

  function goToLowStock() {
    setProductStatusFilter("low_stock")
    setView("products")
  }

  return (
    <div className="space-y-4">
      {/* Low-stock shortcut */}
      <Card className="border-amber-500/30 bg-amber-500/5">
        <CardContent className="flex flex-col items-start justify-between gap-3 py-3 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-medium">Low stock alerts</p>
              <p className="text-xs text-muted-foreground">
                Products with stock at or below {LOW_STOCK_THRESHOLD} units
              </p>
            </div>
          </div>
          <Button size="sm" variant="outline" onClick={goToLowStock} className="gap-1.5">
            <Filter className="h-3.5 w-3.5" /> View low-stock products
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <CatalogCard
          kind="color"
          icon={Palette}
          title="Colors"
          description="Color variants available for products"
          items={colors.data}
          isLoading={colors.isLoading}
          onCreate={() => setDialog({ kind: "color", mode: "add" })}
          onRename={(item) => setDialog({ kind: "color", mode: "rename", item })}
          onDelete={(item) => setDeleting({ kind: "color", item })}
          onShowProducts={(item) => {
            setProductColorFilter(item.name)
            setView("products")
          }}
        />
        <CatalogCard
          kind="size"
          icon={Ruler}
          title="Sizes"
          description="Size variants available for products"
          items={sizes.data}
          isLoading={sizes.isLoading}
          onCreate={() => setDialog({ kind: "size", mode: "add" })}
          onRename={(item) => setDialog({ kind: "size", mode: "rename", item })}
          onDelete={(item) => setDeleting({ kind: "size", item })}
          onShowProducts={(item) => {
            setProductSizeFilter(item.name)
            setView("products")
          }}
        />
        <CatalogCard
          kind="category"
          icon={FolderTree}
          title="Categories"
          description="Product categories — e.g. Jewellery, Apparel"
          items={categories.data}
          isLoading={categories.isLoading}
          onCreate={() => setDialog({ kind: "category", mode: "add" })}
          onRename={(item) => setDialog({ kind: "category", mode: "rename", item })}
          onDelete={(item) => setDeleting({ kind: "category", item })}
          onShowProducts={(item) => {
            setProductCategoryFilter(item.name)
            setView("products")
          }}
        />
      </div>

      <CatalogItemDialog state={dialog} onClose={() => setDialog(null)} />
      <DeleteCatalogItemDialog state={deleting} onClose={() => setDeleting(null)} />
    </div>
  )
}

function CatalogCard({
  kind,
  icon: Icon,
  title,
  description,
  items,
  isLoading,
  onCreate,
  onRename,
  onDelete,
  onShowProducts,
}: {
  kind: CatalogKind
  icon: React.ComponentType<{ className?: string }>
  title: string
  description: string
  items?: CatalogItem[]
  isLoading: boolean
  onCreate: () => void
  onRename: (item: CatalogItem) => void
  onDelete: (item: CatalogItem) => void
  onShowProducts: (item: CatalogItem) => void
}) {
  const [page, setPage] = React.useState(0)
  const total = items?.length ?? 0
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const safePage = Math.min(page, pageCount - 1)
  const visible = items?.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE) ?? []

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-base">{title}</CardTitle>
            <CardDescription className="text-xs">{description}</CardDescription>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="font-normal">
            {total}
          </Badge>
          <Button size="sm" variant="outline" onClick={onCreate} className="h-8 gap-1.5">
            <Plus className="h-3.5 w-3.5" /> Add
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : total > 0 ? (
          <>
            <ul className="divide-y">
              {visible.map((item) => (
                <li
                  key={item.id}
                  className="group flex items-center justify-between gap-3 px-4 py-2.5"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    {kind === "color" && (
                      <span
                        className="h-4 w-4 shrink-0 rounded-full border border-border"
                        style={{ backgroundColor: swatchColor(item.name) }}
                        aria-hidden
                      />
                    )}
                    <span className="truncate text-sm font-medium">{item.name}</span>
                    <button
                      type="button"
                      onClick={() => onShowProducts(item)}
                      title={
                        item.productCount > 0
                          ? `View ${item.productCount} product${item.productCount === 1 ? "" : "s"} with this ${kind}`
                          : `No products use this ${kind} yet`
                      }
                      className={cn(
                        "inline-flex shrink-0 items-center gap-1 rounded-full border bg-muted/50 px-2 py-0.5 text-[11px] font-medium tabular-nums transition-colors",
                        item.productCount > 0
                          ? "text-muted-foreground hover:border-primary/40 hover:bg-primary/10 hover:text-primary"
                          : "cursor-default text-muted-foreground/50"
                      )}
                    >
                      <Package className="h-3 w-3" />
                      {item.productCount}
                    </button>
                    <Badge variant="secondary" className="hidden font-normal sm:inline-flex">
                      {formatDate(item.createdAt)}
                    </Badge>
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
                      title={
                        item.productCount > 0
                          ? `In use by ${item.productCount} product(s)`
                          : `Delete ${item.name}`
                      }
                      disabled={item.productCount > 0}
                      onClick={() => onDelete(item)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
            {pageCount > 1 && (
              <div className="flex items-center justify-between border-t px-4 py-2.5">
                <p className="text-xs text-muted-foreground">
                  {total} {title.toLowerCase()} · Page {safePage + 1} of {pageCount}
                </p>
                <div className="flex items-center gap-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 gap-1"
                    onClick={() => setPage(Math.max(0, safePage - 1))}
                    disabled={safePage <= 0}
                  >
                    <ChevronLeft className="h-3.5 w-3.5" /> Prev
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 gap-1"
                    onClick={() => setPage(Math.min(pageCount - 1, safePage + 1))}
                    disabled={safePage >= pageCount - 1}
                  >
                    Next <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </>
        ) : (
          <p className="px-4 py-8 text-center text-xs text-muted-foreground">
            No {title.toLowerCase()} yet. Click “Add” to create one.
          </p>
        )}
      </CardContent>
    </Card>
  )
}

function CatalogItemDialog({
  state,
  onClose,
}: {
  state: DialogState
  onClose: () => void
}) {
  const [name, setName] = React.useState("")
  // Reset the name whenever the dialog opens for a different item. Uses
  // React's "storing information from previous renders" pattern instead of
  // an effect (avoids the react-hooks/set-state-in-effect lint rule).
  const [prevState, setPrevState] = React.useState(state)
  if (state && state !== prevState) {
    setPrevState(state)
    setName(state.mode === "rename" ? state.item?.name ?? "" : "")
  }

  const create = useCreateCatalogItem(state?.kind ?? "color")
  const update = useUpdateCatalogItem(state?.kind ?? "color")
  const submitting = create.isPending || update.isPending

  if (!state) return null
  const current = state
  const isRename = current.mode === "rename"
  const kindLabel =
    current.kind === "color" ? "color" : current.kind === "size" ? "size" : "category"

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    try {
      if (isRename && current.item) {
        await update.mutateAsync({ id: current.item.id, name: trimmed })
        toast.success(`${kindLabel} renamed`, { description: trimmed })
      } else {
        await create.mutateAsync(trimmed)
        toast.success(`${kindLabel} created`, { description: trimmed })
      }
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong")
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>{isRename ? `Rename ${kindLabel}` : `Add ${kindLabel}`}</DialogTitle>
          <DialogDescription>
            {isRename
              ? `Rename "${current.item?.name}" — all products using it will update.`
              : `Create a new ${kindLabel} that products can use.`}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="catalog-name">Name *</Label>
            <Input
              id="catalog-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={
                kindLabel === "color" ? "e.g. Midnight Blue" : kindLabel === "size" ? "e.g. 3XL" : "e.g. Jewellery"
              }
              autoFocus
              maxLength={40}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || !name.trim()}>
              {submitting && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              {isRename ? "Save" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function DeleteCatalogItemDialog({
  state,
  onClose,
}: {
  state: DeleteState
  onClose: () => void
}) {
  const del = useDeleteCatalogItem(state?.kind ?? "color")
  const isPending = del.isPending

  async function handleDelete() {
    if (!state) return
    try {
      await del.mutateAsync(state.item.id)
      toast.success(`${state.kind} deleted`, { description: state.item.name })
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong")
    }
  }

  return (
    <AlertDialog open={!!state} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <AlertDialogTitle>Delete this {state?.kind}?</AlertDialogTitle>
              <AlertDialogDescription>
                <strong>{state?.item.name}</strong> will be permanently removed.
                {state && state.item.productCount > 0 && (
                  <>
                    {" "}
                    It is used by <strong>{state.item.productCount}</strong> product
                    {state.item.productCount === 1 ? "" : "s"} — colors/sizes still in use
                    cannot be deleted.
                  </>
                )}
              </AlertDialogDescription>
            </div>
          </div>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            <Trash2 className="mr-1.5 h-4 w-4" />
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
