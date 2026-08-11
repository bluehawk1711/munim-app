"use client"

import * as React from "react"
import { motion } from "motion/react"
import { Save, Loader2, Store, Database, CheckCircle2, XCircle, Globe, Palette } from "lucide-react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiFetch } from "@/lib/api-client"
import { Button, Input, Label, Card, CardContent, CardDescription, CardHeader, CardTitle, Badge, Skeleton, PinSettingsCard } from "@munim/ui"






import { toast } from "sonner"
import { ThemeSwatches, useAccentThemeContext } from "@/components/app/theme-picker"

type ShopSettings = {
  shopName: string
  shopAddress: string | null
  shopPhones: string[]
  shopEmail: string | null
  lowStockThreshold: number
  currency: string
}

function useShopSettings() {
  return useQuery({
    queryKey: ["settings"],
    queryFn: () => apiFetch<ShopSettings>("/api/settings"),
    staleTime: 1000 * 60,
  })
}

export function SettingsView() {
  const queryClient = useQueryClient()
  const { data: settings, isLoading } = useShopSettings()
  const { themeName, setThemeName } = useAccentThemeContext()

  const [shopName, setShopName] = React.useState("")
  const [shopAddress, setShopAddress] = React.useState("")
  const [shopPhones, setShopPhones] = React.useState("")
  const [shopEmail, setShopEmail] = React.useState("")
  const [currency, setCurrency] = React.useState("INR")
  const [lowStockThreshold, setLowStockThreshold] = React.useState("5")
  const [loaded, setLoaded] = React.useState(false)

  // Hydrate form fields once when settings arrive.
  const [prevSettings, setPrevSettings] = React.useState<ShopSettings | undefined>(undefined)
  if (settings && settings !== prevSettings) {
    setPrevSettings(settings)
    if (!loaded) {
      setShopName(settings.shopName)
      setShopAddress(settings.shopAddress ?? "")
      setShopPhones((settings.shopPhones ?? []).join(", "))
      setShopEmail(settings.shopEmail ?? "")
      setCurrency(settings.currency)
      setLowStockThreshold(String(settings.lowStockThreshold))
      setLoaded(true)
    }
  }

  const save = useMutation({
    mutationFn: () =>
      apiFetch<ShopSettings>("/api/settings", {
        method: "PUT",
        body: {
          shopName: shopName.trim() || "My Shop",
          shopAddress: shopAddress.trim() || undefined,
          shopPhones: shopPhones.split(",").map((s) => s.trim()).filter(Boolean),
          shopEmail: shopEmail.trim() || undefined,
          currency: currency.trim() || "INR",
          lowStockThreshold: Math.max(0, Number(lowStockThreshold) || 0),
        },
      }),
    onSuccess: (saved) => {
      queryClient.setQueryData(["settings"], saved)
      toast.success("Settings saved")
    },
    onError: (err) => {
      toast.error("Failed to save settings", {
        description: err instanceof Error ? err.message : undefined,
      })
    },
  })

  const [pingState, setPingState] = React.useState<"idle" | "testing" | "ok" | "fail">("idle")

  async function handlePing() {
    setPingState("testing")
    try {
      const res = await fetch("/api/settings", { cache: "no-store" })
      if (res.ok) {
        setPingState("ok")
      } else {
        setPingState("fail")
      }
    } catch {
      setPingState("fail")
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      {/* Shop profile */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Store className="h-4 w-4" /> Shop profile
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

      {/* Appearance — accent theme (works with light & dark mode) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Palette className="h-4 w-4" /> Appearance
          </CardTitle>
          <CardDescription className="text-xs">
            Pick a color theme — each adapts to both light and dark mode.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ThemeSwatches value={themeName} onChange={setThemeName} />
        </CardContent>
      </Card>

      {/* App lock — 4-digit PIN, per-device */}
      <PinSettingsCard />

      {/* Shared database */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Database className="h-4 w-4" /> Shared database
          </CardTitle>
          <CardDescription className="text-xs">
            One Neon Postgres database powers web, desktop and mobile — no API server.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-3 rounded-lg border bg-muted/40 p-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Globe className="h-4 w-4" />
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Munim talks to the database <strong>directly</strong> from the browser via Neon&apos;s
              SQL-over-HTTP endpoint. The connection string lives in the server environment — desktop
              and mobile apps can connect to the same database by pasting it in their Settings screens.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="font-normal">
              No API server
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
              {pingState === "testing" ? "Checking…" : "Check database connection"}
            </Button>
            {pingState === "ok" && (
              <motion.span
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-1.5 text-sm text-emerald-600 dark:text-emerald-400"
              >
                <CheckCircle2 className="h-4 w-4" /> Connected
              </motion.span>
            )}
            {pingState === "fail" && (
              <motion.span
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-1.5 text-sm text-destructive"
              >
                <XCircle className="h-4 w-4" /> Connection failed
              </motion.span>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
