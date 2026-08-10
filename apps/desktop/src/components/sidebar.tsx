import { LayoutDashboard, Package, ShoppingCart, FileText, Users, ScrollText, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/products", label: "Products & Stock", icon: Package },
  { href: "/sales", label: "Sales", icon: ShoppingCart },
  { href: "/billing", label: "Billing / Invoices", icon: FileText },
  { href: "/parties", label: "Parties & Khata", icon: Users },
  { href: "/job-letters", label: "Job Letters", icon: ScrollText },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

export function Sidebar({ current }: { current: string }) {
  return (
    <aside className="bg-card flex w-56 shrink-0 flex-col border-r">
      <div className="flex h-14 items-center gap-2 border-b px-4">
        <div className="bg-primary flex h-7 w-7 items-center justify-center rounded-lg text-sm font-bold text-primary-foreground">
          M
        </div>
        <div className="leading-tight">
          <p className="text-sm font-semibold">Munim</p>
          <p className="text-muted-foreground text-[11px]">Shop Manager</p>
        </div>
      </div>
      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-2">
        {NAV_ITEMS.map((item) => {
          const active = current === item.href;
          const Icon = item.icon;
          return (
            <a
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </a>
          );
        })}
      </nav>
      <div className="border-t p-3 text-[11px] leading-relaxed text-muted-foreground">
        Shared Neon database — live across web, desktop & mobile.
      </div>
    </aside>
  );
}
