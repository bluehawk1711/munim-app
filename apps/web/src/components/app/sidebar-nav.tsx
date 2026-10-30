"use client"

import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  FileBarChart,
  Boxes,
  Palette,
  Receipt,
  ClipboardList,
  FileText,
  Users,
  HandCoins,
  Settings,
  CircleHelp,
  Tag,
} from "lucide-react"
import { SidebarBrand, SidebarFooter as SharedSidebarFooter, SidebarNav as SharedSidebarNav } from "@munim/ui"
import { useAppStore, type ViewKey } from "@/store/view-store"

/** One destination in the sidebar (and every other nav surface). */
export type NavItem = {
  key: ViewKey
  label: string
  icon: React.ComponentType<{ className?: string }>
  description: string
}

const NAV_SECTIONS: {
  label: string
  items: NavItem[]
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
      { key: "articles", label: "Articles", icon: Tag, description: "Designs & analytics" },
      { key: "sales", label: "Sales", icon: ShoppingCart, description: "Sell & history" },
      { key: "catalog", label: "Catalog", icon: Palette, description: "Colors, sizes & categories" },
    ],
  },
  {
    label: "Billing & Docs",
    items: [
      { key: "invoices", label: "Invoices", icon: Receipt, description: "All bills & statuses" },
      { key: "orders", label: "Orders", icon: ClipboardList, description: "Quotes — bill later" },
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
      { key: "help", label: "Help", icon: CircleHelp, description: "Pricing guide & how-to" },
    ],
  },
]

/** Every destination, flattened — shared by the sidebar, the mobile nav sheet
 *  and the bottom tab bar (single source of truth for nav order + labels). */
export const NAV_ITEMS: NavItem[] = NAV_SECTIONS.flatMap((section) => section.items)

/** Web sidebar — the shared sectioned design from @munim/ui, wired to the
 *  web's view store + URL sync. Desktop renders the same component. */
export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const activeView = useAppStore((s) => s.activeView)
  const setView = useAppStore((s) => s.setActiveView)

  return (
    <SharedSidebarNav
      sections={NAV_SECTIONS}
      activeKey={activeView}
      onNavigate={(key) => {
        setView(key)
        onNavigate?.()
      }}
    />
  )
}

export function SidebarHeader() {
  return <SidebarBrand />
}

export function SidebarFooter() {
  return <SharedSidebarFooter />
}