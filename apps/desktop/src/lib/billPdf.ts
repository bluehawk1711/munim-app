import { generateBillPDF, mergeBillTemplateSettings } from "@munim/core";
import type { BillDocument, BillTemplateSettings } from "@munim/core";

/**
 * Desktop bill PDF renderer — delegates to the shared `generateBillPDF` from
 * `@munim/core`, which is the SAME function the web app uses. One model, one
 * renderer, identical output on both platforms.
 *
 * `opts` is a partial BillTemplateSettings (missing toggles → core defaults,
 * all display lines ON) plus the optional second bill for 2-in-1 "Separate".
 */
export async function downloadBillPdf(
  bill: BillDocument,
  opts?: Partial<BillTemplateSettings> & { secondBill?: BillDocument },
): Promise<void> {
  const { secondBill, ...partial } = opts ?? {};
  const settings: BillTemplateSettings = mergeBillTemplateSettings(partial);

  const second =
    settings.twoInOne && settings.mode === "distinct" && secondBill ? secondBill : undefined;

  generateBillPDF(bill, settings, second);
}
