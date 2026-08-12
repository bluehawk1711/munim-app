"use client"

/**
 * QuickAdvanceRecord — the "quick record" advance card at the top of the
 * Advances page. Used by BOTH the web and desktop apps so the fast-capture
 * flow is identical.
 *
 * Fully controlled: the parent owns all state (party selection, kind, amount)
 * and the core call (createAdvance). This component only renders the layout.
 */
import * as React from "react";
import { Loader2, Plus } from "lucide-react";
import { Button } from "./button";
import { Card, CardContent } from "./card";
import { Input } from "./input";
import { Label } from "./label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select";

export function QuickAdvanceRecord({
  parties,
  partyId,
  onPartyChange,
  kind,
  onKindChange,
  amount,
  onAmountChange,
  busy,
  onRecord,
}: {
  parties: { id: string; name: string }[];
  partyId: string;
  onPartyChange: (id: string) => void;
  kind: "GIVEN" | "TAKEN";
  onKindChange: (kind: "GIVEN" | "TAKEN") => void;
  amount: number;
  onAmountChange: (amount: number) => void;
  busy?: boolean;
  onRecord: () => void;
}) {
  return (
    <Card className="border-primary/20 bg-primary/[0.03]">
      <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-end">
        <div className="flex-1 space-y-1.5">
          <Label className="text-xs">Party</Label>
          <Select value={partyId} onValueChange={onPartyChange}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Select party…" />
            </SelectTrigger>
            <SelectContent>
              {parties.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1 space-y-1.5">
          <Label className="text-xs">Type</Label>
          <Select value={kind} onValueChange={(v) => onKindChange(v as "GIVEN" | "TAKEN")}>
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="GIVEN">I gave advance (they owe me)</SelectItem>
              <SelectItem value="TAKEN">I took advance (I owe them)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1 space-y-1.5">
          <Label className="text-xs">Amount (₹)</Label>
          <Input
            type="number"
            min={0}
            value={amount || ""}
            onChange={(e) => onAmountChange(Number(e.target.value))}
            className="h-9"
          />
        </div>
        <Button onClick={onRecord} disabled={!partyId || amount <= 0 || busy} className="h-9 gap-1.5">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Record
        </Button>
      </CardContent>
    </Card>
  );
}
