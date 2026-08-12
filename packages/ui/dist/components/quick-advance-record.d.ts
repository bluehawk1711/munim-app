/**
 * QuickAdvanceRecord — the "quick record" advance card at the top of the
 * Advances page. Used by BOTH the web and desktop apps so the fast-capture
 * flow is identical.
 *
 * Fully controlled: the parent owns all state (party selection, kind, amount)
 * and the core call (createAdvance). This component only renders the layout.
 */
import * as React from "react";
export declare function QuickAdvanceRecord({ parties, partyId, onPartyChange, kind, onKindChange, amount, onAmountChange, busy, onRecord, }: {
    parties: {
        id: string;
        name: string;
    }[];
    partyId: string;
    onPartyChange: (id: string) => void;
    kind: "GIVEN" | "TAKEN";
    onKindChange: (kind: "GIVEN" | "TAKEN") => void;
    amount: number;
    onAmountChange: (amount: number) => void;
    busy?: boolean;
    onRecord: () => void;
}): React.JSX.Element;
//# sourceMappingURL=quick-advance-record.d.ts.map