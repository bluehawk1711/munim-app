import { and, desc, eq, sql } from "drizzle-orm";
import * as schema from "../db/schema.js";
import { logActivity } from "./activity.js";
export class PartyError extends Error {
    code;
    status;
    constructor(message, code, status = 400) {
        super(message);
        this.code = code;
        this.status = status;
    }
}
export async function createParty(db, input) {
    const [row] = await db
        .insert(schema.parties)
        .values({
        name: input.name.trim(),
        phone: input.phone?.trim() || null,
        email: input.email?.trim() || null,
        address: input.address?.trim() || null,
        type: input.type ?? "CUSTOMER",
        notes: input.notes?.trim() || null,
    })
        .returning();
    if (!row)
        throw new PartyError("Failed to create party", "CREATE_FAILED", 500);
    await logActivity(db, "PARTY_CREATED", `Created party "${row.name}"`);
    return row;
}
export async function updateParty(db, id, input) {
    const existing = await db.query.parties.findFirst({ where: eq(schema.parties.id, id) });
    if (!existing)
        throw new PartyError("Party not found", "NOT_FOUND", 404);
    const [row] = await db
        .update(schema.parties)
        .set({
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.phone !== undefined ? { phone: input.phone?.trim() || null } : {}),
        ...(input.email !== undefined ? { email: input.email?.trim() || null } : {}),
        ...(input.address !== undefined ? { address: input.address?.trim() || null } : {}),
        ...(input.type !== undefined ? { type: input.type } : {}),
        ...(input.notes !== undefined ? { notes: input.notes?.trim() || null } : {}),
        updatedAt: new Date(),
    })
        .where(eq(schema.parties.id, id))
        .returning();
    if (!row)
        throw new PartyError("Party not found", "NOT_FOUND", 404);
    await logActivity(db, "PARTY_UPDATED", `Updated party "${row.name}"`);
    return row;
}
export async function deleteParty(db, id) {
    await db.delete(schema.parties).where(eq(schema.parties.id, id));
    await logActivity(db, "PARTY_DELETED", `Deleted party ${id}`);
    return { success: true };
}
export async function listParties(db, type, search) {
    const conditions = [];
    if (type && type !== "all")
        conditions.push(eq(schema.parties.type, type));
    if (search?.trim()) {
        const s = `%${search.trim()}%`;
        conditions.push(sql `(${schema.parties.name} ilike ${s} or ${schema.parties.phone} ilike ${s})`);
    }
    const rows = await db
        .select()
        .from(schema.parties)
        .where(conditions.length ? and(...conditions) : undefined)
        .orderBy(desc(schema.parties.createdAt));
    return rows;
}
export async function getPartyLedger(db, partyId) {
    const [advances, invoices, payments] = await Promise.all([
        db.select().from(schema.advances).where(eq(schema.advances.partyId, partyId)).orderBy(desc(schema.advances.date)),
        db
            .select()
            .from(schema.invoices)
            .where(eq(schema.invoices.partyId, partyId))
            .orderBy(desc(schema.invoices.date)),
        db
            .select()
            .from(schema.payments)
            .where(eq(schema.payments.partyId, partyId))
            .orderBy(desc(schema.payments.date)),
    ]);
    const raw = [];
    for (const a of advances) {
        if (a.status === "SETTLED")
            continue;
        if (a.direction === "GIVEN") {
            raw.push({ id: a.id, date: a.date, kind: "ADVANCE_GIVEN", description: `Advance given${a.note ? ` — ${a.note}` : ""}`, debit: a.amount, credit: 0, referenceId: a.id });
        }
        else {
            raw.push({ id: a.id, date: a.date, kind: "ADVANCE_TAKEN", description: `Advance received${a.note ? ` — ${a.note}` : ""}`, debit: 0, credit: a.amount, referenceId: a.id });
        }
    }
    for (const inv of invoices) {
        const outstanding = inv.total - inv.amountPaid;
        if (outstanding > 0) {
            raw.push({
                id: inv.id,
                date: inv.date,
                kind: "INVOICE",
                description: `Invoice ${inv.invoiceNumber}${inv.customerName ? ` (${inv.customerName})` : ""}`,
                debit: outstanding,
                credit: 0,
                referenceId: inv.id,
            });
        }
    }
    for (const p of payments) {
        if (p.direction === "IN") {
            raw.push({ id: p.id, date: p.date, kind: "PAYMENT_IN", description: `Payment received${p.note ? ` — ${p.note}` : ""}`, debit: 0, credit: p.amount, referenceId: p.invoiceId ?? undefined });
        }
        else {
            raw.push({ id: p.id, date: p.date, kind: "PAYMENT_OUT", description: `Payment made${p.note ? ` — ${p.note}` : ""}`, debit: p.amount, credit: 0, referenceId: p.invoiceId ?? undefined });
        }
    }
    raw.sort((a, b) => a.date.getTime() - b.date.getTime());
    let running = 0;
    const lines = raw.map((r) => {
        running += r.debit - r.credit;
        return { ...r, balance: running };
    });
    return { lines, balance: running };
}
/** Net balances for every party — powers the "whom do I owe / who owes me" views. */
export async function getPartyBalances(db) {
    const parties = await db.select().from(schema.parties).orderBy(schema.parties.name);
    const out = [];
    for (const party of parties) {
        const { balance } = await getPartyLedger(db, party.id);
        const [advRows] = await Promise.all([
            db
                .select({ given: sql `coalesce(sum(case when direction = 'GIVEN' then amount else 0 end), 0)::float8`, taken: sql `coalesce(sum(case when direction = 'TAKEN' then amount else 0 end), 0)::float8` })
                .from(schema.advances)
                .where(and(eq(schema.advances.partyId, party.id), eq(schema.advances.status, "OPEN"))),
        ]);
        out.push({
            ...party,
            balance,
            given: advRows[0]?.given ?? 0,
            taken: advRows[0]?.taken ?? 0,
        });
    }
    return out.sort((a, b) => b.balance - a.balance);
}
/** Money we are owed (receivables) — parties with positive balance. */
export async function getReceivables(db) {
    const all = await getPartyBalances(db);
    return all.filter((p) => p.balance > 0.001);
}
/** Money we owe others (payables) — parties with negative balance. */
export async function getPayables(db) {
    const all = await getPartyBalances(db);
    return all.filter((p) => p.balance < -0.001);
}
//# sourceMappingURL=parties.js.map