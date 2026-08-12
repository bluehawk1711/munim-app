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
export type KhataParty = {
    id: string;
    name: string;
    type: string;
    balance: number;
};
export type KhataActionKind = "GIVEN" | "TAKEN" | "PAYMENT_IN" | "PAYMENT_OUT";
export declare function KhataCard<P extends KhataParty>({ title, description, icon: Icon, accent, parties, emptyText, onAction, onViewAll, }: {
    title: string;
    description: string;
    icon: React.ComponentType<{
        className?: string;
    }>;
    accent: "emerald" | "red";
    parties: P[];
    emptyText: string;
    onAction: (party: P, kind: KhataActionKind) => void;
    onViewAll: () => void;
}): React.JSX.Element;
//# sourceMappingURL=khata-card.d.ts.map