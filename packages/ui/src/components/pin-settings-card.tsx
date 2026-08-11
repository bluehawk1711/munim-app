"use client"

/**
 * App-lock settings card — shared by the web and desktop Settings pages.
 * Consumes `usePinLockContext` (from PinGate) so status stays live: change the
 * PIN, disable/enable the lock, or reset to the pre-created test account.
 */
import * as React from "react";
import { KeyRound, ShieldCheck, ShieldOff, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { cn } from "../lib/utils";
import { usePinLockContext } from "./pin-gate";
import { Button } from "./button";
import { Input } from "./input";
import { Label } from "./label";
import { Badge } from "./badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./card";

function PinFields({
  current,
  newPin,
  confirm,
  showCurrent = true,
  onChange,
}: {
  current: string;
  newPin: string;
  confirm: string;
  /** Hide the "Current" field (enable-lock mode has no current PIN yet). */
  showCurrent?: boolean;
  onChange: (field: "current" | "newPin" | "confirm", value: string) => void;
}) {
  const pinProps = (field: "current" | "newPin" | "confirm", value: string) => ({
    type: "password",
    inputMode: "numeric" as const,
    pattern: "[0-9]*",
    maxLength: 4,
    autoComplete: "off",
    value,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      onChange(field, e.target.value.replace(/\D/g, "").slice(0, 4)),
    className: "text-center tracking-[0.4em] font-mono",
  });
  return (
    <div className={cn("grid gap-3", showCurrent ? "sm:grid-cols-3" : "sm:grid-cols-2")}>
      {showCurrent && (
        <div className="space-y-1.5">
          <Label htmlFor="pin-current">Current</Label>
          <Input id="pin-current" placeholder="••••" {...pinProps("current", current)} />
        </div>
      )}
      <div className="space-y-1.5">
        <Label htmlFor="pin-new">New PIN</Label>
        <Input id="pin-new" placeholder="••••" {...pinProps("newPin", newPin)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="pin-confirm">Confirm</Label>
        <Input id="pin-confirm" placeholder="••••" {...pinProps("confirm", confirm)} />
      </div>
    </div>
  );
}

export function PinSettingsCard() {
  const lock = usePinLockContext();
  const [current, setCurrent] = React.useState("");
  const [newPin, setNewPin] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const clear = () => {
    setCurrent("");
    setNewPin("");
    setConfirm("");
  };

  async function handleChange() {
    if (newPin !== confirm) {
      toast.error("New PINs do not match");
      return;
    }
    setBusy(true);
    const err = lock.changePin(current, newPin);
    setBusy(false);
    if (err) {
      toast.error(err);
      return;
    }
    clear();
    toast.success("PIN updated");
  }

  async function handleDisable() {
    setBusy(true);
    const err = lock.disable(current);
    setBusy(false);
    if (err) {
      toast.error(err);
      return;
    }
    clear();
    toast.success("App lock disabled");
  }

  async function handleEnable() {
    if (newPin !== confirm) {
      toast.error("PINs do not match");
      return;
    }
    setBusy(true);
    const err = lock.enable(newPin);
    setBusy(false);
    if (err) {
      toast.error(err);
      return;
    }
    clear();
    toast.success("App lock enabled");
  }

  function handleResetToTest() {
    if (!window.confirm("Reset to the test account (PIN 1234)? This replaces your current PIN.")) {
      return;
    }
    lock.resetToTest();
    clear();
    toast.success("Reset to test account — PIN 1234");
  }

  // Persisted state — NOT the session status (after unlocking, status is
  // "unlocked" but the lock is still enabled).
  const enabled = lock.lockEnabled;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <KeyRound className="h-4 w-4" /> App lock
        </CardTitle>
        <CardDescription className="text-xs">
          A 4-digit PIN unlocks this device — stored locally (hashed), never sent to the database.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          {enabled ? (
            <Badge className="gap-1">
              <ShieldCheck className="h-3 w-3" /> PIN lock enabled
            </Badge>
          ) : (
            <Badge variant="secondary" className="gap-1">
              <ShieldOff className="h-3 w-3" /> Lock disabled
            </Badge>
          )}
          {lock.isTestAccount && (
            <Badge variant="secondary">Test account — PIN 1234</Badge>
          )}
        </div>

        {enabled ? (
          <>
            <div className="space-y-2">
              <PinFields current={current} newPin={newPin} confirm={confirm} onChange={(f, v) => {
                if (f === "current") setCurrent(v);
                if (f === "newPin") setNewPin(v);
                if (f === "confirm") setConfirm(v);
              }} />
              <Button onClick={handleChange} disabled={busy} size="sm" className="gap-1.5">
                <KeyRound className="h-3.5 w-3.5" /> Change PIN
              </Button>
            </div>
            <div className="flex flex-wrap gap-2 border-t pt-4">
              <Button variant="outline" size="sm" onClick={handleDisable} disabled={busy} className="gap-1.5">
                <ShieldOff className="h-3.5 w-3.5" /> Disable lock
              </Button>
              <Button variant="ghost" size="sm" onClick={handleResetToTest} className="gap-1.5 text-muted-foreground">
                <RotateCcw className="h-3.5 w-3.5" /> Reset to test account
              </Button>
            </div>
          </>
        ) : (
          <div className="space-y-2 border-t pt-4">
            <p className="text-xs text-muted-foreground">
              Enable the lock with a new 4-digit PIN. You&apos;ll be asked for it next launch.
            </p>
            <PinFields current="" newPin={newPin} confirm={confirm} showCurrent={false} onChange={(f, v) => {
              if (f === "newPin") setNewPin(v);
              if (f === "confirm") setConfirm(v);
            }} />
            <Button onClick={handleEnable} disabled={busy} size="sm" className="gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5" /> Enable lock
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
