/**
 * An order — a quotation written down at the counter — as a printable document.
 *
 * An estimate IS a bill the customer hasn't settled yet, so rather than
 * inventing a second renderer this reuses the whole bill pipeline: same
 * columns (including WEIGHT and the estimate-grid itemisations), same shop
 * letterhead, same templates, same amount-in-words. Only the header wording
 * changes, via `kind: "quotation"`.
 *
 * That gets the shop exactly what it asks for on an estimate — the quoted
 * total, what the party has already paid, and what is still due — printed in
 * the same format as the bill that will eventually follow it.
 *
 * Orders carry no template settings of their own; the caller decides which
 * template to print with when it renders the returned document.
 */
import {
  buildBillDocument,
  type BillDocument,
  type BillShopDetails,
} from "./billDocument.js";

/** The order fields a quotation prints. Kept structural so callers can hand it
 *  a schema row, a DTO, or anything shaped like one without importing the DB. */
export interface OrderDocumentInput {
  orderNumber: string;
  date?: string | Date;
  customerName?: string | null;
  customerPhone?: string | null;
  customerAddress?: string | null;
  items: ReadonlyArray<{
    productName: string;
    description?: string | null;
    sku?: string | null;
    color?: string | null;
    size?: string | null;
    /** Product weight + unit snapshot — the printed WEIGHT column. */
    weight?: number | null;
    weightUnit?: string | null;
    quantity: number;
    /** Quoted unit price — printed exactly as quoted. */
    price: number;
  }>;
  discount?: number;
  deliveryCharge?: number;
  /** Advance already collected — prints as RECEIPT CASH / Closing Balance. */
  amountPaid?: number;
}

/** Build the printable quotation for an order. */
export function buildOrderDocument(
  input: OrderDocumentInput,
  shop: BillShopDetails,
  options: { currency?: string } = {},
): BillDocument {
  return buildBillDocument({
    kind: "quotation",
    billNo: input.orderNumber,
    date: input.date,
    customerName: input.customerName,
    customerPhone: input.customerPhone,
    customerAddress: input.customerAddress,
    shop,
    lines: input.items.map((it) => ({
      productName: it.productName,
      description: it.description,
      sku: it.sku,
      color: it.color,
      size: it.size,
      weight: it.weight,
      weightUnit: it.weightUnit,
      quantity: it.quantity,
      price: it.price,
    })),
    discount: input.discount,
    deliveryCharge: input.deliveryCharge,
    amountPaid: input.amountPaid,
    currency: options.currency,
  });
}
