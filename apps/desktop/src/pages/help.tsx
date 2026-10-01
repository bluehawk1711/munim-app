import { BadgeIndianRupee } from "lucide-react";
import { PricingGuide } from "@munim/ui";
import { PageHeader } from "@/components/page-header";
import { Button } from "@munim/ui";
import { navigate } from "@/lib/navigation";

/** Help / Pricing guide — the same body the web app renders (AGENTS §4b parity). */
export function HelpPage() {
  return (
    <div className="space-y-5">
      <PageHeader
        title="Help"
        badge="PRICING GUIDE"
        subtitle="How Munim prices gold & silver, where rates and labour live, and how to push a rate change through every list, label and bill."
        actions={
          <Button onClick={() => navigate("/settings?section=gold")}>
            <BadgeIndianRupee className="h-4 w-4" />
            Open Rates &amp; labour
          </Button>
        }
      />
      <PricingGuide />
    </div>
  );
}
