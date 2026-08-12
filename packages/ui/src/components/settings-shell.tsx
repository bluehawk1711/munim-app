"use client"

/**
 * SettingsShell — shared sectioned settings layout (macOS System Settings /
 * iOS Settings style), used by BOTH the web and desktop apps so the settings
 * page stays pixel-identical across platforms.
 *
 * Layout:
 *   - lg+      : left glass sidebar with icon + label rows (active row gets a
 *                primary-tint pill) and a content pane on the right.
 *   - < lg     : the sidebar collapses into a horizontally scrollable row of
 *                chips; content stacks below.
 *
 * The content pane is keyed by the active section, so switching sections
 * replays a short fade/slide entrance (motion-reduce safe).
 */
import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "../lib/utils";

export type SettingsSection = {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
  /** Optional short status chip on the right of the row (e.g. "On"/"1234"). */
  badge?: string;
};

type SettingsShellProps = {
  sections: SettingsSection[];
  active: string;
  onSelect: (id: string) => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
};

export function SettingsShell({
  sections,
  active,
  onSelect,
  title,
  subtitle,
  children,
}: SettingsShellProps) {
  const current = sections.find((s) => s.id === active) ?? sections[0];

  return (
    <>
      <style>{SETTINGS_SECTION_CSS}</style>
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
      {/* ── Sidebar (lg+) ─────────────────────────────────────────── */}
      <nav
        aria-label="Settings sections"
        className="glass hidden w-full max-w-[264px] shrink-0 flex-col rounded-2xl border bg-card/70 p-2 shadow-sm backdrop-blur-xl lg:sticky lg:top-4 lg:flex"
      >
        <div className="px-3 pt-2 pb-3">
          <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
          {subtitle ? (
            <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
          ) : null}
        </div>
        <div className="flex flex-col gap-1">
          {sections.map((s) => {
            const isActive = s.id === active;
            const Icon = s.icon;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => onSelect(s.id)}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "group flex cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm transition-colors duration-150",
                  "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
                  isActive && "bg-primary/10 font-medium text-primary hover:bg-primary/15 hover:text-primary",
                )}
              >
                <span
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors duration-150",
                    isActive
                      ? "bg-primary/15 text-primary"
                      : "bg-muted text-muted-foreground group-hover:text-foreground",
                  )}
                >
                  <Icon className="h-4 w-4" strokeWidth={2.1} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] leading-tight font-medium">{s.label}</span>
                  <span className="block truncate text-[11px] text-muted-foreground/80">{s.description}</span>
                </span>
                {s.badge ? (
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                      isActive ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground",
                    )}
                  >
                    {s.badge}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </nav>

      {/* ── Chips (below lg) ──────────────────────────────────────── */}
      <div className="lg:hidden">
        <h2 className="px-1 text-sm font-semibold tracking-tight">{title}</h2>
        {subtitle ? (
          <p className="px-1 mt-0.5 mb-2 text-xs text-muted-foreground">{subtitle}</p>
        ) : null}
        <div
          aria-label="Settings sections"
          className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1"
          style={{ scrollbarWidth: "thin" }}
        >
        {sections.map((s) => {
          const isActive = s.id === active;
          const Icon = s.icon;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => onSelect(s.id)}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors duration-150",
                isActive
                  ? "border-primary/30 bg-primary/10 text-primary"
                  : "border-border bg-card/70 text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="h-3.5 w-3.5" strokeWidth={2.1} />
              {s.label}
              {s.badge ? <span className="opacity-70">· {s.badge}</span> : null}
            </button>
          );
        })}
        </div>
      </div>

      {/* ── Content pane ──────────────────────────────────────────── */}
      <div
        key={active}
        className="settings-section-enter min-w-0 flex-1"
      >
        <div className="mb-4 hidden lg:block">
          <h2 className="text-base font-semibold tracking-tight">{current?.label}</h2>
          {current ? (
            <p className="mt-0.5 text-sm text-muted-foreground">{current.description}</p>
          ) : null}
        </div>
        {children}
      </div>
      </div>
    </>
  );
}

/** Enter animation used by the content pane when switching sections. */
export const SETTINGS_SECTION_CSS = `
@keyframes munim-settings-enter {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
.settings-section-enter { animation: munim-settings-enter 0.28s cubic-bezier(0.25, 0.46, 0.45, 0.94) both; }
@media (prefers-reduced-motion: reduce) {
  .settings-section-enter { animation: none; }
}
`;
