import * as React from "react";
export type ConnectionTestState = "testing" | "ok" | "fail";
/**
 * Modal shown while testing a database connection. Cannot be dismissed while
 * `state === "testing"` (no close button, outside-click and Escape are
 * swallowed) so the user can't miss the in-flight state; once the ping
 * resolves it flips to a success or error panel with a Close action.
 */
export declare function ConnectionTestDialog({ open, onOpenChange, state, error, onRetry, }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    state: ConnectionTestState;
    error?: string;
    onRetry?: () => void;
}): React.JSX.Element;
//# sourceMappingURL=connection-test-dialog.d.ts.map