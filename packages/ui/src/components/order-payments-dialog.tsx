"use client";

/**
 * OrderPaymentsDialog — the order's full advance/payment trail, shared by the
 * web and desktop order lists (AGENTS.md §4b: one component, never a fork).
 *
 * Mobile has always had a dedicated History button next to each order; web and
 * desktop only showed the trail buried inside the order detail dialog. This is
 * that same trail as its own dialog so parity is one click away on every app.
 *
 * Presentational + controlled: the parent owns `open`, the selected order and
 * the fetched `payments` (useOrderPayments).
 */
import * as React from "react";
import { History } from "lucide-react";
import { formatCurrency, formatDate, paymentMethodLabel, type OrderDto, type PaymentDto } from "@munim/core";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./dialog";
import { Separator } from "./separator";
import { cn } from "../lib/utils";

export function OrderPaymentsDialog({
  open,
  onOpenChange,
  order,
  payments,
  className,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Order whose trail is shown (null while nothing is selected). */
  order: OrderDto | null;
  /** `useOrderPayments(order?.id ?? null)` result. */
  payments?: PaymentDto[] | null;
  className?: string;
}) {
  const rows = payments ?? [];
  const tracked = rows.reduce((sum, p) => sum + p.amount, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn("sm:max-w-md", className)}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-4 w-4" />
            Payment history
          </DialogTitle>
          <DialogDescription>
            {order ? (
              <>
                {order.orderNumber} · {order.customerName || "Walk-in customer"} · {formatDate(order.date)}
              </>
            ) : null}
          </DialogDescription>
        </DialogHeader>

        {order ? (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2 rounded-lg border p-3 text-center">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Order</p>
                <p className="text-sm font-bold tabular-nums">{formatCurrency(order.total)}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Received</p>
                <p className="text-sm font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                  {formatCurrency(order.amountPaid)}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Due</p>
                <p
                  className={cn(
                    "text-sm font-bold tabular-nums",
                    order.dueAmount > 0 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400",
                  )}
                >
                  {formatCurrency(order.dueAmount)}
                </p>
              </div>
            </div>

            <Separator />

            <div className="max-h-72 space-y-2 overflow-y-auto">
              {rows.length === 0 ? (
                <p className="py-6 text-center text-xs text-muted-foreground">
                  {order.amountPaid > 0
                    ? `${formatCurrency(order.amountPaid)} was received before payment history was tracked.`
                    : "No payments recorded on this order yet."}
                </p>
              ) : (
                rows.map((p) => (
                  <div key={p.id} className="flex items-start justify-between gap-3 rounded-lg border px-3 py-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold tabular-nums">
                        {formatCurrency(p.amount)}
                        <span className="ml-1.5 rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase text-muted-foreground">
                          {paymentMethodLabel(p.method)}
                        </span>
                      </p>
                      {p.note ? (
                        <p className="truncate text-[11px] text-muted-foreground">{p.note}</p>
                      ) : null}
                    </div>
                    <span className="shrink-0 text-[11px] text-muted-foreground">{formatDate(p.date)}</span>
                  </div>
                ))
              )}
            </div>

            {rows.length > 0 ? (
              <p className="text-right text-[11px] text-muted-foreground">
                {rows.length} payment{rows.length !== 1 ? "s" : ""} tracked ·{" "}
                <span className="font-semibold tabular-nums">{formatCurrency(tracked)}</span>
              </p>
            ) : null}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
