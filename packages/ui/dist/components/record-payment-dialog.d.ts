/**
 * RecordPaymentDialog — shared record-payment dialog for the invoice lists,
 * used by BOTH the web and desktop apps so the payment flow is identical.
 *
 * Presentational + controlled: the parent owns `open`/`busy` and the actual
 * core call (recordInvoicePayment). The amount is owned INSIDE the dialog and
 * initialised to the outstanding balance, so parents don't duplicate the
 * total/paid/outstanding math.
 *
 * The payment is recorded HOW it was received — a Cash / Online toggle plus
 * an optional reference note (UPI id / txn number / "cash in hand"), so the
 * invoice detail can later show the full payment trail.
 *
 * Parent contract: render <RecordPaymentDialog key={paying?.id ?? "closed"} …>
 * so the amount resets when a different invoice is opened.
 */
import * as React from "react";
export type PaymentTarget = {
    id: string;
    invoiceNumber: string;
    customerName: string | null;
    total: number;
    amountPaid: number;
};
/** How the money came in — stored on `payments.method` (free text in the DB
 *  so legacy rows keep their old values). */
export type PaymentMethod = "cash" | "online";
export type RecordPaymentSubmit = {
    amount: number;
    method: PaymentMethod;
    /** Optional reference (UPI id / txn no. / note) — trimmed; "" when blank. */
    note: string;
};
export declare function RecordPaymentDialog({ open, onOpenChange, invoice, busy, onConfirm, }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    invoice: PaymentTarget | null;
    busy?: boolean;
    onConfirm: (submit: RecordPaymentSubmit) => void;
}): React.JSX.Element;
//# sourceMappingURL=record-payment-dialog.d.ts.map