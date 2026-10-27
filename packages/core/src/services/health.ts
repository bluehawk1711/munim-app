/**
 * Config health — a pure checklist of what the shop has configured and what
 * is still missing, shared by every app (desktop Settings → Health is the
 * first consumer; the New Bill banner reuses the settings-only subset).
 *
 * Nothing here touches the database: callers pass the settings / rate /
 * product facts they already have, so the same checks drive the Health page,
 * inline warnings and (later) mobile without duplicating rules.
 */

/** How badly a missing config hurts. `ok` = configured (shown as a tick). */
export type HealthSeverity = "ok" | "warning" | "error";

/** One row of the health checklist. */
export type HealthCheck = {
  id: string;
  /** Short label — "Shop gold rate". */
  title: string;
  /** Why it matters / what is wrong right now. */
  detail: string;
  severity: HealthSeverity;
  /** Button text when there is something to do ("Set the shop gold rate"). */
  action: string | null;
  /** Path to jump to for the fix ("/settings?section=gold", "/products"). */
  fixHref: string | null;
};

/** Everything the checks read — omit what you don't have (→ not checked). */
export type ConfigHealthInput = {
  shopName?: string | null;
  shopAddress?: string | null;
  shopPhones?: readonly string[] | null;
  shopEmail?: string | null;
  /** Highest quoted karat (null → nothing quoted yet). */
  goldBaseKarat?: number | null;
  /** Base ₹/gram of that karat (0/undefined → no gold rate configured). */
  goldBaseRatePerGram?: number | null;
  /** How many karats the shop quoted outright (derives the rest). */
  quotedKarats?: number | null;
  /** Shop-wide silver ₹/gram (0 → silver never auto-prices). */
  silverRatePerGram?: number | null;
  /** Default labour METHOD for gold products (PERCENT / FIXED / PER_GRAM). */
  defaultLabourType?: "PERCENT" | "FIXED" | "PER_GRAM" | null;
  /** Default labour value (0 → gold products get ₹0 labour). */
  defaultLabourValue?: number | null;
  /** PIN lock enabled? */
  pinLocked?: boolean;
  /** Label printer name, when one is configured. */
  labelPrinter?: string | null;
  /** Gold products still without a karat (null → products not loaded). */
  goldProductsMissingKarat?: number | null;
  /** Products still without a barcode (null → products not loaded). */
  productsMissingBarcode?: number | null;
  /** Products at/below the low-stock threshold (null → not loaded). */
  lowStockCount?: number | null;
};

/** Default labour description — mirrors the label the settings form shows. */
function labourDetail(
  type: "PERCENT" | "FIXED" | "PER_GRAM" | null | undefined,
  value: number | null | undefined,
): string {
  const v = value ?? 0;
  if (type === "FIXED") return `Fixed ₹${v} per product`;
  if (type === "PER_GRAM") return `₹${v} per gram of weight`;
  return `${v}% of the metal value`;
}

/**
 * Builds the full checklist. Settings-only checks always run; the product
 * stats run only when their number is supplied, so a caller without the
 * products query still gets a valid (shorter) list.
 */
export function evaluateConfigHealth(input: ConfigHealthInput): HealthCheck[] {
  const checks: HealthCheck[] = [];

  // ── Shop profile ────────────────────────────────────────────────────────
  const hasName = Boolean(input.shopName?.trim());
  checks.push(
    hasName
      ? {
          id: "shop-name",
          title: "Shop name",
          detail: `“${input.shopName?.trim()}” — printed on every bill.`,
          severity: "ok",
          action: null,
          fixHref: null,
        }
      : {
          id: "shop-name",
          title: "Shop name is missing",
          detail: "Bills and labels print without a shop name.",
          severity: "error",
          action: "Add the shop name",
          fixHref: "/settings?section=shop",
        },
  );

  const hasAddress = Boolean(input.shopAddress?.trim());
  checks.push(
    hasAddress
      ? { id: "shop-address", title: "Shop address", detail: "Set.", severity: "ok", action: null, fixHref: null }
      : {
          id: "shop-address",
          title: "Shop address is missing",
          detail: "The bill header has no address to print.",
          severity: "warning",
          action: "Add the address",
          fixHref: "/settings?section=shop",
        },
  );

  const hasPhone = (input.shopPhones ?? []).some((p) => p?.trim());
  checks.push(
    hasPhone
      ? { id: "shop-phone", title: "Shop phone", detail: "Set.", severity: "ok", action: null, fixHref: null }
      : {
          id: "shop-phone",
          title: "No shop phone",
          detail: "Bills print without a contact number.",
          severity: "warning",
          action: "Add a phone number",
          fixHref: "/settings?section=shop",
        },
  );

  // ── Rates & labour ──────────────────────────────────────────────────────
  const baseRate = input.goldBaseRatePerGram ?? 0;
  const baseKarat = input.goldBaseKarat ?? null;
  const rateOk = baseRate > 0 && baseKarat != null && baseKarat > 0;
  checks.push(
    rateOk
      ? {
          id: "gold-rate",
          title: "Shop gold rate",
          detail:
            `₹${baseRate} per gram at ${baseKarat}K` +
            (input.quotedKarats != null && input.quotedKarats > 1
              ? ` · ${input.quotedKarats} karats quoted, the rest derived`
              : ""),
          severity: "ok",
          action: null,
          fixHref: null,
        }
      : {
          id: "gold-rate",
          title: "No shop gold rate",
          detail:
            "Quote a gold rate in Rates & labour — auto pricing can't compute metal values and the bill's Gold rate row stays empty.",
          severity: "error",
          action: "Set the gold rate",
          fixHref: "/settings?section=gold",
        },
  );

  const silverRate = input.silverRatePerGram ?? 0;
  checks.push(
    silverRate > 0
      ? {
          id: "silver-rate",
          title: "Shop silver rate",
          detail: `₹${silverRate} per gram.`,
          severity: "ok",
          action: null,
          fixHref: null,
        }
      : {
          id: "silver-rate",
          title: "No shop silver rate",
          detail: "Auto-priced silver products value their metal at ₹0.",
          severity: "warning",
          action: "Set the silver rate",
          fixHref: "/settings?section=gold",
        },
  );

  const labourValue = input.defaultLabourValue ?? 0;
  checks.push(
    labourValue > 0
      ? {
          id: "default-labour",
          title: "Default labour (gold)",
          detail: labourDetail(input.defaultLabourType, labourValue) + ".",
          severity: "ok",
          action: null,
          fixHref: null,
        }
      : {
          id: "default-labour",
          title: "No default labour for gold",
          detail: "Gold products fall back to ₹0 labour until each one sets its own.",
          severity: "warning",
          action: "Set the default labour",
          fixHref: "/settings?section=gold",
        },
  );

  // ── Bills / security / printing ─────────────────────────────────────────
  checks.push(
    input.pinLocked
      ? { id: "pin-lock", title: "PIN lock", detail: "On — the app asks for the PIN.", severity: "ok", action: null, fixHref: null }
      : {
          id: "pin-lock",
          title: "PIN lock is off",
          detail: "Anyone can open the app and create or edit bills.",
          severity: "warning",
          action: "Turn on the PIN lock",
          fixHref: "/settings?section=security",
        },
  );

  checks.push(
    input.labelPrinter
      ? {
          id: "label-printer",
          title: "Label printer",
          detail: `${input.labelPrinter} — ready for thermal labels.`,
          severity: "ok",
          action: null,
          fixHref: null,
        }
      : {
          id: "label-printer",
          title: "No label printer configured",
          detail: "Labels fall back to the system print dialog (still works).",
          severity: "ok",
          action: null,
          fixHref: null,
        },
  );

  // ── Product data quality (only when the caller has the numbers) ─────────
  const missingKarats = input.goldProductsMissingKarat;
  if (missingKarats != null) {
    checks.push(
      missingKarats > 0
        ? {
            id: "gold-karat-missing",
            title: `${missingKarats} gold product${missingKarats === 1 ? "" : "s"} without a karat`,
            detail: "Auto pricing can't compute their metal value until each has a karat (or manual pricing).",
            severity: "warning",
            action: "Open Products",
            fixHref: "/products",
          }
        : {
            id: "gold-karat-missing",
            title: "Gold products have karats",
            detail: "Every gold product can auto-price from its karat.",
            severity: "ok",
            action: null,
            fixHref: null,
          },
    );
  }

  const missingBarcodes = input.productsMissingBarcode;
  if (missingBarcodes != null) {
    checks.push(
      missingBarcodes > 0
        ? {
            id: "barcode-missing",
            title: `${missingBarcodes} product${missingBarcodes === 1 ? "" : "s"} without a barcode`,
            detail: "Scan-to-bill can't find them — add barcodes or use SKU entry.",
            severity: "warning",
            action: "Open Products",
            fixHref: "/products",
          }
        : {
            id: "barcode-missing",
            title: "Barcodes complete",
            detail: "Every product scans.",
            severity: "ok",
            action: null,
            fixHref: null,
          },
    );
  }

  const lowStock = input.lowStockCount;
  if (lowStock != null) {
    checks.push(
      lowStock > 0
        ? {
            id: "low-stock",
            title: `${lowStock} product${lowStock === 1 ? "" : "s"} low on stock`,
            detail: "At or below the low-stock threshold — restock soon.",
            severity: "warning",
            action: "Open Products",
            fixHref: "/products",
          }
        : {
            id: "low-stock",
            title: "Stock levels healthy",
            detail: "Nothing is at or below the low-stock threshold.",
            severity: "ok",
            action: null,
            fixHref: null,
          },
    );
  }

  return checks;
}

/** Counts by severity — handy for a header/badge ("2 need attention"). */
export function summarizeHealth(checks: readonly HealthCheck[]): {
  ok: number;
  warnings: number;
  errors: number;
} {
  return {
    ok: checks.filter((c) => c.severity === "ok").length,
    warnings: checks.filter((c) => c.severity === "warning").length,
    errors: checks.filter((c) => c.severity === "error").length,
  };
}
