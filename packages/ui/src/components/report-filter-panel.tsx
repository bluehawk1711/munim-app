"use client"

/**
 * ReportFilterPanel — the ONE report filter form shared by web AND desktop.
 * Every facet the API understands is exposed here (article, category,
 * sub-category, color, size, product type, metal, gold karat, silver purity,
 * sold weight, sold state, payment status, party, dates + quick ranges) and
 * the exact same state shape/logic is used by mobile (`ReportFilterFormValues`
 * + `toReportFilters` in @munim/core).
 */
import * as React from "react"
import { Filter, RefreshCw, RotateCcw, Search } from "lucide-react"
import {
  REPORT_METALS,
  REPORT_PAYMENT_STATUSES,
  REPORT_PRODUCT_TYPES,
  REPORT_SOLD_STATES,
  countActiveReportFilters,
  dashboardPresetRange,
  emptyReportFilterForm,
  type ReportFilterFormValues,
  type ReportMetal,
  type ReportPaymentStatus,
  type ReportProductType,
  type ReportSoldState,
} from "@munim/core"
import { cn } from "../lib/utils.js"
import { Badge } from "./badge.js"
import { Button } from "./button.js"
import { Input } from "./input.js"
import { Label } from "./label.js"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select.js"

export type ReportFilterRef = { id: string; name: string }

export type ReportFilterPanelOptions = {
  articles: ReportFilterRef[]
  categories: ReportFilterRef[]
  colors: { name: string }[]
  sizes: { name: string }[]
  parties: ReportFilterRef[]
}

const PRODUCT_TYPE_LABELS: Record<ReportProductType, string> = {
  gold: "Gold",
  silver: "Silver",
  diamond: "Diamond",
  platinum: "Platinum",
  other: "Other",
}

const PAYMENT_LABELS: Record<ReportPaymentStatus, string> = {
  any: "Any status",
  paid: "Paid",
  partial: "Partially paid",
  unpaid: "Unpaid",
  draft: "Draft",
}

const SOLD_STATE_LABELS: Record<ReportSoldState, string> = {
  all: "All (sold + unsold)",
  sold: "Sold only",
  unsold: "Unsold only",
}

function Field({
  id,
  label,
  children,
  className,
}: {
  id?: string
  label: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("min-w-0 space-y-1.5", className)}>
      <Label htmlFor={id} className="text-xs font-medium text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  )
}

function FilterSelect({
  id,
  label,
  value,
  onChange,
  options,
  placeholder,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
  placeholder: string
}) {
  return (
    <Field id={id} label={label}>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id} size="sm" className="h-9 w-full">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  )
}

function RangeField({
  label,
  minValue,
  maxValue,
  onMin,
  onMax,
  minPlaceholder = "Min",
  maxPlaceholder = "Max",
}: {
  label: string
  minValue: string
  maxValue: string
  onMin: (v: string) => void
  onMax: (v: string) => void
  minPlaceholder?: string
  maxPlaceholder?: string
}) {
  return (
    <Field label={label}>
      <div className="flex items-center gap-1.5">
        <Input
          inputMode="decimal"
          value={minValue}
          onChange={(e) => onMin(e.target.value)}
          placeholder={minPlaceholder}
          aria-label={`${label} minimum`}
          className="h-9"
        />
        <span className="text-muted-foreground shrink-0 text-xs">–</span>
        <Input
          inputMode="decimal"
          value={maxValue}
          onChange={(e) => onMax(e.target.value)}
          placeholder={maxPlaceholder}
          aria-label={`${label} maximum`}
          className="h-9"
        />
      </div>
    </Field>
  )
}

export function ReportFilterPanel({
  value,
  onChange,
  options,
  onApply,
  busy,
  className,
}: {
  value: ReportFilterFormValues
  onChange: (next: ReportFilterFormValues) => void
  options: ReportFilterPanelOptions
  onApply: () => void
  busy?: boolean
  className?: string
}) {
  const set = <K extends keyof ReportFilterFormValues,>(key: K, next: ReportFilterFormValues[K]) =>
    onChange({ ...value, [key]: next })

  const activeCount = countActiveReportFilters(value)

  const refOptions = (items: ReportFilterRef[], allLabel: string) => [
    { value: "all", label: allLabel },
    ...items.map((item) => ({ value: item.id, label: item.name })),
  ]

  return (
    <div className={cn("space-y-4", className)}>
      {/* Search + classifications */}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Field id="report-search" label="Search">
          <div className="relative">
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2" />
            <Input
              id="report-search"
              value={value.search}
              onChange={(e) => set("search", e.target.value)}
              placeholder="Product, SKU, barcode…"
              className="h-9 pl-8"
            />
          </div>
        </Field>
        <FilterSelect
          id="report-article"
          label="Article"
          value={value.articleId || "all"}
          onChange={(v) => set("articleId", v === "all" ? "" : v)}
          options={refOptions(options.articles, "All articles")}
          placeholder="All articles"
        />
        <FilterSelect
          id="report-category"
          label="Category"
          value={value.categoryId || "all"}
          onChange={(v) => set("categoryId", v === "all" ? "" : v)}
          options={refOptions(options.categories, "All categories")}
          placeholder="All categories"
        />
        <FilterSelect
          id="report-subcategory"
          label="Sub-category"
          value={value.subCategoryId || "all"}
          onChange={(v) => set("subCategoryId", v === "all" ? "" : v)}
          options={refOptions(options.categories, "All sub-categories")}
          placeholder="All sub-categories"
        />
      </div>

      {/* Attributes */}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <FilterSelect
          id="report-color"
          label="Color"
          value={value.color || "all"}
          onChange={(v) => set("color", v === "all" ? "" : v)}
          options={[{ value: "all", label: "All colors" }, ...options.colors.map((c) => ({ value: c.name, label: c.name }))]}
          placeholder="All colors"
        />
        <FilterSelect
          id="report-size"
          label="Size"
          value={value.size || "all"}
          onChange={(v) => set("size", v === "all" ? "" : v)}
          options={[{ value: "all", label: "All sizes" }, ...options.sizes.map((s) => ({ value: s.name, label: s.name }))]}
          placeholder="All sizes"
        />
        <FilterSelect
          id="report-type"
          label="Product type"
          value={value.productType || "all"}
          onChange={(v) => set("productType", v === "all" ? "" : (v as ReportProductType))}
          options={[{ value: "all", label: "All types" }, ...REPORT_PRODUCT_TYPES.map((t) => ({ value: t, label: PRODUCT_TYPE_LABELS[t] }))]}
          placeholder="All types"
        />
        <FilterSelect
          id="report-metal"
          label="Metal"
          value={value.metal || "all"}
          onChange={(v) => set("metal", v === "all" ? "" : (v as ReportMetal))}
          options={[{ value: "all", label: "All metals" }, ...REPORT_METALS.map((m) => ({ value: m, label: m }))]}
          placeholder="All metals"
        />
      </div>

      {/* Numeric ranges */}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <RangeField
          label="Gold karat"
          minValue={value.goldKaratMin}
          maxValue={value.goldKaratMax}
          onMin={(v) => set("goldKaratMin", v)}
          onMax={(v) => set("goldKaratMax", v)}
          minPlaceholder="e.g. 18"
          maxPlaceholder="e.g. 24"
        />
        <RangeField
          label="Silver purity (%)"
          minValue={value.silverPurityMin}
          maxValue={value.silverPurityMax}
          onMin={(v) => set("silverPurityMin", v)}
          onMax={(v) => set("silverPurityMax", v)}
          minPlaceholder="e.g. 80"
          maxPlaceholder="e.g. 99"
        />
        <RangeField
          label="Sold weight (gm)"
          minValue={value.weightMinGm}
          maxValue={value.weightMaxGm}
          onMin={(v) => set("weightMinGm", v)}
          onMax={(v) => set("weightMaxGm", v)}
          minPlaceholder="Min gm"
          maxPlaceholder="Max gm"
        />
        <div className="grid grid-cols-2 gap-2">
          <FilterSelect
            id="report-sold-state"
            label="Sold state"
            value={value.soldState}
            onChange={(v) => set("soldState", v as ReportSoldState)}
            options={REPORT_SOLD_STATES.map((s) => ({ value: s, label: SOLD_STATE_LABELS[s] }))}
            placeholder="Sold state"
          />
          <FilterSelect
            id="report-payment"
            label="Payment"
            value={value.paymentStatus}
            onChange={(v) => set("paymentStatus", v as ReportPaymentStatus)}
            options={REPORT_PAYMENT_STATUSES.map((s) => ({ value: s, label: PAYMENT_LABELS[s] }))}
            placeholder="Payment"
          />
        </div>
      </div>

      {/* Party + time window */}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <FilterSelect
          id="report-party"
          label="Customer / party"
          value={value.partyId || "all"}
          onChange={(v) => set("partyId", v === "all" ? "" : v)}
          options={refOptions(options.parties, "All parties")}
          placeholder="All parties"
        />
        <Field id="report-start" label="Start date">
          <Input id="report-start" type="date" value={value.startDate} onChange={(e) => set("startDate", e.target.value)} className="h-9" />
        </Field>
        <Field id="report-end" label="End date">
          <Input id="report-end" type="date" value={value.endDate} onChange={(e) => set("endDate", e.target.value)} className="h-9" />
        </Field>
        <Field label="Quick range">
          <div className="flex flex-wrap gap-1.5">
            {(["today", "week", "month"] as const).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  const range = dashboardPresetRange(key)
                  onChange({ ...value, startDate: range.from, endDate: range.to })
                }}
                className="rounded-full border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted"
              >
                {key === "today" ? "Today" : key === "week" ? "This week" : "This month"}
              </button>
            ))}
          </div>
        </Field>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
        <div className="flex items-center gap-2">
          <Badge variant={activeCount > 0 ? "default" : "secondary"} className="gap-1">
            <Filter className="h-3 w-3" /> {activeCount > 0 ? `${activeCount} filter${activeCount === 1 ? "" : "s"} active` : "No filters"}
          </Badge>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="gap-1.5 text-xs"
            onClick={() => onChange(emptyReportFilterForm())}
            disabled={activeCount === 0}
          >
            <RotateCcw className="h-3.5 w-3.5" /> Clear all
          </Button>
        </div>
        <Button onClick={onApply} disabled={busy} className="gap-1.5">
          <RefreshCw className={cn("h-4 w-4", busy && "animate-spin")} /> Generate Report
        </Button>
      </div>
    </div>
  )
}
