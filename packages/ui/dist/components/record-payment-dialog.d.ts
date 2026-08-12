/**
 * RecordPaymentDialog — shared record-payment dialog for the invoice lists,
 * used by BOTH the web and desktop apps so the payment flow is identical.
 *
 * Presentational + controlled: the parent owns `open`/`busy` and the actual
 * core call (recordInvoicePayment). The amount is owned INSIDE the dialog and
 * initialised to the outstanding balance, so parents don't duplicate the
 * total/paid/outstanding math.
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
export declare function RecordPaymentDialog({ open, onOpenChange, invoice, busy, onConfirm, }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    invoice: PaymentTarget | null;
    busy?: boolean;
    onConfirm: (amount: number) => void;
}): React.JSX.Element;
//# sourceMappingURL=record-payment-dialog.d.ts.map