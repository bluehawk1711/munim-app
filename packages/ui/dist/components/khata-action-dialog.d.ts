/**
 * KhataActionDialog — shared dialog for the four khata actions:
 * Give advance / Take advance / Receive payment / Make payment.
 * Used by the web + desktop Advances pages AND the desktop Parties page so the
 * money-movement flow is identical everywhere.
 *
 * Presentational + controlled: the parent owns `open`/`busy` and the core call
 * (createAdvance / recordPayment). Amount + note are owned INSIDE the dialog
 * and reset on open — parents only pass the action's title and the party.
 *
 * Parent contract: render <KhataActionDialog key={action?.party.id + action?.kind ?? "closed"} …>
 * so amount/note reset whenever a different action is opened.
 */
import * as React from "react";
export declare function KhataActionDialog({ open, onOpenChange, title, subtitle, balance, busy, confirmLabel, onConfirm, }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** e.g. "Give advance", "Receive payment" */
    title: string;
    /** Party name (or any context line under the title). */
    subtitle?: string;
    /** When provided, shows the party's current balance row. */
    balance?: number;
    busy?: boolean;
    confirmLabel?: string;
    onConfirm: (input: {
        amount: number;
        note: string;
    }) => void;
}): React.JSX.Element;
//# sourceMappingURL=khata-action-dialog.d.ts.map