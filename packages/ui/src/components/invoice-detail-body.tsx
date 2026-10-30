"use client"

/**
 * InvoiceDetailBody — the full "what is on this bill" read-out shared by the
 * web and desktop invoice detail dialogs (AGENTS.md §4b: never fork it).
 *
 * Everything the bill froze at sale time is shown: customer + khata link,
 * every line with its weight/purity working AND the pricing breakdown that
 * produced the price (rate, karat, metal, labour, charges), material returned,
 * the bill's own gold/silver rates, notes and the payment trail with method.
 *
 * Presentational: the host owns the dialog chrome and the actions.
 */
import * as React from "react"
import {
  calcNetWeight,
  formatCurrency,
  formatDate,
  paymentMethodLabel,
  type InvoiceDto,
  type InvoiceItemPricing,
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

/** The frozen pricing inputs behind a line — exactly what the printed bill's
 *  Rate/Labour/Other columns were derived from. Missing slices are hidden. */
function PricingReadout({ pricing }: { pricing: InvoiceItemPricing }) {
  const otherCharges = (pricing.nag ?? 0) + (pricing.povayi ?? 0) + (pricing.other ?? 0)
  return (
    <div className="mt-1.5 grid grid-cols-2 gap-x-4 gap-y-0.5 rounded-md bg-muted/40 px-2 py-1.5 text-[11px] text-muted-foreground sm:grid-cols-4">
      <span>
        {pricing.metal} @ {formatCurrency(pricing.ratePerGram)}/g
        {pricing.karat ? ` · ${pricing.karat}K` : ""}
        {pricing.silverPercentage != null ? ` · ${pricing.silverPercentage}%` : ""}
      </span>
      {pricing.weightGm != null && <span>Priced weight {pricing.weightGm.toFixed(3)} gm</span>}
      {pricing.metalValue != null && <span>Metal {formatCurrency(pricing.metalValue)}</span>}
      {pricing.labourAmount != null && (
        <span>
          Labour {formatCurrency(pricing.labourAmount)}
          {pricing.labourType && pricing.labourValue != null
            ? ` (${pricing.labourType === "PERCENT" ? `${pricing.labourValue}%` : pricing.labourType === "FIXED" ? formatCurrency(pricing.labourValue) : `${formatCurrency(pricing.labourValue)}/g`})`
            : ""}
        </span>
      )}
      {otherCharges > 0 && <span>Other charges {formatCurrency(otherCharges)}</span>}
    </div>
  )
}

function lineNetWeight(item: InvoiceDto["items"][number]): number | null {
  // Gold lines price on the derived net weight; silver lines carry a plain
  // weight. Only derive when the bill actually stored the gross/nag/chejat
  // basis — `calcNetWeight` (core) is the ONE derivation all forms use.
  if (item.nagLessWeight == null && item.chejatWeight == null) return null
  const net = calcNetWeight({
    grossWeight: item.grossWeight,
    nagLessWeight: item.nagLessWeight == null ? "" : String(item.nagLessWeight),
    chejatWeight: item.chejatWeight == null ? "" : String(item.chejatWeight),
    weightUnit: item.weightUnit,
    nagUnit: "gm",
  })
  return net ? net.grams : null
}

export function InvoiceDetailBody({
  invoice,
  payments,
  partyName,
  className,
}: {
  invoice: InvoiceDto
  /** The invoice's payment trail (amount · method · note · date). */
  payments?: PaymentDto[] | null
  /** Khata party this bill is linked to, when one is set. */
  partyName?: string | null
  className?: string
}) {
  const outstanding = invoice.total - invoice.amountPaid

  return (
    <div className={cn("space-y-4 text-sm", className)}>
      {/* Customer */}
      <Section title="Customer">
        <p className="font-medium">{invoice.customerName || "Walk-in customer"}</p>
        {invoice.customerPhone && <p className="text-xs text-muted-foreground">{invoice.customerPhone}</p>}
        {invoice.customerAddress && <p className="text-xs text-muted-foreground">{invoice.customerAddress}</p>}
        {partyName && (
          <p className="mt-1 text-[11px] text-muted-foreground">
            Khata: <span className="font-medium text-foreground">{partyName}</span>
          </p>
        )}
      </Section>

      {/* Line items — every frozen detail, not just name/qty/price. */}
      <div className="overflow-hidden rounded-lg border">
        <div className="flex items-center justify-between bg-muted/50 px-3 py-2 text-xs font-semibold text-muted-foreground">
          <span>
            Items · {invoice.items.length} line{invoice.items.length === 1 ? "" : "s"}
          </span>
          <span className="tabular-nums">{formatCurrency(invoice.subtotal)}</span>
        </div>
        <div className="divide-y">
          {invoice.items.map((item) => {
            const net = lineNetWeight(item)
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
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                  {item.purity && <span>Purity {item.purity}</span>}
                  {item.weight != null && (
                    <span>
                      Wt {item.weight}
                      {item.weightUnit ?? "gm"}
                    </span>
                  )}
                  {item.grossWeight && <span>G. Wt {item.grossWeight}</span>}
                  {item.nagLessWeight != null && <span>Nag {item.nagLessWeight} gm</span>}
                  {item.chejatWeight != null && <span>Chejat {item.chejatWeight} gm</span>}
                  {net != null && <span>Net {net.toFixed(3)} gm</span>}
                </div>
                {item.pricing && <PricingReadout pricing={item.pricing} />}
              </div>
            )
          })}
        </div>
      </div>

      {/* Totals */}
      <Section title="Totals">
        <div className="space-y-1.5">
          <MoneyRow label="Subtotal" value={formatCurrency(invoice.subtotal)} />
          {invoice.discount > 0 && <MoneyRow label="Discount" value={`-${formatCurrency(invoice.discount)}`} tone="red" />}
          {invoice.deliveryCharge > 0 && (
            <MoneyRow label="Delivery" value={`+${formatCurrency(invoice.deliveryCharge)}`} />
          )}
          {invoice.materialReturnedValue > 0 && (
            <MoneyRow
              label={`${invoice.materialReturnedTitle?.trim() || "Material returned"}${
                invoice.materialReturnedWeight ? ` (${invoice.materialReturnedWeight})` : ""
              }`}
              value={`-${formatCurrency(invoice.materialReturnedValue)}`}
              tone="red"
            />
          )}
          <div className="flex justify-between border-t pt-1.5 text-sm font-bold">
            <span>Total</span>
            <span className="tabular-nums">{formatCurrency(invoice.total)}</span>
          </div>
          <MoneyRow label="Paid" value={formatCurrency(invoice.amountPaid)} tone="emerald" />
          {outstanding > 0 && <MoneyRow label="Outstanding" value={formatCurrency(outstanding)} tone="amber" />}
        </div>
      </Section>

      {/* Rates frozen on THIS bill (not the shop's current rate). */}
      {(invoice.goldRate != null || invoice.silverRate != null) && (
        <Section title="Rates on this bill">
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {invoice.goldRate != null && <span>Gold {formatCurrency(invoice.goldRate)}/g</span>}
            {invoice.silverRate != null && <span>Silver {formatCurrency(invoice.silverRate)}/g</span>}
          </div>
        </Section>
      )}

      {invoice.notes && (
        <Section title="Notes">
          <p className="text-xs">{invoice.notes}</p>
        </Section>
      )}

      {/* Payments — the full trail: how much, when, and HOW (cash/upi/…). */}
      {(payments?.length ?? 0) > 0 && (
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
                  {p.note && p.note !== `Payment for ${invoice.invoiceNumber}` && (
                    <p className="truncate text-[11px] text-muted-foreground">{p.note}</p>
                  )}
                </div>
                <span className="shrink-0 text-[11px] text-muted-foreground">{formatDate(p.date)}</span>
              </div>
            ))}
          </div>
        </Section>
      )}
    </div>
  )
}
