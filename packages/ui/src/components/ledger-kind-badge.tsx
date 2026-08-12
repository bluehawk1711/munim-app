"use client"

/**
 * Shared ledger-kind badge — the colored chip shown next to a ledger line
 * (Advance given/taken, Bill, Paid us, We paid). Used by the web + desktop
 * parties screens so both show the same mapping.
 */
import { cn } from "../lib/utils";
import { Badge } from "./badge";

export type LedgerKind =
  | "ADVANCE_GIVEN"
  | "ADVANCE_TAKEN"
  | "INVOICE"
  | "PAYMENT_IN"
  | "PAYMENT_OUT";

const KIND_STYLES: Record<string, string> = {
  ADVANCE_GIVEN: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  ADVANCE_TAKEN: "bg-red-500/15 text-red-600 dark:text-red-400",
  INVOICE: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  PAYMENT_IN: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  PAYMENT_OUT: "bg-red-500/15 text-red-600 dark:text-red-400",
};

const KIND_LABELS: Record<string, string> = {
  ADVANCE_GIVEN: "Given",
  ADVANCE_TAKEN: "Taken",
  INVOICE: "Bill",
  PAYMENT_IN: "Paid us",
  PAYMENT_OUT: "We paid",
};

export function LedgerKindBadge({ kind }: { kind: string }) {
  return (
    <Badge className={cn("font-normal", KIND_STYLES[kind] ?? "bg-muted text-muted-foreground")}>
      {KIND_LABELS[kind] ?? kind}
    </Badge>
  );
}
