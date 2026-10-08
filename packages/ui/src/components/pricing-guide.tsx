"use client";

/**
 * PricingGuide — renders the shared "how pricing works" body behind the Help
 * page from `PRICING_GUIDE` in @munim/core (the single source of truth).
 *
 * Web, desktop and mobile all render that same content (mobile natively in
 * its HelpScreen), so the wording about rates, labour, auto/manual and the
 * Recalculate action can never drift between the apps (AGENTS §2/§4b).
 * Presentational only — no data fetching; the pages above it decide which
 * header/badge to show. Apps own icons + styling; core owns the text.
 */
import * as React from "react";
import { BadgeIndianRupee, Calculator, Percent, IndianRupee, Scale, RefreshCw, ScanLine, Tag } from "lucide-react";
import {
  PRICING_GUIDE,
  type GuideBlock,
  type GuideSpan,
  type PricingGuideSectionKey,
} from "@munim/core";
import { Card, CardContent } from "./card";

const SECTION_ICONS: Record<
  PricingGuideSectionKey,
  React.ComponentType<{ className?: string }>
> = {
  formula: Calculator,
  rates: BadgeIndianRupee,
  auto: Tag,
  recalc: RefreshCw,
  counter: ScanLine,
};

const LABOUR_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Percent: Percent,
  Fixed: IndianRupee,
  "Per gram": Scale,
};

function Spans({ spans }: { spans: GuideSpan[] }) {
  return (
    <>
      {spans.map((s, i) =>
        s.b ? (
          <strong key={i}>{s.t}</strong>
        ) : s.i ? (
          <em key={i}>{s.t}</em>
        ) : (
          <React.Fragment key={i}>{s.t}</React.Fragment>
        ),
      )}
    </>
  );
}

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="space-y-3 pt-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Icon className="text-primary h-4 w-4" />
          {title}
        </h2>
        {children}
      </CardContent>
    </Card>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-2.5 text-sm">
      <span className="bg-primary/10 text-primary mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold">
        {n}
      </span>
      <span className="text-muted-foreground">{children}</span>
    </li>
  );
}

function Block({ block }: { block: GuideBlock }) {
  if (block.kind === "para") {
    return (
      <p className="text-muted-foreground text-sm">
        <Spans spans={block.spans} />
      </p>
    );
  }

  if (block.kind === "formula") {
    return (
      <div className="bg-muted/50 space-y-2 rounded-lg border p-3 font-mono text-xs">
        {block.lines.map((line) => (
          <p key={line.label}>
            <span
              className={
                line.tone === "primary"
                  ? "text-primary font-semibold"
                  : "text-muted-foreground font-semibold"
              }
            >
              {line.label}
            </span>{" "}
            {line.rest}
          </p>
        ))}
      </div>
    );
  }

  if (block.kind === "list") {
    if (block.marker === "step") {
      return (
        <ol className="space-y-2">
          {block.items.map((item, i) => (
            <Step key={i} n={i + 1}>
              <Spans spans={item} />
            </Step>
          ))}
        </ol>
      );
    }
    const spaced = block.marker === "plain" ? "space-y-2" : "space-y-1.5";
    return (
      <ul className={`text-muted-foreground ${spaced} text-sm`}>
        {block.items.map((item, i) => (
          <li key={i}>
            {block.marker === "arrow" && <>▸ </>}
            <Spans spans={item} />
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {block.cards.map((card) => {
        const Icon = LABOUR_ICONS[card.name];
        return (
          <div key={card.name} className="bg-muted/40 rounded-lg border p-3">
            <p className="flex items-center gap-1.5 text-xs font-semibold">
              {Icon ? <Icon className="text-primary h-3.5 w-3.5" /> : null} {card.name}
            </p>
            <p className="text-muted-foreground mt-1 text-xs">{card.blurb}</p>
          </div>
        );
      })}
    </div>
  );
}

export function PricingGuide({ className }: { className?: string }) {
  return (
    <div className={className ? `space-y-4 ${className}` : "space-y-4"}>
      {PRICING_GUIDE.map((section) => (
        <Section key={section.key} icon={SECTION_ICONS[section.key]} title={section.title}>
          {section.blocks.map((block, i) => (
            <Block key={i} block={block} />
          ))}
        </Section>
      ))}
    </div>
  );
}
