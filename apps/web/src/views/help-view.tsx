"use client"

import { PricingGuide } from "@munim/ui"
import { BadgeIndianRupee, LifeBuoy } from "lucide-react"
import { useAppStore } from "@/store/view-store"

/** Help / Pricing guide — same body as the desktop Help page (AGENTS §4b parity). */
export function HelpView() {
  const setActiveView = useAppStore((s) => s.setActiveView)
  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">Help</h1>
            <span className="bg-primary/10 text-primary rounded-full px-2.5 py-1 text-[10px] font-bold tracking-wide uppercase">
              Pricing Guide
            </span>
          </div>
          <p className="text-muted-foreground mt-1 max-w-2xl text-sm">
            How Munim prices gold &amp; silver, where rates and labour live, and how to push a rate change through
            every list, label and bill.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              // Deep-link Settings → Rates & labour (consumed at mount).
              const url = new URL(window.location.href)
              url.searchParams.set("section", "gold")
              window.history.replaceState({}, "", url)
              setActiveView("settings")
            }}
            className="border-input bg-background hover:bg-muted inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm font-medium"
          >
            <BadgeIndianRupee className="h-4 w-4" />
            Open Rates &amp; labour
          </button>
        </div>
      </div>
      <div className="text-muted-foreground mb-1 flex items-center gap-2 text-xs">
        <LifeBuoy className="h-3.5 w-3.5" />
        Prices · rates · labels · barcodes
      </div>
      <PricingGuide />
    </div>
  )
}
