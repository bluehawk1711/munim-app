import type { ReactNode } from "react";

/**
 * PageHeader — the analytics-suite header band shared by desktop pages.
 *
 *   Title  [Badge]        [actions…]
 *   Subtitle line
 *
 * Keeps the page-top hierarchy (big title + supporting copy + page actions)
 * identical across Products, Sales, Billing, Invoices, Advances, Job Letters,
 * Catalog and Settings, matching the redesigned Dashboard / Reports / Parties.
 */
export function PageHeader({
  title,
  badge,
  subtitle,
  actions,
}: {
  title: string;
  /** Optional pill next to the title (e.g. ACTIVE LEDGER). */
  badge?: string;
  subtitle?: string;
  /** Right-aligned page actions (buttons). */
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          {badge ? (
            <span className="bg-primary/10 text-primary rounded-full px-2.5 py-1 text-[10px] font-bold tracking-wide uppercase">
              {badge}
            </span>
          ) : null}
        </div>
        {subtitle ? <p className="text-muted-foreground mt-1 max-w-2xl text-sm">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
