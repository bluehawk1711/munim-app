import type { DbClient } from "../db/client.js";
export declare class AdvanceError extends Error {
    code: string;
    status: number;
    constructor(message: string, code: string, status?: number);
}
export type AdvanceInput = {
    partyId: string;
    direction: "GIVEN" | "TAKEN";
    amount: number;
    date?: string | Date;
    note?: string;
};
/** Record a new advance — GIVEN = we handed money, TAKEN = we received money. */
export declare function createAdvance(db: DbClient, input: AdvanceInput): Promise<{
    date: Date;
    id: string;
    createdAt: Date;
    note: string | null;
    partyId: string;
    direction: "GIVEN" | "TAKEN";
    amount: number;
    status: "OPEN" | "SETTLED";
} | undefined>;
export declare function listAdvances(db: DbClient, partyId?: string): Promise<{
    id: string;
    partyId: string;
    direction: "GIVEN" | "TAKEN";
    amount: number;
    date: Date;
    note: string | null;
    status: "OPEN" | "SETTLED";
    createdAt: Date;
}[]>;
export declare function settleAdvance(db: DbClient, id: string): Promise<{
    id: string;
    partyId: string;
    direction: "GIVEN" | "TAKEN";
    amount: number;
    date: Date;
    note: string | null;
    status: "OPEN" | "SETTLED";
    createdAt: Date;
}>;
export declare function deleteAdvance(db: DbClient, id: string): Promise<{
    success: boolean;
}>;
export type PaymentInput = {
    partyId?: string;
    direction: "IN" | "OUT";
    amount: number;
    method?: string;
    date?: string | Date;
    note?: string;
};
/** Record money in (received) or out (paid) — settles advances / khata. */
export declare function recordPayment(db: DbClient, input: PaymentInput): Promise<{
    date: Date;
    id: string;
    createdAt: Date;
    note: string | null;
    partyId: string | null;
    direction: "IN" | "OUT";
    amount: number;
    invoiceId: string | null;
    method: string | null;
} | undefined>;
export declare function listPayments(db: DbClient, partyId?: string): Promise<{
    id: string;
    partyId: string | null;
    invoiceId: string | null;
    direction: "IN" | "OUT";
    amount: number;
    method: string | null;
    date: Date;
    note: string | null;
    createdAt: Date;
}[]>;
//# sourceMappingURL=advances.d.ts.map