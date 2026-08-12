/**
 * ConfirmDialog — shared destructive-confirm dialog (e.g. "Delete invoice?"),
 * used by BOTH the web and desktop apps so confirms look and behave the same.
 *
 * Presentational: the parent owns `open`/`busy` and the destructive action.
 * Rendered with role="alertdialog" (like the web app's previous AlertDialog),
 * and the busy label derives from confirmLabel so it reads correctly for any
 * action (e.g. "Delete…" / "Archive…").
 */
import * as React from "react";
export declare function ConfirmDialog({ open, onOpenChange, title, description, confirmLabel, busy, destructive, onConfirm, }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: string;
    description: React.ReactNode;
    confirmLabel: string;
    busy?: boolean;
    destructive?: boolean;
    onConfirm: () => void;
}): React.JSX.Element;
//# sourceMappingURL=confirm-dialog.d.ts.map