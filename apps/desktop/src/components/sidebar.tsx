import { motion } from "motion/react";
import { LayoutDashboard, Package, ShoppingCart, FileText, Users, ScrollText, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { navigate } from "@/lib/navigation";

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
        <motion.div
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 18 }}
          className="bg-primary flex h-7 w-7 items-center justify-center rounded-lg text-sm font-bold text-primary-foreground"
        >
          M
        </motion.div>
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
            <button
              key={item.href}
              type="button"
              onClick={() => navigate(item.href)}
              aria-current={active ? "page" : undefined}
              className={cn(
                "group relative flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "text-primary"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
              )}
            >
              {active && (
                <motion.span
                  layoutId="sidebar-active-pill"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  className="bg-primary/12 absolute inset-0 rounded-md"
                />
              )}
              <Icon
                className={cn(
                  "relative h-4 w-4 transition-transform duration-200 group-hover:scale-110",
                  active && "text-primary",
                )}
              />
              <span className="relative">{item.label}</span>
            </button>
          );
        })}
      </nav>
      <div className="border-t p-3 text-[11px] leading-relaxed text-muted-foreground">
        Shared Neon database — live across web, desktop & mobile.
      </div>
    </aside>
  );
}
