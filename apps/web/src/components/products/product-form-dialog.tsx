"use client"

import * as React from "react"
import { useForm, type Resolver } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2, Package, UploadCloud, Image as ImageIcon, X, Plus } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useProductMeta } from "@/hooks/use-meta"
import { useCreateProduct, useUpdateProduct } from "@/hooks/use-products"
import { productSchema, type ProductFormValues } from "@/lib/validators"
import type { Product } from "@/lib/types"
import { toast } from "sonner"

const DEFAULT_COLORS = ["Black", "White", "Navy", "Blue", "Red", "Green", "Grey", "Brown", "Olive", "Silver", "Teal", "Amber"]
const DEFAULT_SIZES = ["XS", "S", "M", "L", "XL", "XXL", "Standard", "30", "32", "34", "36", "8", "9", "10", "11"]

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  product?: Product | null
}

export function ProductFormDialog({ open, onOpenChange, product }: Props) {
  const isEdit = !!product
  const create = useCreateProduct()
  const update = useUpdateProduct()
  const { data: meta } = useProductMeta()

  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = React.useState(false)
  const [customColor, setCustomColor] = React.useState(false)
  const [customSize, setCustomSize] = React.useState(false)

  const colors = Array.from(new Set([...DEFAULT_COLORS, ...(meta?.colors ?? [])]))
  const sizes = Array.from(new Set([...DEFAULT_SIZES, ...(meta?.sizes ?? [])]))

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema) as unknown as Resolver<ProductFormValues>,
    defaultValues: {
      name: "",
      color: "Black",
      size: "Standard",
      barcode: "",
      imageUrl: "",
      stock: 0,
      purchasePrice: 0,
      sellingPrice: 0,
      notes: "",
    },
  })

  React.useEffect(() => {
    if (open) {
      setCustomColor(false)
      setCustomSize(false)
      if (product) {
        form.reset({
          name: product.name,
          color: product.color,
          size: product.size,
          barcode: product.barcode ?? "",
          imageUrl: product.imageUrl ?? "",
          stock: product.stock,
          purchasePrice: product.purchasePrice,
          sellingPrice: product.sellingPrice,
          notes: product.notes ?? "",
        })
      } else {
        form.reset({
          name: "",
          color: "Black",
          size: "Standard",
          barcode: "",
          imageUrl: "",
          stock: 0,
          purchasePrice: 0,
          sellingPrice: 0,
          notes: "",
        })
      }
    }
  }, [open, product, form])

  const watched = form.watch()
  const imageUrl = watched.imageUrl
  const colorValue = watched.color ?? ""
  const sizeValue = watched.size ?? ""
  const colorIsCustom = customColor || (!!colorValue && !colors.includes(colorValue))
  const sizeIsCustom = customSize || (!!sizeValue && !sizes.includes(sizeValue))
  const margin =
    watched.sellingPrice - watched.purchasePrice > 0
      ? (((watched.sellingPrice - watched.purchasePrice) / watched.sellingPrice) * 100).toFixed(0)
      : null

  function handleColorSelect(value: string) {
    if (value === "__custom") {
      setCustomColor(true)
      form.setValue("color", "", { shouldValidate: false })
    } else {
      setCustomColor(false)
      form.setValue("color", value, { shouldValidate: true })
    }
  }

  function handleSizeSelect(value: string) {
    if (value === "__custom") {
      setCustomSize(true)
      form.setValue("size", "", { shouldValidate: false })
    } else {
      setCustomSize(false)
      form.setValue("size", value, { shouldValidate: true })
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file")
      return
    }
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append("file", file)
      const res = await fetch("/api/upload", { method: "POST", body: fd })
      const body = await res.json().catch(() => null)
      if (!res.ok) {
        throw new Error(body?.error ?? "Upload failed")
      }
      form.setValue("imageUrl", body.url, { shouldValidate: true })
      toast.success("Image uploaded")
    } catch (err) {
      toast.error("Upload failed", {
        description: err instanceof Error ? err.message : undefined,
      })
    } finally {
      setUploading(false)
      e.target.value = ""
    }
  }

  async function onSubmit(values: ProductFormValues) {
    try {
      if (isEdit && product) {
        await update.mutateAsync({ id: product.id, values })
        toast.success("Product updated", { description: values.name })
      } else {
        await create.mutateAsync(values)
        toast.success("Product created", { description: `${values.name} added to inventory` })
      }
      onOpenChange(false)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong"
      toast.error("Failed to save product", { description: message })
    }
  }

  const submitting = create.isPending || update.isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto scrollbar-thin sm:max-w-[560px]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Package className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle>{isEdit ? "Edit Product" : "Add New Product"}</DialogTitle>
              <DialogDescription>
                {isEdit ? "Update the product details below." : "Fill in the details to add a product to inventory."}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label>Product Image</Label>
            <div className="flex items-center gap-3">
              {imageUrl ? (
                <img
                  src={imageUrl}
                  alt="Product preview"
                  className="h-16 w-16 rounded-lg border object-cover"
                />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-lg border bg-muted text-muted-foreground">
                  <ImageIcon className="h-6 w-6" />
                </div>
              )}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={uploading}
                    onClick={() => fileInputRef.current?.click()}
                    className="gap-1.5"
                  >
                    {uploading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <UploadCloud className="h-4 w-4" />
                    )}
                    {uploading ? "Uploading…" : imageUrl ? "Replace image" : "Upload image"}
                  </Button>
                  {imageUrl && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      aria-label="Remove image"
                      onClick={() => form.setValue("imageUrl", "")}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  JPG, PNG or WebP · up to 5 MB · hosted on Cloudinary
                </p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>
            {form.formState.errors.imageUrl && (
              <p className="text-xs text-destructive">{form.formState.errors.imageUrl.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Product Name *</Label>
            <Input id="name" placeholder="e.g. Classic Cotton T-Shirt" {...form.register("name")} />
            {form.formState.errors.name && (
              <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="sku">SKU</Label>
              <Input
                id="sku"
                value={isEdit && product ? product.sku : "Auto-generated on save"}
                readOnly
                disabled
                className="h-9 text-muted-foreground"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="barcode">Barcode</Label>
              <Input id="barcode" placeholder="e.g. 8901234567890" {...form.register("barcode")} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Color *</Label>
              <Select value={colorIsCustom ? "__custom" : colorValue} onValueChange={handleColorSelect}>
                <SelectTrigger className="h-9 w-full" aria-label="Color">
                  <SelectValue placeholder="Select a color" />
                </SelectTrigger>
                <SelectContent>
                  {colors.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                  <SelectItem value="__custom">
                    <span className="flex items-center gap-1.5">
                      <Plus className="h-3.5 w-3.5" /> New color…
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
              {colorIsCustom && (
                <Input
                  placeholder="Type a new color…"
                  value={colorValue}
                  onChange={(e) => form.setValue("color", e.target.value, { shouldValidate: true })}
                  className="h-9"
                />
              )}
              {form.formState.errors.color && (
                <p className="text-xs text-destructive">{form.formState.errors.color.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Size *</Label>
              <Select value={sizeIsCustom ? "__custom" : sizeValue} onValueChange={handleSizeSelect}>
                <SelectTrigger className="h-9 w-full" aria-label="Size">
                  <SelectValue placeholder="Select a size" />
                </SelectTrigger>
                <SelectContent>
                  {sizes.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                  <SelectItem value="__custom">
                    <span className="flex items-center gap-1.5">
                      <Plus className="h-3.5 w-3.5" /> New size…
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
              {sizeIsCustom && (
                <Input
                  placeholder="Type a new size…"
                  value={sizeValue}
                  onChange={(e) => form.setValue("size", e.target.value, { shouldValidate: true })}
                  className="h-9"
                />
              )}
              {form.formState.errors.size && (
                <p className="text-xs text-destructive">{form.formState.errors.size.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="stock">Current Stock</Label>
            <Input id="stock" type="number" step="0.01" min={0} {...form.register("stock")} />
            {form.formState.errors.stock && (
              <p className="text-xs text-destructive">{form.formState.errors.stock.message}</p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="purchasePrice">Purchase Price (₹)</Label>
              <Input id="purchasePrice" type="number" step="0.01" min={0} {...form.register("purchasePrice")} />
              {form.formState.errors.purchasePrice && (
                <p className="text-xs text-destructive">{form.formState.errors.purchasePrice.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="sellingPrice">Selling Price (₹)</Label>
              <Input id="sellingPrice" type="number" step="0.01" min={0} {...form.register("sellingPrice")} />
              {form.formState.errors.sellingPrice && (
                <p className="text-xs text-destructive">{form.formState.errors.sellingPrice.message}</p>
              )}
            </div>
          </div>

          {margin && (
            <p className="text-xs text-muted-foreground">
              Profit margin: <span className="font-medium text-emerald-600 dark:text-emerald-400">{margin}%</span>{" "}
              (₹{(watched.sellingPrice - watched.purchasePrice).toFixed(2)} per unit)
            </p>
          )}

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" placeholder="Optional notes about this product…" rows={2} {...form.register("notes")} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              {isEdit ? "Save Changes" : "Create Product"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
