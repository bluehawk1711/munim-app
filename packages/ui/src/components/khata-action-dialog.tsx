"use client"

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
import { HandCoins, Loader2 } from "lucide-react";
import { Button } from "./button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./dialog";
import { Input } from "./input";
import { Label } from "./label";
import { formatMoney } from "../lib/format";

export function KhataActionDialog({
  open,
  onOpenChange,
  title,
  subtitle,
  balance,
  busy,
  confirmLabel = "Confirm",
  onConfirm,
}: {
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
  onConfirm: (input: { amount: number; note: string }) => void;
}) {
  const [amount, setAmount] = React.useState(0);
  const [note, setNote] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!amount || amount <= 0) {
      setError("Enter an amount greater than 0.");
      return;
    }
    setError(null);
    onConfirm({ amount, note });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[380px]">
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {subtitle ? <DialogDescription>{subtitle}</DialogDescription> : null}
          </DialogHeader>
          <div className="space-y-4 py-2">
            {balance !== undefined ? (
              <div className="flex items-center justify-between rounded-lg bg-muted/50 p-3 text-sm">
                <span className="text-muted-foreground">Current balance</span>
                <span className="font-semibold">{formatMoney(balance)}</span>
              </div>
            ) : null}
            <div className="space-y-1.5">
              <Label className="text-xs">Amount (₹)</Label>
              <Input
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
              <Label className="text-xs">Note (optional)</Label>
              <Input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. gold purchase advance"
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
                <>
                  <HandCoins className="mr-1.5 h-4 w-4" />
                  {confirmLabel}
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

