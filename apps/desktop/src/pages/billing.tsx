import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Plus, Trash2, Download, Loader2, FileDown, CheckCircle2, RefreshCw, Copy } from "lucide-react";
import {
  applyGoldBaseRate,
  buildBillDocument,
  invoicePricingFromBreakdown,
  isLabourType,
  priceBillLineRow,
  productMatchesCode,
  resolveGoldRateTable,
  type BillDocument,
  type BillShopDetails,
  type PriceBreakdown,
  type PricingContext,
  type ProductDto,
} from "@munim/core";
import type { InvoiceDto, SettingsDto } from "@munim/api-client";
import {
  useSettings,
  useProducts,
  useParties,
  useCreateInvoice,
  useRecordInvoicePayment,
  useSyncProductPrices,
  useApiClient,
  useQueryState,
  useGoldRates,
} from "@munim/query";
import { money } from "@/lib/format";
import { downloadBillPdf } from "@/lib/billPdf";
import { toast } from "@munim/ui";
import { PageHeader } from "@/components/page-header";
import {
  Button,
  Input,
  Label,
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Checkbox,
  BarcodeLookupInput,
  ProductSearchSelect,
  BillLinePricingStrip,
  type BillLinePricingStripValue,
  type ProductOption,
  BillTemplateOptions,
  type BillTemplate,
  type BillClassicColor,
  type BillMode,
} from "@munim/ui";

type LineState = {
  productId: string;
  productName: string;
  sku: string;
  color: string;
  size: string;
  description: string;
  weight: string;
  weightUnit: "gm" | "mg";
  /** True once the shop edits this line's Weight — the edited weight then
   *  drives auto-pricing (and survives later rate reprices). */
  weightEdited: boolean;
  /** Metal purity stamp ("22K") — printed beside the name in parentheses. */
  purity: string;
  /** Gross-weight free text — bill G.Wt. column. */
  grossWeight: string;
  quantity: string;
  price: string;
  silverPercentage: string;
  /** Per-line pricing editor (auto gold/silver lines) — the values on the
   *  bill's Rate/Labour/Nag/Povayi/Other columns. Empty = product default;
   *  an edited Rate sticks (`rateEdited`), otherwise it tracks the bill rate. */
  ratePerGram: string;
  rateEdited: boolean;
  labourType: string;
  labourValue: string;
  nag: string;
  povayi: string;
  otherCharges: string;
};

function emptyLine(): LineState {
  return { productId: "", productName: "", sku: "", color: "", size: "", description: "", weight: "", weightUnit: "gm", weightEdited: false, purity: "", grossWeight: "", quantity: "1", price: "0", silverPercentage: "100", ratePerGram: "", rateEdited: false, labourType: "", labourValue: "", nag: "", povayi: "", otherCharges: "" };
}

/** Raw line text → number; "" / garbage → null (= "keep the product's input"). */
function parseLineNum(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function settingsToShop(s: SettingsDto): BillShopDetails {
  return {
    name: s.shopName,
    address: s.shopAddress,
    phones: Array.isArray(s.shopPhones) ? s.shopPhones : [],
    email: s.shopEmail,
  };
}

function toInvoiceShop(s: BillShopDetails): { name: string; address: string; phones: string[]; email: string } {
  return { name: s.name, address: s.address ?? "", phones: s.phones, email: s.email ?? "" };
}

function invoiceToBillDocument(
  inv: InvoiceDto,
  shop: BillShopDetails,
  currency: string,
  rates?: { gold?: number | null; silver?: number | null },
): BillDocument {
  return buildBillDocument({
    billNo: inv.invoiceNumber,
    date: inv.date,
    customerName: inv.customerName,
    customerPhone: inv.customerPhone,
    customerAddress: inv.customerAddress,
    shop,
    lines: inv.items.map((it) => ({
      productName: it.productName,
      description: it.description,
      sku: it.sku,
      color: it.color,
      size: it.size,
      weight: it.weight,
      weightUnit: it.weightUnit,
      purity: it.purity,
      grossWeight: it.grossWeight,
      pricing: it.pricing,
      quantity: it.quantity,
      price: it.price,
    })),
    discount: inv.discount,
    deliveryCharge: inv.deliveryCharge,
    materialReturnedWeight: inv.materialReturnedWeight,
    materialReturnedValue: inv.materialReturnedValue,
    materialReturnedTitle: inv.materialReturnedTitle,
    amountPaid: inv.amountPaid,
    status: inv.status,
    currency,
    goldRate: inv.goldRate ?? rates?.gold ?? null,
    silverRate: inv.silverRate ?? rates?.silver ?? null,
  });
}

export function BillingPage() {
  const { data: settings } = useQueryState(useSettings());
  const { data: goldRates } = useQueryState(useGoldRates());
  const billRates = { gold: goldRates?.baseRatePerGram ?? null, silver: settings?.silverRatePerGram ?? null };
  const { data: allProductsData } = useQueryState(useProducts({ pageSize: 1000 }));
  const allProducts = allProductsData?.products;
  const { data: parties } = useQueryState(useParties());
  // const { data: list, loading: loadingList } = useQueryState(useInvoices({ pageSize: 100 }));
  const createInvoice = useCreateInvoice();

  // ── Bill 1 ──────────────────────────────────────────────────────────────
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [partyId, setPartyId] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [discount, setDiscount] = useState("0");
  const [deliveryCharge, setDeliveryCharge] = useState("0");
  const [materialReturnedWeight, setMaterialReturnedWeight] = useState("");
  const [materialReturnedValue, setMaterialReturnedValue] = useState("0");
  const [materialReturnedTitle, setMaterialReturnedTitle] = useState("");
  const [amountPaid, setAmountPaid] = useState("0");
  const [lines, setLines] = useState<LineState[]>([emptyLine()]);

  // ── Template options (shared with web — bill-template-options) ─────────
  const [template, setTemplate] = useState<BillTemplate>("ecommerce");
  const [classicColor, setClassicColor] = useState<BillClassicColor>("red");
  const [twoInOne, setTwoInOne] = useState(false);
  const [mode, setMode] = useState<BillMode>("duplicate");
  const [weightAfterName, setWeightAfterName] = useState(true);
  const [goldRateLine, setGoldRateLine] = useState(true);
  const [silverRateLine, setSilverRateLine] = useState(true);

  // Per-bill gold base ₹/g — prefilled with the shop's rate; editing it
  // re-prices every auto-priced gold line as you type (Phase 4b).
  const [goldRateInput, setGoldRateInput] = useState("");
  const goldRateTouched = useRef(false);
  useEffect(() => {
    if (goldRates?.baseRatePerGram != null && !goldRateTouched.current) {
      setGoldRateInput(String(goldRates.baseRatePerGram));
    }
  }, [goldRates?.baseRatePerGram]);
  const parsedGoldRate = Number(goldRateInput);
  const goldBaseRate = goldRates?.baseRatePerGram ?? null;
  const billGoldRate =
    goldRateInput.trim() && Number.isFinite(parsedGoldRate) && parsedGoldRate > 0
      ? parsedGoldRate
      : goldBaseRate;

  // Per-bill silver ₹/10g — prefilled from the shop's ₹/g rate (×10); editing
  // it re-prices every auto-priced silver line on THIS bill only (stored per-gram).
  const [silverRateInput, setSilverRateInput] = useState("");
  const [silverTouched, setSilverTouched] = useState(false);
  const shopSilverPerGram = settings?.silverRatePerGram ?? 0;
  const shopSilverPer10g = Math.round(shopSilverPerGram * 1000) / 100;
  useEffect(() => {
    if (shopSilverPerGram > 0 && !silverTouched) setSilverRateInput(String(shopSilverPer10g));
  }, [shopSilverPerGram, shopSilverPer10g, silverTouched]);
  const parsedSilver10g = Number(silverRateInput);
  // null until the user edits it — untouched bills keep each product's own rate.
  const billSilverRate: number | null = !silverTouched
    ? null
    : silverRateInput.trim() && Number.isFinite(parsedSilver10g) && parsedSilver10g > 0
      ? parsedSilver10g / 10
      : shopSilverPerGram;

  // ── Second bill — only used in 2-in-1 "Separate" mode ─────────────────
  const [secondCustomerName, setSecondCustomerName] = useState("");
  const [secondCustomerPhone, setSecondCustomerPhone] = useState("");
  const [secondCustomerAddress, setSecondCustomerAddress] = useState("");
  const [secondPartyId, setSecondPartyId] = useState("");
  const [secondDiscount, setSecondDiscount] = useState("0");
  const [secondDeliveryCharge, setSecondDeliveryCharge] = useState("0");
  const [secondAmountPaid, setSecondAmountPaid] = useState("0");
  const [secondLines, setSecondLines] = useState<LineState[]>([emptyLine()]);

  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);

  // ── Recalculate prices: refresh every product-backed line once the
  //    invalidated product list lands (auto prices are computed on read). ──
  const syncPrices = useSyncProductPrices();
  const getClient = useApiClient();
  const [awaitingFreshPrices, setAwaitingFreshPrices] = useState(false);

  /** Pricing inputs for the bill — the gold table re-based on `billGoldRate`. */
  const billPricingContext = useMemo(() => {
    const table = resolveGoldRateTable(goldRates?.rates ?? []);
    const overridden =
      billGoldRate != null ? applyGoldBaseRate(table, billGoldRate, goldRates?.baseKarat ?? null) : table;
    const defaultLabour =
      (settings?.defaultLabourValue ?? 0) > 0
        ? { type: settings?.defaultLabourType ?? "PERCENT", value: settings?.defaultLabourValue ?? 0 }
        : null;
    return {
      goldRateTable: overridden,
      silverRatePerGram: settings?.silverRatePerGram ?? 0,
      silverRateOverride: billSilverRate,
      defaultLabour,
    };
  }, [goldRates, billGoldRate, billSilverRate, settings]);

  /** Core breakdown for ONE line under a given bill context — the edited
   *  weight/rate/labour/charges included; null when the line isn't an
   *  auto-priced gold/silver product. */
  const breakdownFor = useCallback(
    (line: LineState, context: PricingContext): PriceBreakdown | null => {
      if (!line.productId) return null;
      const p = allProducts?.find((x) => x.id === line.productId);
      if (!p || p.priceMode !== "auto" || (p.type !== "Gold" && p.type !== "Silver")) return null;
      const weight = line.weightEdited ? parseLineNum(line.weight) : null;
      return priceBillLineRow(
        p,
        context,
        { weight, weightUnit: line.weightUnit },
        {
          ratePerGram: line.rateEdited ? parseLineNum(line.ratePerGram) : null,
          labourType: isLabourType(line.labourType) ? line.labourType : null,
          labourValue: parseLineNum(line.labourValue),
          nag: parseLineNum(line.nag),
          povayi: parseLineNum(line.povayi),
          otherCharges: parseLineNum(line.otherCharges),
          silverPercentage: parseLineNum(line.silverPercentage),
        },
      );
    },
    [allProducts],
  );

  /** Applies a breakdown to the line — price from the engine; an untouched
   *  Rate field tracks the bill/table rate (write-back), an edited one sticks. */
  function applyBreakdown(line: LineState, breakdown: PriceBreakdown | null): LineState {
    if (!breakdown) return line;
    const next = { ...line, price: String(breakdown.price) };
    if (!line.rateEdited && breakdown.source === "auto") next.ratePerGram = String(breakdown.ratePerGram);
    return next;
  }

  const lineBreakdown = useCallback(
    (line: LineState): PriceBreakdown | null => breakdownFor(line, billPricingContext),
    [breakdownFor, billPricingContext],
  );

  /** Re-prices ONE line with the bill's current rates. */
  const repriceLine = useCallback(
    (line: LineState): LineState => applyBreakdown(line, breakdownFor(line, billPricingContext)),
    [breakdownFor, billPricingContext],
  );

  /** Editing a line's Weight re-prices that line (clearing it reverts to the
   *  product's own weight basis). */
  function makeWeightHandler(setter: (updater: (prev: LineState[]) => LineState[]) => void) {
    return (index: number, raw: string) => {
      setter((prev) =>
        prev.map((l, i) => (i === index ? repriceLine({ ...l, weight: raw, weightEdited: raw.trim() !== "" }) : l)),
      );
    };
  }

  /** Per-line pricing edits (rate/labour/charges/silver %) — merge the patch,
   *  flip `rateEdited` for the Rate field, then re-price. */
  function handlePricingChange(
    setter: (updater: (prev: LineState[]) => LineState[]) => void,
    index: number,
    patch: Partial<LineState>,
  ) {
    setter((prev) =>
      prev.map((l, i) => {
        if (i !== index) return l;
        const merged = { ...l, ...patch };
        if (patch.ratePerGram !== undefined) merged.rateEdited = patch.ratePerGram.trim() !== "";
        return repriceLine(merged);
      }),
    );
  }

  /** Re-prices the auto-priced lines (optionally only one metal). */
  const repriceAll = useCallback(
    (prev: LineState[], metal?: "Gold" | "Silver"): LineState[] =>
      prev.map((line) => {
        if (metal) {
          const p = allProducts?.find((x) => x.id === line.productId);
          if (!p || p.type !== metal) return line;
        }
        return applyBreakdown(line, breakdownFor(line, billPricingContext));
      }),
    [allProducts, breakdownFor, billPricingContext],
  );

  /** Pricing fields materialised when a product lands on a line — visible
   *  values the operator can edit (empty = product default). The rate comes
   *  from the live breakdown (bill rate applied); labour/charges from the
   *  product row itself. */
  function pricingDefaultsFor(
    provisional: LineState,
    full?: ProductDto,
  ): Pick<
    LineState,
    "ratePerGram" | "rateEdited" | "labourType" | "labourValue" | "nag" | "povayi" | "otherCharges"
  > {
    const product =
      full ?? (provisional.productId ? allProducts?.find((x) => x.id === provisional.productId) : undefined);
    const base = {
      ratePerGram: "",
      rateEdited: false,
      labourType: "",
      labourValue: "",
      nag: "",
      povayi: "",
      otherCharges: "",
    };
    if (!product || product.priceMode !== "auto" || (product.type !== "Gold" && product.type !== "Silver"))
      return base;
    const breakdown = lineBreakdown(provisional);
    const rate =
      breakdown && breakdown.source === "auto"
        ? String(breakdown.ratePerGram)
        : product.type === "Gold" && product.goldRatePerGram > 0
          ? String(product.goldRatePerGram)
          : product.type === "Silver" && product.silverRatePerGram > 0
            ? String(product.silverRatePerGram)
            : "";
    return {
      ...base,
      ratePerGram: rate,
      labourType: product.labourType,
      labourValue: product.labourValue != null ? String(product.labourValue) : "",
      nag: product.nagRate ?? "",
      povayi: product.povayiRate != null ? String(product.povayiRate) : "",
      otherCharges: product.otherCharges != null ? String(product.otherCharges) : "",
    };
  }

  /** The pricing strip's data for one line — metal + live breakdown
   *  (null → no strip: no product / manual price / non-metal). */
  function pricingViewFor(
    line: LineState,
  ): { metal: "Gold" | "Silver"; breakdown: PriceBreakdown } | null {
    if (!line.productId) return null;
    const p = allProducts?.find((x) => x.id === line.productId);
    if (!p || p.priceMode !== "auto" || (p.type !== "Gold" && p.type !== "Silver")) return null;
    const breakdown = lineBreakdown(line);
    if (!breakdown) return null;
    return { metal: p.type, breakdown };
  }

  /** Bill context with the gold base replaced by the field's live value. The
   *  rate inputs reprice inside their own setState updater — a context memo
   *  would still hold the previous keystroke's rate at that point. */
  function goldContextFor(raw: string): PricingContext {
    const parsed = Number(raw);
    const rate = raw.trim() && Number.isFinite(parsed) && parsed > 0 ? parsed : goldBaseRate;
    const table = resolveGoldRateTable(goldRates?.rates ?? []);
    return {
      ...billPricingContext,
      goldRateTable:
        rate != null ? applyGoldBaseRate(table, rate, goldRates?.baseKarat ?? null) : table,
    };
  }

  /** Same for the silver ₹/10g field (stored per-gram). */
  function silverContextFor(raw: string): PricingContext {
    const parsed10g = Number(raw);
    const perGram =
      raw.trim() && Number.isFinite(parsed10g) && parsed10g > 0 ? parsed10g / 10 : shopSilverPerGram;
    return { ...billPricingContext, silverRateOverride: perGram };
  }

  /** Re-prices one metal's lines under an explicitly built context (used by
   *  the bill-rate inputs, whose new rate isn't in the memo yet). */
  function repriceMetalWith(
    prev: LineState[],
    metal: "Gold" | "Silver",
    context: PricingContext,
  ): LineState[] {
    return prev.map((line) => {
      if (!line.productId) return line;
      const p = allProducts?.find((x) => x.id === line.productId);
      if (!p || p.type !== metal || p.priceMode !== "auto") return line;
      return applyBreakdown(line, breakdownFor(line, context));
    });
  }

  function handleGoldRateChange(value: string) {
    goldRateTouched.current = true;
    setGoldRateInput(value);
    setLines((prev) => repriceMetalWith(prev, "Gold", goldContextFor(value)));
    setSecondLines((prev) => repriceMetalWith(prev, "Gold", goldContextFor(value)));
  }

  function handleSilverRateChange(value: string) {
    setSilverTouched(true);
    setSilverRateInput(value);
    setLines((prev) => repriceMetalWith(prev, "Silver", silverContextFor(value)));
    setSecondLines((prev) => repriceMetalWith(prev, "Silver", silverContextFor(value)));
  }

  useEffect(() => {
    if (!awaitingFreshPrices || !allProducts) return;
    const priceOf = (id: string): string | null => {
      const row = allProducts.find((p) => p.id === id);
      return row ? String(row.effectivePrice) : null;
    };
    const refresh = (prev: LineState[]): LineState[] =>
      prev.map((line) => {
        if (!line.productId) return line;
        const fresh = priceOf(line.productId);
        return fresh === null ? line : { ...line, price: fresh };
      });
    // Server prices land first, then every auto line re-prices with the
    // bill's rates + this line's own rate/labour/charge edits on top.
    setLines((prev) => repriceAll(refresh(prev)));
    setSecondLines((prev) => repriceAll(refresh(prev)));
    setAwaitingFreshPrices(false);
  }, [awaitingFreshPrices, allProducts, repriceAll]);

  async function handleRecalcPrices() {
    try {
      const r = await syncPrices.mutateAsync();
      if (r.scanned === 0) {
        toast.info("No auto-priced products yet — nothing to recalculate");
      } else if (r.updated === 0) {
        toast.info("Prices already match the current rates");
      } else {
        toast.success(`Re-priced ${r.updated} of ${r.scanned} auto-priced product${r.scanned !== 1 ? "s" : ""}`);
      }
      setAwaitingFreshPrices(true);
    } catch (err) {
      toast.error("Recalculation failed", { description: err instanceof Error ? err.message : undefined });
    }
  }

  /**
   * Fast entry: a USB scanner types the code (or the user types an SKU) +
   * Enter, this drops the product into the next empty line (price = its
   * current effective price). Local match first (instant, works from the
   * already-fetched list, same barcode-or-SKU rule as core
   * `findProductByCode`), API lookup as a fallback for codes outside the
   * loaded page.
   */
  async function handleBarcodeAdd(code: string, target: "first" | "second" = "first"): Promise<unknown> {
    let row = allProducts?.find((p) => productMatchesCode(p, code)) ?? null;
    if (!row) {
      const api = await getClient();
      row = await api.products.byBarcode(code);
    }
    const found = row;
    if (found.stock <= 0) {
      toast.error(`${found.name} is out of stock`, { description: "Fix its stock in Products before billing it." });
      return null;
    }
    const apply = target === "second" ? setSecondLines : setLines;
    apply((prev) => {
      const base: LineState = {
        ...emptyLine(),
        productId: found.id,
        productName: found.name,
        sku: found.sku ?? "",
        color: found.color ?? "",
        size: found.size ?? "",
        weight: found.weight != null ? String(found.weight) : "",
        weightUnit: found.weightUnit === "mg" ? ("mg" as const) : ("gm" as const),
        purity: found.purity ?? "",
        grossWeight: found.grossWeight ?? "",
        price: String(found.effectivePrice),
        silverPercentage: String(found.silverPercentage ?? 100),
      };
      // Materialise the editable pricing fields + re-price with the bill's
      // CURRENT rates (picking after a rate edit still lands the right price).
      const line = repriceLine({ ...base, ...pricingDefaultsFor(base, found) });
      const idx = prev.findIndex((l) => !l.productId && !l.productName.trim());
      return idx >= 0 ? prev.map((l, i) => (i === idx ? line : l)) : [...prev, line];
    });
    toast.success(`Added ${found.name}`);
    return found;
  }

  const [preview, setPreview] = useState<BillDocument | null>(null);
  const [secondPreview, setSecondPreview] = useState<BillDocument | null>(null);

  // ── Creation options (user-selectable per bill run) ────────────────────
  // Auto-download the PDF right after saving; mark the invoice(s) fully paid
  // on creation (amountPaid = total → status PAID) instead of the Paid-now
  // field. Defaults: auto-save ON (the common case), mark-paid OFF.
  const [autoSavePdf, setAutoSavePdf] = useState(true);
  const [markPaid, setMarkPaid] = useState(false);

  const [payingInvoice, setPayingInvoice] = useState<InvoiceDto | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [recordingPayment, setRecordingPayment] = useState(false);
  const recordPayment = useRecordInvoicePayment(payingInvoice?.id ?? "");

  const distinct = twoInOne && mode === "distinct";

  const subtotal = useMemo(
    () => lines.reduce((sum, l) => sum + (Number(l.quantity) || 0) * (Number(l.price) || 0), 0),
    [lines],
  );
  const total = Math.max(0, subtotal - (Number(discount) || 0) - (Number(materialReturnedValue) || 0) + (Number(deliveryCharge) || 0));
  const secondSubtotal = useMemo(
    () => secondLines.reduce((sum, l) => sum + (Number(l.quantity) || 0) * (Number(l.price) || 0), 0),
    [secondLines],
  );
  const secondTotal = Math.max(0, secondSubtotal - (Number(secondDiscount) || 0) + (Number(secondDeliveryCharge) || 0));
  const shop = settings ? settingsToShop(settings) : null;

  function updateLine(index: number, patch: Partial<LineState>) {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  }

  function updateSecondLine(index: number, patch: Partial<LineState>) {
    setSecondLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  }

  function pickProduct(index: number, p: ProductOption, target: "first" | "second" = "first") {
    const full = allProducts?.find((x) => x.id === p.id);
    const base: LineState = {
      ...emptyLine(),
      productId: p.id,
      productName: p.name,
      sku: p.sku ?? "",
      color: p.color ?? "",
      size: p.size ?? "",
      weight: p.weight != null ? String(p.weight) : "",
      weightUnit: p.weightUnit === "mg" ? ("mg" as const) : ("gm" as const),
      weightEdited: false,
      purity: p.purity ?? "",
      grossWeight: p.grossWeight ?? "",
      price: String(p.effectivePrice ?? p.sellingPrice),
      silverPercentage: String(p.silverPercentage ?? 100),
    };
    // Materialise the editable pricing fields + re-price with the bill's
    // CURRENT rates (picking after a rate edit still lands the right price).
    const line = repriceLine({ ...base, ...pricingDefaultsFor(base, full) });
    if (target === "second") updateSecondLine(index, line);
    else updateLine(index, line);
  }

  function lineItems(list: LineState[]) {
    return list
      .map((l) => {
        // The edited line's snapshot (rate/labour/povayi) so the printed bill
        // matches the screen; omitted → server freezes from the product.
        const breakdown = l.productId ? lineBreakdown(l) : null;
        return {
          productId: l.productId || undefined,
          productName: l.productName.trim(),
          sku: l.sku.trim() || undefined,
          color: l.color.trim() || undefined,
          size: l.size.trim() || undefined,
          description: l.description.trim() || undefined,
          weight: l.weight.trim() ? Number(l.weight) : undefined,
          weightUnit: l.weight.trim() ? l.weightUnit : undefined,
          purity: l.purity.trim() || undefined,
          grossWeight: l.grossWeight.trim() || undefined,
          quantity: Number(l.quantity) || 0,
          price: Number(l.price) || 0,
          pricing: breakdown ? invoicePricingFromBreakdown(breakdown) ?? undefined : undefined,
        };
      })
      .filter((it) => it.productName && it.quantity > 0);
  }

  function resetForm() {
    setCustomerName("");
    setCustomerPhone("");
    setCustomerAddress("");
    setPartyId("");
    setDiscount("0");
    setDeliveryCharge("0");
    setMaterialReturnedWeight("");
    setMaterialReturnedValue("0");
    setMaterialReturnedTitle("");
    setAmountPaid("0");
    setLines([emptyLine()]);
    setSecondCustomerName("");
    setSecondCustomerPhone("");
    setSecondCustomerAddress("");
    setSecondPartyId("");
    setSecondDiscount("0");
    setSecondDeliveryCharge("0");
    setSecondAmountPaid("0");
    setSecondLines([emptyLine()]);
    setPreview(null);
    setSecondPreview(null);
    goldRateTouched.current = false;
    setGoldRateInput(goldBaseRate != null ? String(goldBaseRate) : "");
    setSilverTouched(false);
    setSilverRateInput(shopSilverPer10g > 0 ? String(shopSilverPer10g) : "");
  }

  async function handleCreate() {
    const items = lineItems(lines);
    if (items.length === 0) {
      toast.error("Add at least one line item");
      return;
    }
    if (distinct && lineItems(secondLines).length === 0) {
      toast.error("Add at least one line item to the second bill");
      return;
    }
    if (!customerName.trim()) {
      toast.error("Customer name is required");
      return;
    }
    if (distinct && !secondCustomerName.trim()) {
      toast.error("Second bill customer name is required");
      return;
    }
    if (distinct) {
      const secondItems = lineItems(secondLines);
      if (secondItems.length === 0) {
        toast.error("Bill 2 needs at least one line item");
        return;
      }
    }

    setSaving(true);
    try {
      const base = {
        date,
        notes: notes.trim() || undefined,
        paymentMethod: "cash" as const,
        shopDetails: shop ? toInvoiceShop(shop) : undefined,
        templateSettings: { template, classicColor, twoInOne, mode, weightAfterName, goldRateLine, silverRateLine },
        goldRate: billGoldRate ?? undefined,
        silverRate: billSilverRate ?? undefined,
      };
      const invoice = await createInvoice.mutateAsync({
        ...base,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim() || undefined,
        customerAddress: customerAddress.trim() || undefined,
        partyId: partyId && partyId !== "__none" ? partyId : undefined,
        items,
        discount: Number(discount) || 0,
        deliveryCharge: Number(deliveryCharge) || 0,
        materialReturnedWeight: materialReturnedWeight.trim() || undefined,
        materialReturnedValue: Number(materialReturnedValue) || 0,
        materialReturnedTitle: materialReturnedTitle.trim() || undefined,
        // "Mark as paid" wins over the Paid-now field — the invoice is saved
        // with its full total as paid, so it lands as PAID (not UNPAID).
        amountPaid: markPaid ? total : Number(amountPaid) || 0,
      });

      const shopForPreview: BillShopDetails = invoice.shopDetails
        ? { name: invoice.shopDetails.name, address: invoice.shopDetails.address, phones: invoice.shopDetails.phones, email: invoice.shopDetails.email }
        : shop ?? { name: "My Shop", address: null, phones: [], email: null };
      const doc = invoiceToBillDocument(invoice, shopForPreview, settings?.currency ?? "INR", billRates);
      setPreview(doc);

      let secondInvoice: InvoiceDto | null = null;
      if (distinct) {
        try {
          secondInvoice = await createInvoice.mutateAsync({
            ...base,
            customerName: secondCustomerName.trim(),
            customerPhone: secondCustomerPhone.trim() || undefined,
            customerAddress: secondCustomerAddress.trim() || undefined,
            partyId: secondPartyId && secondPartyId !== "__none" ? secondPartyId : undefined,
            items: lineItems(secondLines),
            discount: Number(secondDiscount) || 0,
            deliveryCharge: Number(secondDeliveryCharge) || 0,
            materialReturnedWeight: undefined,
            materialReturnedValue: 0,
            amountPaid: markPaid ? secondTotal : Number(secondAmountPaid) || 0,
          });
          if (secondInvoice) {
            setSecondPreview(invoiceToBillDocument(secondInvoice, shopForPreview, settings?.currency ?? "INR", billRates));
          }
        } catch (err) {
          // First bill was already saved — surface the partial result clearly.
          toast.error(`Bill 1 (${invoice.invoiceNumber}) saved, but Bill 2 failed`,
            { description: err instanceof Error ? err.message : undefined });
          resetForm();
          return;
        }
      }

      toast.success(
        distinct && secondInvoice
          ? `2 bills saved — ${invoice.invoiceNumber} + ${secondInvoice.invoiceNumber}`
          : `Invoice ${invoice.invoiceNumber} created`,
      );

      // Auto-save the PDF right after the invoice lands (same shared
      // renderer as the preview's Download button).
      if (autoSavePdf) {
        try {
          await downloadBillPdf(doc, {
            template,
            twoInOne,
            mode,
            secondBill: distinct ? secondPreview ?? undefined : undefined,
            classicColor,
            weightAfterName,
            goldRateLine,
            silverRateLine,
          });
        } catch (err) {
          toast.error("Bill saved, but the PDF could not be generated", {
            description: err instanceof Error ? err.message : undefined,
          });
        }
      }

      resetForm();
    } catch (err) {
      toast.error("Failed to create invoice", { description: err instanceof Error ? err.message : undefined });
    } finally {
      setSaving(false);
    }
  }

  async function exportBill(doc: BillDocument) {
    setExporting(true);
    try {
      await downloadBillPdf(doc, {
        template,
        twoInOne,
        mode,
        secondBill: secondPreview ?? undefined,
        classicColor,
        weightAfterName,
        goldRateLine,
        silverRateLine,
      });
      toast.success("PDF downloaded");
    } catch (err) {
      toast.error("Could not generate PDF", { description: err instanceof Error ? err.message : undefined });
    } finally {
      setExporting(false);
    }
  }

  async function handleRecordPayment() {
    if (!payingInvoice) return;
    const amount = Number(payAmount);
    if (!amount || amount <= 0) {
      toast.error("Enter a positive amount");
      return;
    }
    setRecordingPayment(true);
    try {
      await recordPayment.mutateAsync({ amount, method: "cash" });
      toast.success("Payment recorded");
      setPayingInvoice(null);
      setPayAmount("");
    } catch (err) {
      toast.error("Payment failed", { description: err instanceof Error ? err.message : undefined });
    } finally {
      setRecordingPayment(false);
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="New Bill"
        badge="Billing"
        subtitle="Create invoices with the same shared bill engine as web & mobile — jewellery or e-commerce templates, 2-in-1 supported."
      />
      <div className="grid gap-5 xl:grid-cols-3">
        <div className="space-y-5 xl:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Bill details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <BillTemplateOptions
                    template={template}
                    classicColor={classicColor}
                    twoInOne={twoInOne}
                    mode={mode}
                    weightAfterName={weightAfterName}
                    goldRateLine={goldRateLine}
                    silverRateLine={silverRateLine}
                    onWeightAfterName={(next) => {
                      setWeightAfterName(next);
                      toast.success(next ? "Weight column shown" : "Weight column hidden");
                    }}
                    onGoldRateLine={(next) => {
                      setGoldRateLine(next);
                      toast.success(next ? "Gold rate line shown" : "Gold rate line hidden");
                    }}
                    onSilverRateLine={(next) => {
                      setSilverRateLine(next);
                      toast.success(next ? "Silver rate line shown" : "Silver rate line hidden");
                    }}
                    onTemplate={(next) => {
                      setTemplate(next);
                      toast.success(next === "jewellery" ? "Classic Jewellery template" : "Modern E-commerce template");
                    }}
                    onClassicColor={(next) => {
                      setClassicColor(next);
                      toast.success(next === "red" ? "Red theme" : "Yellow theme", { description: "Bill accent color updated" });
                    }}
                    onTwoInOne={(next) => {
                      setTwoInOne(next);
                      toast.success(next ? "2-in-1 bill enabled" : "2-in-1 bill disabled");
                    }}
                    onMode={(next) => {
                      setMode(next);
                      toast.success(next === "duplicate" ? "Duplicate mode" : "Separate mode", {
                        description: next === "duplicate" ? "Two identical bills on one page" : "Two different bills on one page",
                      });
                    }}
                  />

                  <CustomerFields
                    name={customerName}
                    phone={customerPhone}
                    address={customerAddress}
                    partyId={partyId}
                    parties={parties}
                    onName={setCustomerName}
                    onPhone={setCustomerPhone}
                    onAddress={setCustomerAddress}
                    onParty={setPartyId}
                    idPrefix="b"
                  />

                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="b-date">Date</Label>
                      <Input id="b-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="b-gold-rate">Gold karat rate (₹/g)</Label>
                      <Input
                        id="b-gold-rate"
                        type="number"
                        min={0}
                        step="any"
                        value={goldRateInput}
                        onChange={(e) => handleGoldRateChange(e.target.value)}
                        placeholder={goldBaseRate != null ? String(goldBaseRate) : "—"}
                      />
                      <p className="text-muted-foreground text-[11px]">Editing re-prices gold lines on this bill.</p>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="b-silver-rate">Silver rate (₹/10g)</Label>
                      <Input
                        id="b-silver-rate"
                        type="number"
                        min={0}
                        step="any"
                        value={silverRateInput}
                        onChange={(e) => handleSilverRateChange(e.target.value)}
                        placeholder={shopSilverPer10g > 0 ? String(shopSilverPer10g) : "—"}
                      />
                      <p className="text-muted-foreground text-[11px]">
                        {billSilverRate != null ? `≈ ₹${billSilverRate.toFixed(2)}/g · ` : ""}Editing re-prices silver lines on this bill.
                      </p>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="b-notes">Notes / terms</Label>
                      <Input id="b-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Thank you for your business!" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-sm">Items</CardTitle>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleRecalcPrices}
                      disabled={syncPrices.isPending}
                      className="h-7 gap-1 px-2 text-[11px]"
                    >
                      <RefreshCw className={syncPrices.isPending ? "h-3 w-3 animate-spin" : "h-3 w-3"} />
                      {syncPrices.isPending ? "Recalculating…" : "Recalculate prices"}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Fast entry — scan barcode or type SKU</Label>
                    <BarcodeLookupInput
                      onLookup={handleBarcodeAdd}
                      placeholder="Scan barcode or type SKU…"
                      className="sm:max-w-[320px]"
                    />
                  </div>
                  <LineItemsEditor
                    lines={lines}
                    allProducts={allProducts}
                    update={updateLine}
                    onWeightChange={makeWeightHandler(setLines)}
                    onPricingChange={(i, patch) => handlePricingChange(setLines, i, patch)}
                    pricing={(i) => (lines[i] ? pricingViewFor(lines[i]) : null)}
                    remove={(i) => setLines((prev) => prev.filter((_, x) => x !== i))}
                    add={() => setLines((prev) => [...prev, emptyLine()])}
                    pick={(i, p) => pickProduct(i, p, "first")}
                  />
                  <SeparatorLine />
                  <AdjustmentFields
                    discount={discount}
                    delivery={deliveryCharge}
                    paid={amountPaid}
                    onDiscount={setDiscount}
                    onDelivery={setDeliveryCharge}
                    onPaid={setAmountPaid}
                    idPrefix="b"
                  />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
          <Label htmlFor="b-mr-title">Material returned title</Label>
          <Input id="b-mr-title" value={materialReturnedTitle} onChange={(e) => setMaterialReturnedTitle(e.target.value)} placeholder="Material Returned" />
          <Label htmlFor="b-mr-weight">Material returned weight</Label>
          <Input id="b-mr-weight" value={materialReturnedWeight} onChange={(e) => setMaterialReturnedWeight(e.target.value)} placeholder="e.g. 5gm" />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="b-mr-value">Material returned value (₹)</Label>
                      <Input id="b-mr-value" type="number" min={0} value={materialReturnedValue} onChange={(e) => setMaterialReturnedValue(e.target.value)} />
                    </div>
                  </div>
                  <TotalsSummary
                    subtotal={subtotal}
                    discount={Number(discount) || 0}
                    delivery={Number(deliveryCharge) || 0}
                    total={total}
                    paid={Number(amountPaid) || 0}
                  />
                </CardContent>
              </Card>

              {distinct && (
                <Card className="border-primary/30">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-sm">
                      Second Bill — separate <Badge variant="secondary">Bill 2</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <CustomerFields
                      name={secondCustomerName}
                      phone={secondCustomerPhone}
                      address={secondCustomerAddress}
                      partyId={secondPartyId}
                      parties={parties}
                      onName={setSecondCustomerName}
                      onPhone={setSecondCustomerPhone}
                      onAddress={setSecondCustomerAddress}
                      onParty={setSecondPartyId}
                      idPrefix="sb"
                    />
                    <div className="space-y-1.5">
                      <Label className="text-xs">Fast entry — scan barcode or type SKU</Label>
                      <BarcodeLookupInput
                        onLookup={(c) => handleBarcodeAdd(c, "second")}
                        placeholder="Scan barcode or type SKU…"
                        className="sm:max-w-[320px]"
                      />
                    </div>
                    <LineItemsEditor
                      lines={secondLines}
                      allProducts={allProducts}
                      update={updateSecondLine}
                      onWeightChange={makeWeightHandler(setSecondLines)}
                      onPricingChange={(i, patch) => handlePricingChange(setSecondLines, i, patch)}
                      pricing={(i) => (secondLines[i] ? pricingViewFor(secondLines[i]) : null)}
                      remove={(i) => setSecondLines((prev) => prev.filter((_, x) => x !== i))}
                      add={() => setSecondLines((prev) => [...prev, emptyLine()])}
                      pick={(i, p) => pickProduct(i, p, "second")}
                    />
                    <SeparatorLine />
                    <AdjustmentFields
                      discount={secondDiscount}
                      delivery={secondDeliveryCharge}
                      paid={secondAmountPaid}
                      onDiscount={setSecondDiscount}
                      onDelivery={setSecondDeliveryCharge}
                      onPaid={setSecondAmountPaid}
                      idPrefix="sb"
                    />
                    <TotalsSummary
                      subtotal={secondSubtotal}
                      discount={Number(secondDiscount) || 0}
                      delivery={Number(secondDeliveryCharge) || 0}
                      total={secondTotal}
                      paid={Number(secondAmountPaid) || 0}
                    />
                  </CardContent>
                </Card>
              )}

              {/* Creation options — auto-save the PDF and/or mark fully paid */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">On save</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <label className="flex items-center gap-2.5 text-sm">
                    <Checkbox
                      checked={autoSavePdf}
                      onCheckedChange={setAutoSavePdf}
                      aria-label="Auto-save the bill PDF after creating the invoice"
                    />
                    <FileDown className="text-muted-foreground h-4 w-4" />
                    <span>Auto-save the PDF after creating</span>
                  </label>
                  <label className="flex items-center gap-2.5 text-sm">
                    <Checkbox
                      checked={markPaid}
                      onCheckedChange={setMarkPaid}
                      aria-label="Mark the invoice as fully paid on creation"
                    />
                    <CheckCircle2 className="text-muted-foreground h-4 w-4" />
                    <span>
                      Mark as paid{' '}
                      <span className="text-muted-foreground">
                        (total {money(total)} received now{distinct ? ` · bill 2 ${money(secondTotal)}` : ""})
                      </span>
                    </span>
                  </label>
                </CardContent>
              </Card>

              <Button className="w-full" onClick={handleCreate} disabled={saving}>
                {saving ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Saving…</> : `Create invoice — ${money(total)}${distinct ? ` + ${money(secondTotal)}` : ""}`}
              </Button>
            </div>

            <Card className="h-fit">
              <CardHeader>
                <CardTitle className="text-sm">Bill preview</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {preview ? (
                  <>
                    <div className="rounded-lg border p-3 text-sm">
                      <p className="font-semibold">{preview.shop.name}</p>
                      <p className="text-muted-foreground">{preview.billNo} · {preview.date}</p>
                      <p className="text-muted-foreground">{preview.customerName ?? "Walk-in Customer"}</p>
                      <SeparatorLine />
                      {preview.lines.map((l, i) => (
                        <p key={i} className="flex justify-between text-xs">
                          <span className="truncate pr-2">{l.quantity} × {l.productName}</span>
                          <span>{money(l.total)}</span>
                        </p>
                      ))}
                      <SeparatorLine />
                      <p className="flex justify-between"><span className="text-muted-foreground">Total</span><span className="font-bold">{money(preview.total)}</span></p>
                      <p className="mt-2 text-xs italic text-muted-foreground">{preview.amountInWords}</p>
                    </div>
                    {secondPreview && distinct && (
                      <div className="rounded-lg border border-primary/30 p-3 text-sm">
                        <p className="font-semibold">Bill 2 — {secondPreview.billNo}</p>
                        <p className="text-muted-foreground">{secondPreview.customerName ?? "Walk-in Customer"}</p>
                        <SeparatorLine />
                        {secondPreview.lines.map((l, i) => (
                          <p key={i} className="flex justify-between text-xs">
                            <span className="truncate pr-2">{l.quantity} × {l.productName}</span>
                            <span>{money(l.total)}</span>
                          </p>
                        ))}
                        <SeparatorLine />
                        <p className="flex justify-between"><span className="text-muted-foreground">Total</span><span className="font-bold">{money(secondPreview.total)}</span></p>
                      </div>
                    )}
                    <Button className="w-full" onClick={() => exportBill(preview)} disabled={exporting}>
                      <Download className="h-4 w-4" /> {exporting ? "Generating…" : twoInOne ? "Download 2-in-1 PDF" : "Download PDF"}
                    </Button>
                  </>
                ) : (
                  <p className="text-muted-foreground text-sm">Create a bill to see the shared preview here.</p>
                )}
              </CardContent>
            </Card>
        </div>

      <Dialog open={payingInvoice !== null} onOpenChange={(open) => !open && setPayingInvoice(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Record payment — {payingInvoice?.invoiceNumber}</DialogTitle>
            <DialogDescription>
              Outstanding: {payingInvoice ? money(payingInvoice.total - payingInvoice.amountPaid) : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="pay-amount">Amount</Label>
            <Input id="pay-amount" type="number" min={0} value={payAmount} onChange={(e) => setPayAmount(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayingInvoice(null)}>Cancel</Button>
            <Button onClick={handleRecordPayment} disabled={recordingPayment}>
              {recordingPayment ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Recording…</> : "Record payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

type PartyOption = { id: string; name: string; phone: string | null; address: string | null };

/** Customer identity fields — always first in the flow. */
function CustomerFields({
  name,
  phone,
  address,
  partyId,
  parties,
  onName,
  onPhone,
  onAddress,
  onParty,
  idPrefix,
}: {
  name: string;
  phone: string;
  address: string;
  partyId: string;
  parties: PartyOption[] | null | undefined;
  onName: (v: string) => void;
  onPhone: (v: string) => void;
  onAddress: (v: string) => void;
  onParty: (v: string) => void;
  idPrefix: string;
}) {
  function pickParty(id: string) {
    onParty(id);
    const p = parties?.find((x) => x.id === id);
    if (!p) return;
    if (p.name) onName(p.name);
    if (p.phone) onPhone(p.phone);
    if (p.address) onAddress(p.address);
  }

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-cust`}>Customer</Label>
        <Input id={`${idPrefix}-cust`} value={name} onChange={(e) => onName(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-phone`}>Phone</Label>
        <Input id={`${idPrefix}-phone`} value={phone} onChange={(e) => onPhone(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-addr`}>Address</Label>
        <Input id={`${idPrefix}-addr`} value={address} onChange={(e) => onAddress(e.target.value)} />
      </div>
      <div className="space-y-1.5 sm:col-span-3">
        <Label htmlFor={`${idPrefix}-party`}>Link to khata party</Label>
        <Select value={partyId} onValueChange={pickParty}>
          <SelectTrigger id={`${idPrefix}-party`} className="w-full">
            <SelectValue placeholder="None (walk-in)" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none">None (walk-in)</SelectItem>
            {parties?.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

/** Charges & payment — sit BELOW the items they adjust. */
function AdjustmentFields({
  discount,
  delivery,
  paid,
  onDiscount,
  onDelivery,
  onPaid,
  idPrefix,
}: {
  discount: string;
  delivery: string;
  paid: string;
  onDiscount: (v: string) => void;
  onDelivery: (v: string) => void;
  onPaid: (v: string) => void;
  idPrefix: string;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-disc`}>Discount (₹)</Label>
        <Input id={`${idPrefix}-disc`} type="number" min={0} value={discount} onChange={(e) => onDiscount(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-delivery`}>Delivery charge (₹)</Label>
        <Input id={`${idPrefix}-delivery`} type="number" min={0} value={delivery} onChange={(e) => onDelivery(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-paid`}>Paid now (₹)</Label>
        <Input id={`${idPrefix}-paid`} type="number" min={0} value={paid} onChange={(e) => onPaid(e.target.value)} />
      </div>
    </div>
  );
}

/** Live math: subtotal − discount + delivery = total, so the auto-calc is visible. */
function TotalsSummary({
  subtotal,
  discount,
  delivery,
  total,
  paid,
}: {
  subtotal: number;
  discount: number;
  delivery: number;
  total: number;
  paid: number;
}) {
  const due = Math.max(0, total - paid);
  return (
    <div className="bg-muted/50 space-y-1.5 rounded-lg border p-3 text-sm">
      <p className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span className="tabular-nums">{money(subtotal)}</span></p>
      {discount > 0 && <p className="flex justify-between"><span className="text-muted-foreground">Discount</span><span className="tabular-nums">−{money(discount)}</span></p>}
      {delivery > 0 && <p className="flex justify-between"><span className="text-muted-foreground">Delivery</span><span className="tabular-nums">+{money(delivery)}</span></p>}
      <p className="flex justify-between border-t pt-1.5"><span className="font-semibold">Total</span><span className="font-bold tabular-nums">{money(total)}</span></p>
      <p className="flex justify-between"><span className="text-muted-foreground">Paid now</span><span className="tabular-nums">{money(paid)}</span></p>
      <p className="flex justify-between"><span className="text-muted-foreground">Balance due</span><span className="font-semibold tabular-nums">{money(due)}</span></p>
    </div>
  );
}

function LineItemsEditor({
  lines,
  update,
  onWeightChange,
  onPricingChange,
  pricing,
  remove,
  add,
  pick,
  allProducts,
}: {
  lines: LineState[];
  update: (i: number, patch: Partial<LineState>) => void;
  onWeightChange?: (i: number, weight: string) => void;
  onPricingChange?: (i: number, patch: Partial<BillLinePricingStripValue>) => void;
  /** Live pricing view per line (metal + breakdown) — null → no strip. */
  pricing?: (i: number) => { metal: "Gold" | "Silver"; breakdown: PriceBreakdown } | null;
  remove: (i: number) => void;
  add: () => void;
  pick: (i: number, p: ProductOption) => void;
  allProducts: ProductOption[] | null | undefined;
}) {
  return (
    <div className="space-y-2">
      {lines.map((line, index) => {
        const pricingView = pricing?.(index) ?? null;
        const breakdown = pricingView?.breakdown;
        return (
        <div key={index} className="bg-muted/50 flex flex-wrap items-end gap-2 rounded-lg border p-3">
          <div className="min-w-56 flex-1 space-y-1.5">
            <div className="flex items-center gap-1.5">
              <Label>Item {index + 1}</Label>
              {line.sku && (
                <span className="inline-flex items-center gap-1 rounded border bg-background px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                  {line.sku}
                  <button
                    type="button"
                    aria-label="Copy SKU"
                    onClick={() => void navigator.clipboard.writeText(line.sku)}
                    className="text-muted-foreground transition-colors hover:text-foreground">
                    <Copy className="h-3 w-3" />
                  </button>
                </span>
              )}
            </div>
            <ProductSearchSelect
              products={allProducts}
              onSelect={(p) => pick(index, p)}
              disableOutOfStock
              placeholder={line.productId ? "Swap product…" : "Search from stock…"}
            />
          </div>
          <div className="min-w-40 flex-1 space-y-1.5">
            <Label>Or type item name</Label>
            <Input value={line.productName} onChange={(e) => update(index, { productName: e.target.value })} />
            <Input
              value={line.description}
              onChange={(e) => update(index, { description: e.target.value })}
              placeholder="Description (optional)"
              className="h-8 text-xs"
            />
          </div>
          <div className="w-20 space-y-1.5">
            <Label>Qty</Label>
            <Input type="number" min={1} value={line.quantity} onChange={(e) => update(index, { quantity: e.target.value })} />
          </div>
          <div className="w-28 space-y-1.5">
            <Label>Weight</Label>
            <Input
              type="number"
              min={0}
              step="any"
              value={line.weight}
              onChange={(e) => (onWeightChange ? onWeightChange(index, e.target.value) : update(index, { weight: e.target.value }))}
              placeholder="0.000"
            />
          </div>
          <div className="w-28 space-y-1.5">
            <Label>Price</Label>
            <Input type="number" min={0} value={line.price} onChange={(e) => update(index, { price: e.target.value })} />
          </div>
          <div className="w-20 space-y-1.5">
            <Label>Purity</Label>
            <Input value={line.purity} onChange={(e) => update(index, { purity: e.target.value })} placeholder="22K" className="h-8 text-xs" />
          </div>
          <div className="w-24 space-y-1.5">
            <Label>G. Wt.</Label>
            <Input value={line.grossWeight} onChange={(e) => update(index, { grossWeight: e.target.value })} placeholder="19.12" className="h-8 text-xs" />
          </div>
          <Button variant="ghost" size="icon" onClick={() => remove(index)}>
            <Trash2 className="h-4 w-4" />
          </Button>
          {pricingView && (
            <BillLinePricingStrip
              className="w-full"
              metal={pricingView.metal}
              value={{
                ratePerGram: line.ratePerGram,
                labourType: line.labourType,
                labourValue: line.labourValue,
                silverPercentage: line.silverPercentage,
                nag: line.nag,
                povayi: line.povayi,
                otherCharges: line.otherCharges,
              }}
              effectiveLabourType={breakdown?.labour.type ?? undefined}
              effectiveRatePerGram={
                breakdown && breakdown.source === "auto" ? String(breakdown.ratePerGram) : undefined
              }
              effectiveLabourValue={
                line.labourValue === "" && breakdown && breakdown.source === "auto" && breakdown.labour.value > 0
                  ? String(breakdown.labour.value)
                  : undefined
              }
              metalValue={breakdown?.metalValue ?? null}
              labourAmount={breakdown?.labour.amount ?? null}
              otherChargesTotal={
                breakdown
                  ? breakdown.charges.nag + breakdown.charges.povayi + breakdown.charges.other
                  : null
              }
              autoPricing={breakdown?.source === "auto"}
              onChange={(patch) => onPricingChange?.(index, patch)}
            />
          )}
        </div>
        );
      })}
      <Button variant="outline" size="sm" onClick={add}>
        <Plus className="h-4 w-4" /> Add item
      </Button>
    </div>
  );
}

function SeparatorLine() {
  return <div className="bg-border my-2 h-px" />;
}

