"use client";

/**
 * PricingGuide — the shared "how pricing works" body behind the Help page.
 *
 * Web and desktop render this verbatim (AGENTS §4b parity), so the wording
 * about rates, labour, auto/manual and the Recalculate action can never drift
 * between the two apps. Presentational only — no data fetching; the pages
 * above it decide which header/badge to show.
 */
import * as React from "react";
import { BadgeIndianRupee, Calculator, Percent, IndianRupee, Scale, RefreshCw, ScanLine, Tag } from "lucide-react";
import { Card, CardContent } from "./card";

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="space-y-3 pt-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Icon className="text-primary h-4 w-4" />
          {title}
        </h2>
        {children}
      </CardContent>
    </Card>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-2.5 text-sm">
      <span className="bg-primary/10 text-primary mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold">
        {n}
      </span>
      <span className="text-muted-foreground">{children}</span>
    </li>
  );
}

const LABOUR_METHODS: { icon: React.ComponentType<{ className?: string }>; name: string; blurb: string }[] = [
  { icon: Percent, name: "Percent", blurb: "A share of the metal value — e.g. 12% making charge." },
  { icon: IndianRupee, name: "Fixed", blurb: "One rupee amount for the whole piece — e.g. ₹250." },
  { icon: Scale, name: "Per gram", blurb: "Rate × net weight — e.g. ₹180/g." },
];

export function PricingGuide({ className }: { className?: string }) {
  return (
    <div className={className ? `space-y-4 ${className}` : "space-y-4"}>
      {/* ── The formula ─────────────────────────────────────────────── */}
      <Section icon={Calculator} title="How a price is calculated">
        <p className="text-muted-foreground text-sm">
          Metal products compute their price on <strong>read</strong> — nothing is stored until you say so. Two
          modes, one per product:
        </p>
        <div className="bg-muted/50 space-y-2 rounded-lg border p-3 font-mono text-xs">
          <p>
            <span className="text-primary font-semibold">Gold (Auto)</span> = net weight (gm) × karat rate (₹/g) +
            labour
          </p>
          <p>
            <span className="text-primary font-semibold">Silver (Auto)</span> = weight (gm) × silver% × silver rate
            (₹/g) + labour
          </p>
          <p>
            <span className="text-muted-foreground font-semibold">Manual</span> = the Selling price you typed
          </p>
        </div>
        <p className="text-muted-foreground text-sm">
          Lists, pickers, labels, exports and stock valuations all read this computed price, so editing a rate
          re-prices the whole shop instantly. Invoices already created keep the totals they were billed at.
        </p>
      </Section>

      {/* ── Rates & labour ──────────────────────────────────────────── */}
      <Section icon={BadgeIndianRupee} title="Rates & labour (Settings → Rates & labour)">
        <ul className="text-muted-foreground space-y-2 text-sm">
          <li>
            <strong className="text-foreground">Gold base rate</strong> — ₹/gram for the base karat (the highest
            quoted one). The other 0–24 karats follow it unless you pin them individually in the 0–24 grid.
          </li>
          <li>
            <strong className="text-foreground">Silver rate</strong> — shop-wide ₹/gram. Leave it at 0 and silver
            products stay on their manual price.
          </li>
          <li>
            <strong className="text-foreground">Shop default labour</strong> — the fallback for gold products that
            don&apos;t declare their own labour. Silver labour is always set per product.
          </li>
        </ul>
        <div className="grid gap-2 sm:grid-cols-3">
          {LABOUR_METHODS.map((m) => (
            <div key={m.name} className="bg-muted/40 rounded-lg border p-3">
              <p className="flex items-center gap-1.5 text-xs font-semibold">
                <m.icon className="text-primary h-3.5 w-3.5" /> {m.name}
              </p>
              <p className="text-muted-foreground mt-1 text-xs">{m.blurb}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* ── Auto vs manual on a product ─────────────────────────────── */}
      <Section icon={Tag} title="Setting a product to Auto">
        <ol className="space-y-2">
          <Step n={1}>
            Open <strong>Products → Add / Edit</strong> and pick type <strong>Gold</strong> or{" "}
            <strong>Silver</strong>.
          </Step>
          <Step n={2}>
            Choose a karat (gold) or confirm the silver %, then set <strong>Pricing → Auto</strong>. The Selling
            price field becomes read-only and shows the calculated value.
          </Step>
          <Step n={3}>
            Pick the labour for this piece — leave it empty to fall back to the shop default.
          </Step>
          <Step n={4}>
            Save. The preview, the list, the label and billing all show the same calculated price.
          </Step>
        </ol>
        <p className="text-muted-foreground text-sm">
          Products show a classification chip everywhere they appear — <strong>Gold · 22K</strong>,{" "}
          <strong>Silver · 92.5 Stock</strong> — so the picker, table and details agree on what an item is.
        </p>
      </Section>

      {/* ── Recalculate ─────────────────────────────────────────────── */}
      <Section icon={RefreshCw} title="Recalculate prices">
        <p className="text-muted-foreground text-sm">
          Auto prices live on read, so lists always show the latest rates. The <strong>stored</strong> price is only
          used when a rate is missing (the fallback) — <strong>Recalculate prices</strong> freezes today&apos;s
          computed price into every auto-priced product. It is idempotent, never touches manual prices, and reports
          how many rows changed.
        </p>
        <ul className="text-muted-foreground space-y-1.5 text-sm">
          <li>▸ <strong>Products page</strong> — in the action row, next to Export CSV.</li>
          <li>▸ <strong>Billing / Sales</strong> — refreshes the items already picked into the bill.</li>
          <li>▸ <strong>Settings → Rates & labour</strong> — press it right after saving new rates.</li>
        </ul>
        <p className="text-muted-foreground text-sm">
          Tip: change a rate → <strong>Save</strong> → <strong>Recalculate now</strong>. Lists on all three apps
          pick up the new numbers immediately.
        </p>
      </Section>

      {/* ── Counter tips ────────────────────────────────────────────── */}
      <Section icon={ScanLine} title="Speeding up the counter">
        <ul className="text-muted-foreground space-y-1.5 text-sm">
          <li>
            ▸ <strong>Scan to add</strong> — USB scanners act like a keyboard: focus the barcode field on Billing,
            scan, and the product drops into the next line at its current price.
          </li>
          <li>
            ▸ <strong>Missing barcodes?</strong> Products → <em>Generate barcodes</em> backfills a unique EAN-13 for
            every product that doesn&apos;t have one; SKU stays independent.
          </li>
          <li>
            ▸ <strong>Labels</strong> — select rows on Products → Print Label for shelf tickets with the barcode and
            the current price.
          </li>
        </ul>
      </Section>
    </div>
  );
}
