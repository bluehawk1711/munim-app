"use client"

/**
 * BottomNav — the web app's mobile navigation: the SAME five tabs the mobile
 * app ships (Home · Stock · Sales · Khata · More), fixed under `lg` where the
 * sidebar is hidden. Like mobile, the tabs cover the day-to-day screens and
 * "More" owns everything else (Invoices, New Bill, Orders, Reports, Settings…)
 * so a phone-width layout stays one tap deep instead of a hamburger away.
 */
import * as React from "react"
import { Home, LayoutGrid, Package, ShoppingCart, Users } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@munim/ui"
import { NAV_ITEMS, type NavItem } from "@/components/app/sidebar-nav"
import { useAppStore, type ViewKey } from "@/store/view-store"
import { cn } from "@/lib/utils"

type Tab = { key: ViewKey; label: string; icon: React.ComponentType<{ className?: string }> }

const TABS: Tab[] = [
  { key: "dashboard", label: "Home", icon: Home },
  { key: "products", label: "Stock", icon: Package },
  { key: "sales", label: "Sales", icon: ShoppingCart },
  { key: "advances", label: "Khata", icon: Users },
]

const TAB_KEYS: ViewKey[] = TABS.map((tab) => tab.key)

/** What "More" owns — mobile's More tab lists the same sub-screens. */
const MORE_ITEMS: NavItem[] = NAV_ITEMS.filter((item) => !TAB_KEYS.includes(item.key))

export function BottomNav() {
  const activeView = useAppStore((s) => s.activeView) as ViewKey
  const setView = useAppStore((s) => s.setActiveView)
  const [moreOpen, setMoreOpen] = React.useState(false)

  /** Deep views live inside "More" — highlight it while one is open. */
  const moreActive = MORE_ITEMS.some((item) => item.key === activeView)

  function go(key: ViewKey) {
    setMoreOpen(false)
    setView(key)
  }

  return (
    <>
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden"
      >
        <div className="grid grid-cols-5">
          {TABS.map((tab) => {
            const Icon = tab.icon
            const active = activeView === tab.key
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => go(tab.key)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex flex-col items-center gap-0.5 py-2 text-[10px] font-semibold transition-colors",
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="h-5 w-5" />
                {tab.label}
              </button>
            )
          })}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={moreOpen}
            className={cn(
              "flex flex-col items-center gap-0.5 py-2 text-[10px] font-semibold transition-colors",
              moreActive ? "text-primary" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <LayoutGrid className="h-5 w-5" />
            More
          </button>
        </div>
      </nav>

      <Dialog open={moreOpen} onOpenChange={setMoreOpen}>
        <DialogContent className="max-h-[80dvh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>More</DialogTitle>
            <DialogDescription>Everything else in Munim</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {MORE_ITEMS.map((item) => {
              const Icon = item.icon
              const active = activeView === item.key
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => go(item.key)}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors",
                    active
                      ? "border-primary/40 bg-primary/10 text-primary"
                      : "hover:bg-muted",
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{item.label}</span>
                    <span className="text-muted-foreground block truncate text-[11px]">
                      {item.description}
                    </span>
                  </span>
                </button>
              )
            })}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
