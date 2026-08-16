import { z } from "zod"

export const productSchema = z.object({
  name: z.string().min(1, "Product name is required").max(120),
  color: z.string().max(40).optional().or(z.literal("")),
  size: z.string().min(1, "Size is required").max(40),
  category: z.string().max(40).optional().or(z.literal("")),
  barcode: z.string().max(80).optional().or(z.literal("")),
  /** Weight in milligrams (mg). */
  weight: z.coerce.number().min(0, "Weight cannot be negative").optional(),
  imageUrl: z.string().max(1000).optional().or(z.literal("")),
  stock: z.coerce.number().min(0, "Stock cannot be negative"),
  purchasePrice: z.coerce.number().min(0, "Purchase price cannot be negative"),
  sellingPrice: z.coerce.number().min(0, "Selling price cannot be negative"),
  lowStockThreshold: z.coerce.number().min(0).optional(),
  notes: z.string().max(500).optional().or(z.literal("")),
})

export type ProductFormValues = z.infer<typeof productSchema>

export const saleSchema = z.object({
  productId: z.string().min(1, "Please select a product"),
  color: z.string().min(1, "Please select a color"),
  size: z.string().min(1, "Please select a size"),
  quantity: z.coerce.number().positive("Quantity must be greater than 0"),
})

export type SaleFormValues = z.infer<typeof saleSchema>

export const stockAdjustmentSchema = z.object({
  adjustment: z.coerce.number().refine((v) => v !== 0, "Adjustment cannot be zero"),
  reason: z.string().max(200).optional().or(z.literal("")),
})

export type StockAdjustmentValues = z.infer<typeof stockAdjustmentSchema>
