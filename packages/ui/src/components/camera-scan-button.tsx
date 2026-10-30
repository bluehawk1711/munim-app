"use client";

/**
 * CameraScanButton — camera barcode scanning for web AND desktop: the browser
 * counterpart of mobile's `BarcodeScannerModal` (Home / Inventory / Sales
 * scan-to-act). Behaviour:
 *   - the camera starts when the dialog opens (the webview owns the permission
 *     prompt); a denial shows the reason + a retry, like mobile's
 *     "Camera permission needed" state.
 *   - a detected code goes to `onDetected`. A RESOLVED promise closes the
 *     scanner (the action succeeded — item added / product found); a REJECTED
 *     one keeps the camera live and shows the message so the operator can aim
 *     again. Same contract as `BarcodeLookupInput.onLookup`.
 *   - closing the dialog (or unmounting) stops the stream so the camera light
 *     actually goes off.
 *
 * Decoding runs through @zxing/browser — universal camera decoding — rather
 * than the Chrome-only `BarcodeDetector` API.
 */
import * as React from "react";
import { Camera, Loader2, ScanLine, VideoOff } from "lucide-react";
import { BrowserCodeReader, BrowserMultiFormatReader, type IScannerControls } from "@zxing/browser";
import { Button } from "./button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./dialog";

type Phase = "starting" | "scanning" | "blocked"

export function CameraScanButton({
  onDetected,
  label = "Scan with camera",
  className,
}: {
  /** Must resolve on a hit and throw on a miss (miss → stay open + show why). */
  onDetected: (code: string) => Promise<unknown>
  /** Button tooltip/aria-label AND the dialog title. */
  label?: string
  className?: string
}) {
  const [open, setOpen] = React.useState(false)
  /** Bumped by "Try again" — restarts the camera after a failure. */
  const [attempt, setAttempt] = React.useState(0)
  const [phase, setPhase] = React.useState<Phase>("starting")
  const [error, setError] = React.useState("")

  const videoRef = React.useRef<HTMLVideoElement | null>(null)
  const controlsRef = React.useRef<IScannerControls | null>(null)
  /** One decode at a time — a barcode keeps matching across many frames. */
  const busyRef = React.useRef(false)

  // Keep the LATEST handler without restarting the camera: parents pass inline
  // closures whose identity changes on every render.
  const onDetectedRef = React.useRef(onDetected)
  React.useEffect(() => {
    onDetectedRef.current = onDetected
  })

  React.useEffect(() => {
    if (!open) return
    let stopped = false
    busyRef.current = false

    const reader = new BrowserMultiFormatReader()

    async function run() {
      // Radix mounts the dialog content in the same commit, but the <video>
      // may not be laid out yet — give it a few frames before starting.
      let video: HTMLVideoElement | null = videoRef.current
      for (let i = 0; video == null && i < 5 && !stopped; i++) {
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
        video = videoRef.current
      }
      if (!video || stopped) return

      try {
        const controls = await reader.decodeFromVideoDevice(undefined, video, (result) => {
          if (stopped || busyRef.current || !result) return
          const code = result.getText()
          if (!code) return
          busyRef.current = true
          void (async () => {
            let ok = false
            try {
              await onDetectedRef.current(code)
              ok = true
              if (!stopped) setOpen(false)
            } catch (err) {
              if (!stopped) setError(err instanceof Error ? err.message : "Product not found")
            } finally {
              // A miss leaves the same code in frame — pause before retrying
              // so one code isn't re-submitted dozens of times a second.
              window.setTimeout(
                () => {
                  busyRef.current = false
                },
                ok ? 0 : 800,
              )
            }
          })()
        })
        if (stopped) {
          controls.stop()
          return
        }
        controlsRef.current = controls
        setPhase("scanning")
      } catch (err) {
        if (stopped) return
        setPhase("blocked")
        setError(
          err instanceof Error && err.message.toLowerCase().includes("not allowed")
            ? "Camera permission denied — allow camera access in your browser, then try again."
            : err instanceof Error
              ? err.message
              : "Could not start the camera",
        )
      }
    }

    void run()

    return () => {
      stopped = true
      busyRef.current = false
      controlsRef.current?.stop()
      controlsRef.current = null
      // Belt and braces: release any stream the scan loop did not track so
      // the camera light goes off.
      BrowserCodeReader.releaseAllStreams()
    }
  }, [open, attempt])

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className={className}
        aria-label={label}
        title={label}
        onClick={() => {
          setPhase("starting")
          setError("")
          setOpen(true)
        }}
      >
        <Camera className="h-4 w-4" />
      </Button>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next)
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ScanLine className="h-4 w-4" /> {label}
            </DialogTitle>
            <DialogDescription>Point the camera at the product barcode.</DialogDescription>
          </DialogHeader>

          <div className="relative aspect-[4/3] overflow-hidden rounded-lg border bg-muted">
            <video
              ref={videoRef}
              playsInline
              autoPlay
              muted
              className="h-full w-full object-cover"
            />

            {phase === "scanning" && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="relative flex h-1/2 w-3/4 items-center justify-center rounded-lg border-2 border-emerald-400/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]">
                  <ScanLine className="h-6 w-6 animate-pulse text-emerald-300" />
                </div>
              </div>
            )}

            {phase === "starting" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin" />
                <p className="text-sm">Starting camera…</p>
              </div>
            )}

            {phase === "blocked" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4 text-center">
                <VideoOff className="text-muted-foreground h-7 w-7" />
                <p className="text-muted-foreground text-sm">{error}</p>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setPhase("starting")
                    setError("")
                    setAttempt((n) => n + 1)
                  }}
                >
                  Try again
                </Button>
              </div>
            )}
          </div>

          <div className="space-y-1 text-center sm:text-left">
            <p className="text-muted-foreground text-xs">
              {phase === "scanning" ? "Hold the barcode inside the frame." : "\u00a0"}
            </p>
            {phase === "scanning" && error ? (
              <p className="text-destructive text-xs" role="alert">
                {error}
              </p>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
