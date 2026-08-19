import { useEffect, useRef, useState } from "react";
import { Server, Save, RotateCcw, Eye, EyeOff, ShieldCheck, Store, Palette, ShoppingBag, SunMoon, Loader2 } from "lucide-react";
import { pingApiUrl, resetApi } from "@/lib/api";
import { getSavedApiKey, getSavedApiUrl, saveApiKey, saveApiUrl } from "@/lib/env";
import { useSettings, useUpdateSettings, useQueryState } from "@munim/query";
import { toast } from "@munim/ui";
import {
  ThemeSelect,
  useAccentTheme,
  type ThemeMode,
} from "@/components/theme-swatches";
import {
  Button,
  Input,
  Label,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  ConnectionTestDialog,
  type ConnectionTestState,
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
} from "@munim/ui";

const MODE_OPTIONS: { value: ThemeMode; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
];

/** Masked host of a saved API URL (shown instead of the raw string). */
function maskApiHost(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).host;
  } catch {
    return url.slice(0, 28);
  }
}

export function SettingsPage() {
  const { data: settings } = useQueryState(useSettings());
  const updateSettings = useUpdateSettings();
  const { themeName, setThemeName, mode, setMode } = useAccentTheme();
  const pin = usePinLockContext();
  const forceTransition = useForceThemeTransition();

  const [section, setSection] = useState<string>("shop");

  const [shopName, setShopName] = useState("");
  const [shopAddress, setShopAddress] = useState("");
  const [shopPhones, setShopPhones] = useState("");
  const [shopEmail, setShopEmail] = useState("");
  const [currency, setCurrency] = useState("INR");
  const [lowStockThreshold, setLowStockThreshold] = useState("5");
  // Only guards one-time population of the form from settings — a ref avoids
  // a pointless re-render (its value is never read in JSX).
  const loadedRef = useRef(false);

  const [apiUrl, setApiUrl] = useState(() => getSavedApiUrl() ?? "");
  const [apiKey, setApiKey] = useState(() => getSavedApiKey() ?? "");
  const [showApiUrl, setShowApiUrl] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [testOpen, setTestOpen] = useState(false);
  const [testState, setTestState] = useState<ConnectionTestState>("testing");
  const [testError, setTestError] = useState<string | undefined>();
  const [savingShop, setSavingShop] = useState(false);
  const [savingUrl, setSavingUrl] = useState(false);

  // Masked host of the currently saved URL (shown instead of the raw string).
  const savedHost = maskApiHost(getSavedApiUrl());

  useEffect(() => {
    if (settings && !loadedRef.current) {
      loadedRef.current = true;
      setShopName(settings.shopName);
      setShopAddress(settings.shopAddress ?? "");
      setShopPhones(settings.shopPhones.join(", "));
      setShopEmail(settings.shopEmail ?? "");
      setCurrency(settings.currency);
      setLowStockThreshold(String(settings.lowStockThreshold));
    }
  }, [settings]);

  async function handleSaveShop() {
    setSavingShop(true);
    try {
      await updateSettings.mutateAsync({
        shopName: shopName.trim() || "My Shop",
        shopAddress: shopAddress.trim() || undefined,
        shopPhones: shopPhones.split(",").map((s) => s.trim()).filter(Boolean),
        shopEmail: shopEmail.trim() || undefined,
        currency: currency.trim() || "INR",
        lowStockThreshold: Math.max(0, Number(lowStockThreshold) || 0),
      });
      toast.success("Settings saved");
    } catch (err) {
      toast.error("Failed to save", { description: err instanceof Error ? err.message : undefined });
    } finally {
      setSavingShop(false);
    }
  }

  /** Runs the ping once, flipping the modal between loading → ok / fail. */
  async function runConnectionTest(url: string, key: string): Promise<boolean> {
    setTestState("testing");
    setTestError(undefined);
    try {
      // Pings GET /readyz through the shared api-client (Tauri HTTP plugin in
      // the webview — no CORS). Resolves when the API + DB are reachable.
      await pingApiUrl(url, key || undefined);
      setTestState("ok");
      return true;
    } catch (err) {
      setTestState("fail");
      setTestError(err instanceof Error ? err.message : "Connection failed");
      return false;
    }
  }

  async function handleTestConnection() {
    const url = apiUrl.trim();
    if (!url) {
      toast.error("Enter the server URL first");
      return;
    }
    // Open the modal first so the loading state is visible immediately, then
    // ping. The dialog can't be dismissed while the test is in flight.
    setTestOpen(true);
    await runConnectionTest(url, apiKey);
  }

  async function handleSaveUrl() {
    const url = apiUrl.trim();
    if (!url) {
      toast.error("Enter the server URL first");
      return;
    }
    setSavingUrl(true);
    setTestOpen(true);
    const ok = await runConnectionTest(url, apiKey);
    if (ok) {
      saveApiUrl(url);
      if (apiKey.trim()) saveApiKey(apiKey.trim());
      resetApi();
      toast.success("Server saved — reconnecting with the new URL");
    } else {
      toast.error("Not saved — connection failed");
    }
    setSavingUrl(false);
  }

  const sections: SettingsSection[] = [
    {
      id: "shop",
      label: "Shop profile",
      description: "Name, address & billing details",
      icon: Store,
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
  ];

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
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="st-name">Shop name</Label>
              <Input id="st-name" value={shopName} onChange={(e) => setShopName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="st-address">Address</Label>
              <Input id="st-address" value={shopAddress} onChange={(e) => setShopAddress(e.target.value)} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="st-phones">Phones (comma separated)</Label>
                <Input id="st-phones" value={shopPhones} onChange={(e) => setShopPhones(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="st-email">Email</Label>
                <Input id="st-email" value={shopEmail} onChange={(e) => setShopEmail(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="st-currency">Currency code</Label>
                <Input id="st-currency" value={currency} onChange={(e) => setCurrency(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="st-threshold">Global low-stock alert at</Label>
                <Input id="st-threshold" type="number" min={0} value={lowStockThreshold} onChange={(e) => setLowStockThreshold(e.target.value)} />
              </div>
            </div>
            <Button onClick={handleSaveShop} disabled={savingShop}>
              {savingShop ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Saving…</> : <><Save className="h-4 w-4" /> Save shop profile</>}
            </Button>
          </CardContent>
        </Card>
      )}

      {section === "appearance" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <SunMoon className="h-4 w-4" /> Appearance
            </CardTitle>
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
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground text-sm leading-relaxed">
              This desktop app talks to the shared <strong>Munim API server</strong> — the same one the
              web app uses. Enter its base URL; the API key is baked in at build time (you can override
              it here for local development).
            </p>
            <ConnectionTestDialog
              open={testOpen}
              onOpenChange={setTestOpen}
              state={testState}
              error={testError}
              onRetry={() => void runConnectionTest(apiUrl.trim(), apiKey)}
            />
            <div className="space-y-1.5">
              <Label htmlFor="st-api">API base URL</Label>
              <div className="relative">
                <Input
                  id="st-api"
                  type={showApiUrl ? "text" : "password"}
                  value={apiUrl}
                  onChange={(e) => setApiUrl(e.target.value)}
                  placeholder="https://api.munim.app"
                  className="font-mono pr-10 text-xs"
                  autoComplete="off"
                />
                <button
                  type="button"
                  onClick={() => setShowApiUrl((v) => !v)}
                  aria-label={showApiUrl ? "Hide URL" : "Show URL"}
                  className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2.5 -translate-y-1/2 cursor-pointer"
                >
                  {showApiUrl ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="st-api-key">API key</Label>
              <div className="relative">
                <Input
                  id="st-api-key"
                  type={showApiKey ? "text" : "password"}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Optional — defaults to the build-time key"
                  className="font-mono pr-10 text-xs"
                  autoComplete="off"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey((v) => !v)}
                  aria-label={showApiKey ? "Hide API key" : "Show API key"}
                  className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2.5 -translate-y-1/2 cursor-pointer"
                >
                  {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <ShieldCheck className="h-3.5 w-3.5" />
                {savedHost
                  ? `Saved server: ${savedHost} — stored on this device only.`
                  : "The URL and key are stored on this device only."}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={handleTestConnection} disabled={testState === "testing"}>
                {testState === "testing" ? "Testing…" : "Test connection"}
              </Button>
              <Button onClick={handleSaveUrl} disabled={savingUrl}>
                {savingUrl ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Saving…</> : <><Save className="h-4 w-4" /> Save &amp; reconnect</>}
              </Button>
              <Button variant="ghost" onClick={() => { resetApi(); toast.success("Client reset"); }}>
                <RotateCcw className="h-4 w-4" /> Reset client
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </SettingsShell>
  );
}
