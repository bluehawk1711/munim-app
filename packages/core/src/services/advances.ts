import { and, desc, eq } from "drizzle-orm";
import type { DbClient } from "../db/client.js";
import * as schema from "../db/schema.js";
import { logActivity } from "./activity.js";

export class AdvanceError extends Error {
  constructor(message: string, public code: string, public status = 400) {
    super(message);
  }
}

export type AdvanceInput = {
  partyId: string;
  direction: "GIVEN" | "TAKEN";
  amount: number;
  date?: string | Date;
  note?: string;
};

/** Record a new advance — GIVEN = we handed money, TAKEN = we received money. */
export async function createAdvance(db: DbClient, input: AdvanceInput) {
  if (input.amount <= 0) throw new AdvanceError("Amount must be positive", "INVALID_AMOUNT");
  const party = await db.query.parties.findFirst({ where: eq(schema.parties.id, input.partyId) });
  if (!party) throw new AdvanceError("Party not found", "NOT_FOUND", 404);

  const [row] = await db
    .insert(schema.advances)
    .values({
      partyId: input.partyId,
      direction: input.direction,
      amount: input.amount,
      date: input.date ? new Date(input.date) : new Date(),
      note: input.note?.trim() || null,
    })
    .returning();

  await logActivity(
    db,
    input.direction === "GIVEN" ? "ADVANCE_GIVEN" : "ADVANCE_TAKEN",
    `${input.direction === "GIVEN" ? "Gave" : "Received"} advance of ${input.amount} to/from "${party.name}"${input.note ? ` — ${input.note}` : ""}`,
  );
  return row;
}

export async function listAdvances(db: DbClient, partyId?: string) {
  return db
    .select()
    .from(schema.advances)
    .where(partyId ? eq(schema.advances.partyId, partyId) : undefined)
    .orderBy(desc(schema.advances.date));
}

export async function settleAdvance(db: DbClient, id: string) {
  const [row] = await db
    .update(schema.advances)
    .set({ status: "SETTLED" })
    .where(eq(schema.advances.id, id))
    .returning();
  if (!row) throw new AdvanceError("Advance not found", "NOT_FOUND", 404);
  await logActivity(db, "ADVANCE_SETTLED", `Settled advance ${id}`);
  return row;
}

export async function deleteAdvance(db: DbClient, id: string) {
  await db.delete(schema.advances).where(eq(schema.advances.id, id));
  return { success: true };
}

/* ── Payments (money movement, not tied to an invoice) ────────── */

export type PaymentInput = {
  partyId?: string;
  direction: "IN" | "OUT";
  amount: number;
  method?: string;
  date?: string | Date;
  note?: string;
};

/** Record money in (received) or out (paid) — settles advances / khata. */
export async function recordPayment(db: DbClient, input: PaymentInput) {
  if (input.amount <= 0) throw new AdvanceError("Amount must be positive", "INVALID_AMOUNT");
  if (input.partyId) {
    const party = await db.query.parties.findFirst({ where: eq(schema.parties.id, input.partyId) });
    if (!party) throw new AdvanceError("Party not found", "NOT_FOUND", 404);
  }

  const [row] = await db
    .insert(schema.payments)
    .values({
      partyId: input.partyId ?? null,
      direction: input.direction,
      amount: input.amount,
      method: input.method || "cash",
      date: input.date ? new Date(input.date) : new Date(),
      note: input.note?.trim() || null,
    })
    .returning();

  await logActivity(
    db,
    input.direction === "IN" ? "PAYMENT_IN" : "PAYMENT_OUT",
    `${input.direction === "IN" ? "Received" : "Paid out"} ${input.amount}${input.note ? ` — ${input.note}` : ""}`,
  );
  return row;
}

export async function listPayments(db: DbClient, partyId?: string) {
  return db
    .select()
    .from(schema.payments)
    .where(partyId ? eq(schema.payments.partyId, partyId) : undefined)
    .orderBy(desc(schema.payments.date));
}
