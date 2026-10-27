"use client"

import * as React from "react"
import {
  Tag,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Package,
  IndianRupee,
  Scale,
  Boxes,
  TrendingUp,
  Eye,
} from "lucide-react"
import {
  Button,
  Input,
  Label,
  Textarea,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Badge,
  Skeleton,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  toast,
} from "@munim/ui"
import {
  useArticles,
  useArticlesAnalytics,
  useCreateArticle,
  useUpdateArticle,
  useDeleteArticle,
  type ArticleDto,
} from "@/hooks/use-articles"
import { MonthlySalesChart } from "@/components/charts"
import { formatCurrency, formatWeight, formatNumber, formatDate } from "@/lib/format"
import { useAppStore } from "@/store/view-store"

type SortKey = "revenue" | "weight" | "stockValue"

const SORTS: { key: SortKey; label: string }[] = [
  { key: "revenue", label: "Revenue" },
  { key: "weight", label: "Weight sold" },
  { key: "stockValue", label: "Stock value" },
]

type FormState = { mode: "add" } | { mode: "edit"; article: ArticleDto } | null

export function ArticlesView() {
  const articles = useArticles()
  const analytics = useArticlesAnalytics()
  const remove = useDeleteArticle()

  const setView = useAppStore((s) => s.setActiveView)
  const setProductArticleFilter = useAppStore((s) => s.setProductArticleFilter)

  const [form, setForm] = React.useState<FormState>(null)
  const [deleting, setDeleting] = React.useState<ArticleDto | null>(null)
  const [detail, setDetail] = React.useState<string | null>(null)
  const [sort, setSort] = React.useState<SortKey>("revenue")

  const rows = React.useMemo(() => {
    const list = [...(analytics.data?.rows ?? [])]
    if (sort === "revenue") list.sort((a, b) => b.revenue - a.revenue)
    if (sort === "weight") list.sort((a, b) => b.soldWeightGm - a.soldWeightGm)
    if (sort === "stockValue") list.sort((a, b) => b.stockValue - a.stockValue)
    return list
  }, [analytics.data, sort])

  const totals = React.useMemo(() => {
    const list = analytics.data?.rows ?? []
    return {
      count: list.length,
      stockValue: list.reduce((s, r) => s + r.stockValue, 0),
      revenue: list.reduce((s, r) => s + r.revenue, 0),
      soldWeightGm: list.reduce((s, r) => s + r.soldWeightGm, 0),
    }
  }, [analytics.data])

  const detailRow = rows.find((r) => r.articleId === detail) ?? null

  async function confirmDelete() {
    if (!deleting) return
    try {
      await remove.mutateAsync(deleting.id)
      toast.success("Article deleted", { description: deleting.name })
      setDeleting(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong")
      setDeleting(null)
    }
  }

  function showProducts(name: string) {
    setProductArticleFilter(name)
    setView("products")
  }

  const loading = articles.isLoading || analytics.isLoading
  const list = articles.data ?? []

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Tag className="h-5 w-5" /> Articles
          </h2>
          <p className="text-sm text-muted-foreground">
            Product designs & classifications — with stock and sales analytics
          </p>
        </div>
        <Button className="gap-1.5" onClick={() => setForm({ mode: "add" })}>
          <Plus className="h-4 w-4" /> New Article
        </Button>
      </div>

      {/* Analytics summary tiles */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Tile icon={Boxes} label="Articles" value={formatNumber(totals.count)} loading={loading} />
        <Tile
          icon={Scale}
          label="Stock value"
          value={formatCurrency(totals.stockValue)}
          loading={loading}
        />
        <Tile
          icon={IndianRupee}
          label="Revenue · 6 months"
          value={formatCurrency(totals.revenue)}
          loading={loading}
        />
        <Tile
          icon={TrendingUp}
          label="Weight sold · 6 months"
          value={totals.soldWeightGm > 0 ? formatWeight(totals.soldWeightGm) : "—"}
          loading={loading}
        />
      </div>

      {/* Analytics table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base">Article analytics</CardTitle>
              <CardDescription>
                Last 6 months — {analytics.data?.monthLabels.join(" · ") ?? ""}
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-1 rounded-full bg-muted p-1">
              {SORTS.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setSort(s.key)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                    sort === s.key
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No articles yet — create one with “New Article”.
            </p>
          ) : (
            <div className="-mx-1 overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-1 py-2 font-medium">Article</th>
                    <th className="px-1 py-2 text-right font-medium">Stock</th>
                    <th className="px-1 py-2 text-right font-medium">Stock value</th>
                    <th className="px-1 py-2 text-right font-medium">Sold (6m)</th>
                    <th className="px-1 py-2 text-right font-medium">Weight (6m)</th>
                    <th className="px-1 py-2 text-right font-medium">Revenue (6m)</th>
                    <th className="px-1 py-2 font-medium">Trend</th>
                    <th className="px-1 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const max = Math.max(...r.trend, 1)
                    return (
                      <tr key={r.articleId} className="border-b last:border-0">
                        <td className="px-1 py-2.5">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{r.name}</span>
                            {r.code ? (
                              <Badge variant="secondary" className="font-normal">
                                {r.code}
                              </Badge>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-1 py-2.5 text-right tabular-nums">
                          {formatNumber(r.stockUnits)}{" "}
                          <span className="text-xs text-muted-foreground">
                            · {r.stockWeightGm > 0 ? formatWeight(r.stockWeightGm) : "—"}
                          </span>
                        </td>
                        <td className="px-1 py-2.5 text-right tabular-nums">
                          {formatCurrency(r.stockValue)}
                        </td>
                        <td className="px-1 py-2.5 text-right tabular-nums">
                          {formatNumber(r.soldUnits)}
                        </td>
                        <td className="px-1 py-2.5 text-right tabular-nums">
                          {r.soldWeightGm > 0 ? formatWeight(r.soldWeightGm) : "—"}
                        </td>
                        <td className="px-1 py-2.5 text-right font-medium tabular-nums">
                          {formatCurrency(r.revenue)}
                        </td>
                        <td className="px-1 py-2.5">
                          <div className="flex h-6 items-end gap-0.5" aria-hidden>
                            {r.trend.map((v, i) => (
                              <span
                                key={i}
                                className="w-2 rounded-t bg-primary/60"
                                style={{
                                  height: `${Math.max(2, Math.round((v / max) * 24))}px`,
                                  opacity: 0.45 + (0.55 * (i + 1)) / r.trend.length,
                                }}
                              />
                            ))}
                          </div>
                        </td>
                        <td className="px-1 py-2.5 text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            aria-label={`View ${r.name} trend`}
                            onClick={() => setDetail(r.articleId)}
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* CRUD list */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">All articles</CardTitle>
          <CardDescription>
            {list.length} article{list.length === 1 ? "" : "s"} — linked products show up in their
            analytics row
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : list.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No articles yet. Articles classify products like categories, with an optional code
              and description.
            </p>
          ) : (
            <ul className="divide-y">
              {list.map((a) => (
                <li
                  key={a.id}
                  className="group flex items-center justify-between gap-3 py-2.5"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-sm font-medium">{a.name}</span>
                      {a.code ? (
                        <Badge variant="outline" className="font-normal">
                          {a.code}
                        </Badge>
                      ) : null}
                      <button
                        type="button"
                        className="text-xs font-medium text-primary hover:underline"
                        onClick={() => showProducts(a.name)}
                      >
                        {a.productCount} product{a.productCount === 1 ? "" : "s"}
                      </button>
                    </div>
                    {a.description ? (
                      <p className="truncate text-xs text-muted-foreground">{a.description}</p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      aria-label={`Edit ${a.name}`}
                      onClick={() => setForm({ mode: "edit", article: a })}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive disabled:opacity-40"
                      aria-label={`Delete ${a.name}`}
                      title={
                        a.productCount > 0
                          ? `In use by ${a.productCount} product(s)`
                          : `Delete ${a.name}`
                      }
                      disabled={a.productCount > 0}
                      onClick={() => setDeleting(a)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <ArticleFormDialog state={form} onClose={() => setForm(null)} />

      <AlertDialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{deleting?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the article. Products are never deleted — the link is
              cleared instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={remove.isPending}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {remove.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Per-article detail with the 6-month trend */}
      <Dialog open={!!detail} onOpenChange={(open) => !open && setDetail(null)}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {detailRow?.name}
              {detailRow?.code ? (
                <Badge variant="secondary" className="font-normal">
                  {detailRow.code}
                </Badge>
              ) : null}
            </DialogTitle>
            <DialogDescription>{detailRow?.description || "No description"}</DialogDescription>
          </DialogHeader>
          {detailRow ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <MiniStat label="Products" value={formatNumber(detailRow.productCount)} />
                <MiniStat label="Stock value" value={formatCurrency(detailRow.stockValue)} />
                <MiniStat label="Sold (6m)" value={formatNumber(detailRow.soldUnits)} />
                <MiniStat
                  label="Revenue (6m)"
                  value={formatCurrency(detailRow.revenue)}
                />
              </div>
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Monthly revenue
                </p>
                <MonthlySalesChart
                  data={(analytics.data?.monthLabels ?? []).map((m, i) => ({
                    month: m,
                    revenue: detailRow.trend[i] ?? 0,
                    orders: 0,
                  }))}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Last sale:{" "}
                {detailRow.lastSaleAt ? formatDate(detailRow.lastSaleAt) : "never"}
              </p>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}

/* ── Small pieces ─────────────────────────────────────────────── */

function Tile({
  icon: Icon,
  label,
  value,
  loading,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
  loading?: boolean
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon className="h-3.5 w-3.5" />
          </span>
          {label}
        </div>
        <p className="mt-2 text-xl font-bold tracking-tight tabular-nums">
          {loading ? <Skeleton className="h-7 w-24" /> : value}
        </p>
      </CardContent>
    </Card>
  )
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-2.5">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold tabular-nums">{value}</p>
    </div>
  )
}

function ArticleFormDialog({
  state,
  onClose,
}: {
  state: FormState
  onClose: () => void
}) {
  const create = useCreateArticle()
  const update = useUpdateArticle()
  const submitting = create.isPending || update.isPending

  const [name, setName] = React.useState("")
  const [code, setCode] = React.useState("")
  const [description, setDescription] = React.useState("")
  const [touched, setTouched] = React.useState(false)

  // Reset the form whenever the dialog opens for a different state — React's
  // "storing information from previous renders" pattern (no effect).
  const [prevState, setPrevState] = React.useState(state)
  if (state && state !== prevState) {
    setPrevState(state)
    setTouched(false)
    setName(state.mode === "edit" ? state.article.name : "")
    setCode(state.mode === "edit" ? state.article.code ?? "" : "")
    setDescription(state.mode === "edit" ? state.article.description ?? "" : "")
  }

  if (!state) return null
  const current = state
  const isEdit = current.mode === "edit"
  const nameError = touched && !name.trim() ? "Name is required" : null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setTouched(true)
    const trimmed = name.trim()
    if (!trimmed) return
    try {
      const input = { name: trimmed, code: code.trim(), description: description.trim() }
      if (isEdit && current.mode === "edit") {
        await update.mutateAsync({ id: current.article.id, input })
        toast.success("Article updated", { description: trimmed })
      } else {
        await create.mutateAsync(input)
        toast.success("Article created", { description: trimmed })
      }
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong")
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit article" : "New article"}</DialogTitle>
          <DialogDescription>
            Articles behave like categories — plus an optional code and description.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="article-name">Name *</Label>
            <Input
              id="article-name"
              value={name}
              maxLength={40}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Bridal Choker"
              autoFocus
            />
            {nameError ? <p className="text-xs text-destructive">{nameError}</p> : null}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="article-code">Code</Label>
            <Input
              id="article-code"
              value={code}
              maxLength={20}
              onChange={(e) => setCode(e.target.value)}
              placeholder="e.g. BGL-01 (optional)"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="article-desc">Description</Label>
            <Textarea
              id="article-desc"
              value={description}
              maxLength={200}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Design notes, target customer… (optional)"
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting} className="gap-1.5">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {isEdit ? "Save changes" : "Create article"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
