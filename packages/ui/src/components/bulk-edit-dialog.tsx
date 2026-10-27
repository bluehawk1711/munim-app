"use client"

import * as React from "react"
import { Loader2, Pencil } from "lucide-react"
import type { BulkProductPatch } from "@munim/core"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./dialog.js"
import { Checkbox } from "./checkbox.js"
import { Input } from "./input.js"
import { Label } from "./label.js"
import { Button } from "./button.js"
import { Textarea } from "./textarea.js"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select.js"
import { toast } from "./sonner.js"

export type BulkEditOptionLists = {
  categories: string[]
  articles: string[]
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** How many products the current selection covers (shown in the title/CTA). */
  selectedCount: number
  /** Existing category/article names for the datalist suggestions. */
  options: BulkEditOptionLists
  /**
   * Applies the patch (POSTed by the caller). Resolves with how many products
   * were updated. Rejects with an Error on failure — the dialog toasts it.
   */
  onSubmit: (patch: BulkProductPatch) => Promise<{ count: number }>
  /** Called after a successful apply (e.g. clear the selection). */
  onDone?: () => void
}

/**
 * Bulk edit: apply ONE patch to many selected products. Each row has an enable
 * checkbox — only ticked fields are sent; everything else stays untouched.
 *
 * Presentational on purpose (no data hooks): the caller supplies the option
   * lists and the submit function, so web and desktop share this dialog.
 */
export function BulkEditDialog({ open, onOpenChange, selectedCount, options, onSubmit, onDone }: Props) {
  const [pending, setPending] = React.useState(false)

  // Which fields to apply.
  const [useCategory, setUseCategory] = React.useState(false)
  const [useArticle, setUseArticle] = React.useState(false)
  const [usePriceMode, setUsePriceMode] = React.useState(false)
  const [useLabour, setUseLabour] = React.useState(false)
  const [useSilverPct, setUseSilverPct] = React.useState(false)
  const [useStock, setUseStock] = React.useState(false)
  const [useThreshold, setUseThreshold] = React.useState(false)
  const [useNotes, setUseNotes] = React.useState(false)

  const [category, setCategory] = React.useState("")
  const [article, setArticle] = React.useState("")
  const [priceMode, setPriceMode] = React.useState<"auto" | "manual">("manual")
  const [labourType, setLabourType] = React.useState<"PERCENT" | "FIXED" | "PER_GRAM">("PERCENT")
  const [labourValue, setLabourValue] = React.useState("")
  const [silverPct, setSilverPct] = React.useState("")
  const [stockDelta, setStockDelta] = React.useState("")
  const [threshold, setThreshold] = React.useState("")
  const [notes, setNotes] = React.useState("")

  React.useEffect(() => {
    if (!open) return
    setPending(false)
    setUseCategory(false)
    setUseArticle(false)
    setUsePriceMode(false)
    setUseLabour(false)
    setUseSilverPct(false)
    setUseStock(false)
    setUseThreshold(false)
    setUseNotes(false)
    setCategory("")
    setArticle("")
    setPriceMode("manual")
    setLabourType("PERCENT")
    setLabourValue("")
    setSilverPct("")
    setStockDelta("")
    setThreshold("")
    setNotes("")
  }, [open])

  const delta = Number(stockDelta) || 0
  const hasPatch =
    useCategory ||
    useArticle ||
    usePriceMode ||
    useLabour ||
    useSilverPct ||
    (useStock && delta !== 0) ||
    useThreshold ||
    useNotes
  const stockError = useStock && delta === 0 ? "Stock change cannot be zero" : null

  async function handleSubmit() {
    if (selectedCount === 0 || !hasPatch || stockError || pending) return
    const patch: BulkProductPatch = {}
    if (useCategory) patch.category = category.trim()
    if (useArticle) patch.article = article.trim()
    if (usePriceMode) patch.priceMode = priceMode
    if (useLabour) {
      patch.labourType = labourType
      patch.labourValue = labourValue === "" ? null : Number(labourValue)
    }
    if (useSilverPct) patch.silverPercentage = Number(silverPct) || 0
    if (useStock && delta !== 0) patch.stockDelta = delta
    if (useThreshold) patch.lowStockThreshold = Math.max(0, Number(threshold) || 0)
    if (useNotes) patch.notes = notes

    setPending(true)
    try {
      const r = await onSubmit(patch)
      toast.success(`Updated ${r.count} product${r.count !== 1 ? "s" : ""}`)
      onDone?.()
      onOpenChange(false)
    } catch (err) {
      toast.error("Bulk edit failed", {
        description: err instanceof Error ? err.message : "Unknown error",
      })
    } finally {
      setPending(false)
    }
  }

  const idFor = (label: string) => `bulk-enable-${label.replace(/\s+/g, "-").toLowerCase()}`

  function Row({
    checked,
    onChange,
    label,
    hint,
    children,
  }: {
    checked: boolean
    onChange: (v: boolean) => void
    label: string
    hint?: string
    children?: React.ReactNode
  }) {
    const id = idFor(label)
    return (
      <div
        className={
          "flex items-start gap-3 rounded-lg border p-3 transition-colors " +
          (checked
            ? "border-primary/40 bg-primary/5"
            : "bg-muted/30 hover:border-ring/50")
        }
      >
        <Checkbox
          id={id}
          checked={checked}
          onCheckedChange={onChange}
          aria-label={`Apply ${label}`}
          className="mt-0.5"
        />
        <div className="min-w-0 flex-1 space-y-1.5">
          <Label htmlFor={id} className="cursor-pointer text-sm font-medium">
            {label}
            {hint ? <span className="ml-1.5 font-normal text-muted-foreground">{hint}</span> : null}
          </Label>
          {checked && children ? <div>{children}</div> : null}
        </div>
      </div>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-[520px]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Pencil className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle>
                Bulk edit {selectedCount} product{selectedCount !== 1 ? "s" : ""}
              </DialogTitle>
              <DialogDescription>Only the fields you tick will change. Everything else stays as-is.</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-2.5">
          <Row checked={useCategory} onChange={setUseCategory} label="Category">
            <Input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Leave empty to clear"
              list="bulk-edit-categories"
              aria-label="New category"
            />
            <datalist id="bulk-edit-categories">
              {options.categories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </Row>

          <Row checked={useArticle} onChange={setUseArticle} label="Article">
            <Input
              value={article}
              onChange={(e) => setArticle(e.target.value)}
              placeholder="Leave empty to clear"
              list="bulk-edit-articles"
              aria-label="New article"
            />
            <datalist id="bulk-edit-articles">
              {options.articles.map((a) => (
                <option key={a} value={a} />
              ))}
            </datalist>
          </Row>

          <Row checked={usePriceMode} onChange={setUsePriceMode} label="Pricing mode">
            <Select value={priceMode} onValueChange={(v) => setPriceMode(v as "auto" | "manual")}>
              <SelectTrigger className="h-9 w-full bg-background" aria-label="Pricing mode">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="manual">Manual price</SelectItem>
                <SelectItem value="auto">Auto (metal rate)</SelectItem>
              </SelectContent>
            </Select>
          </Row>

          <Row checked={useLabour} onChange={setUseLabour} label="Labour charge">
            <div className="flex gap-2">
              <Select value={labourType} onValueChange={(v) => setLabourType(v as typeof labourType)}>
                <SelectTrigger className="h-9 flex-1 bg-background" aria-label="Labour type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PERCENT">Percent (%)</SelectItem>
                  <SelectItem value="FIXED">Fixed</SelectItem>
                  <SelectItem value="PER_GRAM">Per gram</SelectItem>
                </SelectContent>
              </Select>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={labourValue}
                onChange={(e) => setLabourValue(e.target.value)}
                placeholder="Value"
                className="flex-1"
                aria-label="Labour value"
              />
            </div>
          </Row>

          <Row checked={useSilverPct} onChange={setUseSilverPct} label="Silver %" hint="(pure-silver percentage)">
            <Input
              type="number"
              step="0.01"
              min="0"
              value={silverPct}
              onChange={(e) => setSilverPct(e.target.value)}
              placeholder="e.g. 92.5"
              aria-label="Silver percentage"
            />
          </Row>

          <Row
            checked={useStock}
            onChange={(v) => {
              setUseStock(v)
              if (v && stockDelta === "") setStockDelta("1")
            }}
            label="Stock change"
            hint="(+ / − units)"
          >
            <Input
              type="number"
              step="1"
              value={stockDelta}
              onChange={(e) => setStockDelta(e.target.value)}
              placeholder="+1 or -1"
              aria-label="Stock delta"
            />
            {stockError ? <p className="text-xs text-destructive">{stockError}</p> : null}
          </Row>

          <Row checked={useThreshold} onChange={setUseThreshold} label="Low-stock alert at">
            <Input
              type="number"
              step="1"
              min="0"
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
              placeholder="e.g. 5"
              aria-label="Low stock threshold"
            />
          </Row>

          <Row checked={useNotes} onChange={setUseNotes} label="Notes" hint="(replaces existing notes)">
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              maxLength={500}
              placeholder="Leave empty to clear"
              aria-label="Notes"
            />
          </Row>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={pending || !hasPatch || !!stockError}>
            {pending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
            Apply to {selectedCount} product{selectedCount !== 1 ? "s" : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
