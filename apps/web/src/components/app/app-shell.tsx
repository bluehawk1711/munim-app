"use client"

import * as React from "react"
import { SidebarNav, SidebarHeader, SidebarFooter } from "@/components/app/sidebar-nav"
import { AppTopbar } from "@/components/app/app-topbar"
import { SellProductDialog } from "@/components/sales/sell-product-dialog"
import { DashboardView } from "@/views/dashboard-view"
import { ProductsView } from "@/views/products-view"
import { SalesView } from "@/views/sales-view"
import { ReportsView } from "@/views/reports-view"
import { CatalogView } from "@/views/catalog-view"
import { useAppStore } from "@/store/view-store"

function ActiveView() {
  const activeView = useAppStore((s) => s.activeView)
  switch (activeView) {
    case "dashboard":
      return <DashboardView />
    case "products":
      return <ProductsView />
    case "sales":
      return <SalesView />
    case "reports":
      return <ReportsView />
    case "catalog":
      return <CatalogView />
    default:
      return <DashboardView />
  }
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
                  Loading…
                </div>
              }
            >
              <ActiveView />
            </React.Suspense>
          </main>
          <footer className="mt-auto border-t bg-background px-4 py-3 lg:px-6">
            <div className="flex flex-col items-center justify-between gap-2 text-xs text-muted-foreground sm:flex-row">
              <p>
                © {new Date().getFullYear()} StockPilot — Inventory & Sales Management
              </p>
              <p className="flex items-center gap-1.5">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary" />
                Built with Next.js, Prisma &amp; shadcn/ui
              </p>
            </div>
          </footer>
        </div>
      </div>

      {/* Global quick-sell dialog */}
      <SellProductDialog />
    </div>
  )
}
