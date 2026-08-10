"use client"

import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  FileBarChart,
  Boxes,
  Palette,
} from "lucide-react"
import { useAppStore, type ViewKey } from "@/store/view-store"
import { cn } from "@/lib/utils"

const NAV_ITEMS: {
  key: ViewKey
  label: string
  icon: React.ComponentType<{ className?: string }>
  description: string
}[] = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard, description: "Overview & analytics" },
  { key: "products", label: "Products", icon: Package, description: "Manage inventory" },
  { key: "sales", label: "Sales", icon: ShoppingCart, description: "Sell & history" },
  { key: "reports", label: "Reports", icon: FileBarChart, description: "Export & analyze" },
  { key: "catalog", label: "Catalog", icon: Palette, description: "Colors & sizes" },
]

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const activeView = useAppStore((s) => s.activeView)
  const setView = useAppStore((s) => s.setView)

  return (
    <nav className="flex flex-col gap-1 px-3 py-4" aria-label="Main navigation">
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon
        const active = activeView === item.key
        return (
          <button
            key={item.key}
            type="button"
            onClick={() => {
              setView(item.key)
              onNavigate?.()
            }}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
              "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              active
                ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                : "text-sidebar-foreground/80"
            )}
          >
            <Icon className="h-5 w-5 shrink-0" />
            <span className="flex flex-col items-start leading-tight">
              <span>{item.label}</span>
              <span
                className={cn(
                  "text-[11px] font-normal",
                  active ? "text-sidebar-primary-foreground/70" : "text-muted-foreground"
                )}
              >
                {item.description}
              </span>
            </span>
          </button>
        )
      })}
    </nav>
  )
}

export function SidebarHeader() {
  return (
    <div className="flex items-center gap-2.5 px-5 h-16 border-b border-sidebar-border">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground shadow-sm">
        <Boxes className="h-5 w-5" />
      </div>
      <div className="flex flex-col leading-tight">
        <span className="text-sm font-semibold text-sidebar-foreground">StockPilot</span>
        <span className="text-[11px] text-muted-foreground">Inventory & Sales</span>
      </div>
    </div>
  )
}

export function SidebarFooter() {
  return (
    <div className="px-5 py-4 border-t border-sidebar-border">
      <p className="text-[11px] text-muted-foreground">
        v1.0 · Desktop optimized
      </p>
    </div>
  )
}
