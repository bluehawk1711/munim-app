import { buildBillDocument } from "./billDocument.js";
import type { BillDocument } from "./billDocument.js";

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
