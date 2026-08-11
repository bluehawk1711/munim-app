"use client"

import * as React from "react"
import { Loader2, Trash2, AlertTriangle } from "lucide-react"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@munim/ui"

import { useDeleteProduct } from "@/hooks/use-products"
import type { Product } from "@/lib/types"
import { toast } from "sonner"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  product: Product | null
}

export function DeleteProductDialog({ open, onOpenChange, product }: Props) {
  const del = useDeleteProduct()

  async function handleDelete() {
    if (!product) return
    try {
      await del.mutateAsync(product.id)
      toast.success("Product deleted", { description: product.name })
      onOpenChange(false)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to delete"
      toast.error("Delete failed", { description: message })
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <AlertDialogTitle>Delete product?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently remove <strong>{product?.name}</strong> ({product?.sku}) and all
                associated sales history. This action cannot be undone.
              </AlertDialogDescription>
            </div>
          </div>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={del.isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {del.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            <Trash2 className="mr-1.5 h-4 w-4" />
            Delete permanently
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
