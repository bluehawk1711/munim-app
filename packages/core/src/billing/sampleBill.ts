import { buildBillDocument } from "./billDocument.js";
import type { BillDocument, BillTemplateSettings } from "./billDocument.js";

export type SampleBillKind = "gold" | "silver";

const SAMPLE_SHOP = {
  name: "Sharma Jewellers",
  address: "12 M.G. Road, Kochi - 682016",
  phones: ["+91 98470 12345"],
  email: "bills@sharmajewellers.in",
};

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Dummy bills for the "Generate sample bill" action in Settings (web/desktop/
 * mobile) and the local `preview:bills` script — one GOLD and one SILVER
 * example covering both rate lines, weight column, discount/delivery and a
 * PARTIAL/PAID status, so every bill layout element shows up.
 */
export function buildSampleBill(kind: SampleBillKind): BillDocument {
  if (kind === "gold") {
    return buildBillDocument({
      billNo: "INV-8K4M",
      date: today(),
      customerName: "Anjali Menon",
      customerPhone: "+91 98470 55521",
      customerAddress: "14 Palm Grove, Panampilly Nagar, Kochi",
      shop: SAMPLE_SHOP,
      lines: [
        {
          productName: "Antique Gold Necklace Set",
          sku: "GOLD-NK-224",
          weight: 18.65,
          weightUnit: "g",
          purity: "22K",
          grossWeight: "19.12",
          // net = 19.12 − 0.62 + 0.15 = 18.65 (the priced weight)
          nagLessWeight: 0.62,
          chejatWeight: 0.15,
        quantity: 1,
        price: 165650,
        pricing: {
          metal: "Gold",
          ratePerGram: 8405,
          metalValue: 156750,
          labourType: "FIXED",
          labourValue: 8000,
          labourAmount: 8000,
          nag: 500,
          povayi: 250,
          other: 150,
        },
        },
        {
          productName: "22K Men's Gold Ring",
          sku: "GOLD-RG-045",
          weight: 4.85,
          weightUnit: "g",
          purity: "22K",
          grossWeight: "10.20",
          // net = 10.20 − 6.00 + 0.65 = 4.85 (studded ring demo)
          nagLessWeight: 6,
          chejatWeight: 0.65,
          quantity: 2,
          price: 41150,
        },
        {
          productName: "22K Gold Chain (24 in)",
          sku: "GOLD-CH-221",
          weight: 9.42,
          weightUnit: "g",
          purity: "22K",
          grossWeight: "9.78",
          // net = 9.78 − 0.46 + 0.10 = 9.42 (the priced weight)
          nagLessWeight: 0.46,
          chejatWeight: 0.1,
          description: "Handcrafted filigree design",
          quantity: 1,
          price: 84900,
        },
      ],
      discount: 5000,
      materialReturnedWeight: "5.2gm",
      materialReturnedValue: 18000,
      amountPaid: 150000,
      goldRate: 8245.5,
    });
  }
  return buildBillDocument({
    billNo: "INV-9T2P",
    date: today(),
    customerName: "Varghese Traders",
    customerPhone: "+91 99460 88210",
    customerAddress: "Kadavanthra, Kochi",
    shop: SAMPLE_SHOP,
    lines: [
      {
        productName: "Silver 925 Chain (24 in)",
        sku: "SLV-CH-925",
        weight: 42.3,
        weightUnit: "g",
        purity: "925",
        grossWeight: "43.8",
        quantity: 1,
        price: 4890,
        pricing: {
          metal: "Silver",
          ratePerGram: 80.25,
          metalValue: 4350,
          labourType: "PER_GRAM",
          labourValue: 11.82,
          labourAmount: 500,
          povayi: 30,
          other: 10,
        },
      },
      {
        productName: "Silver Lakshmi Coin 50g",
        sku: "SLV-CN-050",
        weight: 50,
        weightUnit: "g",
        purity: "999",
        grossWeight: "51.2",
        quantity: 2,
        price: 4600,
      },
      {
        productName: "Silver Anklet Pair",
        sku: "SLV-AN-112",
        weight: 68.4,
        weightUnit: "g",
        purity: "925",
        grossWeight: "70.5",
        quantity: 1,
        price: 7250,
      },
    ],
    discount: 300,
    deliveryCharge: 120,
    amountPaid: 21160,
    silverRate: 80.25,
  });
}

/** One selectable look for the Settings → Bills sample-bill card. */
export type SampleBillVariant = {
  id: string;
  /** Dropdown label. */
  label: string;
  /** One line saying what the sheet demonstrates. */
  hint: string;
  /** Which dummy bill to render (gold / silver). */
  kind: SampleBillKind;
  /** Bill 2 for the 2-in-1 Separate sheet. */
  secondKind?: SampleBillKind;
  /** Template settings for this look — merged over core defaults by the caller. */
  settings: Partial<BillTemplateSettings>;
};

/**
 * Every sample-bill variant the Settings → Bills card offers, so a shop can
 * eyeball each template/color/2-in-1 combination without creating an invoice.
 * The first entry is the default (the look a fresh New Bill produces).
 */
export const SAMPLE_BILL_VARIANTS: readonly SampleBillVariant[] = [
  {
    id: "gold-ecommerce",
    label: "Gold · Modern E-commerce",
    hint: "Estimate sheet — the default bill design",
    kind: "gold",
    settings: { template: "ecommerce" },
  },
  {
    id: "gold-classic-red",
    label: "Gold · Classic Jewellery (red)",
    hint: "Traditional red-theme invoice",
    kind: "gold",
    settings: { template: "jewellery", classicColor: "red" },
  },
  {
    id: "gold-classic-yellow",
    label: "Gold · Classic Jewellery (yellow)",
    hint: "Traditional invoice in the yellow accent",
    kind: "gold",
    settings: { template: "jewellery", classicColor: "yellow" },
  },
  {
    id: "gold-karat-line",
    label: "Gold · Estimate + picked karat line",
    hint: "Shows the manually picked karat next to the gold rate",
    kind: "gold",
    settings: { template: "ecommerce", goldRateKaratMode: "karat", goldRateKaratValue: 22 },
  },
  {
    id: "silver-ecommerce",
    label: "Silver · Modern E-commerce",
    hint: "Estimate with the combined silver Weight column",
    kind: "silver",
    settings: { template: "ecommerce" },
  },
  {
    id: "silver-classic-red",
    label: "Silver · Classic Jewellery (red)",
    hint: "Classic invoice for a silver bill",
    kind: "silver",
    settings: { template: "jewellery", classicColor: "red" },
  },
  {
    id: "two-in-one-duplicate",
    label: "2-in-1 · Duplicate (gold ×2)",
    hint: "Same bill printed twice on one sheet",
    kind: "gold",
    settings: { template: "ecommerce", twoInOne: true, mode: "duplicate" },
  },
  {
    id: "two-in-one-separate",
    label: "2-in-1 · Separate (gold + silver)",
    hint: "Two different bills stacked on one sheet",
    kind: "gold",
    secondKind: "silver",
    settings: { template: "ecommerce", twoInOne: true, mode: "distinct" },
  },
];
