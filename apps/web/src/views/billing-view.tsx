"use client"

import * as React from "react"
import { Plus, Save, Zap, FileText, X, Loader2, Trash2, Printer, Receipt, RefreshCw, Copy, FileDown, CheckCircle2 } from "lucide-react"
import { Button, Input, NumberInput, Label, Card, CardContent, Checkbox, Separator, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Badge, BillTemplateOptions, BillLinePricingStrip, EstimateColumnToggles, ProductSearchSelect, BarcodeLookupInput, PaymentMethodPicker, type BillLinePricingStripValue, type BillTemplate, type BillClassicColor, type BillMode } from "@munim/ui"
import { useCreateInvoice, useInvoice, useUpdateInvoice, type CreateInvoiceInput } from "@/hooks/use-invoices"
import { useParties } from "@/hooks/use-parties"
import { useSettings } from "@/hooks/use-settings"
import { useProducts, useSyncProductPrices } from "@/hooks/use-products"
import { useApiClient, useGoldRates } from "@munim/query"
import {
  applyGoldBaseRate,
  buildBillDocument,
  calcNetWeight,
  firstGoldKarat,
  invoicePricingFromBreakdown,
  isLabourType,
  priceBillLineRow,
  resolveGoldRateTable,
  weightTextToGrams,
  type BillDocument,
  type EstimateColumnId,
  type GoldRateKaratMode,
  type InvoiceDto,
  type PriceBreakdown,
} from "@munim/core"
import { generateBillPDF, type InvoiceFormValues } from "@munim/core"
import { useAppStore } from "@/store/view-store"
import { CameraScanButton } from "@/components/camera-scan-button"
import { formatCurrency } from "@/lib/format"
import { toast } from "@munim/ui"


type LineItem = {
  productId?: string
  productName: string
  sku?: string
  color?: string
  size?: string
  description: string
  weight?: number | null
  weightUnit?: "gm" | "mg"
  /** True once the shop edits this line's Weight — the edited weight then
   *  drives auto-pricing (and survives later rate reprices). */
  weightEdited?: boolean
  /** Metal purity stamp ("22K") — printed beside the name in parentheses. */
  purity?: string
  /** Gross-weight free text — bill G.Wt. column + gold's net-weight basis. */
  grossWeight?: string
  /** Bill line's nag-less weight in GRAMS (gold net-weight derivation input:
   *  net = gross − nag + chejat) — the printed Nag Wt. column. */
  nagLessWeight: string
  /** Bill line's chejat (stone) weight in GRAMS — the other derivation
   *  input + the printed Chejat Wt. column. */
  chejatWeight: string
  quantity: number
  price: number
  silverPercentage?: number
  /** Per-line pricing editor (auto gold/silver lines) — the values on the
   *  bill's Rate/Labour/Nag/Povayi/Other columns. "" = the product's own
   *  value; an edited Rate sticks (`rateEdited`), otherwise it tracks the
   *  bill's rate. */
  ratePerGram: string
  rateEdited: boolean
  labourType: string
  labourValue: string
  nag: string
  povayi: string
  otherCharges: string
}

/** Empty per-line pricing editor state — every field at "product default". */
function emptyPricing() {
  return {
    ratePerGram: "",
    rateEdited: false,
    labourType: "",
    labourValue: "",
    nag: "",
    povayi: "",
    otherCharges: "",
  }
}

const emptyLine = (): LineItem => ({
  productName: "",
  description: "",
  quantity: 1,
  price: 0,
  nagLessWeight: "",
  chejatWeight: "",
  ...emptyPricing(),
})

/** Raw line text → number; "" / garbage → null (= "keep the product's input"). */
function parseLineNum(raw: string): number | null {
  const t = raw.trim()
  if (!t) return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

/** Grams → the line field's string form ("" when the product has no value). */
function gramsField(grams: number | null): string {
  return grams == null ? "" : String(grams)
}

/** Gold price basis from the line's OWN derivation inputs — NET grams via the
 *  shared `calcNetWeight` (net = gross − nag + chejat; the nag/chejat fields
 *  are grams). Null when gross isn't usable (or nets ≤ 0) → the caller falls
 *  back to an edited Weight, else the product's own basis. */
function goldNetGrams(line: LineItem): number | null {
  const net = calcNetWeight({
    grossWeight: line.grossWeight ?? "",
    nagLessWeight: line.nagLessWeight,
    chejatWeight: line.chejatWeight,
    weightUnit: line.weightUnit ?? "gm",
    nagUnit: "gm",
  })
  return net && net.grams > 0 ? net.grams : null
}

/** A stored invoice line back into the editor's line — the inverse of
 *  `lineItems`. A frozen rate stays "edited" so a later bill-rate change
 *  can't quietly rewrite what the customer was billed. */
function invoiceToLine(it: InvoiceDto["items"][number]): LineItem {
  const p = it.pricing
  const frozenRate = p?.ratePerGram != null
  return {
    productId: it.productId ?? undefined,
    productName: it.productName,
    sku: it.sku ?? undefined,
    color: it.color ?? undefined,
    size: it.size ?? undefined,
    description: it.description ?? "",
    weight: it.weight ?? null,
    weightUnit: it.weightUnit === "mg" ? "mg" : "gm",
    weightEdited: true,
    purity: it.purity ?? undefined,
    grossWeight: it.grossWeight ?? undefined,
    nagLessWeight: it.nagLessWeight != null ? String(it.nagLessWeight) : "",
    chejatWeight: it.chejatWeight != null ? String(it.chejatWeight) : "",
    quantity: it.quantity,
    price: it.price,
    silverPercentage: p?.silverPercentage != null ? p.silverPercentage : 100,
    ratePerGram: frozenRate ? String(p.ratePerGram) : "",
    rateEdited: frozenRate,
    labourType: p?.labourType ?? "",
    labourValue: p?.labourValue != null ? String(p.labourValue) : "",
    nag: p?.nag != null ? String(p.nag) : "",
    povayi: p?.povayi != null ? String(p.povayi) : "",
    otherCharges: p?.other != null ? String(p.other) : "",
  }
}

type PickableProduct = {
  id: string
  name: string
  sku: string | null
  color: string | null
  size: string | null
  weight?: number | null
  weightUnit?: string | null
  /** Free-text purity stamp ("22K", "916", "925"). */
  purity?: string | null
  /** Gross-weight free text from the product record (bill G.Wt. column). */
  grossWeight?: string | null
  type: string
  stock: number
  sellingPrice: number
  /** SQL-computed current price (auto gold — weightA-rate+making, else sellingPrice). */
  effectivePrice: number
  silverPercentage?: number
}

export function BillingView() {
  const setView = useAppStore((s) => s.setActiveView)
  const createInvoice = useCreateInvoice()
  const { data: settings } = useSettings()
  const { data: parties } = useParties()
  const { data: productData } = useProducts({ pageSize: 1000 })
  const { data: goldRates } = useGoldRates()
  const products = productData?.products ?? []
  const getClient = useApiClient()
  const goldBaseRate = goldRates?.baseRatePerGram ?? null

  const shop = settings ?? {
    shopName: "JEWELLERY WALA",
    shopAddress: "Jhalamand Circle, Jodhpur",
    shopPhones: ["8094681299", "9460343208"],
    shopEmail: "jewellerywalaonline@gmail.com",
  }

  const [customerName, setCustomerName] = React.useState("")
  const [customerPhone, setCustomerPhone] = React.useState("")
  const [customerAddress, setCustomerAddress] = React.useState("")
  const [partyId, setPartyId] = React.useState("")
  const [date, setDate] = React.useState(new Date().toISOString().slice(0, 10))
  const [items, setItems] = React.useState<LineItem[]>([emptyLine()])
  const [deliveryCharge, setDeliveryCharge] = React.useState(0)
  const [discount, setDiscount] = React.useState(0)
  const [materialReturnedWeight, setMaterialReturnedWeight] = React.useState("")
  const [materialReturnedValue, setMaterialReturnedValue] = React.useState(0)
  const [materialReturnedTitle, setMaterialReturnedTitle] = React.useState("")
  const [notes, setNotes] = React.useState("")
  const [amountPaid, setAmountPaid] = React.useState(0)
  const [template, setTemplate] = React.useState<BillTemplate>("ecommerce")
  const [classicColor, setClassicColor] = React.useState<BillClassicColor>("red")
  const [twoInOne, setTwoInOne] = React.useState(false)
  const [mode, setMode] = React.useState<BillMode>("duplicate")
  const [weightAfterName, setWeightAfterName] = React.useState(true)
  const [goldRateLine, setGoldRateLine] = React.useState(true)
  const [silverRateLine, setSilverRateLine] = React.useState(true)
  // Chejat/Nag direction marks — ON prints "Chejat: 0.100 +" / "Nag: 0.200 −".
  const [signSuffix, setSignSuffix] = React.useState(true)
  // Purity line under the gold rate row — shop base / this bill's product
  // karat / custom text / nothing (see GoldRateKaratMode).
  const [goldRateKaratMode, setGoldRateKaratMode] = React.useState<GoldRateKaratMode>("base")
  const [goldRateKaratText, setGoldRateKaratText] = React.useState("")
  // Estimate columns turned off on THIS bill (per metal) — saved with the
  // bill so reprints match what the shop chose to show.
  const [hiddenGold, setHiddenGold] = React.useState<EstimateColumnId[]>([])
  const [hiddenSilver, setHiddenSilver] = React.useState<EstimateColumnId[]>([])
  // How the advance is coming in — Cash / Online + optional reference note.
  const [paymentMethod, setPaymentMethod] = React.useState<string>("cash")
  const [paymentNote, setPaymentNote] = React.useState("")

  // Per-bill gold base ₹/g — prefilled with the shop's rate; editing it
  // re-prices every auto-priced gold line as you type (Phase 4b).
  const [goldRateInput, setGoldRateInput] = React.useState("")
  const goldRateTouched = React.useRef(false)
  React.useEffect(() => {
    if (goldBaseRate != null && !goldRateTouched.current) setGoldRateInput(String(goldBaseRate))
  }, [goldBaseRate])
  const parsedGoldRate = Number(goldRateInput)
  const billGoldRate =
    goldRateInput.trim() && Number.isFinite(parsedGoldRate) && parsedGoldRate > 0
      ? parsedGoldRate
      : goldBaseRate

  // Per-bill silver ₹/10g — prefilled from the shop's ₹/g rate (×10); editing
  // it re-prices every auto-priced silver line on THIS bill only (stored per-gram).
  const [silverRateInput, setSilverRateInput] = React.useState("")
  const silverRateTouched = React.useRef(false)
  const shopSilverPerGram = settings?.silverRatePerGram ?? 0
  const shopSilverPer10g = Math.round(shopSilverPerGram * 1000) / 100
  React.useEffect(() => {
    if (shopSilverPerGram > 0 && !silverRateTouched.current) setSilverRateInput(String(shopSilverPer10g))
  }, [shopSilverPerGram, shopSilverPer10g])
  const parsedSilver10g = Number(silverRateInput)
  // null until the user edits it — untouched bills keep each product's own rate.
  const billSilverRate: number | null = !silverRateTouched.current
    ? null
    : silverRateInput.trim() && Number.isFinite(parsedSilver10g) && parsedSilver10g > 0
      ? parsedSilver10g / 10
      : shopSilverPerGram

  // Second bill — only used in 2-in-1 "Separate" mode.
  const [secondCustomerName, setSecondCustomerName] = React.useState("")
  const [secondCustomerPhone, setSecondCustomerPhone] = React.useState("")
  const [secondCustomerAddress, setSecondCustomerAddress] = React.useState("")
  const [secondPartyId, setSecondPartyId] = React.useState("")
  const [secondItems, setSecondItems] = React.useState<LineItem[]>([emptyLine()])
  const [secondDeliveryCharge, setSecondDeliveryCharge] = React.useState(0)
  const [secondDiscount, setSecondDiscount] = React.useState(0)
  const [secondAmountPaid, setSecondAmountPaid] = React.useState(0)

  // ── EDIT MODE — `?view=billing&edit=<invoiceId>` ────────────────────────
  // The New Bill page IS the edit page: the same form, seeded with a stored
  // bill and PUT back on save (stock + payments are reconciled in core, the
  // invoice number and date are never touched).
  const [editId, setEditId] = React.useState<string | null>(() =>
    typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("edit"),
  )
  React.useEffect(() => {
    const read = () => setEditId(new URLSearchParams(window.location.search).get("edit"))
    window.addEventListener("popstate", read)
    return () => window.removeEventListener("popstate", read)
  }, [])
  const editing = editId != null
  /** Seeds exactly once per invoice — a background refetch must never wipe
   *  an in-progress edit. */
  const seededEditId = React.useRef<string | null>(null)

  const { data: editInvoice, isError: editLoadFailed } = useInvoice(editId)
  const updateInvoice = useUpdateInvoice()

  /** Drop `?edit=` from the URL (the editor is only entered from the list). */
  function clearEditParam() {
    if (typeof window === "undefined") return
    const url = new URL(window.location.href)
    if (!url.searchParams.has("edit")) return
    url.searchParams.delete("edit")
    window.history.pushState({}, "", url)
  }

  // "Separate" mode creates a SECOND invoice — that only makes sense when
  // creating. Editing works on one saved bill, so the 2-in-1 pairing is off.
  const distinct = !editing && twoInOne && mode === "distinct"

  // ── Creation options (user-selectable per bill run) ────────────────────
  // Auto-download the PDF right after saving; mark the invoice(s) fully paid
  // on creation (amountPaid = total → status PAID) instead of the Paid-now
  // field. Defaults: auto-save ON (the common case), mark-paid OFF.
  const [autoSavePdf, setAutoSavePdf] = React.useState(true)
  const [markPaid, setMarkPaid] = React.useState(false)

  // ── Recalculate prices: cart lines are refreshed inside handleRecalcPrices
  //    with a per-product fetch (auto prices are computed on read). ─────────
  const syncPrices = useSyncProductPrices()

  /** Pricing inputs for the bill's rate — the gold table re-based on `billGoldRate`. */
  const billPricingContext = React.useMemo(() => {
    const table = resolveGoldRateTable(goldRates?.rates ?? [])
    const overridden =
      billGoldRate != null ? applyGoldBaseRate(table, billGoldRate, goldRates?.baseKarat ?? null) : table
    const defaultLabour =
      (settings?.defaultLabourValue ?? 0) > 0
        ? { type: settings?.defaultLabourType ?? "PERCENT", value: settings?.defaultLabourValue ?? 0 }
        : null
    return {
      goldRateTable: overridden,
      silverRatePerGram: settings?.silverRatePerGram ?? 0,
      silverRateOverride: billSilverRate,
      defaultLabour,
    }
  }, [goldRates, billGoldRate, billSilverRate, settings])

  /** The line's live pricing breakdown — auto-priced Gold/Silver lines only,
   *  with the edited Rate/Labour/flat charges layered over the product. */
  function breakdownFor(it: LineItem): PriceBreakdown | null {
    if (!it.productId) return null
    const p = products.find((x) => x.id === it.productId)
    if (!p || p.priceMode !== "auto" || (p.type !== "Gold" && p.type !== "Silver")) return null
    // Gold prices on the DERIVED NET weight (gross − nag + chejat, grams);
    // silver keeps the plain edited-Weight basis. No net → legacy edited
    // weight → null (the product's own basis).
    let weight: number | null
    let weightUnit: "gm" | "mg"
    if (p.type === "Gold") {
      const net = goldNetGrams(it)
      weight = net ?? (it.weightEdited ? it.weight ?? null : null)
      weightUnit = net != null ? "gm" : it.weightUnit ?? "gm"
    } else {
      weight = it.weightEdited ? it.weight ?? null : null
      weightUnit = it.weightUnit ?? "gm"
    }
    return priceBillLineRow(
      p,
      billPricingContext,
      { weight, weightUnit },
      {
        ratePerGram: it.rateEdited ? parseLineNum(it.ratePerGram) : null,
        labourType: isLabourType(it.labourType) ? it.labourType : null,
        labourValue: parseLineNum(it.labourValue),
        nag: parseLineNum(it.nag),
        povayi: parseLineNum(it.povayi),
        otherCharges: parseLineNum(it.otherCharges),
        silverPercentage: it.silverPercentage ?? null,
      },
    )
  }

  /** Applies a breakdown to the line — price from the engine; an untouched
   *  Rate field tracks the bill/table rate (write-back), an edited one sticks. */
  function applyBreakdown(it: LineItem, breakdown: PriceBreakdown | null): LineItem {
    if (!breakdown) return it
    const next = { ...it, price: breakdown.price }
    if (!it.rateEdited && breakdown.source === "auto") next.ratePerGram = String(breakdown.ratePerGram)
    return next
  }

  /** Re-prices ONE auto-priced line with the bill's current rates. */
  function repriceLine(it: LineItem): LineItem {
    return applyBreakdown(it, breakdownFor(it))
  }

  /** Re-prices the auto-priced lines (optionally only one metal). */
  function repriceAll(prev: LineItem[], metal?: "Gold" | "Silver"): LineItem[] {
    return prev.map((it) => {
      if (metal) {
        const p = it.productId ? products.find((x) => x.id === it.productId) : undefined
        if (!p || p.type !== metal) return it
      }
      return applyBreakdown(it, breakdownFor(it))
    })
  }

  /** Editing a line's Weight re-prices that line (clearing it reverts to the
   *  product's own weight basis). */
  function makeWeightHandler(setter: React.Dispatch<React.SetStateAction<LineItem[]>>) {
    return (index: number, raw: string) => {
      setter((prev) =>
        prev.map((it, i) =>
          i === index
            ? repriceLine({ ...it, weight: raw === "" ? null : Number(raw), weightEdited: raw.trim() !== "" })
            : it,
        ),
      )
    }
  }

  /** Editing a line's weight-BASIS inputs (gold: G. Wt. / Nag / Chejat — they
   *  drive the derived net the price is computed on) re-prices that line. */
  function makeBasisHandler(setter: React.Dispatch<React.SetStateAction<LineItem[]>>) {
    return (index: number, patch: Partial<LineItem>) => {
      setter((prev) => prev.map((it, i) => (i === index ? repriceLine({ ...it, ...patch }) : it)))
    }
  }

  /** Per-line pricing edits (rate/labour/charges/silver %) — merge the patch,
   *  flip `rateEdited` for the Rate field, then re-price. */
  function handlePricingChange(
    setter: React.Dispatch<React.SetStateAction<LineItem[]>>,
    index: number,
    patch: Partial<BillLinePricingStripValue>,
  ) {
    const { silverPercentage, ...rest } = patch
    setter((prev) =>
      prev.map((it, i) => {
        if (i !== index) return it
        const merged: LineItem = {
          ...it,
          ...rest,
          ...(silverPercentage !== undefined ? { silverPercentage: Number(silverPercentage) || 100 } : {}),
        }
        if (patch.ratePerGram !== undefined) merged.rateEdited = patch.ratePerGram.trim() !== ""
        return repriceLine(merged)
      }),
    )
  }

  /** Pricing fields materialised when a product lands on a line — visible
   *  values the operator can edit ("" = the product's own). The rate comes
   *  from the live breakdown (bill rate applied); labour/charges from the
   *  product row itself. */
  function pricingDefaultsFor(
    provisional: LineItem,
  ): Pick<
    LineItem,
    "ratePerGram" | "rateEdited" | "labourType" | "labourValue" | "nag" | "povayi" | "otherCharges"
  > {
    const base = emptyPricing()
    const p = provisional.productId ? products.find((x) => x.id === provisional.productId) : undefined
    if (!p || p.priceMode !== "auto" || (p.type !== "Gold" && p.type !== "Silver")) return base
    const breakdown = breakdownFor(provisional)
    const rate =
      breakdown && breakdown.source === "auto"
        ? String(breakdown.ratePerGram)
        : p.type === "Gold" && p.goldRatePerGram > 0
          ? String(p.goldRatePerGram)
          : p.type === "Silver" && p.silverRatePerGram > 0
            ? String(p.silverRatePerGram)
            : ""
    return {
      ...base,
      ratePerGram: rate,
      labourType: p.labourType,
      labourValue: p.labourValue != null ? String(p.labourValue) : "",
      nag: p.nagRate != null ? String(p.nagRate) : "",
      povayi: p.povayiRate != null ? String(p.povayiRate) : "",
      otherCharges: p.otherCharges != null ? String(p.otherCharges) : "",
    }
  }

  /** The pricing strip's data for one line — metal + live breakdown
   *  (null → no strip: no product / manual price / non-metal). */
  function pricingViewFor(
    it: LineItem,
  ): { metal: "Gold" | "Silver"; breakdown: PriceBreakdown } | null {
    if (!it.productId) return null
    const p = products.find((x) => x.id === it.productId)
    if (!p || p.priceMode !== "auto" || (p.type !== "Gold" && p.type !== "Silver")) return null
    const breakdown = breakdownFor(it)
    if (!breakdown) return null
    return { metal: p.type, breakdown }
  }

  function handleGoldRateChange(value: string) {
    goldRateTouched.current = true
    setGoldRateInput(value)
    setItems((prev) => repriceAll(prev, "Gold"))
    setSecondItems((prev) => repriceAll(prev, "Gold"))
  }

  function handleSilverRateChange(value: string) {
    silverRateTouched.current = true
    setSilverRateInput(value)
    setItems((prev) => repriceAll(prev, "Silver"))
    setSecondItems((prev) => repriceAll(prev, "Silver"))
  }

  async function handleRecalcPrices() {
    try {
      const r = await syncPrices.mutateAsync()
      if (r.scanned === 0) {
        toast.info("No auto-priced products yet — nothing to recalculate")
      } else if (r.updated === 0) {
        toast.info("Prices already match the current rates")
      } else {
        toast.success(`Re-priced ${r.updated} of ${r.scanned} auto-priced product${r.scanned !== 1 ? "s" : ""}`)
      }
      // Refresh just the products actually on the bills — no full-catalog
      // scan. Detail caches were invalidated by the sync-prices call above.
      try {
        const api = await getClient()
        const ids = [...new Set([...items, ...secondItems].map((i) => i.productId).filter((id): id is string => !!id))]
        const rows = await Promise.all(ids.map((id) => api.products.get(id)))
        const priceOf = (id: string): number | null => {
          const row = rows.find((fresh) => fresh.id === id)
          return row ? row.effectivePrice : null
        }
        const refresh = (prev: LineItem[]): LineItem[] =>
          prev.map((it) => {
            if (!it.productId) return it
            const fresh = priceOf(it.productId)
            return fresh === null ? it : { ...it, price: fresh }
          })
        // Server rates land first, then the bill's own gold/silver rates (if
        // any) re-apply on top so edited rates are never clobbered.
        setItems((prev) => repriceAll(refresh(prev)))
        setSecondItems((prev) => repriceAll(refresh(prev)))
      } catch {
        // Best-effort: keep the current line prices if the refresh fails.
      }
    } catch (err) {
      toast.error("Recalculation failed", { description: err instanceof Error ? err.message : undefined })
    }
  }

  /** The line a picked product becomes — seeded from the product record (incl.
   *  the gold nag/chejat basis) with its editable pricing fields materialised,
   *  then priced with the bill's CURRENT rates. */
  type CatalogProduct = (typeof products)[number]
  function lineFromProduct(p: CatalogProduct): LineItem {
    const base: LineItem = {
      productId: p.id,
      productName: p.name,
      sku: p.sku ?? undefined,
      color: p.color ?? undefined,
      size: p.size ?? undefined,
      description: "",
      weight: p.weight ?? null,
      weightUnit: p.weightUnit === "mg" ? "mg" : "gm",
      weightEdited: false,
      purity: p.purity ?? undefined,
      grossWeight: p.grossWeight ?? undefined,
      nagLessWeight: gramsField(weightTextToGrams(p.nagLessWeight ?? null, p.nagUnit ?? null)),
      chejatWeight: gramsField(weightTextToGrams(p.chejatWeight ?? null, p.nagUnit ?? null)),
      quantity: 1,
      price: p.effectivePrice,
      silverPercentage: p.silverPercentage ?? 100,
      ...emptyPricing(),
    }
    // Materialise the editable pricing fields + re-price with the bill's
    // CURRENT rates (picking after a rate edit still lands the right price).
    return repriceLine({ ...base, ...pricingDefaultsFor(base) })
  }

  /**
   * Fast entry: a USB scanner types the code (or the user types an SKU) +
   * Enter → drop the product into the next empty line of the given bill
   * (price = its current effective price). Resolved by the API lookup, which
   * matches barcode OR SKU.
   */
  function handleBarcodeLookup(setter: React.Dispatch<React.SetStateAction<LineItem[]>>) {
    return async (code: string): Promise<unknown> => {
      const api = await getClient()
      const p = await api.products.byBarcode(code)
      if (p.stock <= 0) {
        toast.error(`${p.name} is out of stock`, { description: "Fix its stock in Products before billing it." })
        return null
      }
      const item = lineFromProduct(p)
      setter((prev) => {
        const idx = prev.findIndex((it) => !it.productName.trim())
        return idx >= 0 ? prev.map((it, i) => (i === idx ? item : it)) : [...prev, item]
      })
      toast.success(`Added ${p.name}`)
      return p
    }
  }

  const subtotal = items.reduce((s, it) => s + it.quantity * it.price, 0)
  const total = Math.max(0, subtotal + deliveryCharge - discount - materialReturnedValue)
  // "Mark as paid" wins over the Paid-now field — the bill is saved (and
  // printed) with its full total as paid, so it lands as PAID.
  const paid = markPaid ? total : Math.min(amountPaid, total)

  const secondSubtotal = secondItems.reduce((s, it) => s + it.quantity * it.price, 0)
  const secondTotal = Math.max(0, secondSubtotal + secondDeliveryCharge - secondDiscount)
  const secondPaid = markPaid ? secondTotal : Math.min(secondAmountPaid, secondTotal)

  function updateItem(index: number, patch: Partial<LineItem>) {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)))
  }

  function addItem() {
    setItems((prev) => [...prev, emptyLine()])
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index))
  }

  /** Picking from the product search — fills the first empty line (else
   *  appends) on whichever bill the picker belongs to. */
  function makePicker(setter: React.Dispatch<React.SetStateAction<LineItem[]>>) {
    return (productId: string) => {
      const p = products.find((x) => x.id === productId)
      if (!p) return
      const item = lineFromProduct(p)
      setter((prev) => {
        const idx = prev.findIndex((it) => !it.productName.trim())
        return idx >= 0 ? prev.map((it, i) => (i === idx ? item : it)) : [...prev, item]
      })
    }
  }

  // Typed against the create payload's own settings shape (the zod output
  // type) rather than the optional-fielded snapshot model — the payload
  // requires every key present.
  function buildSettings(): NonNullable<InvoiceFormValues["templateSettings"]> {
    return {
      template,
      classicColor,
      twoInOne,
      mode,
      weightAfterName,
      goldRateLine,
      silverRateLine,
      signSuffix,
      goldRateKaratMode,
      goldRateKaratText,
      hiddenColumns: { gold: hiddenGold, silver: hiddenSilver },
    }
  }

  /** Badge text for the gold-rate purity line — the form-side twin of core's
   *  `goldRateKaratLine`: off → nothing; custom → the operator's text;
   *  product → the first gold line's karat (the selected product's, resolved
   *  exactly like the printed bill resolves it); base → the shop base karat. */
  function rateKaratBadge(): string | null {
    if (goldRateKaratMode === "off") return null
    if (goldRateKaratMode === "custom") return goldRateKaratText.trim() || null
    if (goldRateKaratMode === "product") {
      const karat = firstGoldKarat(
        items
          .filter((it) => it.productName.trim())
          .map((it) => {
            const breakdown = it.productId ? breakdownFor(it) : null
            return { pricing: breakdown ? invoicePricingFromBreakdown(breakdown) : null, purity: it.purity ?? null }
          }),
      )
      return karat != null && karat > 0 ? `${karat}K` : null
    }
    return goldRates?.baseKarat && goldRates.baseKarat > 0 ? `Base ${goldRates.baseKarat}K` : null
  }

  /** Builds a SHARED BillDocument (core) — the same model desktop & mobile render. */
  function buildBill(opts: {
    customerName: string
    customerPhone: string
    customerAddress: string
    items: LineItem[]
    deliveryCharge: number
    discount: number
    amountPaid: number
    materialReturnedWeight?: string
    materialReturnedValue?: number
    materialReturnedTitle?: string
  }): BillDocument {
    return buildBillDocument({
      billNo: "NEW",
      date,
      customerName: opts.customerName,
      customerPhone: opts.customerPhone,
      customerAddress: opts.customerAddress,
      shop: {
        name: shop.shopName,
        address: shop.shopAddress ?? null,
        phones: Array.isArray(shop.shopPhones) ? shop.shopPhones : [],
        email: shop.shopEmail ?? null,
      },
      lines: opts.items
        .filter((it) => it.productName.trim())
        .map((it) => {
          const isGold = it.productId ? products.find((x) => x.id === it.productId)?.type === "Gold" : false
          const net = isGold ? goldNetGrams(it) : null
          const breakdown = it.productId ? breakdownFor(it) : null
          return {
            productName: it.productName,
            description: it.description || undefined,
            sku: it.sku,
            color: it.color,
            size: it.size,
            // Gold prices on the derived NET weight — same figure the payload sends.
            weight: net ?? it.weight ?? null,
            weightUnit: net != null ? "gm" : it.weightUnit ?? null,
            purity: it.purity,
            grossWeight: it.grossWeight,
            nagLessWeight: isGold ? parseLineNum(it.nagLessWeight) : null,
            chejatWeight: isGold ? parseLineNum(it.chejatWeight) : null,
            pricing: breakdown ? invoicePricingFromBreakdown(breakdown) ?? undefined : undefined,
            quantity: it.quantity,
            price: it.price,
          }
        }),
      deliveryCharge: opts.deliveryCharge,
      discount: opts.discount,
      materialReturnedWeight: opts.materialReturnedWeight,
      materialReturnedValue: opts.materialReturnedValue,
      materialReturnedTitle: opts.materialReturnedTitle,
      amountPaid: opts.amountPaid,
      currency: "INR",
      goldRate: billGoldRate,
      // Purity of the quoted rate — printed as the "24K" suffix on the
      // gold rate row (shop's base karat; unset → no purity line).
      goldRateKarat: goldRates?.baseKarat ?? null,
      silverRate: billSilverRate ?? shopSilverPerGram ?? null,
    })
  }

  function buildFirstBill(): BillDocument {
    return buildBill({
      customerName,
      customerPhone,
      customerAddress,
      items,
      deliveryCharge,
      discount,
      amountPaid: paid,
      materialReturnedWeight: materialReturnedWeight || undefined,
      materialReturnedValue,
      materialReturnedTitle: materialReturnedTitle || undefined,
    })
  }

  function buildSecondBill(): BillDocument {
    return buildBill({
      customerName: secondCustomerName,
      customerPhone: secondCustomerPhone,
      customerAddress: secondCustomerAddress,
      items: secondItems,
      deliveryCharge: secondDeliveryCharge,
      discount: secondDiscount,
      amountPaid: secondPaid,
    })
  }

  /**
   * The bill's submit rows — written out explicitly so editor-only state never
   * leaks into the payload. Gold stores the DERIVED NET weight (what it was
   * priced on) plus its nag/chejat derivation inputs for their own columns;
   * `pricing` freezes the operator's rate/labour/charge edits so the printed
   * bill matches the screen (omitted → the server freezes its own).
   */
  function lineItems(list: LineItem[]) {
    return list
      .map((l) => {
        const breakdown = l.productId ? breakdownFor(l) : null
        const isGold = l.productId ? products.find((x) => x.id === l.productId)?.type === "Gold" : false
        const net = isGold ? goldNetGrams(l) : null
        return {
          productId: l.productId || undefined,
          productName: l.productName.trim(),
          sku: l.sku?.trim() || undefined,
          color: l.color?.trim() || undefined,
          size: l.size?.trim() || undefined,
          description: l.description.trim() || undefined,
          purity: l.purity?.trim() || undefined,
          grossWeight: l.grossWeight?.trim() || undefined,
          nagLessWeight: isGold ? parseLineNum(l.nagLessWeight) ?? undefined : undefined,
          chejatWeight: isGold ? parseLineNum(l.chejatWeight) ?? undefined : undefined,
          weight: net ?? l.weight ?? undefined,
          weightUnit: net != null ? "gm" : l.weight != null ? l.weightUnit ?? "gm" : undefined,
          quantity: l.quantity,
          price: l.price,
          pricing: breakdown ? invoicePricingFromBreakdown(breakdown) ?? undefined : undefined,
        }
      })
      .filter((it) => it.productName && it.quantity > 0)
  }

  /** Client-side mirror of the server guards: qty ≥ 1. */
  function validateBill(name: string, its: LineItem[], tot: number): string | null {
    if (!name.trim()) return "Customer name is required"
    if (!its.length) return "Add at least one line item"
    const badQty = its.findIndex((it) => !(it.quantity > 0))
    if (badQty >= 0) return `Item ${badQty + 1} needs a quantity of at least 1`
    return null
  }

  async function handleSaveAndPrint() {
    const bill1Items = items.filter((it) => it.productName.trim())
    const bill2Items = secondItems.filter((it) => it.productName.trim())
    const error = validateBill(customerName, bill1Items, total)
    if (error) {
      toast.error(error)
      return
    }
    if (distinct) {
      const secondError = validateBill(secondCustomerName, bill2Items, secondTotal)
      if (secondError) {
        toast.error(`Bill 2: ${secondError}`)
        return
      }
    }

    const basePayload = {
      customerPhone,
      customerAddress,
      date,
      notes,
      // How the advance came in — Cash / Online, plus the optional reference.
      paymentMethod,
      paymentNote: paymentNote.trim() || undefined,
      shopDetails: {
        name: shop.shopName,
        address: shop.shopAddress ?? "",
        phones: Array.isArray(shop.shopPhones) ? shop.shopPhones : [],
        email: shop.shopEmail ?? "",
      },
      templateSettings: buildSettings(),
      goldRate: billGoldRate ?? undefined,
      silverRate: billSilverRate ?? undefined,
    }

    const payload: CreateInvoiceInput = {
      ...basePayload,
      customerName,
      partyId: partyId && partyId !== "__none" ? partyId : undefined,
      items: lineItems(items),
      deliveryCharge,
      discount,
      materialReturnedWeight: materialReturnedWeight || undefined,
      materialReturnedValue,
      materialReturnedTitle: materialReturnedTitle || undefined,
      amountPaid: paid,
    }

    try {
      // ── EDIT: PUT the whole bill back. Core reconciles the per-product
      //    stock delta and the payment rows; the number never moves. ──
      if (editing && editInvoice) {
        const updated = await updateInvoice.mutateAsync({ id: editInvoice.id, values: payload })
        toast.success(`Bill ${updated.invoiceNumber} updated`, {
          description: "Stock and khata payments were reconciled to your changes.",
        })
        try {
          if (autoSavePdf) {
            const doc = buildFirstBill()
            doc.billNo = updated.invoiceNumber
            generateBillPDF(doc, buildSettings())
          }
        } catch (err) {
          toast.error("Bill updated, but the PDF could not be generated", {
            description: err instanceof Error ? err.message : undefined,
          })
        }
        // Stay in edit mode — the operator usually keeps tweaking.
        return
      }

      const invoice = await createInvoice.mutateAsync(payload)
      const bill = buildFirstBill()
      bill.billNo = invoice.invoiceNumber

      if (distinct) {
        const secondPayload: CreateInvoiceInput = {
          ...basePayload,
          customerName: secondCustomerName,
          partyId: secondPartyId && secondPartyId !== "__none" ? secondPartyId : undefined,
          items: lineItems(secondItems),
          deliveryCharge: secondDeliveryCharge,
          discount: secondDiscount,
          amountPaid: secondPaid,
        }
        const secondInvoice = await createInvoice.mutateAsync(secondPayload)
        const secondBill = buildSecondBill()
        secondBill.billNo = secondInvoice.invoiceNumber
        if (autoSavePdf) generateBillPDF(bill, buildSettings(), secondBill)
        toast.success("2 bills saved", { description: `${invoice.invoiceNumber} + ${secondInvoice.invoiceNumber}` })
      } else {
        if (autoSavePdf) generateBillPDF(bill, buildSettings())
        toast.success("Bill saved", { description: invoice.invoiceNumber })
      }

      reset()
      setView("invoices")
    } catch (err) {
      toast.error("Failed to save bill", { description: err instanceof Error ? err.message : "Unknown error" })
    }
  }

  function reset() {
    setCustomerName("")
    setCustomerPhone("")
    setCustomerAddress("")
    setPartyId("")
    setItems([emptyLine()])
    setDeliveryCharge(0)
    setDiscount(0)
    setMaterialReturnedWeight("")
    setMaterialReturnedValue(0)
    setMaterialReturnedTitle("")
    setNotes("")
    setAmountPaid(0)
    setSecondCustomerName("")
    setSecondCustomerPhone("")
    setSecondCustomerAddress("")
    setSecondPartyId("")
    setSecondItems([emptyLine()])
    setSecondDeliveryCharge(0)
    setSecondDiscount(0)
    setSecondAmountPaid(0)
    goldRateTouched.current = false
    setGoldRateInput(goldBaseRate != null ? String(goldBaseRate) : "")
    silverRateTouched.current = false
    setSilverRateInput(shopSilverPer10g > 0 ? String(shopSilverPer10g) : "")
  }

  /** EDIT MODE — a stored invoice back into every field on this form (the
   *  inverse of what `handleSaveAndPrint` submits). Bill 2 is always cleared:
   *  an edit updates exactly ONE invoice. */
  function seedFromInvoice(inv: InvoiceDto) {
    setCustomerName(inv.customerName ?? "")
    setCustomerPhone(inv.customerPhone ?? "")
    setCustomerAddress(inv.customerAddress ?? "")
    setPartyId(inv.partyId ?? "")
    setDate(inv.date.slice(0, 10))
    setNotes(inv.notes ?? "")
    setDiscount(inv.discount)
    setDeliveryCharge(inv.deliveryCharge)
    setMaterialReturnedWeight(inv.materialReturnedWeight ?? "")
    setMaterialReturnedValue(inv.materialReturnedValue)
    setMaterialReturnedTitle(inv.materialReturnedTitle ?? "")
    setAmountPaid(inv.amountPaid)
    setItems(inv.items.length ? inv.items.map(invoiceToLine) : [emptyLine()])

    // Never carry a previous run's 2-in-1 partner into an edit.
    setSecondCustomerName("")
    setSecondCustomerPhone("")
    setSecondCustomerAddress("")
    setSecondPartyId("")
    setSecondDiscount(0)
    setSecondDeliveryCharge(0)
    setSecondAmountPaid(0)
    setSecondItems([emptyLine()])

    const st = inv.templateSettings
    setTemplate(st?.template ?? "ecommerce")
    setClassicColor(st?.classicColor ?? "red")
    setTwoInOne(st?.twoInOne ?? false)
    setMode(st?.mode ?? "duplicate")
    setWeightAfterName(st?.weightAfterName ?? true)
    setGoldRateLine(st?.goldRateLine ?? true)
    setSilverRateLine(st?.silverRateLine ?? true)
    setSignSuffix(st?.signSuffix ?? true)
    setGoldRateKaratMode(st?.goldRateKaratMode ?? "base")
    setGoldRateKaratText(st?.goldRateKaratText ?? "")
    setHiddenGold(st?.hiddenColumns?.gold ?? [])
    setHiddenSilver(st?.hiddenColumns?.silver ?? [])

    // The bill's OWN rates beat the shop default — and are marked "touched"
    // so the two prefill effects above can't overwrite them later.
    if (inv.goldRate != null && inv.goldRate > 0) {
      setGoldRateInput(String(inv.goldRate))
      goldRateTouched.current = true
    }
    if (inv.silverRate != null && inv.silverRate > 0) {
      // Stored per-gram; the field shows ₹/10g (same conversion as the prefill).
      setSilverRateInput(String(Math.round(inv.silverRate * 1000) / 100))
      silverRateTouched.current = true
    }
  }

  // Load + seed once per invoice (never on a refetch — that would wipe the
  // operator's in-progress edits).
  React.useEffect(() => {
    if (!editing || !editInvoice || seededEditId.current === editInvoice.id) return
    seededEditId.current = editInvoice.id
    seedFromInvoice(editInvoice)
    // `seedFromInvoice` is a per-render closure over the setters — re-running
    // it on every render would loop, so the ref above is the source of truth.
  }, [editing, editInvoice])

  /** Back out of edit mode: clean form, no stale target, land on the list. */
  function cancelEdit() {
    seededEditId.current = null
    reset()
    clearEditParam()
    setView("invoices")
  }

  // A bill that no longer exists (deleted elsewhere, or a stale link) must not
  // leave the operator staring at a dead, disabled form.
  React.useEffect(() => {
    if (!editing || !editLoadFailed) return
    toast.error("That bill could not be loaded", {
      description: "It may have been deleted — open the bill list to pick another.",
    })
    seededEditId.current = null
    reset()
    clearEditParam()
    setView("invoices")
  }, [editing, editLoadFailed])

  // Navigating to a plain billing view (sidebar "New Bill", back button) must
  // leave the seeded bill behind.
  React.useEffect(() => {
    if (editing || seededEditId.current === null) return
    seededEditId.current = null
    reset()
  }, [editing])

  const rateKaratBadgeText = rateKaratBadge()

  return (
    <div className="space-y-4">
      {/* Header settings */}
      <Card>
        <CardContent className="space-y-4 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-semibold">{editing ? "Edit Bill" : "New Bill / Invoice"}</h2>
                <p className="text-xs text-muted-foreground">
                  {editing
                    ? `Editing ${editInvoice?.invoiceNumber ?? "…"} · ${shop.shopName}`
                    : `Template · ${shop.shopName}`}
                </p>
              </div>
            </div>
            <BillTemplateOptions
              template={template}
              classicColor={classicColor}
              twoInOne={twoInOne}
              mode={mode}
              weightAfterName={weightAfterName}
              goldRateLine={goldRateLine}
              silverRateLine={silverRateLine}
              signSuffix={signSuffix}
              goldRateKaratMode={goldRateKaratMode}
              goldRateKaratText={goldRateKaratText}
              onGoldRateKaratMode={(next) => {
                setGoldRateKaratMode(next)
                toast.success(`Karat line: ${next === "off" ? "hidden" : next === "base" ? "shop base" : next === "product" ? "product's karat" : "custom text"}`)
              }}
              onGoldRateKaratText={setGoldRateKaratText}
              onSignSuffix={(next) => {
                setSignSuffix(next)
                toast.success(next ? "Chejat/Nag signs shown" : "Chejat/Nag signs hidden")
              }}
              onWeightAfterName={(next) => {
                setWeightAfterName(next)
                toast.success(next ? "Weight column shown" : "Weight column hidden")
              }}
              onGoldRateLine={(next) => {
                setGoldRateLine(next)
                toast.success(next ? "Gold rate line shown" : "Gold rate line hidden")
              }}
              onSilverRateLine={(next) => {
                setSilverRateLine(next)
                toast.success(next ? "Silver rate line shown" : "Silver rate line hidden")
              }}
              onTemplate={(next) => {
                setTemplate(next)
                toast.success(next === "jewellery" ? "Classic Jewellery template" : "Modern E-commerce template", {
                  description: "Applied to this bill",
                })
              }}
              onClassicColor={(next) => {
                setClassicColor(next)
                toast.success(next === "red" ? "Red theme" : "Yellow theme", {
                  description: "Bill accent color updated",
                })
              }}
              onTwoInOne={(next) => {
                setTwoInOne(next)
                toast.success(next ? "2-in-1 bill enabled" : "2-in-1 bill disabled")
              }}
              onMode={(next) => {
                setMode(next)
                toast.success(next === "duplicate" ? "Duplicate mode" : "Separate mode", {
                  description: next === "duplicate" ? "Two identical bills on one page" : "Two different bills on one page",
                })
              }}
            />
          </div>

          {/* Estimate column visibility — same toggles desktop shows, so the
              printed grid can be trimmed per metal. */}
          <EstimateColumnToggles
            template={template}
            hiddenGold={hiddenGold}
            hiddenSilver={hiddenSilver}
            onToggle={(metal, column) => {
              const setter = metal === "gold" ? setHiddenGold : setHiddenSilver
              setter((prev) => (prev.includes(column) ? prev.filter((c) => c !== column) : [...prev, column]))
            }}
          />

          <Separator />

          {/* Bill to / details */}
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Bill To</p>
              <div className="space-y-2">
                <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Customer name" className="h-9" />
                <Input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="Phone" className="h-9" />
                <Input value={customerAddress} onChange={(e) => setCustomerAddress(e.target.value)} placeholder="Address" className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Link to khata party</Label>
                <Select value={partyId} onValueChange={(v) => {
                  setPartyId(v)
                  const p = parties?.find((x) => x.id === v)
                  if (p) {
                    setCustomerName(p.name)
                    if (p.phone) setCustomerPhone(p.phone)
                    if (p.address) setCustomerAddress(p.address)
                  }
                }}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="None (walk-in)" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">None (walk-in)</SelectItem>
                    {parties?.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Invoice Details</p>
              <div className="space-y-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">Date</Label>
                  <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-9" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Gold karat rate (₹/g)</Label>
                  <Input
                    type="number"
                    min={0}
                    step="any"
                    value={goldRateInput}
                    onChange={(e) => handleGoldRateChange(e.target.value)}
                    placeholder={goldBaseRate != null ? String(goldBaseRate) : "—"}
                    className="h-9"
                  />
                  <div className="flex items-center gap-2">
                    <p className="text-[11px] text-muted-foreground">Editing re-prices gold lines on this bill.</p>
                    {rateKaratBadgeText && (
                      <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary">
                        {rateKaratBadgeText}
                      </span>
                    )}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Silver rate (₹/10g)</Label>
                  <Input
                    type="number"
                    min={0}
                    step="any"
                    value={silverRateInput}
                    onChange={(e) => handleSilverRateChange(e.target.value)}
                    placeholder={shopSilverPer10g > 0 ? String(shopSilverPer10g) : "—"}
                    className="h-9"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    {billSilverRate != null ? `≈ ₹${billSilverRate.toFixed(2)}/g · ` : ""}
                    Editing re-prices silver lines on this bill.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">From {shop.shopName}</p>
              <div className="rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">
                <p className="font-medium text-foreground">{shop.shopName}</p>
                <p className="mt-1">{shop.shopAddress}</p>
                <p className="mt-1">Ph: {Array.isArray(shop.shopPhones) ? shop.shopPhones.join(" · ") : ""}</p>
                {shop.shopEmail && <p className="mt-1">{shop.shopEmail}</p>}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bill 1 line items */}
      <div className="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={handleRecalcPrices}
          disabled={syncPrices.isPending}
          className="h-9 gap-1.5"
        >
          <RefreshCw className={syncPrices.isPending ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
          {syncPrices.isPending ? "Recalculating…" : "Recalculate prices"}
        </Button>
      </div>
      <BillItemsCard
        title={distinct ? "Bill 1" : undefined}
        items={items}
        setItems={setItems}
        onWeightChange={makeWeightHandler(setItems)}
        onBasisChange={makeBasisHandler(setItems)}
        onPricingChange={(i, patch) => handlePricingChange(setItems, i, patch)}
        pricing={(i) => (items[i] ? pricingViewFor(items[i]) : null)}
        products={products}
        onPickProduct={makePicker(setItems)}
        onBarcodeLookup={handleBarcodeLookup(setItems)}
        charges={{
          delivery: deliveryCharge,
          discount,
          subtotal,
          total,
          onDelivery: setDeliveryCharge,
          onDiscount: setDiscount,
        }}
      />

      {/* Second bill — only when 2-in-1 "Separate" is selected */}
      {distinct && (
        <>
          <Card>
            <CardContent className="space-y-4 p-5">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Receipt className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-semibold">Second Bill — separate</h3>
                    <Badge variant="secondary">Bill 2</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    A different customer &amp; items; printed on the bottom half of the 2-in-1 page.
                  </p>
                </div>
              </div>
              <div className="grid gap-4 lg:grid-cols-3">
                <div className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Bill To</p>
                  <div className="space-y-2">
                    <Input value={secondCustomerName} onChange={(e) => setSecondCustomerName(e.target.value)} placeholder="Customer name" className="h-9" />
                    <Input value={secondCustomerPhone} onChange={(e) => setSecondCustomerPhone(e.target.value)} placeholder="Phone" className="h-9" />
                    <Input value={secondCustomerAddress} onChange={(e) => setSecondCustomerAddress(e.target.value)} placeholder="Address" className="h-9" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Link to khata party</Label>
                    <Select value={secondPartyId} onValueChange={(v) => {
                      setSecondPartyId(v)
                      const p = parties?.find((x) => x.id === v)
                      if (p) {
                        setSecondCustomerName(p.name)
                        if (p.phone) setSecondCustomerPhone(p.phone)
                        if (p.address) setSecondCustomerAddress(p.address)
                      }
                    }}>
                      <SelectTrigger className="h-9"><SelectValue placeholder="None (walk-in)" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none">None (walk-in)</SelectItem>
                        {parties?.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Payment</p>
                  <div className="space-y-2">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Amount paid now (₹)</Label>
                      <NumberInput min={0} value={secondAmountPaid} onValueChange={(v) => setSecondAmountPaid(v ?? 0)} className="h-9" />
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Summary</p>
                  <div className="rounded-lg border bg-muted/40 p-3 text-xs">
                    <Row label="Subtotal" value={formatCurrency(secondSubtotal)} />
                    {secondDeliveryCharge > 0 && <Row label="Delivery" value={formatCurrency(secondDeliveryCharge)} />}
                    {secondDiscount > 0 && <Row label="Discount" value={`−${formatCurrency(secondDiscount)}`} />}
                    <div className="mt-1.5 flex items-center justify-between border-t pt-1.5">
                      <span className="font-semibold">Total</span>
                      <span className="text-base font-bold tabular-nums">{formatCurrency(secondTotal)}</span>
                    </div>
                    {secondPaid > 0 && (
                      <p className="mt-1 text-muted-foreground">
                        Paying now: {formatCurrency(secondPaid)} · Balance: {formatCurrency(secondTotal - secondPaid)}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          <BillItemsCard
            title="Bill 2"
            items={secondItems}
            setItems={setSecondItems}
            onWeightChange={makeWeightHandler(setSecondItems)}
            onBasisChange={makeBasisHandler(setSecondItems)}
            onPricingChange={(i, patch) => handlePricingChange(setSecondItems, i, patch)}
            pricing={(i) => (secondItems[i] ? pricingViewFor(secondItems[i]) : null)}
            products={products}
            onPickProduct={makePicker(setSecondItems)}
            onBarcodeLookup={handleBarcodeLookup(setSecondItems)}
            charges={{
              delivery: secondDeliveryCharge,
              discount: secondDiscount,
              subtotal: secondSubtotal,
              total: secondTotal,
              onDelivery: setSecondDeliveryCharge,
              onDiscount: setSecondDiscount,
            }}
          />
        </>
      )}

      {/* Summary + actions */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardContent className="space-y-3 p-4">
            <Label className="text-xs">Notes / terms</Label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Thank you for your business!"
              rows={4}
              className="w-full resize-none rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring"
            />
            <div className="space-y-1.5">
              <Label className="text-xs">Material returned title</Label>
              <Input value={materialReturnedTitle} onChange={(e) => setMaterialReturnedTitle(e.target.value)} placeholder="Material Returned" className="h-9" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Material returned weight</Label>
                <Input value={materialReturnedWeight} onChange={(e) => setMaterialReturnedWeight(e.target.value)} placeholder="e.g. 5gm" className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Material returned value (₹)</Label>
                <NumberInput min={0} value={materialReturnedValue} onValueChange={(v) => setMaterialReturnedValue(v ?? 0)} className="h-9" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Amount paid now (₹)</Label>
              <NumberInput min={0} value={amountPaid} onValueChange={(v) => setAmountPaid(v ?? 0)} className="h-9" />
              {/* How the advance is coming in — printed on the invoice's
                  Payments trail (preset method or Custom + optional reference). */}
              <PaymentMethodPicker value={paymentMethod} onChange={setPaymentMethod} />
              <Input
                value={paymentNote}
                maxLength={120}
                onChange={(e) => setPaymentNote(e.target.value)}
                placeholder={paymentMethod === "online" || (paymentMethod && paymentMethod !== "cash") ? "UPI id / transaction no. (optional)" : "Note (optional)"}
                className="h-9"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-2.5 p-4">
            <Row label="Subtotal" value={formatCurrency(subtotal)} />
            {deliveryCharge > 0 && <Row label="Delivery" value={formatCurrency(deliveryCharge)} />}
            {discount > 0 && <Row label="Discount" value={`−${formatCurrency(discount)}`} />}
            {materialReturnedValue > 0 && (
              <Row
                label={`${materialReturnedTitle.trim() || "Material Returned"}${materialReturnedWeight ? ` (${materialReturnedWeight})` : ""}`}
                value={`−${formatCurrency(materialReturnedValue)}`}
              />
            )}
            <Separator />
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">Total</span>
              <span className="text-2xl font-bold tabular-nums">{formatCurrency(total)}</span>
            </div>
            {distinct && (
              <p className="text-xs text-muted-foreground">
                + Second bill total: <span className="font-semibold text-foreground">{formatCurrency(secondTotal)}</span>
              </p>
            )}
            {paid > 0 ? (
              <p className="text-xs text-muted-foreground">Paying now: {formatCurrency(paid)} · Balance: {formatCurrency(total - paid)}</p>
            ) : null}
            {/* Live paid/due strip — what the customer is handing over vs
                what they still owe on this bill. */}
            <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2 text-xs">
              <span className="text-muted-foreground">
                Paid <span className="font-semibold text-foreground tabular-nums">{formatCurrency(paid)}</span>
              </span>
              <span className="text-muted-foreground">
                Due <span className={`font-semibold tabular-nums ${total - paid > 0 ? "text-amber-600 dark:text-amber-400" : "text-foreground"}`}>{formatCurrency(Math.max(0, total - paid))}</span>
              </span>
            </div>

            {/* Creation options — auto-save the PDF and/or mark fully paid */}
            <div className="space-y-2 rounded-lg border bg-muted/40 p-2.5">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">On save</p>
              <label className="flex items-center gap-2.5 text-sm">
                <Checkbox
                  checked={autoSavePdf}
                  onCheckedChange={setAutoSavePdf}
                  aria-label="Auto-save the bill PDF after creating the invoice"
                />
                <FileDown className="text-muted-foreground h-4 w-4" />
                <span>Auto-save the PDF after {editing ? "saving" : "creating"}</span>
              </label>
              <label className="flex items-center gap-2.5 text-sm">
                <Checkbox
                  checked={markPaid}
                  onCheckedChange={setMarkPaid}
                  aria-label={
                    editing
                      ? "Set the full bill total as the paid amount"
                      : "Mark the invoice as fully paid on creation"
                  }
                />
                <CheckCircle2 className="text-muted-foreground h-4 w-4" />
                <span>
                  Mark as paid{" "}
                  <span className="text-muted-foreground">
                    {editing
                      ? `(paid becomes the full ${formatCurrency(total)} — the difference is recorded as a payment)`
                      : `(total ${formatCurrency(total)} received now${distinct ? ` · bill 2 ${formatCurrency(secondTotal)}` : ""})`}
                  </span>
                </span>
              </label>
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              {editing ? (
                <Button variant="outline" onClick={cancelEdit} className="gap-1.5">
                  <X className="h-4 w-4" /> Cancel
                </Button>
              ) : (
                <Button variant="outline" onClick={reset} className="gap-1.5">
                  <Trash2 className="h-4 w-4" /> Clear
                </Button>
              )}
              <Button
                variant="outline"
                onClick={() => {
                  const settings = buildSettings()
                  if (distinct) {
                    generateBillPDF(buildFirstBill(), settings, buildSecondBill())
                  } else {
                    generateBillPDF(buildFirstBill(), settings)
                  }
                }}
                className="gap-1.5"
              >
                <Printer className="h-4 w-4" /> Preview PDF
              </Button>
              <Button
                onClick={handleSaveAndPrint}
                className="ml-auto gap-1.5"
                disabled={
                  createInvoice.isPending ||
                  updateInvoice.isPending ||
                  (editing && !editInvoice)
                }
              >
                {createInvoice.isPending || updateInvoice.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Zap className="h-4 w-4" />
                )}
                {editing ? "Save changes" : "Save & Generate Bill"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

/**
 * Product picker + line-items table. Shared by Bill 1 and the second bill in
 * 2-in-1 "Separate" mode so both bills get the same editing experience.
 */
function BillItemsCard({
  title,
  items,
  setItems,
  onWeightChange,
  onBasisChange,
  onPricingChange,
  pricing,
  products,
  charges,
  onBarcodeLookup,
  onPickProduct,
}: {
  title?: string
  items: LineItem[]
  setItems: React.Dispatch<React.SetStateAction<LineItem[]>>
  /** Weight edits re-price the line (core engine) — passed down from BillingView. */
  onWeightChange?: (index: number, value: string) => void
  /** Weight-BASIS edits (gold G. Wt. / Nag / Chejat) re-price the line. */
  onBasisChange?: (index: number, patch: Partial<LineItem>) => void
  /** Per-line rate/labour/charge edits (the pricing strip). */
  onPricingChange?: (index: number, patch: Partial<BillLinePricingStripValue>) => void
  /** Live pricing view per line (metal + breakdown) — null → no strip. */
  pricing?: (index: number) => { metal: "Gold" | "Silver"; breakdown: PriceBreakdown } | null
  products: PickableProduct[]
  /** Optional USB-scanner fast entry — resolves on a hit, throws on a miss. */
  onBarcodeLookup?: (code: string) => Promise<unknown>
  /** Picking a product is owned by BillingView (it needs the FULL product
   *  record to materialise the line's editable pricing fields). */
  onPickProduct: (productId: string) => void
  /** Delivery + discount inputs and live totals — rendered below the rows. */
  charges?: {
    delivery: number
    discount: number
    subtotal: number
    total: number
    onDelivery: (n: number) => void
    onDiscount: (n: number) => void
  }
}) {
  function updateItem(index: number, patch: Partial<LineItem>) {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)))
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index))
  }

  return (
    <>
      {title && (
        <p className="px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </p>
      )}
      <Card>
        <CardContent className="p-4">
          <Label className="text-xs">Add from stock (auto-fills price & details)</Label>
          <div className="mt-1.5">
            <ProductSearchSelect
              products={products}
              disableOutOfStock
              placeholder="Search product…"
              onSelect={(p) => onPickProduct(p.id)}
            />
          </div>
          {onBarcodeLookup ? (
            <div className="mt-2 flex items-center gap-2">
              <BarcodeLookupInput
                onLookup={onBarcodeLookup}
                placeholder="Or scan barcode / type SKU to add…"
                className="flex-1"
              />
              {/* Camera scan — mobile's scan-to-bill on a phone/laptop camera. */}
              <CameraScanButton onDetected={onBarcodeLookup} label="Scan barcode to add an item" />
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="hidden grid-cols-[1fr_70px_110px_110px_40px] gap-3 border-b px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground sm:grid">
            <span>Product / description</span>
            <span className="text-center">Qty</span>
            <span className="text-center">Rate</span>
            <span className="text-right">Amount</span>
            <span />
          </div>
          <div className="divide-y">
            {items.map((item, idx) => {
              const isGold = item.productId
                ? products.find((p) => p.id === item.productId)?.type === "Gold"
                : false
              const view = pricing?.(idx) ?? null
              // Gold's price basis (net wt) — the derived grams, or the weight
              // the engine actually priced when a breakdown exists.
              const goldNet = isGold ? view?.breakdown.weightGm ?? goldNetGrams(item) : null
              return (
              <div key={idx} className="grid grid-cols-1 gap-2 px-4 py-3 sm:grid-cols-[1fr_70px_110px_110px_40px] sm:items-center">
                <div className="space-y-1.5">
                  <Input
                    value={item.productName}
                    onChange={(e) => updateItem(idx, { productName: e.target.value })}
                    placeholder="Product name"
                    className="h-9"
                  />
                  <Input
                    value={item.description}
                    onChange={(e) => updateItem(idx, { description: e.target.value })}
                    placeholder="Description (optional)"
                    className="h-8 text-xs"
                  />
                  <div className="flex gap-1.5">
                    <NumberInput
                      min={0}
                      value={item.weight}
                      onValueChange={(value) =>
                        onWeightChange
                          ? onWeightChange(idx, value == null ? "" : String(value))
                          : updateItem(idx, { weight: value })
                      }
                      placeholder="Weight"
                      className="h-8 text-xs"
                    />
                    <Input
                      value={item.purity ?? ""}
                      onChange={(e) => updateItem(idx, { purity: e.target.value })}
                      placeholder="Purity 22K"
                      className="h-8 w-24 text-xs"
                    />
                    <Input
                      value={item.grossWeight ?? ""}
                      onChange={(e) =>
                        onBasisChange
                          ? onBasisChange(idx, { grossWeight: e.target.value })
                          : updateItem(idx, { grossWeight: e.target.value })
                      }
                      placeholder="G. Wt."
                      className="h-8 w-24 text-xs"
                    />
                  </div>
                  {item.productId && item.sku && (
                    <div className="flex items-center gap-1.5">
                      <span className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                        {item.sku}
                      </span>
                      <button
                        type="button"
                        aria-label="Copy SKU"
                        onClick={() => item.sku && void navigator.clipboard.writeText(item.sku)}
                        className="inline-flex items-center gap-1 text-[10px] text-muted-foreground transition-colors hover:text-foreground">
                        <Copy className="h-3 w-3" /> Copy
                      </button>
                    </div>
                  )}
                  {isGold && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Input
                        type="number"
                        min={0}
                        step="any"
                        value={item.nagLessWeight}
                        onChange={(e) => onBasisChange?.(idx, { nagLessWeight: e.target.value })}
                        placeholder="Nag Wt."
                        className="h-8 w-24 text-xs"
                      />
                      <Input
                        type="number"
                        min={0}
                        step="any"
                        value={item.chejatWeight}
                        onChange={(e) => onBasisChange?.(idx, { chejatWeight: e.target.value })}
                        placeholder="Chejat Wt."
                        className="h-8 w-24 text-xs"
                      />
                      <Input
                        value={goldNet != null ? goldNet.toFixed(3) : ""}
                        readOnly
                        placeholder="Net wt"
                        className="bg-muted text-muted-foreground h-8 w-24 text-xs"
                        aria-label="Net weight (derived)"
                      />
                      <span className="text-[11px] text-muted-foreground">Net = G. Wt. − Nag + Chejat</span>
                    </div>
                  )}
                  {item.productId && (() => {
                    const selectedProduct = products.find(p => p.id === item.productId)
                    if (selectedProduct?.type !== "Silver") return null
                    return (
                      <div className="flex items-center gap-2">
                        <NumberInput
                          min={0}
                          max={100}
                          value={item.silverPercentage ?? 100}
                          onValueChange={(value) => updateItem(idx, { silverPercentage: value ?? 100 })}
                          className="h-8 w-20 text-xs"
                          placeholder="Silver %"
                        />
                        <span className="text-[11px] text-muted-foreground">
                          Silver % — {item.quantity}gm @ {item.silverPercentage ?? 100}% = {(item.quantity * (item.silverPercentage ?? 100) / 100).toFixed(1)}gm
                        </span>
                      </div>
                    )
                  })()}
                </div>
                <NumberInput
                  min={0}
                  value={item.quantity || null}
                  onValueChange={(value) => updateItem(idx, { quantity: value ?? 0 })}
                  className="h-9 text-center"
                />
                <NumberInput
                  min={0}
                  value={item.price || null}
                  onValueChange={(value) => updateItem(idx, { price: value ?? 0 })}
                  className="h-9 text-center"
                />
                <div className="flex items-center justify-between sm:justify-end">
                  <span className="text-sm font-semibold tabular-nums sm:hidden">Amount</span>
                  <span className="text-sm font-semibold tabular-nums">{formatCurrency(item.quantity * item.price)}</span>
                </div>
                <button
                  type="button"
                  onClick={() => removeItem(idx)}
                  className="justify-self-end text-muted-foreground transition-colors hover:text-destructive sm:justify-self-center"
                  aria-label="Remove item"
                >
                  <X className="h-4 w-4" />
                </button>
                {view && (
                  <div className="col-span-full">
                    <BillLinePricingStrip
                      metal={view.metal}
                      value={{
                        ratePerGram: item.ratePerGram,
                        labourType: item.labourType,
                        labourValue: item.labourValue,
                        silverPercentage: String(item.silverPercentage ?? 100),
                        nag: item.nag,
                        povayi: item.povayi,
                        otherCharges: item.otherCharges,
                      }}
                      effectiveLabourType={view.breakdown.labour.type ?? undefined}
                      effectiveRatePerGram={
                        view.breakdown.source === "auto" ? String(view.breakdown.ratePerGram) : undefined
                      }
                      effectiveLabourValue={
                        item.labourValue === "" &&
                        view.breakdown.source === "auto" &&
                        view.breakdown.labour.value > 0
                          ? String(view.breakdown.labour.value)
                          : undefined
                      }
                      metalValue={view.breakdown.metalValue ?? null}
                      labourAmount={view.breakdown.labour.amount ?? null}
                      otherChargesTotal={
                        // Matches the bill's Other Charges column: nag + povayi
                        // + other summed there, shown here the same way.
                        view.breakdown.charges.nag +
                        view.breakdown.charges.povayi +
                        view.breakdown.charges.other
                      }
                      autoPricing={view.breakdown.source === "auto"}
                      onChange={(patch) => onPricingChange?.(idx, patch)}
                    />
                  </div>
                )}
              </div>
              )
            })}
          </div>
          <div className="border-t p-3">
            <Button variant="outline" size="sm" onClick={() => setItems((prev) => [...prev, emptyLine()])} className="gap-1.5">
              <Plus className="h-4 w-4" /> Add line item
            </Button>
            {charges && (
              <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
                <div className="space-y-1.5">
                  <Label className="text-xs">Delivery charge (₹)</Label>
                  <NumberInput min={0} value={charges.delivery} onValueChange={(v) => charges!.onDelivery(v ?? 0)} className="h-9" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Discount (₹)</Label>
                  <NumberInput min={0} value={charges.discount} onValueChange={(v) => charges!.onDiscount(v ?? 0)} className="h-9" />
                </div>
                <div className="bg-muted/40 min-w-48 rounded-lg border p-2.5 text-xs">
                  <Row label="Subtotal" value={formatCurrency(charges.subtotal)} />
                  {charges.delivery > 0 && <Row label="Delivery" value={`+${formatCurrency(charges.delivery)}`} />}
                  {charges.discount > 0 && <Row label="Discount" value={`−${formatCurrency(charges.discount)}`} />}
                  <div className="mt-1 flex items-center justify-between border-t pt-1">
                    <span className="font-semibold">Total</span>
                    <span className="text-sm font-bold tabular-nums">{formatCurrency(charges.total)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  )
}

