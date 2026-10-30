/**
 * The money rows behind `orders.amountPaid`.
 *
 * An order keeps ONE running `amountPaid`, but the khata ledger, the Advances
 * screen and every payment-history view read the `payments` rows. Those two
 * views must never disagree, so every path that changes an order's money
 * (create, edit, bill, invoice deletion) funnels through `syncOrderPayments`.
 * Mirrors the same invariant `updateInvoice` keeps for bills.
 */
import { and, desc, eq } from "drizzle-orm";
import type { DbClient } from "../db/client.js";
import * as schema from "../db/schema.js";
import { round2 } from "../pricing/gold.js";

/** Float money columns — exact `===` on sums of rupees misfires on 0.1 + 0.2. */
const MONEY_EPS = 0.005;

export type OrderPaymentTarget = {
  id: string;
  orderNumber: string;
  partyId: string | null;
};

/**
 * Make the order's IN payment rows equal `targetPaid` — inserts the missing
 * money, unwinds the newest rows when it shrinks. Legacy orders that were paid
 * before rows were tracked get their missing row backfilled the first time
 * their money is touched.
 */
export async function syncOrderPayments(
  db: DbClient,
  order: OrderPaymentTarget,
  targetPaid: number,
  opts?: { method?: string; note?: string; partyChanged?: boolean },
): Promise<void> {
  const rows = await db
    .select()
    .from(schema.payments)
    .where(and(eq(schema.payments.orderId, order.id), eq(schema.payments.direction, "IN")))
    .orderBy(desc(schema.payments.date), desc(schema.payments.createdAt));
  const recorded = round2(rows.reduce((sum, p) => sum + p.amount, 0));
  const diff = round2(targetPaid - recorded);

  if (diff > MONEY_EPS) {
    await db.insert(schema.payments).values({
      orderId: order.id,
      partyId: order.partyId,
      direction: "IN",
      amount: diff,
      method: opts?.method?.trim() || "cash",
      note: opts?.note?.trim() || `Advance on order ${order.orderNumber}`,
    });
  } else if (diff < -MONEY_EPS) {
    // Unwind the newest rows first, so a correction targets the last entry.
    let remaining = -diff;
    for (const p of rows) {
      if (remaining <= MONEY_EPS) break;
      if (p.amount <= remaining + MONEY_EPS) {
        await db.delete(schema.payments).where(eq(schema.payments.id, p.id));
        remaining = round2(remaining - p.amount);
      } else {
        await db
          .update(schema.payments)
          .set({ amount: round2(p.amount - remaining) })
          .where(eq(schema.payments.id, p.id));
        remaining = 0;
      }
    }
  }

  // Ledger credits belong to the party currently on the order.
  if (opts?.partyChanged) {
    await db
      .update(schema.payments)
      .set({ partyId: order.partyId })
      .where(eq(schema.payments.orderId, order.id));
  }
}
