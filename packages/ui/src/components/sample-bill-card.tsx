"use client"

/**
 * SampleBillCard — Settings card shared by web + desktop: renders a dummy
 * bill through the SAME pipeline real bills use (`buildSampleBill` +
 * `generateBillPDF` from core) and saves the PDF automatically (browser /
 * Tauri download). The variant dropdown lists every look a shop can pick —
 * gold/silver × Classic (red/yellow) / Modern E-commerce, the picked-karat
 * line and both 2-in-1 modes — so layout/fonts/rate lines can be checked
 * without creating an invoice. The mobile Settings screen offers the same
 * action for its two default variants.
 */
import * as React from "react"
import { FileText, Loader2 } from "lucide-react"
import {
  buildSampleBill,
  generateBillPDF,
  mergeBillTemplateSettings,
  SAMPLE_BILL_VARIANTS,
} from "@munim/core"
import { toast } from "./sonner"
import { Button } from "./button"
import { Card, CardContent, CardHeader, CardTitle } from "./card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select"

export function SampleBillCard() {
  const [variantId, setVariantId] = React.useState<string>(SAMPLE_BILL_VARIANTS[0]?.id ?? "gold-ecommerce")
  const [busy, setBusy] = React.useState(false)
  const variant =
    SAMPLE_BILL_VARIANTS.find((v) => v.id === variantId) ?? SAMPLE_BILL_VARIANTS[0]

  async function generate(): Promise<void> {
    if (!variant) return
    setBusy(true)
    try {
      const bill = buildSampleBill(variant.kind)
      const second = variant.secondKind ? buildSampleBill(variant.secondKind) : undefined
      generateBillPDF(bill, mergeBillTemplateSettings(variant.settings), second)
      toast.success("Sample bill saved", { description: `Bill_${bill.billNo}.pdf downloaded` })
    } catch (err) {
      toast.error("Could not generate the sample bill", {
        description: err instanceof Error ? err.message : undefined,
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <FileText className="h-4 w-4" /> Sample bills
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Renders a dummy bill with the real template pipeline and saves the PDF to your
          downloads — check every template, accent color and 2-in-1 layout without creating
          an invoice.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={variant?.id} onValueChange={setVariantId}>
            <SelectTrigger className="w-[290px]" aria-label="Sample bill variant">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SAMPLE_BILL_VARIANTS.map((v) => (
                <SelectItem key={v.id} value={v.id}>
                  {v.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" disabled={busy || !variant} onClick={() => void generate()}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {busy ? "Generating…" : "Generate PDF"}
          </Button>
        </div>
        {variant && <p className="text-xs text-muted-foreground">{variant.hint}</p>}
      </CardContent>
    </Card>
  )
}
