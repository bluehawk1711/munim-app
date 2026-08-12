import { useEffect, useState } from "react";
import { Database, Save, CheckCircle2, XCircle, RotateCcw, Palette } from "lucide-react";
import { createDb, getSettings, pingDatabase, updateSettings } from "@munim/core";
import { getCore, resetCore } from "@/lib/core";
import { getSavedDatabaseUrl, saveDatabaseUrl } from "@/lib/env";
import { useAsync } from "@/lib/use-async";
import { toast } from "sonner";
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
  PinSettingsCard,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@munim/ui"

export function SettingsPage() {
  const { data: settings, reload } = useAsync(() => getSettings(getCore()), []);
  const { themeName, setThemeName, mode, setMode } = useAccentTheme();

  const [shopName, setShopName] = useState("");
  const [shopAddress, setShopAddress] = useState("");
  const [shopPhones, setShopPhones] = useState("");
  const [shopEmail, setShopEmail] = useState("");
  const [currency, setCurrency] = useState("INR");
  const [lowStockThreshold, setLowStockThreshold] = useState("5");
  const [loaded, setLoaded] = useState(false);

  const [dbUrl, setDbUrl] = useState(getSavedDatabaseUrl() ?? "");
  const [testing, setTesting] = useState<"idle" | "testing" | "ok" | "fail">("idle");

  useEffect(() => {
    if (settings && !loaded) {
      setShopName(settings.shopName);
      setShopAddress(settings.shopAddress ?? "");
      setShopPhones(settings.shopPhones.join(", "));
      setShopEmail(settings.shopEmail ?? "");
      setCurrency(settings.currency);
      setLowStockThreshold(String(settings.lowStockThreshold));
      setLoaded(true);
    }
  }, [settings, loaded]);

  async function handleSaveShop() {
    try {
      await updateSettings(getCore(), {
        shopName: shopName.trim() || "My Shop",
        shopAddress: shopAddress.trim() || undefined,
        shopPhones: shopPhones.split(",").map((s) => s.trim()).filter(Boolean),
        shopEmail: shopEmail.trim() || undefined,
        currency: currency.trim() || "INR",
        lowStockThreshold: Math.max(0, Number(lowStockThreshold) || 0),
      });
      toast.success("Settings saved");
      reload();
    } catch (err) {
      toast.error("Failed to save", { description: err instanceof Error ? err.message : undefined });
    }
  }

  async function handleTestConnection() {
    const url = dbUrl.trim();
    if (!url) {
      toast.error("Enter a database URL first");
      return;
    }
    setTesting("testing");
    try {
      const testDb = createDb({ databaseUrl: url });
      await pingDatabase(testDb);
      setTesting("ok");
    } catch (err) {
      setTesting("fail");
      toast.error("Connection failed", { description: err instanceof Error ? err.message : undefined });
    }
  }

  function handleSaveUrl() {
    saveDatabaseUrl(dbUrl);
    resetCore();
    setTesting("idle");
    toast.success("Database URL saved — reconnect with the new URL");
  }

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Shop profile</CardTitle>
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
          <Button onClick={handleSaveShop}>
            <Save className="h-4 w-4" /> Save shop profile
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Palette className="h-4 w-4" /> Appearance
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
                  <SelectItem value="light">Light</SelectItem>
                  <SelectItem value="dark">Dark</SelectItem>
                  <SelectItem value="system">System</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <PinSettingsCard />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Database className="h-4 w-4" /> Database
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground text-sm leading-relaxed">
            Munim has no API server — this desktop app connects <strong>directly</strong> to the shared
            Neon Postgres database used by the web app and mobile app. Paste your connection string:
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="st-db">Neon connection string (postgres://…)</Label>
            <Input id="st-db" value={dbUrl} onChange={(e) => setDbUrl(e.target.value)} placeholder="postgresql://user:pass@host/db?sslmode=require" className="font-mono text-xs" />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={handleTestConnection} disabled={testing === "testing"}>
              {testing === "testing" ? "Testing…" : "Test connection"}
            </Button>
            <Button onClick={handleSaveUrl}>
              <Save className="h-4 w-4" /> Save URL
            </Button>
            <Button variant="ghost" onClick={() => { resetCore(); toast.success("Client reset"); }}>
              <RotateCcw className="h-4 w-4" /> Reset client
            </Button>
          </div>
          {testing === "ok" && (
            <p className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4" /> Connected successfully.
            </p>
          )}
          {testing === "fail" && (
            <p className="flex items-center gap-2 text-sm text-destructive">
              <XCircle className="h-4 w-4" /> Connection failed — check the URL.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
