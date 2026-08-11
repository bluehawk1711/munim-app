"use client"

import * as React from "react"
import { useForm, type Resolver } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2, Plus, Minus, SlidersHorizontal } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Input, Label, Button, Textarea, Badge } from "@munim/ui"






import { useAdjustStock } from "@/hooks/use-products"
import { stockAdjustmentSchema, type StockAdjustmentValues } from "@/lib/validators"
import type { Product } from "@/lib/types"
import { formatNumber } from "@/lib/format"
import { toast } from "sonner"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  product: Product | null
}

export function StockAdjustmentDialog({ open, onOpenChange, product }: Props) {
  const adjust = useAdjustStock()

  const form = useForm<StockAdjustmentValues>({
    // Sanctioned boundary cast: react-hook-form's Resolver<T> requires
    // TFieldValues == TTransformedValues, but zodResolver infers the schema's
    // *input* type (fields use z.coerce.number, so input ≠ output). Runtime
    // values are always the parsed (output) values. Nothing else types here.
    resolver: zodResolver(stockAdjustmentSchema) as unknown as Resolver<StockAdjustmentValues>,
    defaultValues: { adjustment: 0, reason: "" },
  })

  React.useEffect(() => {
    if (open) form.reset({ adjustment: 0, reason: "" })
  }, [open, form])

  const adjustment = form.watch("adjustment")
  const newStock = product ? product.stock + (Number(adjustment) || 0) : 0

  async function onSubmit(values: StockAdjustmentValues) {
    if (!product) return
    try {
      await adjust.mutateAsync({ id: product.id, values })
      toast.success("Stock adjusted", {
        description: `${product.name}: ${product.stock} → ${product.stock + values.adjustment}`,
      })
      onOpenChange(false)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to adjust stock"
      toast.error("Adjustment failed", { description: message })
    }
  }

  if (!product) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <SlidersHorizontal className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle>Adjust Stock</DialogTitle>
              <DialogDescription className="truncate">{product.name}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border bg-muted/40 p-3">
            <span className="text-sm text-muted-foreground">Current Stock</span>
            <Badge variant="secondary" className="text-sm">{formatNumber(product.stock)} units</Badge>
          </div>

          <div className="space-y-2">
            <Label htmlFor="adjustment">Adjustment (use − for decrease)</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => form.setValue("adjustment", (Number(form.getValues("adjustment")) || 0) - 1)}
                aria-label="Decrease"
              >
                <Minus className="h-4 w-4" />
              </Button>
              <Input
                id="adjustment"
                type="number"
                step="0.01"
                className="text-center"
                {...form.register("adjustment")}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => form.setValue("adjustment", (Number(form.getValues("adjustment")) || 0) + 1)}
                aria-label="Increase"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {form.formState.errors.adjustment && (
              <p className="text-xs text-destructive">{form.formState.errors.adjustment.message}</p>
            )}
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <span className="text-sm text-muted-foreground">New Stock</span>
            <span className={`text-sm font-semibold ${newStock < 0 ? "text-destructive" : ""}`}>
              {formatNumber(newStock)} units
            </span>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reason">Reason (optional)</Label>
            <Textarea id="reason" placeholder="e.g. Restocked, damaged, returned…" rows={2} {...form.register("reason")} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={adjust.isPending || newStock < 0}>
              {adjust.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              Apply Adjustment
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
