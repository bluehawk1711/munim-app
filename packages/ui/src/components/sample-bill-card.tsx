"use client"

/**
 * SampleBillCard — Settings card shared by web + desktop: renders a dummy
 * bill (gold → Classic Jewellery, silver → Modern E-commerce) through the
 * SAME pipeline real bills use (`buildSampleBill` + `generateBillPDF` from
 * core) and saves the PDF automatically (browser / Tauri download). Handy for
 * checking the layout, embedded fonts and rate lines without creating an
 * invoice — the mobile Settings screen offers the same action.
 */
import * as React from "react"
import { FileText, Loader2 } from "lucide-react"
import {
  buildSampleBill,
  generateBillPDF,
  mergeBillTemplateSettings,
  type SampleBillKind,
} from "@munim/core"
import { toast } from "./sonner"
import { Button } from "./button"
import { Card, CardContent, CardHeader, CardTitle } from "./card"

export function SampleBillCard() {
  const [busy, setBusy] = React.useState<SampleBillKind | null>(null)

  async function generate(kind: SampleBillKind): Promise<void> {
    setBusy(kind)
    try {
      const bill = buildSampleBill(kind)
      generateBillPDF(
        bill,
        mergeBillTemplateSettings({ template: kind === "gold" ? "jewellery" : "ecommerce" }),
      )
      toast.success("Sample bill saved", { description: `Bill_${bill.billNo}.pdf downloaded` })
    } catch (err) {
      toast.error("Could not generate the sample bill", {
        description: err instanceof Error ? err.message : undefined,
      })
    } finally {
      setBusy(null)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <FileText className="h-4 w-4" /> Sample bill
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Renders a dummy bill with the real template pipeline and saves the PDF to your
          downloads — check the layout, fonts and gold/silver rate lines without creating an
          invoice.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={busy !== null}
            onClick={() => void generate("gold")}
          >
            {busy === "gold" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Classic Jewellery (gold sample)
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={busy !== null}
            onClick={() => void generate("silver")}
          >
            {busy === "silver" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Modern E-commerce (silver sample)
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
