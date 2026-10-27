"use client"

import { BulkEditDialog as SharedBulkEditDialog } from "@munim/ui"
import { useBulkUpdateProducts } from "@/hooks/use-products"
import { useProductMeta } from "@/hooks/use-meta"
import { useArticles } from "@/hooks/use-articles"
import type { BulkProductPatch } from "@munim/core"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedIds: string[]
  onDone: () => void
}

/**
 * Web wiring for the SHARED @munim/ui BulkEditDialog: fetches the option
 * lists (categories/articles) and the mutation, then hands both to the dialog.
 */
export function BulkEditDialog({ open, onOpenChange, selectedIds, onDone }: Props) {
  const bulk = useBulkUpdateProducts()
  const { data: meta } = useProductMeta()
  const { data: articleList } = useArticles()

  return (
    <SharedBulkEditDialog
      open={open}
      onOpenChange={onOpenChange}
      selectedCount={selectedIds.length}
      options={{
        categories: meta?.categories ?? [],
        articles: (articleList ?? []).map((a) => a.name),
      }}
      onSubmit={(patch: BulkProductPatch) => bulk.mutateAsync({ ids: selectedIds, patch })}
      onDone={onDone}
    />
  )
}
