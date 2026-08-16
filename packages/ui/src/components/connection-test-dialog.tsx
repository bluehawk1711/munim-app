"use client"

import * as React from "react"
import { CheckCircle2, Loader2, XCircle } from "lucide-react"

import { cn } from "../lib/utils.js"
import { Button } from "./button.js"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./dialog.js"

export type ConnectionTestState = "testing" | "ok" | "fail"

/**
 * Modal shown while testing a database connection. Cannot be dismissed while
 * `state === "testing"` (no close button, outside-click and Escape are
 * swallowed) so the user can't miss the in-flight state; once the ping
 * resolves it flips to a success or error panel with a Close action.
 */
export function ConnectionTestDialog({
  open,
  onOpenChange,
  state,
  error,
  onRetry,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  state: ConnectionTestState
  error?: string
  onRetry?: () => void
}) {
  const busy = state === "testing"

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // Never allow closing while the test is in flight.
        if (!busy) onOpenChange(next)
      }}
    >
      <DialogContent
        className="sm:max-w-md"
        showCloseButton={!busy}
        onEscapeKeyDown={(e) => {
          if (busy) e.preventDefault()
        }}
        onPointerDownOutside={(e) => {
          if (busy) e.preventDefault()
        }}
        onInteractOutside={(e) => {
          if (busy) e.preventDefault()
        }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {state === "testing" ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : state === "ok" ? (
              <CheckCircle2 className="size-4 text-emerald-500" aria-hidden="true" />
            ) : (
              <XCircle className="size-4 text-destructive" aria-hidden="true" />
            )}
            {state === "testing"
              ? "Testing connection"
              : state === "ok"
                ? "Connected"
                : "Connection failed"}
          </DialogTitle>
          <DialogDescription>
            {state === "testing"
              ? "Contacting the database…"
              : state === "ok"
                ? "The database responded successfully."
                : "Could not reach the database. Check the connection string and try again."}
          </DialogDescription>
        </DialogHeader>

        {state === "fail" && error ? (
          <p
            className={cn(
              "rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs leading-relaxed text-destructive",
            )}
          >
            {error}
          </p>
        ) : null}

        {state !== "testing" && (
          <DialogFooter>
            {state === "fail" && onRetry ? (
              <Button variant="outline" onClick={onRetry}>
                Try again
              </Button>
            ) : null}
            <Button onClick={() => onOpenChange(false)}>Close</Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}
