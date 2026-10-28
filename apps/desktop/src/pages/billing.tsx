import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Plus, Trash2, Download, Loader2, FileDown, CheckCircle2, RefreshCw, Copy, ArrowLeft, TriangleAlert } from "lucide-react";
import {
  applyGoldBaseRate,
  buildBillDocument,
  calcNetWeight,
  evaluateConfigHealth,
  firstGoldKarat,
  invoicePricingFromBreakdown,
  isLabourType,
  priceBillLineRow,
  productMatchesCode,
  purityOptionsFor,
  renderBillHtml,
  paymentMethodLabel,
  resolveGoldRateTable,
  weightTextToGrams,
  type BillDocument,
  type BillShopDetails,
  type BillTemplateSettings,
  type EstimateColumnId,
  type GoldRateKaratMode,
  type PriceBreakdown,
  type PricingContext,
  type ProductDto,
} from "@munim/core";
import type { InvoiceDto, SettingsDto } from "@munim/api-client";
import {
  useSettings,
  useAllProducts,
  useParties,
  useCreateInvoice,
  useUpdateInvoice,
  useInvoice,
  useRecordInvoicePayment,
  useSyncProductPrices,
  useApiClient,
  useQueryState,
  useGoldRates,
} from "@munim/query";
import { money } from "@/lib/format";
import { navigate, useUrlSearch } from "@/lib/navigation";
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
  EstimateColumnToggles,
  RecordPaymentDialog,
  PaymentMethodPicker,
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
  /** Metal purity stamp ("22K") — the estimate's Remark column (dropdown). */
  purity: string;
  /** Gross-weight free text — bill G. Wt. column. */
  grossWeight: string;
  /** Bill line's nag-less weight in GRAMS (string field) — gold net-weight
   *  derivation input (net = gross − nag + chejat) + printed Nag Wt. column. */
  nagLessWeight: string;
  /** Bill line's chejat (stone) weight in GRAMS — the other derivation input
   *  + printed Chejat Wt. column. */
  chejatWeight: string;
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
  return { productId: "", productName: "", sku: "", color: "", size: "", description: "", weight: "", weightUnit: "gm", weightEdited: false, purity: "", grossWeight: "", nagLessWeight: "", chejatWeight: "", quantity: "1", price: "0", silverPercentage: "100", ratePerGram: "", rateEdited: false, labourType: "", labourValue: "", nag: "", povayi: "", otherCharges: "" };
}

/** Raw line text → number; "" / garbage → null (= "keep the product's input"). */
function parseLineNum(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/** Grams → the line field's string form ("" when the product has no value). */
function gramsField(grams: number | null): string {
  return grams == null ? "" : String(grams);
}

/** Gold price basis from the line's OWN derivation inputs — NET grams via the
 *  shared `calcNetWeight` (net = gross − nag + chejat; the bill line's nag/
 *  chejat fields are grams). Null when gross isn't usable (or nets ≤ 0) → the
 *  caller falls back to an edited Weight, else the product's own basis. */
function goldNetGrams(line: LineState): number | null {
  const net = calcNetWeight({
    grossWeight: line.grossWeight,
    nagLessWeight: line.nagLessWeight,
    chejatWeight: line.chejatWeight,
    weightUnit: line.weightUnit,
    nagUnit: "gm",
  });
  return net && net.grams > 0 ? net.grams : null;
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
  rates?: { gold?: number | null; silver?: number | null; karat?: number | null },
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
      nagLessWeight: it.nagLessWeight,
      chejatWeight: it.chejatWeight,
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
    // Purity of the quoted rate — the "24K" suffix on the gold rate row.
    goldRateKarat: rates?.karat ?? null,
    silverRate: inv.silverRate ?? rates?.silver ?? null,
  });
}

/** EDIT MODE — a stored invoice row back into the editor's line state.
 *
 *  This is the exact inverse of `lineItems()`. Two details matter:
 *
 *   • The frozen pricing snapshot becomes the strip's EXPLICIT values, and the
 *     line is marked `rateEdited` — so a rate/labour that was frozen on the
 *     original bill STICKS instead of silently re-tracking the live bill rate.
 *   • `weightEdited` is set, so the saved weight keeps driving auto-pricing
 *     for silver lines instead of being replaced by the product's current one.
 *
 *  Gold lines store the DERIVED NET weight in `weight` (that's what priced
 *  them) plus their nag/chejat inputs — both come back here, so the net weight
 *  round-trips through `goldNetGrams` unchanged. */
function invoiceToLine(it: InvoiceDto["items"][number]): LineState {
  const p = it.pricing;
  const frozenRate = p?.ratePerGram != null;
  return {
    productId: it.productId ?? "",
    productName: it.productName,
    sku: it.sku ?? "",
    color: it.color ?? "",
    size: it.size ?? "",
    description: it.description ?? "",
    weight: it.weight != null ? String(it.weight) : "",
    weightUnit: it.weightUnit === "mg" ? "mg" : "gm",
    weightEdited: true,
    purity: it.purity ?? "",
    grossWeight: it.grossWeight ?? "",
    nagLessWeight: it.nagLessWeight != null ? String(it.nagLessWeight) : "",
    chejatWeight: it.chejatWeight != null ? String(it.chejatWeight) : "",
    quantity: String(it.quantity),
    price: String(it.price),
    silverPercentage: p?.silverPercentage != null ? String(p.silverPercentage) : "100",
    ratePerGram: frozenRate ? String(p?.ratePerGram) : "",
    rateEdited: frozenRate,
    labourType: p?.labourType ?? "",
    labourValue: p?.labourValue != null ? String(p.labourValue) : "",
    nag: p?.nag != null ? String(p.nag) : "",
    povayi: p?.povayi != null ? String(p.povayi) : "",
    otherCharges: p?.other != null ? String(p.other) : "",
  };
}

/** A4 render size at 96dpi — the bill HTML sizes itself in mm, so this box
 *  matches the printed page exactly (794 × 1123 px). */
const BILL_PX = { w: 794, h: 1123 };

/**
 * Scaled iframe of the shared bill HTML (`renderBillHtml` — the same markup
 * the mobile print path prints). `fit="width"` scales to the container width
 * inside the fixed A4-ratio frame (the sidebar card); `fit="contain"` scales
 * the sheet to fit the whole box (the full-screen lightbox). When `onClick`
 * is given the frame is clickable (Enter/Space too) — the user sees the bill
 * BEFORE creating it, and clicks to enlarge.
 */
function BillPreviewFrame({
  html,
  fit = "width",
  onClick,
}: {
  html: string;
  fit?: "width" | "contain";
  onClick?: () => void;
}) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(0.45);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () => {
      const s =
        fit === "contain"
          ? Math.min(el.clientWidth / BILL_PX.w, el.clientHeight / BILL_PX.h)
          : el.clientWidth / BILL_PX.w;
      setScale(s > 0 ? s : 0.1);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [fit, html]);

  const contain = fit === "contain";
  const frame = (
    <iframe
      title="Bill preview"
      srcDoc={html}
      scrolling="no"
      className={
        contain
          ? "pointer-events-none absolute left-1/2 top-1/2 origin-center border-0"
          : "pointer-events-none absolute left-0 top-0 origin-top-left border-0"
      }
      style={{
        width: BILL_PX.w,
        height: BILL_PX.h,
        transform: contain ? `translate(-50%, -50%) scale(${scale})` : `scale(${scale})`,
      }}
    />
  );

  const boxCls = [
    contain ? "relative h-full w-full" : "relative block aspect-[210/297] w-full",
    "overflow-hidden rounded-lg border bg-white",
    onClick ? "cursor-zoom-in focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" : "",
  ].join(" ");

  if (!onClick) {
    return (
      <div ref={wrapRef} className={boxCls}>
        {frame}
      </div>
    );
  }
  return (
    <div
      ref={wrapRef}
      role="button"
      tabIndex={0}
      aria-label="Enlarge bill preview"
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      className={boxCls}
    >
      {frame}
    </div>
  );
}

export function BillingPage() {
  const { data: settings } = useQueryState(useSettings());
  const { data: goldRates } = useQueryState(useGoldRates());
  const billRates = { gold: goldRates?.baseRatePerGram ?? null, silver: settings?.silverRatePerGram ?? null, karat: goldRates?.baseKarat ?? null };
  const { data: allProductsData } = useQueryState(useAllProducts());
  const allProducts = allProductsData;
  const { data: parties } = useQueryState(useParties());
  // const { data: list, loading: loadingList } = useQueryState(useInvoices({ pageSize: 100 }));
  const createInvoice = useCreateInvoice();
  const updateInvoice = useUpdateInvoice();

  // ── EDIT MODE — `/billing?edit=<invoice id>`, opened from the invoices list
  // (the same page in edit mode; no second 1800-line form to keep in sync).
  // `useCurrentPath` doesn't re-render for query-only navigation, so the
  // search string has its own subscription.
  const search = useUrlSearch();
  const editId = useMemo(() => new URLSearchParams(search).get("edit"), [search]);
  const editing = editId !== null && editId !== "";
  const { data: editInvoice, isError: editLoadFailed } = useInvoice(editId);
  /** Set once per invoice so a background refetch can't clobber in-progress edits. */
  const seededEditId = useRef<string | null>(null);
  /** Same guard for the "show the SAVED bill in the Download slot" preview. */
  const seededPreviewId = useRef<string | null>(null);

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
  // Chejat/Nag direction marks — ON prints "Chejat: 0.100 +" / "Nag: 0.200 −".
  const [signSuffix, setSignSuffix] = useState(true);
  // Purity line under the gold rate row — shop base / this bill's product
  // karat / custom text / nothing (see GoldRateKaratMode).
  const [goldRateKaratMode, setGoldRateKaratMode] = useState<GoldRateKaratMode>("base");
  const [goldRateKaratText, setGoldRateKaratText] = useState("");
  // Karat PICKED in the dropdown (mode "karat") — prints under the gold rate
  // even when neither the product nor the shop has a karat set.
  const [goldRateKaratValue, setGoldRateKaratValue] = useState(22);
  // Inline missing-field errors appear once a create attempt fails.
  const [showErrors, setShowErrors] = useState(false);
  // How the advance is coming in — Cash / Online + optional reference note.
  const [paymentMethod, setPaymentMethod] = useState<string>("cash");
  const [paymentNote, setPaymentNote] = useState("");

  // ── Estimate column toggles — per METAL (gold grid ≠ silver field list) ─
  const [hiddenGold, setHiddenGold] = useState<EstimateColumnId[]>([]);
  const [hiddenSilver, setHiddenSilver] = useState<EstimateColumnId[]>([]);
  function toggleColumn(metal: "gold" | "silver", id: EstimateColumnId) {
    const setter = metal === "gold" ? setHiddenGold : setHiddenSilver;
    setter((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  /** Everything the printed bill honors — template, display lines AND the
   *  per-metal column toggles. Saved with the invoice; also drives the live
   *  preview and both PDF download paths. */
  const billSettings: BillTemplateSettings = {
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
    goldRateKaratValue,
    hiddenColumns: { gold: hiddenGold, silver: hiddenSilver },
  };

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
      // Gold prices on the DERIVED NET weight (gross − nag + chejat, grams);
      // silver keeps the plain edited-Weight basis. No net → legacy edited
      // weight → null (the product's own basis).
      let weight: number | null;
      let weightUnit: "gm" | "mg";
      if (p.type === "Gold") {
        const net = goldNetGrams(line);
        weight = net ?? (line.weightEdited ? parseLineNum(line.weight) : null);
        weightUnit = net != null ? "gm" : line.weightUnit;
      } else {
        weight = line.weightEdited ? parseLineNum(line.weight) : null;
        weightUnit = line.weightUnit;
      }
      return priceBillLineRow(
        p,
        context,
        { weight, weightUnit },
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

  /** Badge text for the gold-rate purity line — the form-side twin of core's
   *  `goldRateKaratLine`: off → nothing; custom → the operator's text;
   *  product → the first gold line's karat (the selected product's);
   *  karat → the picked dropdown value; base → the shop base karat. */
  function rateKaratBadge(): string | null {
    if (goldRateKaratMode === "off") return null;
    if (goldRateKaratMode === "custom") return goldRateKaratText.trim() || null;
    if (goldRateKaratMode === "karat") return `${goldRateKaratValue}K`;
    if (goldRateKaratMode === "product") {
      const karat = firstGoldKarat(
        lines
          .filter((l) => l.productName.trim())
          .map((l) => {
            const breakdown = lineBreakdown(l);
            return { pricing: breakdown ? invoicePricingFromBreakdown(breakdown) : null, purity: l.purity || null };
          }),
      );
      return karat != null && karat > 0 ? `${karat}K` : null;
    }
    return goldRates?.baseKarat && goldRates.baseKarat > 0 ? `Base ${goldRates.baseKarat}K` : null;
  }

  /** Editing a line's Weight re-prices that line (clearing it reverts to the
   *  product's own weight basis). */
  function makeWeightHandler(setter: (updater: (prev: LineState[]) => LineState[]) => void) {
    return (index: number, raw: string) => {
      setter((prev) =>
        prev.map((l, i) => (i === index ? repriceLine({ ...l, weight: raw, weightEdited: raw.trim() !== "" }) : l)),
      );
    };
  }

  /** Editing a line's weight-BASIS inputs (gold: G. Wt. / Nag / Chejat — they
   *  drive the derived net the price is computed on) re-prices that line. */
  function makeBasisHandler(setter: (updater: (prev: LineState[]) => LineState[]) => void) {
    return (index: number, patch: Partial<LineState>) => {
      setter((prev) => prev.map((l, i) => (i === index ? repriceLine({ ...l, ...patch }) : l)));
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
        nagLessWeight: gramsField(weightTextToGrams(found.nagLessWeight, found.nagUnit)),
        chejatWeight: gramsField(weightTextToGrams(found.chejatWeight, found.nagUnit)),
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
  // Fullscreen lightbox for the live bill preview (click the preview to open).
  const [previewOpen, setPreviewOpen] = useState(false);
  useEffect(() => {
    if (!previewOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPreviewOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [previewOpen]);

  // ── Creation options (user-selectable per bill run) ────────────────────
  // Auto-download the PDF right after saving; mark the invoice(s) fully paid
  // on creation (amountPaid = total → status PAID) instead of the Paid-now
  // field. Defaults: auto-save ON (the common case), mark-paid OFF.
  const [autoSavePdf, setAutoSavePdf] = useState(true);
  const [markPaid, setMarkPaid] = useState(false);

  const [payingInvoice, setPayingInvoice] = useState<InvoiceDto | null>(null);
  // payAmount removed — the shared RecordPaymentDialog owns the amount now.
  const [recordingPayment, setRecordingPayment] = useState(false);
  const recordPayment = useRecordInvoicePayment(payingInvoice?.id ?? "");

  // "Separate" mode creates a SECOND invoice — that only makes sense when
  // creating. Editing works on one saved bill, so the 2-in-1 pairing UI (and
  // the whole second-bill editor below) is off in edit mode.
  const distinct = !editing && twoInOne && mode === "distinct";

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
      nagLessWeight: gramsField(weightTextToGrams(full?.nagLessWeight ?? null, full?.nagUnit ?? null)),
      chejatWeight: gramsField(weightTextToGrams(full?.chejatWeight ?? null, full?.nagUnit ?? null)),
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
        // Gold stores the DERIVED NET weight (grams) — what it priced — plus
        // its nag/chejat derivation inputs for their own bill columns; silver
        // keeps the plain Weight field.
        const isGold = l.productId ? allProducts?.find((x) => x.id === l.productId)?.type === "Gold" : false;
        const net = isGold ? goldNetGrams(l) : null;
        return {
          productId: l.productId || undefined,
          productName: l.productName.trim(),
          sku: l.sku.trim() || undefined,
          color: l.color.trim() || undefined,
          size: l.size.trim() || undefined,
          description: l.description.trim() || undefined,
          weight: net ?? (l.weight.trim() ? Number(l.weight) : undefined),
          weightUnit: net != null ? "gm" : l.weight.trim() ? l.weightUnit : undefined,
          purity: l.purity.trim() || undefined,
          grossWeight: l.grossWeight.trim() || undefined,
          nagLessWeight: isGold ? parseLineNum(l.nagLessWeight) ?? undefined : undefined,
          chejatWeight: isGold ? parseLineNum(l.chejatWeight) ?? undefined : undefined,
          quantity: Number(l.quantity) || 0,
          price: Number(l.price) || 0,
          pricing: breakdown ? invoicePricingFromBreakdown(breakdown) ?? undefined : undefined,
        };
      })
      .filter((it) => it.productName && it.quantity > 0);
  }

  // ── LIVE preview — the CURRENT form rendered as a bill, before saving ───
  // Plain consts (not hooks): the editor re-renders on every keystroke anyway
  // and the build is cheap for typical bills. `lineItems` is a hoisted
  // function declaration, so it is visible here.
  const liveItems = lineItems(lines);
  const liveBill: BillDocument | null = shop
    ? buildBillDocument({
        billNo: "PREVIEW",
        date,
        customerName: customerName.trim() || "Walk-in Customer",
        customerPhone: customerPhone.trim() || undefined,
        customerAddress: customerAddress.trim() || undefined,
        shop,
        lines: liveItems.map((it) => ({
          productName: it.productName,
          description: it.description,
          sku: it.sku,
          color: it.color,
          size: it.size,
          weight: it.weight,
          weightUnit: it.weightUnit,
          purity: it.purity,
          grossWeight: it.grossWeight,
          nagLessWeight: it.nagLessWeight,
          chejatWeight: it.chejatWeight,
          pricing: it.pricing,
          quantity: it.quantity,
          price: it.price,
        })),
        discount: Number(discount) || 0,
        deliveryCharge: Number(deliveryCharge) || 0,
        materialReturnedWeight: materialReturnedWeight.trim() || undefined,
        materialReturnedValue: Number(materialReturnedValue) || 0,
        materialReturnedTitle: materialReturnedTitle.trim() || undefined,
        amountPaid: Number(amountPaid) || 0,
        status: "UNPAID",
        currency: settings?.currency ?? "INR",
        goldRate: billGoldRate ?? undefined,
        goldRateKarat: goldRates?.baseKarat ?? null,
        silverRate: billSilverRate ?? undefined,
      })
    : null;
  const liveHtml = liveBill ? renderBillHtml(liveBill, billSettings) : null;

  // ── MISSING-FIELD WARNINGS ───────────────────────────────────────────────
  // Everything this bill still needs, recomputed on every render so the
  // inline hints stay live. A failed create attempt flips `showErrors`,
  // which paints them under the offending fields AND lists them in the toast
  // — nothing fails silently anymore.
  const secondDraftItems = distinct ? lineItems(secondLines) : [];
  const missingFields: { key: string; message: string }[] = [];
  if (liveItems.length === 0) {
    missingFields.push({ key: "items", message: "Add at least one line item." });
  }
  const badPriceIndex = liveItems.findIndex((it) => !(it.price > 0));
  if (badPriceIndex >= 0) {
    const name = liveItems[badPriceIndex]?.productName ?? `#${badPriceIndex + 1}`;
    missingFields.push({ key: "price", message: `“${name}” needs a price above ₹0.` });
  }
  if (!customerName.trim()) {
    missingFields.push({ key: "customer", message: "Customer name is required." });
  }
  if (distinct) {
    if (secondDraftItems.length === 0) {
      missingFields.push({ key: "second-items", message: "Bill 2 needs at least one line item." });
    }
    if (!secondCustomerName.trim()) {
      missingFields.push({ key: "second-customer", message: "Second bill customer name is required." });
    }
  }
  /** First message for a field key — `null` hides that inline hint. */
  function fieldError(key: string): string | null {
    if (!showErrors) return null;
    return missingFields.find((m) => m.key === key)?.message ?? null;
  }

  // ── CONFIG WARNINGS — settings that are still empty, surfaced right on
  //    the bill form (the Settings → Health page shows the full list). ──────
  const configIssues = evaluateConfigHealth({
    shopName: settings?.shopName,
    shopAddress: settings?.shopAddress,
    shopPhones: settings?.shopPhones,
    goldBaseKarat: goldRates?.baseKarat ?? null,
    goldBaseRatePerGram: goldRates?.baseRatePerGram ?? null,
    quotedKarats: goldRates?.rates?.filter((r) => r.isCustom && r.ratePerGram > 0).length ?? null,
    silverRatePerGram: settings?.silverRatePerGram ?? 0,
    defaultLabourType: settings?.defaultLabourType ?? null,
    defaultLabourValue: settings?.defaultLabourValue ?? 0,
  }).filter((check) => check.severity !== "ok");

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
    // NOTE: `preview`/`secondPreview` are intentionally NOT cleared here —
    // they hold the LAST SAVED bill so its Download button keeps working
    // after the form resets (clearing them here is what made the right-side
    // preview card permanently empty). The next save replaces them.
    goldRateTouched.current = false;
    setGoldRateInput(goldBaseRate != null ? String(goldBaseRate) : "");
    setSilverTouched(false);
    setSilverRateInput(shopSilverPer10g > 0 ? String(shopSilverPer10g) : "");
    setShowErrors(false);
  }

  /** EDIT MODE — a stored invoice back into every field on this form (the
   *  inverse of what `handleCreate` submits). Bill 2 is always cleared:
   *  an edit updates exactly ONE invoice. */
  function seedFromInvoice(inv: InvoiceDto) {
    setCustomerName(inv.customerName ?? "");
    setCustomerPhone(inv.customerPhone ?? "");
    setCustomerAddress(inv.customerAddress ?? "");
    setPartyId(inv.partyId ?? "");
    setDate(inv.date.slice(0, 10));
    setNotes(inv.notes ?? "");
    setDiscount(String(inv.discount));
    setDeliveryCharge(String(inv.deliveryCharge));
    setMaterialReturnedWeight(inv.materialReturnedWeight ?? "");
    setMaterialReturnedValue(String(inv.materialReturnedValue));
    setMaterialReturnedTitle(inv.materialReturnedTitle ?? "");
    setAmountPaid(String(inv.amountPaid));
    setLines(inv.items.length ? inv.items.map(invoiceToLine) : [emptyLine()]);

    // Never carry a previous run's 2-in-1 partner into an edit.
    setSecondCustomerName("");
    setSecondCustomerPhone("");
    setSecondCustomerAddress("");
    setSecondPartyId("");
    setSecondDiscount("0");
    setSecondDeliveryCharge("0");
    setSecondAmountPaid("0");
    setSecondLines([emptyLine()]);
    setSecondPreview(null);

    const st = inv.templateSettings;
    setTemplate(st?.template ?? "ecommerce");
    setClassicColor(st?.classicColor ?? "red");
    setTwoInOne(st?.twoInOne ?? false);
    setMode(st?.mode ?? "duplicate");
    setWeightAfterName(st?.weightAfterName ?? true);
    setGoldRateLine(st?.goldRateLine ?? true);
    setSilverRateLine(st?.silverRateLine ?? true);
    setSignSuffix(st?.signSuffix ?? true);
    setGoldRateKaratMode(st?.goldRateKaratMode ?? "base");
    setGoldRateKaratText(st?.goldRateKaratText ?? "");
    setGoldRateKaratValue(st?.goldRateKaratValue ?? 22);
    setHiddenGold(st?.hiddenColumns?.gold ?? []);
    setHiddenSilver(st?.hiddenColumns?.silver ?? []);

    // The bill's OWN rates beat the shop default — and are marked "touched"
    // so the two prefill effects above can't overwrite them later.
    if (inv.goldRate != null && inv.goldRate > 0) {
      setGoldRateInput(String(inv.goldRate));
      goldRateTouched.current = true;
    }
    if (inv.silverRate != null && inv.silverRate > 0) {
      // Stored per-gram; the field shows ₹/10g (same conversion as the shop prefill).
      setSilverRateInput(String(Math.round(inv.silverRate * 1000) / 100));
      setSilverTouched(true);
    }
  }

  // Load + seed once per invoice (never on a refetch — that would wipe the
  // operator's in-progress edits).
  useEffect(() => {
    if (!editing || !editInvoice || seededEditId.current === editInvoice.id) return;
    seededEditId.current = editInvoice.id;
    seedFromInvoice(editInvoice);
    // `seedFromInvoice` is a per-render closure over the setters — re-running
    // it on every render would loop, so the ref above is the source of truth.
  }, [editing, editInvoice]);

  // Put the SAVED bill in the "Download PDF" slot while editing, so the button
  // shows what's on the server instead of the previous run's bill. The ref
  // guard stops this from firing again after a save (the save already sets it).
  useEffect(() => {
    if (!editing || !editInvoice || !settings || seededPreviewId.current === editInvoice.id) return;
    seededPreviewId.current = editInvoice.id;
    const saved = editInvoice.shopDetails;
    const shop = saved
      ? { name: saved.name, address: saved.address, phones: saved.phones, email: saved.email }
      : settingsToShop(settings);
    setPreview(
      invoiceToBillDocument(editInvoice, shop, settings.currency ?? "INR", {
        gold: goldRates?.baseRatePerGram ?? null,
        silver: settings.silverRatePerGram ?? null,
      }),
    );
  }, [editing, editInvoice, settings, goldRates]);

  /** Back out of edit mode: clean form, no stale preview, land on the list. */
  function cancelEdit() {
    seededEditId.current = null;
    seededPreviewId.current = null;
    resetForm();
    setPreview(null);
    setSecondPreview(null);
    navigate("/invoices");
  }

  // A bill that no longer exists (deleted elsewhere, or a stale link) must not
  // leave the operator staring at a dead, disabled form.
  useEffect(() => {
    if (!editing || !editLoadFailed) return;
    toast.error("That bill could not be loaded", {
      description: "It may have been deleted — open the bill list to pick another.",
    });
    seededEditId.current = null;
    seededPreviewId.current = null;
    resetForm();
    setPreview(null);
    setSecondPreview(null);
    navigate("/invoices");
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot guard.
  }, [editing, editLoadFailed]);

  // Navigating to a plain `/billing` (sidebar "New Bill", back button) must
  // leave the seeded bill behind.
  useEffect(() => {
    if (editing || seededEditId.current === null) return;
    seededEditId.current = null;
    seededPreviewId.current = null;
    resetForm();
    setPreview(null);
    setSecondPreview(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset-only effect.
  }, [editing]);

  async function handleCreate() {
    // Validate FIRST and surface every missing field inline (plus in the
    // toast) so the operator can see at a glance what is still missing.
    setShowErrors(true);
    if (missingFields.length > 0) {
      toast.error(
        missingFields.length === 1
          ? "1 field still needs attention"
          : `${missingFields.length} fields still need attention`,
        { description: missingFields.map((m) => m.message).join(" ") },
      );
      return;
    }

    const items = liveItems;
    setSaving(true);
    try {
      const base = {
        date,
        notes: notes.trim() || undefined,
        // How the advance came in — Cash / Online + the optional reference.
        paymentMethod,
        paymentNote: paymentNote.trim() || undefined,
        shopDetails: shop ? toInvoiceShop(shop) : undefined,
        templateSettings: billSettings,
        goldRate: billGoldRate ?? undefined,
        silverRate: billSilverRate ?? undefined,
      };
      // The SAME payload feeds both create and edit — the edit screens are the
      // create screen in edit mode, so the whole bill is re-submitted.
      const values = {
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
      };

      // ── EDIT: PUT the whole bill back. Core reconciles the per-product
      //    stock delta and the payment rows; the number stays untouched. ──
      if (editing && editInvoice) {
        const updated = await updateInvoice.mutateAsync({ id: editInvoice.id, values });
        const shopForPreview: BillShopDetails = updated.shopDetails
          ? { name: updated.shopDetails.name, address: updated.shopDetails.address, phones: updated.shopDetails.phones, email: updated.shopDetails.email }
          : shop ?? { name: "My Shop", address: null, phones: [], email: null };
        setPreview(invoiceToBillDocument(updated, shopForPreview, settings?.currency ?? "INR", billRates));
        toast.success(`Bill ${updated.invoiceNumber} updated`);
        if (autoSavePdf) {
          try {
            await downloadBillPdf(invoiceToBillDocument(updated, shopForPreview, settings?.currency ?? "INR", billRates), billSettings);
          } catch (err) {
            toast.error("Bill updated, but the PDF could not be generated", {
              description: err instanceof Error ? err.message : undefined,
            });
          }
        }
        // Stay in edit mode — the operator usually keeps tweaking, and the
        // live preview already reflects the saved numbers.
        return;
      }

      const invoice = await createInvoice.mutateAsync(values);

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
            ...billSettings,
            secondBill: distinct ? secondPreview ?? undefined : undefined,
          });
        } catch (err) {
          toast.error("Bill saved, but the PDF could not be generated", {
            description: err instanceof Error ? err.message : undefined,
          });
        }
      }

      resetForm();
    } catch (err) {
      toast.error(editing ? "Failed to update bill" : "Failed to create invoice", {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setSaving(false);
    }
  }

  async function exportBill(doc: BillDocument) {
    setExporting(true);
    try {
      await downloadBillPdf(doc, {
        ...billSettings,
        secondBill: secondPreview ?? undefined,
      });
      toast.success("PDF downloaded");
    } catch (err) {
      toast.error("Could not generate PDF", { description: err instanceof Error ? err.message : undefined });
    } finally {
      setExporting(false);
    }
  }

  async function handleRecordPayment(submit: { amount: number; method: string; note: string }) {
    if (!payingInvoice) return;
    setRecordingPayment(true);
    try {
      await recordPayment.mutateAsync({
        amount: submit.amount,
        method: submit.method,
        note: submit.note || undefined,
      });
      toast.success("Payment recorded", {
        description: `${money(submit.amount)} received · ${paymentMethodLabel(submit.method)}`,
      });
      setPayingInvoice(null);
    } catch (err) {
      toast.error("Payment failed", { description: err instanceof Error ? err.message : undefined });
    } finally {
      setRecordingPayment(false);
    }
  }

  const rateKaratBadgeText = rateKaratBadge();

  return (
    <div className="space-y-5">
      <PageHeader
        title={editing && editInvoice ? "Edit bill" : "New Bill"}
        badge={editing && editInvoice ? editInvoice.invoiceNumber : "Billing"}
        subtitle={
          editing && editInvoice
            ? "Saving replaces the saved bill. Stock moves by the DIFFERENCE only, the paid amount is reconciled with the payments already recorded, and the bill number is never changed."
            : "Create invoices with the same shared bill engine as web & mobile — jewellery or e-commerce templates, 2-in-1 supported."
        }
        actions={
          editing ? (
            <Button variant="outline" onClick={cancelEdit}>
              <ArrowLeft className="h-4 w-4" /> Back to bills
            </Button>
          ) : undefined
        }
      />
      <div className="grid gap-5 xl:grid-cols-3">
        <div className="space-y-5 xl:col-span-2">
              {/* Config warnings — the settings that are still empty, right
                  where they bite. The full checklist lives in Settings →
                  Health; only non-OK rows show here. */}
              {configIssues.length > 0 && (
                <Card className="border-amber-500/50 bg-amber-500/5">
                  <CardContent className="space-y-2.5 py-4">
                    <div className="flex items-center gap-2 text-sm font-semibold text-amber-600 dark:text-amber-500">
                      <TriangleAlert className="h-4 w-4 shrink-0" />
                      Setup incomplete — {configIssues.length} setting{configIssues.length === 1 ? "" : "s"} still missing
                    </div>
                    <ul className="space-y-1.5">
                      {configIssues.map((check) => (
                        <li key={check.id} className="text-xs text-muted-foreground">
                          <span className="font-medium text-foreground">{check.title}.</span> {check.detail}
                        </li>
                      ))}
                    </ul>
                    <Button variant="outline" size="sm" onClick={() => navigate("/settings?section=health")}>
                      Open Settings → Health
                    </Button>
                  </CardContent>
                </Card>
              )}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Bill details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
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
                    error={fieldError("customer")}
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
                      <div className="flex items-center gap-2">
                        <p className="text-muted-foreground text-[11px]">Editing re-prices gold lines on this bill.</p>
                        {rateKaratBadgeText && (
                          <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary">
                            {rateKaratBadgeText}
                          </span>
                        )}
                      </div>
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
                    onBasisChange={makeBasisHandler(setLines)}
                    onPricingChange={(i, patch) => handlePricingChange(setLines, i, patch)}
                    pricing={(i) => (lines[i] ? pricingViewFor(lines[i]) : null)}
                    remove={(i) => setLines((prev) => prev.filter((_, x) => x !== i))}
                    add={() => setLines((prev) => [...prev, emptyLine()])}
                    pick={(i, p) => pickProduct(i, p, "first")}
                  />
                  {fieldError("items") && (
                    <p className="text-xs font-medium text-destructive">{fieldError("items")}</p>
                  )}
                  {fieldError("price") && (
                    <p className="text-xs font-medium text-destructive">{fieldError("price")}</p>
                  )}
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
                  {/* How the advance is coming in — preset method or Custom
                      + the optional reference (printed in the Payments trail). */}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <PaymentMethodPicker label="Paid via" value={paymentMethod} onChange={setPaymentMethod} />
                    <div className="space-y-1.5">
                      <Label htmlFor="b-payment-note">Payment note (optional)</Label>
                      <Input
                        id="b-payment-note"
                        value={paymentNote}
                        maxLength={120}
                        onChange={(e) => setPaymentNote(e.target.value)}
                        placeholder={paymentMethod === "online" || (paymentMethod && paymentMethod !== "cash") ? "UPI id / transaction no." : "e.g. cash in hand"}
                      />
                    </div>
                  </div>
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
                      error={fieldError("second-customer")}
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
                      onBasisChange={makeBasisHandler(setSecondLines)}
                      onPricingChange={(i, patch) => handlePricingChange(setSecondLines, i, patch)}
                      pricing={(i) => (secondLines[i] ? pricingViewFor(secondLines[i]) : null)}
                      remove={(i) => setSecondLines((prev) => prev.filter((_, x) => x !== i))}
                      add={() => setSecondLines((prev) => [...prev, emptyLine()])}
                      pick={(i, p) => pickProduct(i, p, "second")}
                    />
                    {fieldError("second-items") && (
                      <p className="text-xs font-medium text-destructive">{fieldError("second-items")}</p>
                    )}
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
                    <span>{editing ? "Auto-save the PDF after saving" : "Auto-save the PDF after creating"}</span>
                  </label>
                  <label className="flex items-center gap-2.5 text-sm">
                    <Checkbox
                      checked={markPaid}
                      onCheckedChange={setMarkPaid}
                      aria-label={editing ? "Set the full bill total as the paid amount" : "Mark the invoice as fully paid on creation"}
                    />
                    <CheckCircle2 className="text-muted-foreground h-4 w-4" />
                    <span>
                      Mark as paid{' '}
                      <span className="text-muted-foreground">
                        {editing
                          ? `(paid becomes the full ${money(total)} — the difference is recorded as a payment)`
                          : `(total ${money(total)} received now${distinct ? ` · bill 2 ${money(secondTotal)}` : ""})`}
                      </span>
                    </span>
                  </label>
                </CardContent>
              </Card>

              <Button
                className="w-full"
                onClick={handleCreate}
                disabled={saving || (editing && !editInvoice)}
              >
                {saving ? (
                  <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Saving…</>
                ) : editing && !editInvoice ? (
                  <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Loading bill…</>
                ) : editing ? (
                  `Save changes — ${money(total)}`
                ) : (
                  `Create invoice — ${money(total)}${distinct ? ` + ${money(secondTotal)}` : ""}`
                )}
              </Button>
            </div>

        <div className="space-y-5">
          <Card className="h-fit">
            <CardHeader>
              <CardTitle className="text-sm">Bill preview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {liveHtml ? (
                <BillPreviewFrame html={liveHtml} onClick={() => setPreviewOpen(true)} />
              ) : (
                <div className="flex aspect-[210/297] w-full items-center justify-center rounded-lg border text-sm text-muted-foreground">
                  Loading shop details for the preview…
                </div>
              )}
              <p className="text-[11px] text-muted-foreground">
                Live preview of the bill you are building — click it to enlarge. Updates as you type, before saving.
              </p>
              {preview && (
                <>
                  <SeparatorLine />
                  <p className="text-xs text-muted-foreground">
                    Saved {preview.billNo}
                    {secondPreview && distinct ? ` + ${secondPreview.billNo}` : ""}
                  </p>
                  <Button className="w-full" onClick={() => exportBill(preview)} disabled={exporting}>
                    <Download className="h-4 w-4" /> {exporting ? "Generating…" : twoInOne ? "Download 2-in-1 PDF" : "Download PDF"}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Bill style</CardTitle>
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
                signSuffix={signSuffix}
                goldRateKaratMode={goldRateKaratMode}
                goldRateKaratText={goldRateKaratText}
                karatPicker
                goldRateKaratValue={goldRateKaratValue}
                onGoldRateKaratValue={(next) => {
                  setGoldRateKaratValue(next);
                  toast.success(`Karat line: ${next}K picked`);
                }}
                onGoldRateKaratMode={(next) => {
                  setGoldRateKaratMode(next);
                  toast.success(
                    `Karat line: ${
                      next === "off"
                        ? "hidden"
                        : next === "base"
                          ? "shop base"
                          : next === "product"
                            ? "product's karat"
                            : next === "karat"
                              ? `${goldRateKaratValue}K picked`
                              : "custom text"
                    }`,
                  );
                }}
                onGoldRateKaratText={setGoldRateKaratText}
                onSignSuffix={(next) => {
                  setSignSuffix(next);
                  toast.success(next ? "Chejat/Nag signs shown" : "Chejat/Nag signs hidden");
                }}
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

              {editing && (
                <p className="text-[11px] text-muted-foreground">
                  2-in-1 pairs bills when CREATING. An edit always updates this single bill — its saved print style is preserved.
                </p>
              )}

              <SeparatorLine />

              <EstimateColumnToggles
                template={template}
                hiddenGold={hiddenGold}
                hiddenSilver={hiddenSilver}
                onToggle={toggleColumn}
              />
            </CardContent>
          </Card>
        </div>
        </div>

      {/* Shared record-payment dialog — Cash/Online + note, same as the
          invoice list's flow. Keyed so the amount resets per invoice. */}
      <RecordPaymentDialog
        key={payingInvoice?.id ?? "closed"}
        open={payingInvoice !== null}
        onOpenChange={(open) => !open && setPayingInvoice(null)}
        invoice={
          payingInvoice
            ? {
                id: payingInvoice.id,
                invoiceNumber: payingInvoice.invoiceNumber,
                customerName: payingInvoice.customerName,
                total: payingInvoice.total,
                amountPaid: payingInvoice.amountPaid,
              }
            : null
        }
        busy={recordingPayment}
        onConfirm={(submit) => void handleRecordPayment(submit)}
      />

      {/* Fullscreen preview lightbox — click the sidebar preview (or press
          Enter on it) to see the current bill full size before saving. */}
      {previewOpen && liveHtml ? (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-background/95 backdrop-blur-sm p-4 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label="Bill preview — fullscreen"
        >
          <div className="flex items-center justify-between pb-3">
            <div>
              <p className="text-sm font-semibold">Bill preview</p>
              <p className="text-[11px] text-muted-foreground">
                {liveBill?.billNo} · {liveBill?.date} — updates live, nothing is saved yet
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => setPreviewOpen(false)}>
              Close (Esc)
            </Button>
          </div>
          <div className="min-h-0 flex-1">
            <BillPreviewFrame html={liveHtml} fit="contain" />
          </div>
        </div>
      ) : null}
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
  error,
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
  /** Missing-field message shown under the Customer input (red). */
  error?: string | null;
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
        <Input
          id={`${idPrefix}-cust`}
          value={name}
          onChange={(e) => onName(e.target.value)}
          aria-invalid={error ? true : undefined}
          className={error ? "border-destructive focus-visible:ring-destructive/40" : undefined}
        />
        {error && <p className="text-[11px] font-medium text-destructive">{error}</p>}
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
  onBasisChange,
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
  /** Weight-basis edits (gold G. Wt. / Nag / Chejat) — re-price the line. */
  onBasisChange?: (i: number, patch: Partial<LineState>) => void;
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
        const isGold = line.productId
          ? allProducts?.find((p) => p.id === line.productId)?.type === "Gold"
          : false;
        // Gold's price basis (net wt) shown read-only — the derived grams, or
        // the weight the engine actually priced when a breakdown exists.
        const goldNet = isGold ? breakdown?.weightGm ?? goldNetGrams(line) : null;
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
          {!isGold && (
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
          )}
          <div className="w-28 space-y-1.5">
            <Label>Price</Label>
            <Input type="number" min={0} value={line.price} onChange={(e) => update(index, { price: e.target.value })} />
          </div>
          <div className="w-24 space-y-1.5">
            <Label>Remark</Label>
            <Select value={line.purity} onValueChange={(v) => update(index, { purity: v })}>
              <SelectTrigger className="h-9 text-xs" aria-label="Remark">
                <SelectValue placeholder="—" />
              </SelectTrigger>
              <SelectContent>
                {purityOptionsFor(line.purity).map((opt) => (
                  <SelectItem key={opt} value={opt}>
                    {opt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-24 space-y-1.5">
            <Label>G. Wt.</Label>
            <Input
              value={line.grossWeight}
              onChange={(e) =>
                onBasisChange
                  ? onBasisChange(index, { grossWeight: e.target.value })
                  : update(index, { grossWeight: e.target.value })
              }
              placeholder="19.12"
              className="h-8 text-xs"
            />
          </div>
          {isGold && (
            <>
              <div className="w-24 space-y-1.5">
                <Label>Nag Wt.</Label>
                <Input
                  type="number"
                  min={0}
                  step="any"
                  value={line.nagLessWeight}
                  onChange={(e) => onBasisChange?.(index, { nagLessWeight: e.target.value })}
                  placeholder="0.000"
                  className="h-8 text-xs"
                />
              </div>
              <div className="w-24 space-y-1.5">
                <Label>Chejat Wt.</Label>
                <Input
                  type="number"
                  min={0}
                  step="any"
                  value={line.chejatWeight}
                  onChange={(e) => onBasisChange?.(index, { chejatWeight: e.target.value })}
                  placeholder="0.000"
                  className="h-8 text-xs"
                />
              </div>
              <div className="w-24 space-y-1.5">
                <Label>Net wt</Label>
                <Input
                  value={goldNet != null ? goldNet.toFixed(3) : ""}
                  readOnly
                  placeholder="0.000"
                  className="bg-muted text-muted-foreground h-8 text-xs"
                  aria-label="Net weight (derived)"
                />
              </div>
            </>
          )}
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
                // Matches the bill's Other Charges column: all three frozen
                // charges itemized there (Nag/Povayi/Other), summed in the
                // totals row — the strip shows the same combined figure.
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

