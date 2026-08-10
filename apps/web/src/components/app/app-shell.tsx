"use client"

import * as React from "react"
import { AnimatePresence, motion } from "motion/react"
import { SidebarNav, SidebarHeader, SidebarFooter } from "@/components/app/sidebar-nav"
import { AppTopbar } from "@/components/app/app-topbar"
import { SellProductDialog } from "@/components/sales/sell-product-dialog"
import { DashboardView } from "@/views/dashboard-view"
import { ProductsView } from "@/views/products-view"
import { SalesView } from "@/views/sales-view"
import { ReportsView } from "@/views/reports-view"
import { CatalogView } from "@/views/catalog-view"
import { InvoicesView } from "@/views/invoices-view"
import { BillingView } from "@/views/billing-view"
import { JobLetterView } from "@/views/job-letter-view"
import { PartiesView } from "@/views/parties-view"
import { AdvancesView } from "@/views/advances-view"
import { SettingsView } from "@/views/settings-view"
import { useAppStore } from "@/store/view-store"

const VIEW_COMPONENTS: Record<string, React.ComponentType> = {
  dashboard: DashboardView,
  products: ProductsView,
  sales: SalesView,
  reports: ReportsView,
  catalog: CatalogView,
  invoices: InvoicesView,
  billing: BillingView,
  "job-letter": JobLetterView,
  parties: PartiesView,
  advances: AdvancesView,
  settings: SettingsView,
}

function ActiveView() {
  const activeView = useAppStore((s) => s.activeView)
  const Component = VIEW_COMPONENTS[activeView] ?? DashboardView

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={activeView}
        initial={{ opacity: 0, y: 12, filter: "blur(4px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        exit={{ opacity: 0, y: -8, filter: "blur(4px)" }}
        transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
      >
        <Component />
      </motion.div>
    </AnimatePresence>
  )
}

export function AppShell() {
  return (
    <div className="flex min-h-screen flex-col bg-muted/30">
      <div className="flex flex-1">
        {/* Desktop sidebar */}
        <aside className="hidden w-64 shrink-0 border-r bg-sidebar lg:flex lg:flex-col">
          <SidebarHeader />
          <div className="flex-1 overflow-y-auto scrollbar-thin">
            <SidebarNav />
          </div>
          <SidebarFooter />
        </aside>

        {/* Main column */}
        <div className="flex min-w-0 flex-1 flex-col">
          <AppTopbar />
          <main className="flex-1 p-4 lg:p-6" id="main-content">
            <React.Suspense
              fallback={
                <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
                    <span className="h-2 w-2 animate-pulse rounded-full bg-primary/60" style={{ animationDelay: "0.2s" }} />
                    <span className="h-2 w-2 animate-pulse rounded-full bg-primary/30" style={{ animationDelay: "0.4s" }} />
                    Loading…
                  </div>
                </div>
              }
            >
              <ActiveView />
            </React.Suspense>
          </main>
          <footer className="mt-auto border-t bg-background px-4 py-3 lg:px-6">
            <div className="flex flex-col items-center justify-between gap-2 text-xs text-muted-foreground sm:flex-row">
              <p>
                © {new Date().getFullYear()} Munim — Stock, Billing &amp; Khata Management
              </p>
              <p className="flex items-center gap-1.5">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary" />
                Web · Desktop · Mobile on one shared database
              </p>
            </div>
          </footer>
        </div>
      </div>
      <SellProductDialog />
    </div>
  )
}