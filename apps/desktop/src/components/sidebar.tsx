import {
  LayoutDashboard,
  Package,
  Palette,
  Tag,
  FileText,
  Receipt,
  ClipboardList,
  Boxes,
  Users,
  HandCoins,
  ShoppingCart,
  FileBarChart,
  Settings,
  CircleHelp,
} from "lucide-react";
import { SidebarBrand, SidebarFooter, SidebarNav, type SidebarNavSection } from "@munim/ui";
import { navigate } from "@/lib/navigation";

/** Same sections, order, labels and copy as the web sidebar — the shared
 *  @munim/ui component renders both, so the two apps cannot drift. */
const NAV_SECTIONS: SidebarNavSection[] = [
  {
    label: "Overview",
    items: [
      { key: "/", label: "Dashboard", icon: LayoutDashboard, description: "Overview & analytics" },
    ],
  },
  {
    label: "Inventory",
    items: [
      { key: "/products", label: "Products", icon: Package, description: "Manage inventory" },
      { key: "/articles", label: "Articles", icon: Tag, description: "Designs & analytics" },
      { key: "/sales", label: "Sales", icon: ShoppingCart, description: "Sell & history" },
      { key: "/catalog", label: "Catalog", icon: Palette, description: "Colors, sizes & categories" },
    ],
  },
  {
    label: "Billing & Docs",
    items: [
      { key: "/invoices", label: "Invoices", icon: Receipt, description: "All bills & statuses" },
      { key: "/orders", label: "Orders", icon: ClipboardList, description: "Quotes — bill later" },
      { key: "/billing", label: "New Bill", icon: Boxes, description: "Create a bill / invoice" },
      { key: "/job-letters", label: "Job Letters", icon: FileText, description: "Offer letters" },
    ],
  },
  {
    label: "Khata",
    items: [
      { key: "/parties", label: "Parties", icon: Users, description: "Customers, suppliers, workers" },
      { key: "/advances", label: "Advances", icon: HandCoins, description: "Who owes whom" },
    ],
  },
  {
    label: "Insights",
    items: [
      { key: "/reports", label: "Reports", icon: FileBarChart, description: "Export & analyze" },
    ],
  },
  {
    label: "System",
    items: [
      { key: "/settings", label: "Settings", icon: Settings, description: "Shop profile & database" },
      { key: "/help", label: "Help", icon: CircleHelp, description: "Pricing guide & how-to" },
    ],
  },
];

export function Sidebar({ current }: { current: string }) {
  return (
    <aside className="bg-sidebar flex w-64 shrink-0 flex-col border-r border-sidebar-border">
      <SidebarBrand />
      <div className="flex-1 overflow-y-auto">
        <SidebarNav sections={NAV_SECTIONS} activeKey={current} onNavigate={navigate} />
      </div>
      <SidebarFooter />
    </aside>
  );
}
