/**
 * PRICING_GUIDE — the single source of truth for the Help page's
 * "how pricing works" wording (AGENTS §2/§4b: types & shared content once).
 *
 * Web + desktop render it through `PricingGuide` in @munim/ui; mobile renders
 * the same structure natively in HelpScreen. Apps own only icons/styling —
 * never the text — so the wording can never drift between the three apps.
 */

/** Inline text run. `b` = bold, `i` = italic (rendered per platform). */
export type GuideSpan = { t: string; b?: true; i?: true };

export type GuideFormulaLine = {
  label: string;
  tone: "primary" | "muted";
  rest: string;
};

export type GuideCard = { name: string; blurb: string };

export type GuideBlock =
  | { kind: "para"; spans: GuideSpan[] }
  | { kind: "formula"; lines: GuideFormulaLine[] }
  | {
      kind: "list";
      /** `plain` = bullet •, `arrow` = ▸ prefix, `step` = numbered circles. */
      marker: "plain" | "arrow" | "step";
      items: GuideSpan[][];
    }
  | { kind: "cards"; cards: GuideCard[] };

export type PricingGuideSectionKey = "formula" | "rates" | "auto" | "recalc" | "counter";

export type PricingGuideSection = {
  key: PricingGuideSectionKey;
  title: string;
  blocks: GuideBlock[];
};

export const PRICING_GUIDE: PricingGuideSection[] = [
  {
    key: "formula",
    title: "How a price is calculated",
    blocks: [
      {
        kind: "para",
        spans: [
          { t: "Metal products compute their price on " },
          { t: "read", b: true },
          {
            t: " — nothing is stored until you say so. Two modes, one per product:",
          },
        ],
      },
      {
        kind: "formula",
        lines: [
          {
            label: "Gold (Auto)",
            tone: "primary",
            rest: "= net weight (gm) × karat rate (₹/g) + labour",
          },
          {
            label: "Silver (Auto)",
            tone: "primary",
            rest: "= weight (gm) × silver% × silver rate (₹/g) + labour",
          },
          { label: "Manual", tone: "muted", rest: "= the Selling price you typed" },
        ],
      },
      {
        kind: "para",
        spans: [
          {
            t: "Lists, pickers, labels, exports and stock valuations all read this computed price, so editing a rate re-prices the whole shop instantly. Invoices already created keep the totals they were billed at.",
          },
        ],
      },
    ],
  },
  {
    key: "rates",
    title: "Rates & labour (Settings → Rates & labour)",
    blocks: [
      {
        kind: "list",
        marker: "plain",
        items: [
          [
            { t: "Gold base rate", b: true },
            {
              t: " — ₹/gram for the base karat (the highest quoted one). The other 0–24 karats follow it unless you pin them individually in the 0–24 grid.",
            },
          ],
          [
            { t: "Silver rate", b: true },
            {
              t: " — shop-wide ₹/gram. Leave it at 0 and silver products stay on their manual price.",
            },
          ],
          [
            { t: "Shop default labour", b: true },
            {
              t: " — the fallback for gold products that don't declare their own labour. Silver labour is always set per product.",
            },
          ],
        ],
      },
      {
        kind: "cards",
        cards: [
          { name: "Percent", blurb: "A share of the metal value — e.g. 12% making charge." },
          { name: "Fixed", blurb: "One rupee amount for the whole piece — e.g. ₹250." },
          { name: "Per gram", blurb: "Rate × net weight — e.g. ₹180/g." },
        ],
      },
    ],
  },
  {
    key: "auto",
    title: "Setting a product to Auto",
    blocks: [
      {
        kind: "list",
        marker: "step",
        items: [
          [
            { t: "Open " },
            { t: "Products → Add / Edit", b: true },
            { t: " and pick type " },
            { t: "Gold", b: true },
            { t: " or " },
            { t: "Silver", b: true },
            { t: "." },
          ],
          [
            { t: "Choose a karat (gold) or confirm the silver %, then set " },
            { t: "Pricing → Auto", b: true },
            {
              t: ". The Selling price field becomes read-only and shows the calculated value.",
            },
          ],
          [
            {
              t: "Pick the labour for this piece — leave it empty to fall back to the shop default.",
            },
          ],
          [
            {
              t: "Save. The preview, the list, the label and billing all show the same calculated price.",
            },
          ],
        ],
      },
      {
        kind: "para",
        spans: [
          { t: "Products show a classification chip everywhere they appear — " },
          { t: "Gold · 22K", b: true },
          { t: ", " },
          { t: "Silver · 92.5 Stock", b: true },
          {
            t: " — so the picker, table and details agree on what an item is.",
          },
        ],
      },
    ],
  },
  {
    key: "recalc",
    title: "Recalculate prices",
    blocks: [
      {
        kind: "para",
        spans: [
          {
            t: "Auto prices live on read, so lists always show the latest rates. The ",
          },
          { t: "stored", b: true },
          { t: " price is only used when a rate is missing (the fallback) — " },
          { t: "Recalculate prices", b: true },
          {
            t: " freezes today's computed price into every auto-priced product. It is idempotent, never touches manual prices, and reports how many rows changed.",
          },
        ],
      },
      {
        kind: "list",
        marker: "arrow",
        items: [
          [
            { t: "Products page", b: true },
            { t: " — in the action row, next to Export CSV." },
          ],
          [
            { t: "Billing / Sales", b: true },
            { t: " — refreshes the items already picked into the bill." },
          ],
          [
            { t: "Settings → Rates & labour", b: true },
            { t: " — press it right after saving new rates." },
          ],
        ],
      },
      {
        kind: "para",
        spans: [
          { t: "Tip: change a rate → " },
          { t: "Save", b: true },
          { t: " → " },
          { t: "Recalculate now", b: true },
          { t: ". Lists on all three apps pick up the new numbers immediately." },
        ],
      },
    ],
  },
  {
    key: "counter",
    title: "Speeding up the counter",
    blocks: [
      {
        kind: "list",
        marker: "arrow",
        items: [
          [
            { t: "Scan to add", b: true },
            {
              t: " — USB scanners act like a keyboard: focus the barcode field on Billing, scan, and the product drops into the next line at its current price.",
            },
          ],
          [
            { t: "Missing barcodes?", b: true },
            { t: " Products → " },
            { t: "Generate barcodes", i: true },
            {
              t: " backfills a unique EAN-13 for every product that doesn't have one; SKU stays independent.",
            },
          ],
          [
            { t: "Labels", b: true },
            {
              t: " — select rows on Products → Print Label for shelf tickets with the barcode and the current price.",
            },
          ],
        ],
      },
    ],
  },
];
