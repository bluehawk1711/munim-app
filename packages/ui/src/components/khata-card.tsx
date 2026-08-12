"use client"

/**
 * Shared khata card — one column of the advances overview ("Whom I gave
 * advance" / "Whom I still have to give money"). Used by BOTH the web and
 * desktop apps so the advances module renders identically on each.
 *
 * Presentational: callers own state and pass onAction/onViewAll handlers.
 * The party type is structural (same shape as @munim/core PartyBalance) so
 * this component stays framework-agnostic.
 */
import * as React from "react";
import { cn } from "../lib/utils";
import { formatMoney } from "../lib/format";
import { Badge } from "./badge";
import { Button } from "./button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./card";

export type KhataParty = {
  id: string;
  name: string;
  type: string;
  balance: number;
};

export type KhataActionKind = "GIVEN" | "TAKEN" | "PAYMENT_IN" | "PAYMENT_OUT";

export function KhataCard<P extends KhataParty>({
  title,
  description,
  icon: Icon,
  accent,
  parties,
  emptyText,
  onAction,
  onViewAll,
}: {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: "emerald" | "red";
  parties: P[];
  emptyText: string;
  onAction: (party: P, kind: KhataActionKind) => void;
  onViewAll: () => void;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <div className="flex items-center gap-2.5">
          <div
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-lg",
              accent === "emerald"
                ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                : "bg-red-500/15 text-red-600 dark:text-red-400"
            )}
          >
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-sm">{title}</CardTitle>
            <CardDescription className="text-xs">{description}</CardDescription>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={onViewAll} className="text-xs">
          View all
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        {parties.length === 0 ? (
          <p className="px-4 py-8 text-center text-xs text-muted-foreground">{emptyText}</p>
        ) : (
          <div className="divide-y">
            {parties.slice(0, 8).map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <div className="flex min-w-0 items-center gap-2.5">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                    {p.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{p.name}</p>
                    <p className="text-xs text-muted-foreground capitalize">{p.type.toLowerCase()}</p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span
                    className={cn(
                      "text-sm font-semibold tabular-nums",
                      accent === "emerald"
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-red-600 dark:text-red-400"
                    )}
                  >
                    {formatMoney(accent === "emerald" ? p.balance : Math.abs(p.balance))}
                  </span>
                  <Badge
                    variant="outline"
                    className={cn(
                      "cursor-pointer font-normal",
                      accent === "emerald" ? "hover:border-emerald-500/50" : "hover:border-red-500/50"
                    )}
                    onClick={() => onAction(p, accent === "emerald" ? "PAYMENT_IN" : "PAYMENT_OUT")}
                  >
                    {accent === "emerald" ? "Collect" : "Pay"}
                  </Badge>
                  <Badge
                    variant="outline"
                    className="cursor-pointer font-normal"
                    onClick={() => onAction(p, accent === "emerald" ? "GIVEN" : "TAKEN")}
                  >
                    +{accent === "emerald" ? "Give" : "Take"}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

