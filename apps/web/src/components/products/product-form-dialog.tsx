"use client"

import * as React from "react"
import { useForm, type Resolver } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2, Package, UploadCloud, Image as ImageIcon, X, Plus, BadgeIndianRupee } from "lucide-react"
import Image from "next/image"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Input, Label, Button, Textarea, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, GoldRateEditor, LabourInput, CategoryChips } from "@munim/ui"
import { useUploadImage, useGoldRates, useSaveGoldRates, useBackfillGoldKarats, useSettings, useDebouncedSettingsUpdate, useQueryState } from "@munim/query"
import { useProductMeta } from "@/hooks/use-meta"
import { useCreateProduct, useUpdateProduct } from "@/hooks/use-products"
import { productSchema, isLabourType, karatPurityPercent, resolveGoldRateTable, priceFallbackMessage, priceWithTable, toGoldKarat, type GoldRateSaveInput, type GoldRateTableEntry, type LabourType, type PriceBreakdown, type ProductFormValues } from "@munim/core"
import type { Product } from "@/lib/types"
import { toast } from "@munim/ui"

const KARAT_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: "0", label: "No karat — manual pricing" },
  ...Array.from({ length: 24 }, (_, i) => i + 1).map((karat) => ({
    value: String(karat),
    label: `${karat}K (${karatPurityPercent(karat)}% pure)`,
  })),
]

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
  const uploadImage = useUploadImage()
  const { data: meta } = useProductMeta()

  // ── Dynamic gold pricing (shared core helpers, rate table from the API) ──
  const goldRatesQuery = useGoldRates()
  const saveGoldRates = useSaveGoldRates()
  const backfillKarats = useBackfillGoldKarats()
  const settingsQuery = useQueryState(useSettings())
  // Labour/silver editors fire per keystroke — one debounced PUT, not one per key.
  const updateSettings = useDebouncedSettingsUpdate()
  const [defaultLabourType, setDefaultLabourType] = React.useState<LabourType>("PERCENT")
  const [defaultLabourValue, setDefaultLabourValue] = React.useState(0)
  const [silverRatePerGram, setSilverRatePerGram] = React.useState(0)
  // Raw text of the silver-rate field while typing (keeps "95." from being
  // clobbered back to "95" by the number-derived controlled value).
  const [silverInputText, setSilverInputText] = React.useState<string | null>(null)
  React.useEffect(() => {
    const s = settingsQuery.data
    if (!s) return
    setDefaultLabourType(s.defaultLabourType ?? "PERCENT")
    setDefaultLabourValue(s.defaultLabourValue ?? 0)
    setSilverRatePerGram(s.silverRatePerGram ?? 0)
  }, [settingsQuery.data])
  /** Shop default labour for gold products (null → none). */
  const defaultLabour = React.useMemo(
    () => (defaultLabourValue > 0 ? { type: defaultLabourType, value: defaultLabourValue } : null),
    [defaultLabourType, defaultLabourValue],
  )
  /** Effective 0–24 rate table (same shape the settings screen saves). */
  const karatTable: GoldRateTableEntry[] = React.useMemo(
    () => resolveGoldRateTable(goldRatesQuery.data?.rates ?? []),
    [goldRatesQuery.data],
  )

  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = React.useState(false)
  const [customColor, setCustomColor] = React.useState(false)
  const [customSize, setCustomSize] = React.useState(false)
  const [customCategory, setCustomCategory] = React.useState(false)

  const colors = Array.from(new Set([...DEFAULT_COLORS, ...(meta?.colors ?? [])]))
  const sizes = Array.from(new Set([...DEFAULT_SIZES, ...(meta?.sizes ?? [])]))
  const categories = Array.from(new Set(meta?.categories ?? []))

  const form = useForm<ProductFormValues>({
    // Sanctioned boundary cast: react-hook-form's Resolver<T> requires
    // TFieldValues == TTransformedValues, but zodResolver infers the schema's
    // *input* type (fields use z.coerce.number, so input ≠ output). Runtime
    // values are always the parsed (output) values. Nothing else types here.
    resolver: zodResolver(productSchema) as unknown as Resolver<ProductFormValues>,
    defaultValues: {
      name: "",
      type: "Gold",
      color: "Black",
      size: "Standard",
      category: "",
      barcode: "",
      weight: undefined,
      weightUnit: "gm",
      purity: "",
      imageUrl: "",
      stock: 0,
      purchasePrice: 0,
      sellingPrice: 0,
      silverPercentage: 100,
      labourType: "PERCENT",
      labourValue: null,
      priceMode: "auto",
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
          type: product.type as "Gold" | "Silver" | "Diamond" | "Platinum" | "Other",
          color: product.color,
          size: product.size,
          category: product.category ?? "",
          barcode: product.barcode ?? "",
          weight: product.weight ?? undefined,
          weightUnit: product.weightUnit === "mg" || product.weightUnit === "gm" ? product.weightUnit : "gm",
          nagRate: product.nagRate ?? "",
          purity: product.purity ?? "",
          imageUrl: product.imageUrl ?? "",
          stock: product.stock,
          purchasePrice: product.purchasePrice,
          sellingPrice: product.sellingPrice,
          silverPercentage: product.silverPercentage ?? 100,
          goldKarat: product.goldKarat ?? 0,
          labourType: isLabourType(product.labourType) ? product.labourType : "PERCENT",
          labourValue: product.labourValue,
          priceMode: product.priceMode,
          notes: product.notes ?? "",
        })
      } else {
        form.reset({
          name: "",
          type: "Gold",
          color: "Black",
          size: "Standard",
          category: "",
          barcode: "",
          weight: undefined,
          weightUnit: "gm",
          purity: "",
          imageUrl: "",
          stock: 0,
          purchasePrice: 0,
          sellingPrice: 0,
          silverPercentage: 100,
          goldKarat: 0,
          labourType: "PERCENT",
          labourValue: null,
          priceMode: "auto",
          notes: "",
        })
      }
    }
  }, [open, product, form])

  const watched = form.watch()
  const imageUrl = watched.imageUrl
  const colorValue = watched.color ?? ""
  const sizeValue = watched.size ?? ""
  const categoryValue = watched.category ?? ""
  const colorIsCustom = customColor || (!!colorValue && !colors.includes(colorValue))
  const sizeIsCustom = customSize || (!!sizeValue && !sizes.includes(sizeValue))
  const categoryIsCustom = customCategory || (!!categoryValue && !categories.includes(categoryValue))
  // Select needs a non-empty value: "__none" represents "no color" (form value "").
  const colorSelectValue = colorIsCustom ? "__custom" : colorValue || "__none"
  const categorySelectValue = categoryIsCustom ? "__custom" : categoryValue || "__none"
  const margin =
    (watched.sellingPrice ?? 0) - (watched.purchasePrice ?? 0) > 0
      ? ((((watched.sellingPrice ?? 0) - (watched.purchasePrice ?? 0)) / (watched.sellingPrice ?? 1)) * 100).toFixed(0)
      : null

  // ── Live auto-price preview (the exact math the API/DB computes on read) ──
  const productType = watched.type ?? "Gold"
  const goldKarat = toGoldKarat(watched.goldKarat ?? 0)
  const priceMode = watched.priceMode ?? "manual"
  const metalPreview = React.useMemo<PriceBreakdown | null>(() => {
    if (productType !== "Gold" && productType !== "Silver") return null
    return priceWithTable(
      {
        type: productType,
        priceMode,
        weight: watched.weight ?? null,
        weightUnit: watched.weightUnit ?? "gm",
        goldKarat,
        silverPercentage: watched.silverPercentage ?? 100,
        labourType: watched.labourType ?? "PERCENT",
        labourValue: typeof watched.labourValue === "number" ? watched.labourValue : null,
        netWeight: watched.netWeight ?? null,
        sellingPrice: watched.sellingPrice ?? 0,
      },
      karatTable,
      silverRatePerGram,
      defaultLabour,
    )
  }, [productType, priceMode, goldKarat, watched.sellingPrice, watched.weight, watched.weightUnit, watched.silverPercentage, watched.labourType, watched.labourValue, watched.netWeight, karatTable, silverRatePerGram, defaultLabour])

  /** Saves an edited rate row (from the inline editor) then refreshes the draft. */
  async function handleSaveInlineRates(rates: GoldRateSaveInput[]) {
    // Any labour/silver edit still inside its debounce window rides along.
    updateSettings.flush()
    try {
      await saveGoldRates.mutateAsync({ rates })
      toast.success("Rates updated", { description: "Auto-priced products now use the new rates." })
    } catch (err) {
      toast.error("Could not save rates", { description: err instanceof Error ? err.message : undefined })
    }
  }

  /** Shop default labour — local state now, settings write debounced. */
  function handleSaveDefaultLabour(type: LabourType, value: number) {
    setDefaultLabourType(type)
    setDefaultLabourValue(value)
    updateSettings.update({ defaultLabourType: type, defaultLabourValue: value }, (err) => {
      toast.error("Could not save default labour", { description: err.message })
    })
  }

  /** Shop-wide silver ₹/g — local state now, settings write debounced. */
  function handleSaveSilverRate(value: number) {
    setSilverRatePerGram(value)
    updateSettings.update({ silverRatePerGram: value }, (err) => {
      toast.error("Could not save silver rate", { description: err.message })
    })
  }

  /** Fills `goldKarat` on existing gold products from their purity stamp. */
  async function handleBackfillKarats() {
    try {
      const result = await backfillKarats.mutateAsync()
      toast.success(`Filled ${result.updated} gold product(s) from their purity stamp`)
    } catch (err) {
      toast.error("Backfill failed", { description: err instanceof Error ? err.message : undefined })
    }
  }

  function handleColorSelect(value: string) {
    if (value === "__custom") {
      setCustomColor(true)
      form.setValue("color", "", { shouldValidate: false })
    } else if (value === "__none") {
      setCustomColor(false)
      form.setValue("color", "", { shouldValidate: true })
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

  function handleCategorySelect(value: string) {
    if (value === "__custom") {
      setCustomCategory(true)
      form.setValue("category", "", { shouldValidate: false })
    } else if (value === "__none") {
      setCustomCategory(false)
      form.setValue("category", "", { shouldValidate: true })
    } else {
      setCustomCategory(false)
      form.setValue("category", value, { shouldValidate: true })
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
      // Shared api-client → POST /api/upload (Cloudinary secret stays server-side).
      const { url } = await uploadImage.mutateAsync(file)
      form.setValue("imageUrl", url, { shouldValidate: true })
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
      // Ensure price fields are always numbers (form allows empty/0)
      const payload = {
        ...values,
        purchasePrice: values.purchasePrice ?? 0,
        sellingPrice: values.sellingPrice ?? 0,
      }
      if (isEdit && product) {
        await update.mutateAsync({ id: product.id, values: payload })
        toast.success("Product updated", { description: values.name })
      } else {
        await create.mutateAsync(payload)
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
                <Image
                  src={imageUrl}
                  alt="Product preview"
                  width={64}
                  height={64}
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

          <div className="space-y-2">
            <Label>Type</Label>
            <Select value={form.watch("type") ?? "Gold"} onValueChange={(v) => form.setValue("type", v as "Gold" | "Silver" | "Diamond" | "Platinum" | "Other")}>
              <SelectTrigger className="h-9 w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Gold">Gold</SelectItem>
                <SelectItem value="Silver">Silver</SelectItem>
                <SelectItem value="Diamond">Diamond</SelectItem>
                <SelectItem value="Platinum">Platinum</SelectItem>
                <SelectItem value="Other">Other</SelectItem>
              </SelectContent>
            </Select>
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
              <p className="text-[11px] text-muted-foreground">Leave blank to auto-generate an EAN-13.</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="weight">Weight</Label>
            <div className="flex gap-2">
              <Input id="weight" type="number" step="0.1" min={0} placeholder="e.g. 24.5" {...form.register("weight")} className="flex-1" />
              <Select value={form.watch("weightUnit") ?? "gm"} onValueChange={(v) => form.setValue("weightUnit", v as "mg" | "gm")}>
                <SelectTrigger className="w-[80px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gm">gm</SelectItem>
                  <SelectItem value="mg">mg</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <p className="text-[11px] text-muted-foreground">Used for stock weight calculations &amp; label printing</p>
            {form.formState.errors.weight && (
              <p className="text-xs text-destructive">{form.formState.errors.weight.message}</p>
            )}
          </div>

          {form.watch("type") !== "Silver" && (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="grossWeight">Gross weight</Label>
                  <Input id="grossWeight" placeholder="e.g. 10+5 or 24.5" {...form.register("grossWeight")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nagLessWeight">Nag less weight</Label>
                  <Input id="nagLessWeight" placeholder="e.g. 2.5" {...form.register("nagLessWeight")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nagRate">Nag rate</Label>
                  <Input id="nagRate" placeholder="e.g. 5" {...form.register("nagRate")} />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="chejatWeight">Chejat weight</Label>
                  <Input id="chejatWeight" placeholder="e.g. 3" {...form.register("chejatWeight")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="netWeight">Net weight</Label>
                  <Input id="netWeight" placeholder="e.g. 19" {...form.register("netWeight")} />
                </div>
              </div>
            </>
          )}

          <div className="space-y-2">
            <Label htmlFor="purity">Purity</Label>
            <Input id="purity" placeholder="e.g. 24K / 22K / 916 / 925" maxLength={20} {...form.register("purity")} />
            {form.formState.errors.purity && (
              <p className="text-xs text-destructive">{form.formState.errors.purity.message}</p>
            )}
          </div>

          {(productType === "Gold" || productType === "Silver") && (
            <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
              <div className="flex items-center gap-1.5 text-xs font-medium">
                <BadgeIndianRupee className="h-3.5 w-3.5" /> {productType} pricing
              </div>

              {productType === "Gold" && (
                <>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {[24, 22, 18, 14].map((k) => (
                      <button
                        key={k}
                        type="button"
                        onClick={() => form.setValue("goldKarat", k, { shouldValidate: true })}
                        className={
                          (watched.goldKarat ?? 0) === k
                            ? "rounded-md border border-primary bg-primary/15 px-2 py-1 text-xs font-medium text-primary"
                            : "rounded-md border bg-background/60 px-2 py-1 text-xs font-medium text-muted-foreground hover:text-foreground"
                        }
                      >
                        {k}K
                      </button>
                    ))}
                    <Select
                      value={String(watched.goldKarat ?? 0)}
                      onValueChange={(value) => form.setValue("goldKarat", Number(value), { shouldValidate: true })}
                    >
                      <SelectTrigger className="h-8 w-[210px] text-xs" aria-label="Gold karat">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {KARAT_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {form.formState.errors.goldKarat && (
                    <p className="text-xs text-destructive">{form.formState.errors.goldKarat.message}</p>
                  )}
                  <div className="space-y-2">
                    <Label>Pricing</Label>
                    <Select
                      value={priceMode}
                      onValueChange={(value) => form.setValue("priceMode", value === "auto" ? "auto" : "manual", { shouldValidate: true })}
                    >
                      <SelectTrigger className="h-9 w-full" aria-label="Price mode">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="auto" disabled={!goldKarat}>Auto — net weight × karat rate</SelectItem>
                        <SelectItem value="manual">Manual price</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}

              {productType === "Silver" && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="silverPercentage">Silver %</Label>
                    <Input id="silverPercentage" type="number" step="1" min={0} max={100} placeholder="e.g. 90" {...form.register("silverPercentage")} />
                    {form.formState.errors.silverPercentage && (
                      <p className="text-xs text-destructive">{form.formState.errors.silverPercentage.message}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Pricing</Label>
                    <Select
                      value={priceMode}
                      onValueChange={(value) => form.setValue("priceMode", value === "auto" ? "auto" : "manual", { shouldValidate: true })}
                    >
                      <SelectTrigger className="h-9 w-full" aria-label="Price mode">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="auto">Auto — weight × silver rate</SelectItem>
                        <SelectItem value="manual">Manual price</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              <LabourInput
                type={watched.labourType ?? "PERCENT"}
                value={watched.labourValue != null ? String(watched.labourValue) : ""}
                onTypeChange={(type) => form.setValue("labourType", type, { shouldValidate: true })}
                onValueChange={(value) =>
                  form.setValue("labourValue", value.trim() === "" ? null : Math.max(0, Number(value) || 0), {
                    shouldValidate: true,
                  })
                }
                label="Labour"
                hint={
                  productType === "Gold"
                    ? "Leave empty to use the shop default labour."
                    : "Silver labour is per product — empty means none."
                }
              />

              {metalPreview ? (
                <p className="text-xs text-muted-foreground">
                  {metalPreview.source === "auto" ? (
                    <>
                      Auto price now:{" "}
                      <span className="font-medium text-foreground">
                        ₹{metalPreview.price.toFixed(2)}
                      </span>{" "}
                      ({metalPreview.weightGm.toFixed(3)}g × ₹{metalPreview.ratePerGram.toFixed(2)}/g
                      {metalPreview.labour.amount > 0
                        ? ` + labour ₹${metalPreview.labour.amount.toFixed(2)}`
                        : ""}
                      )
                    </>
                  ) : (
                    <>
                      Falls back to the stored price —{" "}
                      {priceFallbackMessage(metalPreview.fallback) ?? `(${metalPreview.fallback}).`}
                    </>
                  )}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  {productType === "Gold" ? "Pick a karat to enable auto pricing by net weight." : "Enter weight to enable auto pricing."}
                </p>
              )}

              {productType === "Gold" ? (
                <div className="border-t pt-2">
                  <GoldRateEditor
                    compact
                    rates={goldRatesQuery.data?.rates}
                    labourType={defaultLabourType}
                    labourValue={defaultLabourValue}
                    onLabourChange={handleSaveDefaultLabour}
                    silverRatePerGram={silverRatePerGram}
                    onSilverRateChange={handleSaveSilverRate}
                    onSave={handleSaveInlineRates}
                    saving={saveGoldRates.isPending || updateSettings.isPending}
                    onBackfillKarats={handleBackfillKarats}
                    backfilling={backfillKarats.isPending}
                    updatedLabel={goldRatesQuery.data?.updatedAt ? new Date(goldRatesQuery.data.updatedAt).toLocaleString() : null}
                  />
                </div>
              ) : (
                <div className="border-t pt-2">
                  <div className="space-y-2">
                    <Label htmlFor="silverRate">Silver rate (₹ per gram)</Label>
                    <Input
                      id="silverRate"
                      type="text"
                      inputMode="decimal"
                      className="h-9 tabular-nums"
                      placeholder="e.g. 95"
                      value={silverInputText ?? (silverRatePerGram ? String(silverRatePerGram) : "")}
                      onChange={(e) => {
                        setSilverInputText(e.target.value)
                        const parsed = Number.parseFloat(e.target.value)
                        handleSaveSilverRate(Number.isFinite(parsed) ? Math.max(0, parsed) : 0)
                      }}
                      onBlur={() => setSilverInputText(null)}
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Shop-wide rate — auto-priced silver products re-price instantly.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Color</Label>
              <Select value={colorSelectValue} onValueChange={handleColorSelect}>
                <SelectTrigger className="h-9 w-full" aria-label="Color">
                  <SelectValue placeholder="Select a color" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">No color</SelectItem>
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
            <Label>Category</Label>
            <Select value={categorySelectValue} onValueChange={handleCategorySelect}>
              <SelectTrigger className="h-9 w-full" aria-label="Category">
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">No category</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
                <SelectItem value="__custom">
                  <span className="flex items-center gap-1.5">
                    <Plus className="h-3.5 w-3.5" /> New category…
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
            {categoryIsCustom && (
              <Input
                placeholder="Type a new category…"
                value={categoryValue}
                onChange={(e) => form.setValue("category", e.target.value, { shouldValidate: true })}
                className="h-9"
              />
            )}
            {form.formState.errors.category && (
              <p className="text-xs text-destructive">{form.formState.errors.category.message}</p>
            )}
            {productType === "Silver" && (
              <CategoryChips
                label="Silver sub-category"
                hint="Shown as “Silver · <name>” on pickers, labels and the products table."
                categories={categories}
                value={categoryValue}
                onSelect={(c) => {
                  setCustomCategory(false)
                  form.setValue("category", c, { shouldValidate: true })
                }}
              />
            )}
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
              {priceMode === "auto" && (productType === "Gold" || productType === "Silver") ? (
                <>
                  <Input
                    id="sellingPrice"
                    type="number"
                    disabled
                    className="tabular-nums"
                    value={metalPreview?.source === "auto" ? String(metalPreview.price) : String(watched.sellingPrice ?? 0)}
                    readOnly
                  />
                  <p className="text-[11px] text-muted-foreground">Calculated — weight × rate + labour.</p>
                </>
              ) : (
                <>
                  <Input id="sellingPrice" type="number" step="0.01" min={0} {...form.register("sellingPrice")} />
                  {form.formState.errors.sellingPrice && (
                    <p className="text-xs text-destructive">{form.formState.errors.sellingPrice.message}</p>
                  )}
                </>
              )}
            </div>
          </div>

          {margin && (
            <p className="text-xs text-muted-foreground">
              Profit margin: <span className="font-medium text-emerald-600 dark:text-emerald-400">{margin}%</span>{" "}
              (₹{((watched.sellingPrice ?? 0) - (watched.purchasePrice ?? 0)).toFixed(2)} per unit)
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
