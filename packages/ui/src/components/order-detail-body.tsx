"use client"

/**
 * OrderDetailBody — the full "what is on this order" read-out shared by the
 * web and desktop order detail dialogs (AGENTS.md §4b: never fork it).
 *
 * Shows everything the quote carries: customer + khata link, every line
 * (qty · quoted price · line total · sku/colour/size/weight/description),
 * the quoted totals, what was received, what is still due, notes and the
 * payment trail with the method each advance came in by.
 *
 * Presentational: the host owns the dialog chrome and the actions.
 */
import * as React from "react"
import {
  formatCurrency,
  formatDate,
  paymentMethodLabel,
  type OrderDto,
  type PaymentDto,
} from "@munim/core"
import { cn } from "../lib/utils"

function Section({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-lg border p-3", className)}>
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      {children}
    </div>
  )
}

function MoneyRow({ label, value, tone }: { label: string; value: string; tone?: "red" | "emerald" | "amber" }) {
  return (
    <div className="flex justify-between text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={cn(
          "tabular-nums",
          tone === "red" && "text-red-600 dark:text-red-400",
          tone === "emerald" && "text-emerald-600 dark:text-emerald-400",
          tone === "amber" && "text-amber-600 dark:text-amber-400",
        )}
      >
        {value}
      </span>
    </div>
  )
}

export function OrderDetailBody({
  order,
  payments,
  partyName,
  className,
}: {
  order: OrderDto
  /** The order's payment trail (amount · method · note · date). */
  payments?: PaymentDto[] | null
  /** Khata party this order is linked to, when one is set. */
  partyName?: string | null
  className?: string
}) {
  return (
    <div className={cn("space-y-4 text-sm", className)}>
      {/* Customer */}
      <Section title="Customer">
        <p className="font-medium">{order.customerName || "Walk-in customer"}</p>
        {order.customerPhone && <p className="text-xs text-muted-foreground">{order.customerPhone}</p>}
        {order.customerAddress && <p className="text-xs text-muted-foreground">{order.customerAddress}</p>}
        {partyName && (
          <p className="mt-1 text-[11px] text-muted-foreground">
            Khata: <span className="font-medium text-foreground">{partyName}</span>
          </p>
        )}
      </Section>

      {/* Lines — what was quoted, at what price. */}
      <div className="overflow-hidden rounded-lg border">
        <div className="flex items-center justify-between bg-muted/50 px-3 py-2 text-xs font-semibold text-muted-foreground">
          <span>
            Items · {order.items.length} line{order.items.length === 1 ? "" : "s"}
          </span>
          <span className="tabular-nums">{formatCurrency(order.subtotal)}</span>
        </div>
        <div className="divide-y">
          {order.items.map((item) => {
            const meta = [item.sku, item.color, item.size].filter(Boolean).join(" · ")
            return (
              <div key={item.id} className="space-y-1 px-3 py-2.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{item.productName}</p>
                    {meta && <p className="truncate text-[11px] text-muted-foreground">{meta}</p>}
                    {item.description && (
                      <p className="truncate text-[11px] text-muted-foreground">{item.description}</p>
                    )}
                  </div>
                  <div className="shrink-0 text-right tabular-nums">
                    <p className="font-medium">{formatCurrency(item.total)}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {item.quantity} × {formatCurrency(item.price)}
                    </p>
                  </div>
                </div>
                {item.weight != null && (
                  <p className="text-[11px] text-muted-foreground">
                    Wt {item.weight}
                    {item.weightUnit ?? "gm"}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Quoted totals + money state */}
      <Section title="Quoted totals">
        <div className="space-y-1.5">
          <MoneyRow label="Subtotal" value={formatCurrency(order.subtotal)} />
          {order.discount > 0 && <MoneyRow label="Discount" value={`-${formatCurrency(order.discount)}`} tone="red" />}
          {order.deliveryCharge > 0 && (
            <MoneyRow label="Delivery" value={`+${formatCurrency(order.deliveryCharge)}`} />
          )}
          <div className="flex justify-between border-t pt-1.5 text-sm font-bold">
            <span>Quoted total</span>
            <span className="tabular-nums">{formatCurrency(order.total)}</span>
          </div>
          <MoneyRow label="Received" value={formatCurrency(order.amountPaid)} tone="emerald" />
          <div className="flex justify-between border-t pt-1.5 text-sm font-bold">
            <span>{order.dueAmount > 0 ? "Balance due" : "Settled in full"}</span>
            <span
              className={cn(
                "tabular-nums",
                order.dueAmount > 0 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400",
              )}
            >
              {formatCurrency(order.dueAmount)}
            </span>
          </div>
        </div>
      </Section>

      {order.notes && (
        <Section title="Notes">
          <p className="text-xs">{order.notes}</p>
        </Section>
      )}

      {/* Payments — every advance with the method it came in by. */}
      {(payments?.length ?? 0) > 0 ? (
        <Section title="Payments">
          <div className="space-y-1.5">
            {payments?.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-2 text-xs">
                <div className="min-w-0">
                  <p className="font-medium">
                    {formatCurrency(p.amount)}
                    <span className="ml-1.5 rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase text-muted-foreground">
                      {paymentMethodLabel(p.method)}
                    </span>
                  </p>
                  {p.note && <p className="truncate text-[11px] text-muted-foreground">{p.note}</p>}
                </div>
                <span className="shrink-0 text-[11px] text-muted-foreground">{formatDate(p.date)}</span>
              </div>
            ))}
          </div>
        </Section>
      ) : order.amountPaid > 0 ? (
        <Section title="Payments">
          <p className="text-xs text-muted-foreground">
            {formatCurrency(order.amountPaid)} was received before payment history was tracked.
          </p>
        </Section>
      ) : null}
    </div>
  )
}
