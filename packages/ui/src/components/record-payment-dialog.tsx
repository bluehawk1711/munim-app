"use client"

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
import { Loader2 } from "lucide-react";
import { Button } from "./button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./dialog";
import { Input } from "./input";
import { formatMoney } from "../lib/format";

export type PaymentTarget = {
  id: string;
  invoiceNumber: string;
  customerName: string | null;
  total: number;
  amountPaid: number;
};

export function RecordPaymentDialog({
  open,
  onOpenChange,
  invoice,
  busy,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: PaymentTarget | null;
  busy?: boolean;
  onConfirm: (amount: number) => void;
}) {
  // Keyed remount (parent passes key={invoice?.id}) makes this initializer run
  // with the freshly opened invoice — the amount always starts at the
  // outstanding balance.
  const [amount, setAmount] = React.useState<number>(() =>
    invoice ? Math.max(0, invoice.total - invoice.amountPaid) : 0,
  );
  const [error, setError] = React.useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!invoice) return;
    if (!amount || amount <= 0) {
      setError("Enter an amount greater than 0.");
      return;
    }
    setError(null);
    onConfirm(amount);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>Record payment</DialogTitle>
            <DialogDescription>
              {invoice ? `${invoice.invoiceNumber} · ${invoice.customerName || "Walk-in customer"}` : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-xs text-muted-foreground">Total</p>
                <p className="font-semibold tabular-nums">{invoice ? formatMoney(invoice.total) : "—"}</p>
              </div>
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-xs text-muted-foreground">Already paid</p>
                <p className="font-semibold tabular-nums">{invoice ? formatMoney(invoice.amountPaid) : "—"}</p>
              </div>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="record-payment-amount" className="text-xs font-medium">
                Amount (₹)
              </label>
              <Input
                id="record-payment-amount"
                type="number"
                min={0}
                value={amount || ""}
                onChange={(e) => {
                  setAmount(Number(e.target.value));
                  setError(null);
                }}
                className="h-9"
                autoFocus
              />
              {error ? <p className="text-xs font-medium text-destructive">{error}</p> : null}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy || !amount || amount <= 0}>
              {busy ? (
                <>
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : (
                "Confirm payment"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

