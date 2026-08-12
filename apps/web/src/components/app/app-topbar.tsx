"use client"

import * as React from "react"
import { AnimatePresence, motion } from "motion/react"
import { Menu, Search, ShoppingCart, Plus, X } from "lucide-react"
import { Button, Input, Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@munim/ui"




import { ThemeToggle } from "@/components/app/theme-toggle"
import { ThemeSelect, useAccentThemeContext } from "@/components/app/theme-picker"
import { SidebarNav, SidebarHeader, SidebarFooter } from "@/components/app/sidebar-nav"
import { useAppStore } from "@/store/view-store"

const VIEW_TITLES: Record<string, { title: string; subtitle: string }> = {
  dashboard: { title: "Dashboard", subtitle: "Business overview & analytics" },
  products: { title: "Products", subtitle: "Manage your inventory" },
  sales: { title: "Sales", subtitle: "Record sales & view history" },
  invoices: { title: "Invoices", subtitle: "All bills & payment statuses" },
  billing: { title: "New Bill", subtitle: "Create a bill / invoice" },
  "job-letter": { title: "Job Letters", subtitle: "Offer & joining letters" },
  parties: { title: "Parties", subtitle: "Khata — customers, suppliers, workers" },
  advances: { title: "Advances", subtitle: "Who owes whom — given & taken" },
  reports: { title: "Reports", subtitle: "Generate & export reports" },
  catalog: { title: "Catalog", subtitle: "Manage colors & sizes" },
  settings: { title: "Settings", subtitle: "Shop profile & shared database" },
}

export function AppTopbar() {
  const activeView = useAppStore((s) => s.activeView)
  const setView = useAppStore((s) => s.setView)
  const globalSearch = useAppStore((s) => s.globalSearch)
  const setGlobalSearch = useAppStore((s) => s.setGlobalSearch)
  const setSellDialogOpen = useAppStore((s) => s.setSellDialogOpen)

  const [sheetOpen, setSheetOpen] = React.useState(false)
  const [searchValue, setSearchValue] = React.useState(globalSearch)
  const [syncedSearch, setSyncedSearch] = React.useState(globalSearch)
  if (globalSearch !== syncedSearch) {
    setSyncedSearch(globalSearch)
    setSearchValue(globalSearch)
  }

  const meta = VIEW_TITLES[activeView] ?? { title: "Dashboard", subtitle: "Business overview & analytics" }

  function commitSearch(value: string) {
    setGlobalSearch(value)
    if (value.trim() && activeView !== "products") setView("products")
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b bg-background/80 px-4 backdrop-blur-md lg:px-6">
      {/* Mobile menu */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            aria-label="Open navigation menu"
          >
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-72 p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>Navigation</SheetTitle>
          </SheetHeader>
          <div className="flex h-full flex-col">
            <SidebarHeader />
            <div className="flex-1 overflow-y-auto scrollbar-thin">
              <SidebarNav onNavigate={() => setSheetOpen(false)} />
            </div>
            <SidebarFooter />
          </div>
        </SheetContent>
      </Sheet>

      <div className="flex flex-col leading-tight lg:min-w-[180px]">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={meta.title}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="flex flex-col leading-tight"
          >
            <h1 className="text-base font-semibold tracking-tight">{meta.title}</h1>
            <p className="hidden text-xs text-muted-foreground sm:block">{meta.subtitle}</p>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Global search */}
      <div className="relative ml-auto w-full max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={searchValue}
          onChange={(e) => {
            setSearchValue(e.target.value)
            commitSearch(e.target.value)
          }}
          onKeyDown={(e) => {
            if (e.nativeEvent.isComposing) return
            if (e.key === "Enter") commitSearch(searchValue)
            if (e.key === "Escape") {
              setSearchValue("")
              setGlobalSearch("")
            }
          }}
          placeholder="Search products by name, SKU, color, size…"
          className="h-9 pl-9 pr-8"
          aria-label="Global search"
        />
        {searchValue && (
          <button
            type="button"
            onClick={() => {
              setSearchValue("")
              setGlobalSearch("")
            }}
            aria-label="Clear search"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <Button
        onClick={() => setSellDialogOpen(true)}
        className="hidden sm:inline-flex h-9"
      >
        <ShoppingCart className="mr-1.5 h-4 w-4" />
        Sell
      </Button>
      <Button
        onClick={() => setSellDialogOpen(true)}
        size="icon"
        className="sm:hidden h-9 w-9"
        aria-label="Sell product"
      >
        <Plus className="h-4 w-4" />
      </Button>

      <ThemeSelectInHeader />
      <ThemeToggle />
    </header>
  )
}

/** Compact color-theme select — swatch on the left, label on the right. */
function ThemeSelectInHeader() {
  const { themeName, setThemeName } = useAccentThemeContext()
  return <ThemeSelect value={themeName} onChange={setThemeName} className="hidden sm:flex" />
}
