import { generateBillPDF } from "@munim/core";
import type { BillDocument, BillTemplateSettings } from "@munim/core";

/**
 * Desktop bill PDF renderer — delegates to the shared `generateBillPDF` from
 * `@munim/core`, which is the SAME function the web app uses. One model, one
 * renderer, identical output on both platforms.
 */
export async function downloadBillPdf(
  bill: BillDocument,
  opts?: {
    secondBill?: BillDocument;
    twoInOne?: boolean;
    mode?: "duplicate" | "distinct";
    classicColor?: "red" | "yellow";
  },
): Promise<void> {
  const settings: BillTemplateSettings = {
    template: "jewellery",
    classicColor: opts?.classicColor ?? "red",
    twoInOne: opts?.twoInOne ?? false,
    mode: opts?.mode ?? "duplicate",
  };

  const second = opts?.twoInOne && opts?.mode === "distinct" && opts?.secondBill
    ? opts.secondBill
    : undefined;

  generateBillPDF(bill, settings, second);
}
