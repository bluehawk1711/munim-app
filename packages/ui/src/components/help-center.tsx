"use client";

/**
 * HelpCenter — searchable accordion over the shared help content in
 * `@munim/core` (`HELP_SECTIONS` / `searchHelp`).
 *
 * Core owns the wording (single source of truth, AGENTS §2); web and desktop
 * render it through this component and mobile renders the same data with RN
 * primitives — so the three apps can never drift (AGENTS §4b).
 *
 * Deep links: every entry keeps its stable `id`, so `#bill-paid` (or the
 * `focusId` prop) opens that entry — other screens can link straight to the
 * field they explain. An optional `search` prop seeds the search box.
 */
import * as React from "react";
import { ChevronDown, LifeBuoy, Link2, Search, X } from "lucide-react";
import { searchHelp, type HelpEntry, type HelpSection } from "@munim/core";
import { Card, CardContent } from "./card";

type Props = {
  /** Pre-fill the search box (e.g. a deep link carried over from another screen). */
  search?: string;
  /** Entry id to open + scroll to on mount (and on hash change). */
  focusId?: string;
  /** Extra content rendered above the sections (e.g. the Pricing Guide link). */
  children?: React.ReactNode;
};

function EntryRow({
  entry,
  open,
  onToggle,
  onCopyLink,
}: {
  entry: HelpEntry;
  open: boolean;
  onToggle: () => void;
  onCopyLink: () => void;
}) {
  return (
    <div id={entry.id} className="scroll-mt-24 rounded-lg border border-border/60 bg-background">
      <div className="hover:bg-muted/40 flex items-center justify-between gap-2 rounded-lg px-3 py-2.5">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          className="flex-1 text-left text-sm font-medium"
        >
          {entry.title}
        </button>
        <button
          type="button"
          onClick={onCopyLink}
          aria-label={`Copy deep link to ${entry.title}`}
          title="Copy deep link"
          className="text-muted-foreground hover:text-foreground shrink-0"
        >
          <Link2 className="h-3.5 w-3.5" />
        </button>
        <ChevronDown
          className={`text-muted-foreground h-4 w-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </div>
      {open && (
        <div className="space-y-2 border-t border-border/60 px-3 py-3">
          {entry.body.map((para, i) => (
            <p key={i} className="text-muted-foreground text-sm leading-relaxed">
              {para}
            </p>
          ))}
          {entry.bullets && entry.bullets.length > 0 && (
            <ul className="text-muted-foreground list-disc space-y-1 pl-5 text-sm leading-relaxed">
              {entry.bullets.map((b, i) => (
                <li key={i}>{b}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function SectionBlock({
  section,
  openIds,
  toggle,
  onCopyLink,
}: {
  section: HelpSection;
  openIds: Set<string>;
  toggle: (id: string) => void;
  onCopyLink: (id: string) => void;
}) {
  return (
    <section id={`help-${section.id}`} className="scroll-mt-24 space-y-2">
      <div>
        <h2 className="text-sm font-semibold tracking-tight">{section.title}</h2>
        {section.description ? (
          <p className="text-muted-foreground text-xs">{section.description}</p>
        ) : null}
      </div>
      <div className="space-y-2">
        {section.entries.map((entry) => (
          <EntryRow
            key={entry.id}
            entry={entry}
            open={openIds.has(entry.id)}
            onToggle={() => toggle(entry.id)}
            onCopyLink={() => onCopyLink(entry.id)}
          />
        ))}
      </div>
    </section>
  );
}

export function HelpCenter({ search, focusId, children }: Props) {
  const [query, setQuery] = React.useState(search ?? "");
  const [openIds, setOpenIds] = React.useState<Set<string>>(() =>
    focusId ? new Set([focusId]) : new Set<string>(),
  );
  const [activeFocus, setActiveFocus] = React.useState(focusId ?? "");

  // Deep link from another screen (focusId prop) or the URL hash — open the
  // entry and scroll it into view.
  React.useEffect(() => {
    const target = activeFocus || (typeof window !== "undefined" ? window.location.hash.slice(1) : "");
    if (!target) return;
    setOpenIds((prev) => new Set(prev).add(target));
    const el = document.getElementById(target);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [activeFocus]);

  const sections = React.useMemo(() => searchHelp(query), [query]);

  function toggle(id: string) {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function copyDeepLink(id: string) {
    const url = `${window.location.pathname}${window.location.search}#${id}`;
    window.history.replaceState({}, "", url);
    setActiveFocus(id);
    void navigator.clipboard?.writeText(window.location.href);
  }

  return (
    <Card>
      <CardContent className="space-y-5 pt-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="text-muted-foreground pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search help — pages, bill fields, filters, reports…"
              aria-label="Search help"
              className="border-input bg-background h-9 w-full rounded-md border pl-9 pr-8 text-sm outline-none focus:ring-2 focus:ring-ring/40"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Clear search"
                className="text-muted-foreground hover:text-foreground absolute right-2.5 top-1/2 -translate-y-1/2"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
            <LifeBuoy className="h-3.5 w-3.5" />
            {sections.reduce((n, s) => n + s.entries.length, 0)} article
            {sections.reduce((n, s) => n + s.entries.length, 0) !== 1 ? "s" : ""}
          </span>
        </div>

        {children}

        {sections.length === 0 ? (
          <div className="text-muted-foreground flex flex-col items-center gap-2 py-10 text-center text-sm">
            <Search className="h-5 w-5" />
            <p>
              No help for “{query}”. Try a page name (Dashboard), a field (Material
              Returned) or a report (Low Stock).
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {sections.map((section) => (
              <SectionBlock
                key={section.id}
                section={section}
                openIds={openIds}
                toggle={toggle}
                onCopyLink={copyDeepLink}
              />
            ))}
          </div>
        )}

        {/* Section jump chips — every entry also has a copy-link button. */}
        <div className="text-muted-foreground border-t border-border/60 pt-3 text-xs">
          Tip: the link icon next to any topic copies a deep link you can send to
          a teammate — it opens straight to that topic.
          <div className="mt-2 flex flex-wrap gap-1.5">
            {HELP_SECTION_LINKS.map((s) => (
              <a
                key={s.id}
                href={`#help-${s.id}`}
                className="border-border text-foreground hover:bg-muted rounded-full border px-2 py-0.5"
              >
                {s.title}
              </a>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/** Section jump chips — derived from the shared content (kept out of render
 *  memo only for clarity; the list is tiny and static). */
const HELP_SECTION_LINKS = searchHelp("");
