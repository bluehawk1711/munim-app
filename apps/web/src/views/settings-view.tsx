"use client"

import * as React from "react"
import * as m from "motion/react-m"
import { Save, Loader2, Store, Server, CheckCircle2, XCircle, Palette, ShieldCheck, ShoppingBag, SunMoon, BadgeIndianRupee, RefreshCw } from "lucide-react"
import { useSettings, useUpdateSettings } from "@/hooks/use-settings"
import { useGoldRates, useSaveGoldRates, useBackfillGoldKarats } from "@/hooks/use-gold-rates"
import { useApiClient, useSyncProductPrices } from "@munim/query"
import { formatDateTime, type LabourType } from "@munim/core"
import {
  Button,
  Input,
  Label,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Badge,
  Skeleton,
  PinSettingsCard,
  SettingsShell,
  Switch,
  type SettingsSection,
  setForceThemeTransition,
  useForceThemeTransition,
  usePinLockContext,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  GoldRateEditor,
  type GoldRateDraft,
} from "@munim/ui"
import { toast } from "@munim/ui"
import {
  ThemeSelect,
  useAccentThemeContext,
  type ThemeMode,
} from "@/components/app/theme-picker"

const MODE_OPTIONS: { value: ThemeMode; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
]

export function SettingsView() {
  const { data: settings, isLoading } = useSettings()
  const updateSettings = useUpdateSettings()
  const { themeName, setThemeName, mode, setMode } = useAccentThemeContext()
  const pin = usePinLockContext()
  const forceTransition = useForceThemeTransition()

  // Deep link from Help ("Open Rates & labour" → ?section=gold); validated
  // against the section ids below, defaults to the shop card. The param is
  // consumed on mount so a later sidebar visit opens the default section.
  const [section, setSection] = React.useState<string>(() => {
    if (typeof window === "undefined") return "shop"
    const param = new URLSearchParams(window.location.search).get("section")
    return param === "gold" ||
      param === "appearance" ||
      param === "security" ||
      param === "server"
      ? param
      : "shop"
  })
  React.useEffect(() => {
    const url = new URL(window.location.href)
    if (url.searchParams.has("section")) {
      url.searchParams.delete("section")
      window.history.replaceState({}, "", url)
    }
  }, [])

  const [shopName, setShopName] = React.useState("")
  const [shopAddress, setShopAddress] = React.useState("")
  const [shopPhones, setShopPhones] = React.useState("")
  const [shopEmail, setShopEmail] = React.useState("")
  const [currency, setCurrency] = React.useState("INR")
  const [lowStockThreshold, setLowStockThreshold] = React.useState("5")
  const [allowZeroTotal, setAllowZeroTotal] = React.useState(true)
  const [defaultLabourType, setDefaultLabourType] = React.useState<LabourType>("PERCENT")
  const [defaultLabourValue, setDefaultLabourValue] = React.useState(0)
  const [silverRatePerGram, setSilverRatePerGram] = React.useState(0)
  const [loaded, setLoaded] = React.useState(false)

  // Gold rate table (dynamic karat pricing) + its save/backfill mutations.
  const goldRates = useGoldRates()
  const saveGoldRates = useSaveGoldRates()
  const backfillKarats = useBackfillGoldKarats()
  const syncPrices = useSyncProductPrices()

  // Hydrate form fields once when settings arrive.
  const [prevSettings, setPrevSettings] = React.useState<typeof settings | undefined>(undefined)
  if (settings && settings !== prevSettings) {
    setPrevSettings(settings)
    if (!loaded) {
      setShopName(settings.shopName)
      setShopAddress(settings.shopAddress ?? "")
      setShopPhones(Array.isArray(settings.shopPhones) ? settings.shopPhones.join(", ") : typeof settings.shopPhones === "string" ? settings.shopPhones : "")
      setShopEmail(settings.shopEmail ?? "")
      setCurrency(settings.currency)
      setLowStockThreshold(String(settings.lowStockThreshold))
      setAllowZeroTotal(settings.allowZeroTotal ?? true)
      setDefaultLabourType(settings.defaultLabourType ?? "PERCENT")
      setDefaultLabourValue(settings.defaultLabourValue ?? 0)
      setSilverRatePerGram(settings.silverRatePerGram ?? 0)
      setLoaded(true)
    }
  }

  const save = {
    mutate: () => {
      updateSettings.mutate(
        {
          shopName: shopName.trim() || "My Shop",
          shopAddress: shopAddress.trim() || undefined,
          shopPhones: shopPhones.split(",").map((s) => s.trim()).filter(Boolean),
          shopEmail: shopEmail.trim() || undefined,
          currency: currency.trim() || "INR",
          lowStockThreshold: Math.max(0, Number(lowStockThreshold) || 0),
          allowZeroTotal,
        },
        {
          onSuccess: () => toast.success("Settings saved"),
          onError: (err) =>
            toast.error("Failed to save settings", {
              description: err instanceof Error ? err.message : undefined,
            }),
        },
      )
    },
    isPending: updateSettings.isPending,
  }

  const [pingState, setPingState] = React.useState<"idle" | "testing" | "ok" | "fail">("idle")
  const getClient = useApiClient()

  /** Saves the whole karat table + the shop-wide pricing settings in one go. */
  async function handleSaveGoldRates(rates: GoldRateDraft[]) {
    try {
      await saveGoldRates.mutateAsync({ rates })
      await updateSettings.mutateAsync({
        defaultLabourType,
        defaultLabourValue,
        silverRatePerGram,
      })
      toast.success("Rates saved", {
        description: "Every auto-priced gold & silver product now uses the new rates.",
      })
    } catch (err) {
      toast.error("Failed to save gold rates", {
        description: err instanceof Error ? err.message : undefined,
      })
    }
  }

  /** Fills `goldKarat` on existing gold products from their purity stamp. */
  async function handleBackfillKarats() {
    try {
      const result = await backfillKarats.mutateAsync()
      toast.success(`Filled ${result.updated} gold product(s) from their purity stamp`, {
        description:
          result.skipped > 0
            ? `${result.skipped} purity stamp(s) couldn't be read — set those karats by hand.`
            : undefined,
      })
    } catch (err) {
      toast.error("Backfill failed", {
        description: err instanceof Error ? err.message : undefined,
      })
    }
  }

  /**
   * "Recalculate prices" — after the rates above change, freeze the freshly
   * computed price into every auto-priced product (same action the products
   * page and billing expose).
   */
  async function handleSyncPrices() {
    try {
      const r = await syncPrices.mutateAsync()
      if (r.scanned === 0) {
        toast.info("No auto-priced products yet — nothing to recalculate")
      } else if (r.updated === 0) {
        toast.info("Prices already match the current rates")
      } else {
        toast.success(`Re-priced ${r.updated} of ${r.scanned} auto-priced product${r.scanned !== 1 ? "s" : ""}`)
      }
    } catch (err) {
      toast.error("Recalculation failed", { description: err instanceof Error ? err.message : undefined })
    }
  }

  async function handlePing() {
    setPingState("testing")
    try {
      // Shared api-client → GET /api/settings (same path the data hooks use).
      const api = await getClient()
      await api.settings.get()
      setPingState("ok")
    } catch {
      setPingState("fail")
    }
  }

  const sections: SettingsSection[] = [
    {
      id: "shop",
      label: "Shop profile",
      description: "Name, address & billing details",
      icon: Store,
    },
    {
      id: "gold",
      label: "Rates & labour",
      description: "Gold/silver rates & default labour",
      icon: BadgeIndianRupee,
      badge: goldRates.data?.baseKarat !== null && goldRates.data?.baseKarat !== undefined
        ? `${goldRates.data.baseKarat}K`
        : undefined,
    },
    {
      id: "appearance",
      label: "Appearance",
      description: "Color theme & light/dark mode",
      icon: Palette,
    },
    {
      id: "security",
      label: "Security",
      description: "PIN lock & sign-in",
      icon: ShieldCheck,
      badge: pin.lockEnabled ? "Locked" : "Off",
    },
    {
      id: "server",
      label: "Server",
      description: "API connection & sync",
      icon: Server,
    },
  ]

  return (
    <SettingsShell
      sections={sections}
      active={section}
      onSelect={setSection}
      title="Settings"
      subtitle="Shared across web, desktop & mobile"
    >
      {section === "shop" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <ShoppingBag className="h-4 w-4" /> Shop profile
            </CardTitle>
            <CardDescription className="text-xs">
              Appears on every bill, invoice and job letter across all three apps.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading && !loaded ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-9 w-full" />
                ))}
              </div>
            ) : (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="st-name">Shop name</Label>
                  <Input
                    id="st-name"
                    value={shopName}
                    onChange={(e) => setShopName(e.target.value)}
                    placeholder="My Shop"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="st-address">Address</Label>
                  <Input
                    id="st-address"
                    value={shopAddress}
                    onChange={(e) => setShopAddress(e.target.value)}
                    placeholder="Shop street, city"
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="st-phones">Phones (comma separated)</Label>
                    <Input
                      id="st-phones"
                      value={shopPhones}
                      onChange={(e) => setShopPhones(e.target.value)}
                      placeholder="+91 98765 43210"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="st-email">Email</Label>
                    <Input
                      id="st-email"
                      type="email"
                      value={shopEmail}
                      onChange={(e) => setShopEmail(e.target.value)}
                      placeholder="shop@example.com"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="st-currency">Currency code</Label>
                    <Input
                      id="st-currency"
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                      placeholder="INR"
                      maxLength={3}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="st-threshold">Global low-stock alert at</Label>
                    <Input
                      id="st-threshold"
                      type="number"
                      min={0}
                      value={lowStockThreshold}
                      onChange={(e) => setLowStockThreshold(e.target.value)}
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between gap-4 rounded-lg border bg-muted/40 p-3">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-medium">Allow ₹0 invoices</Label>
                    <p className="text-xs text-muted-foreground">
                      When enabled, bills with a total of ₹0 can be created (useful for complimentary items or samples).
                    </p>
                  </div>
                  <Switch
                    checked={allowZeroTotal}
                    onCheckedChange={setAllowZeroTotal}
                    aria-label="Allow zero-total invoices"
                  />
                </div>
                <Button onClick={() => save.mutate()} disabled={save.isPending} className="gap-1.5">
                  {save.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Save shop profile
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {section === "gold" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <BadgeIndianRupee className="h-4 w-4" /> Rates &amp; labour
            </CardTitle>
            <CardDescription className="text-xs">
              Gold ₹/g per karat (0–24), the shop-wide silver ₹/g and the default labour.
              Auto-priced products re-price instantly on all three apps.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <GoldRateEditor
              rates={goldRates.data?.rates}
              labourType={defaultLabourType}
              labourValue={defaultLabourValue}
              onLabourChange={(type, value) => {
                setDefaultLabourType(type)
                setDefaultLabourValue(value)
              }}
              silverRatePerGram={silverRatePerGram}
              onSilverRateChange={setSilverRatePerGram}
              onSave={handleSaveGoldRates}
              saving={saveGoldRates.isPending || updateSettings.isPending}
              onBackfillKarats={handleBackfillKarats}
              backfilling={backfillKarats.isPending}
              updatedLabel={goldRates.data?.updatedAt ? formatDateTime(goldRates.data.updatedAt) : null}
            />
            <div className="bg-muted/40 mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">Recalculate prices</p>
                <p className="text-xs text-muted-foreground">
                  Saves today's rate into every auto-priced product's stored price (manual prices are untouched).
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={handleSyncPrices} disabled={syncPrices.isPending} className="gap-1.5">
                <RefreshCw className={syncPrices.isPending ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
                {syncPrices.isPending ? "Recalculating…" : "Recalculate now"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {section === "appearance" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <SunMoon className="h-4 w-4" /> Appearance
            </CardTitle>
            <CardDescription className="text-xs">
              Color theme &amp; light/dark mode — chosen per device (stored locally, never synced across apps).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Color theme</Label>
                <ThemeSelect value={themeName} onChange={setThemeName} className="w-full" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Mode</Label>
                <Select value={mode ?? "system"} onValueChange={(v) => setMode(v as ThemeMode)}>
                  <SelectTrigger className="h-8 w-full text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MODE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center justify-between gap-4 rounded-lg border bg-muted/40 p-3">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">Force animation play</Label>
                <p className="text-xs text-muted-foreground">
                  Play the wipe animation even when your system has reduced motion enabled. Applies
                  on this device only.
                </p>
              </div>
              <Switch
                checked={forceTransition}
                onCheckedChange={setForceThemeTransition}
                aria-label="Force animation play"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {section === "security" && <PinSettingsCard />}

      {section === "server" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Server className="h-4 w-4" /> Server connection
            </CardTitle>
            <CardDescription className="text-xs">
              All three apps talk to the shared Munim API server — same data everywhere.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3 rounded-lg border bg-muted/40 p-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Server className="h-4 w-4" />
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground">
                This web app connects to the shared <strong>Munim API server</strong> — the same one
                desktop and mobile use. The base URL and API key come from build-time environment
                variables (<code className="font-mono text-[11px]">NEXT_PUBLIC_API_URL</code> /
                <code className="font-mono text-[11px]"> NEXT_PUBLIC_API_KEY</code>) — no database URL
                is ever entered here.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="font-normal">
                One API for all apps
              </Badge>
              <Badge variant="secondary" className="font-normal">
                Shared schema
              </Badge>
              <Badge variant="secondary" className="font-normal">
                One source of truth
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handlePing} disabled={pingState === "testing"} className="gap-1.5">
                {pingState === "testing" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                )}
                {pingState === "testing" ? "Checking…" : "Check server connection"}
              </Button>
              {pingState === "ok" && (
                <m.span
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-1.5 text-sm text-emerald-600 dark:text-emerald-400"
                >
                  <CheckCircle2 className="h-4 w-4" /> Connected
                </m.span>
              )}
              {pingState === "fail" && (
                <m.span
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-1.5 text-sm text-destructive"
                >
                  <XCircle className="h-4 w-4" /> Connection failed
                </m.span>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </SettingsShell>
  )
}
