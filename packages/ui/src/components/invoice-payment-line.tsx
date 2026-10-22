/**
 * InvoicePaymentLine — the Orders-style money line under an invoice row:
 * "Paid ₹5,000/- · ₹12,200/- due" (amber) or a green tick "Paid ₹12,200/-"
 * when fully settled, "Nothing received yet" when nothing was paid.
 *
 * Shared by the web AND desktop invoice lists so the two stay identical —
 * purely presentational; the parent passes the invoice's own numbers.
 */
import * as React from "react";
import { CheckCircle2 } from "lucide-react";
import { cn } from "../lib/utils";
import { formatMoney } from "../lib/format";

export function InvoicePaymentLine({
  total,
  amountPaid,
  className,
}: {
  total: number;
  amountPaid: number;
  className?: string;
}) {
  const paid = Math.min(Math.max(0, amountPaid), total);
  const due = Math.max(0, total - paid);
  const settled = due <= 0 && paid > 0;

  if (paid <= 0) {
    return <p className={cn("text-[11px] text-muted-foreground tabular-nums", className)}>Nothing received yet</p>;
  }
  return (
    <p
      className={cn(
        "flex items-center gap-1 text-[11px] tabular-nums",
        settled ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400",
        className,
      )}
    >
      {settled ? <CheckCircle2 className="h-3 w-3 shrink-0" aria-hidden /> : null}
      <span>
        Paid {formatMoney(paid)}
        {settled ? "" : ` · ${formatMoney(due)} due`}
      </span>
    </p>
  );
}
