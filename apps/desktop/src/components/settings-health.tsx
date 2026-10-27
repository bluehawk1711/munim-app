/**
 * SettingsHealthCard — the Settings → Health section: one checklist of what
 * the shop has configured and what is still missing (shop profile, gold/
 * silver rates, karats, labour, PIN, printer, product data quality), so the
 * operator can see at a glance what is wrong and where to fix it.
 *
 * The checks themselves live in core (`evaluateConfigHealth` — the same
 * rules the New Bill setup-warning banner reuses), so web/mobile can render
 * this later without duplicating a single rule.
 */
import { useMemo } from "react";
import { CheckCircle2, HeartPulse, Loader2, TriangleAlert, XCircle } from "lucide-react";
import {
  evaluateConfigHealth,
  summarizeHealth,
  type HealthCheck,
  type HealthSeverity,
} from "@munim/core";
import { useGoldRates, useProducts, useQueryState, useSettings } from "@munim/query";
import { navigate } from "@/lib/navigation";
import { getSavedLabelPrinter } from "@/lib/printer";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  usePinLockContext,
} from "@munim/ui";

const SEVERITY_ICON: Record<HealthSeverity, typeof CheckCircle2> = {
  ok: CheckCircle2,
  warning: TriangleAlert,
  error: XCircle,
};

const SEVERITY_ORDER: Record<HealthSeverity, number> = { error: 0, warning: 1, ok: 2 };

export function SettingsHealthCard() {
  const { data: settings } = useQueryState(useSettings());
  const { data: goldRates } = useQueryState(useGoldRates());
  const productsQ = useQueryState(useProducts({ pageSize: 1000 }));
  const pin = usePinLockContext();

  const loading = settings === undefined || goldRates === undefined || productsQ.data === undefined;
  const labelPrinter = getSavedLabelPrinter() ?? null;

  const checks = useMemo<HealthCheck[]>(() => {
    const products = productsQ.data?.products ?? null;
    const threshold = settings?.lowStockThreshold ?? 5;
    return evaluateConfigHealth({
      shopName: settings?.shopName,
      shopAddress: settings?.shopAddress,
      shopPhones: settings?.shopPhones,
      shopEmail: settings?.shopEmail,
      goldBaseKarat: goldRates?.baseKarat ?? null,
      goldBaseRatePerGram: goldRates?.baseRatePerGram ?? null,
      quotedKarats:
        goldRates?.rates?.filter((r) => r.isCustom && r.ratePerGram > 0).length ?? null,
      silverRatePerGram: settings?.silverRatePerGram ?? 0,
      defaultLabourType: settings?.defaultLabourType ?? null,
      defaultLabourValue: settings?.defaultLabourValue ?? 0,
      pinLocked: pin.lockEnabled,
      labelPrinter,
      goldProductsMissingKarat: products
        ? products.filter((p) => p.type === "Gold" && !(p.goldKarat != null && p.goldKarat > 0)).length
        : null,
      productsMissingBarcode: products ? products.filter((p) => !p.barcode).length : null,
      lowStockCount: products
        ? products.filter((p) => p.stock <= threshold).length
        : null,
    }).sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
  }, [settings, goldRates, productsQ.data, pin.lockEnabled, labelPrinter]);

  const summary = summarizeHealth(checks);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <HeartPulse className="h-4 w-4" /> Health
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Checking the shop setup…
          </p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              {summary.errors > 0 && (
                <Badge variant="destructive">
                  {summary.errors} critical
                </Badge>
              )}
              {summary.warnings > 0 && (
                <Badge variant="warning">{summary.warnings} to fix</Badge>
              )}
              <Badge variant="success">{summary.ok} configured</Badge>
              <span className="text-xs text-muted-foreground">
                {summary.errors + summary.warnings === 0
                  ? "Everything the bill engine needs is set up."
                  : "Click a fix button to jump straight to the setting."}
              </span>
            </div>

            <ul className="space-y-2">
              {checks.map((check) => {
                const Icon = SEVERITY_ICON[check.severity];
                return (
                  <li
                    key={check.id}
                    className="flex flex-wrap items-start gap-x-3 gap-y-1.5 rounded-lg border bg-muted/30 px-3 py-2"
                  >
                    <Icon
                      className={
                        check.severity === "ok"
                          ? "mt-0.5 h-4 w-4 shrink-0 text-emerald-600"
                          : check.severity === "warning"
                            ? "mt-0.5 h-4 w-4 shrink-0 text-amber-600"
                            : "mt-0.5 h-4 w-4 shrink-0 text-destructive"
                      }
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{check.title}</p>
                      <p className="text-xs text-muted-foreground">{check.detail}</p>
                    </div>
                    {check.action && check.fixHref && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 shrink-0 text-xs"
                        onClick={() => navigate(check.fixHref!)}
                      >
                        {check.action}
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  );
}
