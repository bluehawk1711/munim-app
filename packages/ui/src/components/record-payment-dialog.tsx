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
 * The payment is recorded HOW it was received — a Cash / Online toggle plus
 * an optional reference note (UPI id / txn number / "cash in hand"), so the
 * invoice detail can later show the full payment trail.
 *
 * Parent contract: render <RecordPaymentDialog key={paying?.id ?? "closed"} …>
 * so the amount resets when a different invoice is opened.
 */
import * as React from "react";
import { Loader2 } from "lucide-react";
import { Button } from "./button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./dialog";
import { Input } from "./input";
import { cn } from "../lib/utils";
import { formatMoney } from "../lib/format";

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
  onConfirm: (submit: RecordPaymentSubmit) => void;
}) {
  // Keyed remount (parent passes key={invoice?.id}) makes this initializer run
  // with the freshly opened invoice — the amount always starts at the
  // outstanding balance.
  const [amount, setAmount] = React.useState<number>(() =>
    invoice ? Math.max(0, invoice.total - invoice.amountPaid) : 0,
  );
  const [method, setMethod] = React.useState<PaymentMethod>("cash");
  const [note, setNote] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!invoice) return;
    if (!amount || amount <= 0) {
      setError("Enter an amount greater than 0.");
      return;
    }
    setError(null);
    onConfirm({ amount, method, note: note.trim() });
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
            <div className="space-y-1.5">
              <span className="text-xs font-medium">Paid via</span>
              <div
                role="radiogroup"
                aria-label="Paid via"
                className="grid grid-cols-2 overflow-hidden rounded-lg border text-xs font-medium"
              >
                {(
                  [
                    ["cash", "Cash"],
                    ["online", "Online"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={method === value}
                    onClick={() => setMethod(value)}
                    className={cn(
                      "py-2 transition-colors",
                      method === value
                        ? "bg-primary text-primary-foreground"
                        : "bg-background text-muted-foreground hover:bg-muted",
                      value === "online" && "border-l",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="record-payment-note" className="text-xs font-medium">
                Note <span className="font-normal text-muted-foreground">(optional — UPI ref, txn no.)</span>
              </label>
              <Input
                id="record-payment-note"
                value={note}
                maxLength={120}
                onChange={(e) => setNote(e.target.value)}
                placeholder={method === "online" ? "UPI id / transaction no." : "e.g. cash in hand"}
                className="h-9"
              />
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

