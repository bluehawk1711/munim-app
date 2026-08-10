"use client"

import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  FileBarChart,
  Boxes,
  Palette,
  Receipt,
  FileText,
  Users,
  HandCoins,
  Settings,
} from "lucide-react"
import { useAppStore, type ViewKey } from "@/store/view-store"
import { cn } from "@/lib/utils"

const NAV_SECTIONS: {
  label: string
  items: {
    key: ViewKey
    label: string
    icon: React.ComponentType<{ className?: string }>
    description: string
  }[]
}[] = [
  {
    label: "Overview",
    items: [
      { key: "dashboard", label: "Dashboard", icon: LayoutDashboard, description: "Overview & analytics" },
    ],
  },
  {
    label: "Inventory",
    items: [
      { key: "products", label: "Products", icon: Package, description: "Manage inventory" },
      { key: "sales", label: "Sales", icon: ShoppingCart, description: "Sell & history" },
      { key: "catalog", label: "Catalog", icon: Palette, description: "Colors, sizes & categories" },
    ],
  },
  {
    label: "Billing & Docs",
    items: [
      { key: "invoices", label: "Invoices", icon: Receipt, description: "All bills & statuses" },
      { key: "billing", label: "New Bill", icon: Boxes, description: "Create a bill / invoice" },
      { key: "job-letter", label: "Job Letters", icon: FileText, description: "Offer letters" },
    ],
  },
  {
    label: "Khata",
    items: [
      { key: "parties", label: "Parties", icon: Users, description: "Customers, suppliers, workers" },
      { key: "advances", label: "Advances", icon: HandCoins, description: "Who owes whom" },
    ],
  },
  {
    label: "Insights",
    items: [
      { key: "reports", label: "Reports", icon: FileBarChart, description: "Export & analyze" },
    ],
  },
  {
    label: "System",
    items: [
      { key: "settings", label: "Settings", icon: Settings, description: "Shop profile & database" },
    ],
  },
]

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const activeView = useAppStore((s) => s.activeView)
  const setView = useAppStore((s) => s.setView)

  return (
    <nav className="flex flex-col gap-4 px-3 py-4" aria-label="Main navigation">
      {NAV_SECTIONS.map((section) => (
        <div key={section.label}>
          <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
            {section.label}
          </p>
          <div className="flex flex-col gap-0.5">
            {section.items.map((item) => {
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
                    "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                    "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                    active
                      ? "bg-sidebar-primary/10 text-sidebar-primary shadow-sm"
                      : "text-sidebar-foreground/80 hover:text-sidebar-foreground"
                  )}
                >
                  {/* Active pill indicator */}
                  {active && (
                    <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-full bg-sidebar-primary transition-all duration-300" />
                  )}
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="flex flex-col items-start leading-tight">
                    <span>{item.label}</span>
                    <span
                      className={cn(
                        "text-[11px] font-normal",
                        active ? "text-sidebar-primary-foreground/60" : "text-muted-foreground"
                      )}
                    >
                      {item.description}
                    </span>
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </nav>
  )
}

export function SidebarHeader() {
  return (
    <div className="flex items-center gap-2.5 px-5 h-16 border-b border-sidebar-border">
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-sm shadow-primary/20">
        <Boxes className="h-5 w-5" />
      </div>
      <div className="flex flex-col leading-tight">
        <span className="text-sm font-semibold text-sidebar-foreground">Munim</span>
        <span className="text-[11px] text-muted-foreground">Shop Management</span>
      </div>
    </div>
  )
}

export function SidebarFooter() {
  return (
    <div className="px-5 py-4 border-t border-sidebar-border">
      <p className="text-[11px] text-muted-foreground">Stock · Billing · Khata</p>
    </div>
  )
}