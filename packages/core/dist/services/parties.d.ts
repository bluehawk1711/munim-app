import type { DbClient } from "../db/client";
import * as schema from "../db/schema";
export declare class PartyError extends Error {
    code: string;
    status: number;
    constructor(message: string, code: string, status?: number);
}
export type PartyInput = {
    name: string;
    phone?: string;
    email?: string;
    address?: string;
    type?: "CUSTOMER" | "SUPPLIER" | "WORKER" | "OTHER";
    notes?: string;
};
export declare function createParty(db: DbClient, input: PartyInput): Promise<{
    id: string;
    name: string;
    createdAt: Date;
    notes: string | null;
    updatedAt: Date;
    type: "CUSTOMER" | "SUPPLIER" | "WORKER" | "OTHER";
    phone: string | null;
    email: string | null;
    address: string | null;
}>;
export declare function updateParty(db: DbClient, id: string, input: Partial<PartyInput>): Promise<{
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
    address: string | null;
    type: "CUSTOMER" | "SUPPLIER" | "WORKER" | "OTHER";
    notes: string | null;
    createdAt: Date;
    updatedAt: Date;
}>;
export declare function deleteParty(db: DbClient, id: string): Promise<{
    success: boolean;
}>;
export declare function listParties(db: DbClient, type?: string, search?: string): Promise<{
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
    address: string | null;
    type: "CUSTOMER" | "SUPPLIER" | "WORKER" | "OTHER";
    notes: string | null;
    createdAt: Date;
    updatedAt: Date;
}[]>;
export type LedgerLine = {
    id: string;
    date: Date;
    kind: "ADVANCE_GIVEN" | "ADVANCE_TAKEN" | "INVOICE" | "PAYMENT_IN" | "PAYMENT_OUT";
    description: string;
    debit: number;
    credit: number;
    balance: number;
    referenceId?: string;
};
export declare function getPartyLedger(db: DbClient, partyId: string): Promise<{
    lines: LedgerLine[];
    balance: number;
}>;
export type PartyBalance = schema.Party & {
    balance: number;
    /** total money WE gave them (they owe us) */
    given: number;
    /** total money THEY gave us (we owe them) */
    taken: number;
};
/** Net balances for every party — powers the "whom do I owe / who owes me" views. */
export declare function getPartyBalances(db: DbClient): Promise<PartyBalance[]>;
/** Money we are owed (receivables) — parties with positive balance. */
export declare function getReceivables(db: DbClient): Promise<PartyBalance[]>;
/** Money we owe others (payables) — parties with negative balance. */
export declare function getPayables(db: DbClient): Promise<PartyBalance[]>;
//# sourceMappingURL=parties.d.ts.map