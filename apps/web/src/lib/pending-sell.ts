import type { Product } from "@/lib/types"

let pendingSellProduct: Product | null = null

export function setPendingSellProduct(product: Product | null) {
  pendingSellProduct = product
}

export function consumePendingSellProduct(): Product | null {
  const p = pendingSellProduct
  pendingSellProduct = null
  return p
}
