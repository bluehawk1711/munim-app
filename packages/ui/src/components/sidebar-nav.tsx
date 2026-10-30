"use client"

/**
 * SidebarNav / SidebarBrand / SidebarFooter — the ONE sidebar design used by
 * both web and desktop (web's sectioned layout: grouped destinations, one-line
 * descriptions, and an active pill). Apps only supply their destination list,
 * the active key, and a navigate callback; they never re-style the sidebar.
 */
import * as React from "react"
import { Boxes } from "lucide-react"

import { cn } from "../lib/utils.js"

export type SidebarNavItem<K extends string = string> = {
  key: K
  label: string
  icon: React.ComponentType<{ className?: string }>
  description: string
}

export type SidebarNavSection<K extends string = string> = {
  label: string
  items: SidebarNavItem<K>[]
}

export function SidebarNav<K extends string>({
  sections,
  activeKey,
  onNavigate,
}: {
  sections: readonly SidebarNavSection<K>[]
  activeKey: string
  onNavigate: (key: K) => void
}) {
  return (
    <nav className="flex flex-col gap-4 px-3 py-4" aria-label="Main navigation">
      {sections.map((section) => (
        <div key={section.label}>
          <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
            {section.label}
          </p>
          <div className="flex flex-col gap-0.5">
            {section.items.map((item) => {
              const Icon = item.icon
              const active = activeKey === item.key
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => onNavigate(item.key)}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "group relative flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium transition-all duration-200",
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
                        active ? "text-sidebar-primary/60" : "text-muted-foreground"
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

export function SidebarBrand({
  title = "Munim",
  subtitle = "Shop Management",
}: {
  title?: string
  subtitle?: string
}) {
  return (
    <div className="flex h-16 items-center gap-2.5 border-b border-sidebar-border px-5">
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-sm shadow-primary/20">
        <Boxes className="h-5 w-5" />
      </div>
      <div className="flex flex-col leading-tight">
        <span className="text-sm font-semibold text-sidebar-foreground">{title}</span>
        <span className="text-[11px] text-muted-foreground">{subtitle}</span>
      </div>
    </div>
  )
}

export function SidebarFooter({ note = "Stock · Billing · Khata" }: { note?: string }) {
  return (
    <div className="border-t border-sidebar-border px-5 py-4">
      <p className="text-[11px] text-muted-foreground">{note}</p>
    </div>
  )
}
