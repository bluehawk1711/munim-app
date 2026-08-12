"use client"

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
import { AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "./button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./dialog";

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  busy,
  destructive = true,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: React.ReactNode;
  confirmLabel: string;
  busy?: boolean;
  destructive?: boolean;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent role="alertdialog" className="sm:max-w-[400px]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle>{title}</DialogTitle>
              <DialogDescription>{description}</DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant={destructive ? "destructive" : "default"}
            onClick={onConfirm}
            disabled={busy}
            className="gap-1.5"
          >
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {confirmLabel}…
              </>
            ) : (
              confirmLabel
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
