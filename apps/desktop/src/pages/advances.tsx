import { useState } from "react";
import { HandCoins, ArrowUpRight, ArrowDownLeft, Plus, Loader2, TrendingUp, TrendingDown, Wallet } from "lucide-react";
import {
  getPartyBalances,
  getReceivables,
  getPayables,
  listParties,
  createAdvance,
  recordPayment,
  formatCurrency,
  type PartyBalance,
} from "@munim/core";
import { getCore } from "@/lib/core";
import { useAsync } from "@/lib/use-async";
import { toast } from "sonner";
import {
  Button,
  Card,
  CardContent,
  Skeleton,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SummaryTile,
  KhataCard,
  type KhataActionKind,
} from "@munim/ui";

type Action = { party: PartyBalance; kind: KhataActionKind } | null;

export function AdvancesPage() {
  const { data, loading, reload } = useAsync(
    async () => {
      const db = getCore();
      const [all, receivables, payables, parties] = await Promise.all([
        getPartyBalances(db),
        getReceivables(db),
        getPayables(db),
        listParties(db),
      ]);
      return { all, receivables, payables, parties };
    },
    [],
  );

  const [action, setAction] = useState<Action>(null);
  const [amount, setAmount] = useState(0);
  const [note, setNote] = useState("");
  const [quickParty, setQuickParty] = useState("");
  const [quickKind, setQuickKind] = useState<"GIVEN" | "TAKEN">("GIVEN");
  const [saving, setSaving] = useState(false);

  const receivables = data?.receivables ?? [];
  const payables = data?.payables ?? [];
  const totalReceivable = receivables.reduce((s, p) => s + p.balance, 0);
  const totalPayable = payables.reduce((s, p) => s + Math.abs(p.balance), 0);

  function openAction(party: PartyBalance, kind: KhataActionKind) {
    setAction({ party, kind });
    setAmount(0);
    setNote("");
  }

  async function submitAction() {
    if (!action || amount <= 0) return;
    setSaving(true);
    try {
      const db = getCore();
      if (action.kind === "GIVEN" || action.kind === "TAKEN") {
        await createAdvance(db, { partyId: action.party.id, direction: action.kind, amount, note: note.trim() || undefined });
        toast.success(action.kind === "GIVEN" ? "Advance given" : "Advance received", {
          description: `${formatCurrency(amount)} · ${action.party.name}`,
        });
      } else {
        await recordPayment(db, {
          partyId: action.party.id,
          direction: action.kind === "PAYMENT_IN" ? "IN" : "OUT",
          amount,
          method: "cash",
          note: note.trim() || undefined,
        });
        toast.success(action.kind === "PAYMENT_IN" ? "Payment received" : "Payment made", {
          description: `${formatCurrency(amount)} · ${action.party.name}`,
        });
      }
      setAction(null);
      reload();
    } catch (err) {
      toast.error("Failed", { description: err instanceof Error ? err.message : undefined });
    } finally {
      setSaving(false);
    }
  }

  async function submitQuick() {
    if (!quickParty || amount <= 0) return;
    setSaving(true);
    try {
      await createAdvance(getCore(), { partyId: quickParty, direction: quickKind, amount, note: note.trim() || undefined });
      toast.success(quickKind === "GIVEN" ? "Advance given" : "Advance received", { description: formatCurrency(amount) });
      setAmount(0);
      setNote("");
      reload();
    } catch (err) {
      toast.error("Failed", { description: err instanceof Error ? err.message : undefined });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="grid gap-4 lg:grid-cols-2">
        <Card><CardContent className="space-y-2 p-4">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</CardContent></Card>
        <Card><CardContent className="space-y-2 p-4">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</CardContent></Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryTile label="We are owed (udhaar)" value={formatCurrency(totalReceivable)} icon={TrendingUp} accent="emerald" />
        <SummaryTile label="We owe (payable)" value={formatCurrency(totalPayable)} icon={TrendingDown} accent="red" />
        <SummaryTile label="Net position" value={formatCurrency(totalReceivable - totalPayable)} icon={Wallet} accent="primary" />
      </div>

      {/* Quick record */}
      <Card className="border-primary/20 bg-primary/[0.03]">
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-1.5">
            <Label className="text-xs">Party</Label>
            <Select value={quickParty} onValueChange={setQuickParty}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Select party…" /></SelectTrigger>
              <SelectContent>
                {(data?.parties ?? []).map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1 space-y-1.5">
            <Label className="text-xs">Type</Label>
            <Select value={quickKind} onValueChange={(v) => setQuickKind(v as "GIVEN" | "TAKEN")}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="GIVEN">I gave advance (they owe me)</SelectItem>
                <SelectItem value="TAKEN">I took advance (I owe them)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1 space-y-1.5">
            <Label className="text-xs">Amount (₹)</Label>
            <Input type="number" min={0} value={amount || ""} onChange={(e) => setAmount(Number(e.target.value))} className="h-9" />
          </div>
          <Button onClick={submitQuick} disabled={!quickParty || amount <= 0 || saving} className="h-9 gap-1.5">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Record
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Receivables — money given out */}
        <KhataCard
          title="Whom I gave advance / money"
          description="These parties owe us money (receivables)"
          icon={ArrowUpRight}
          accent="emerald"
          parties={receivables}
          emptyText="No receivables — you haven't given anyone money."
          onAction={openAction}
          onViewAll={() => toast.info("Open a party in Parties & Khata to see its full ledger")}
        />
        {/* Payables — money owed to others */}
        <KhataCard
          title="Whom I still have to give money"
          description="We owe these parties (payables)"
          icon={ArrowDownLeft}
          accent="red"
          parties={payables}
          emptyText="No payables — you owe no one."
          onAction={openAction}
          onViewAll={() => toast.info("Open a party in Parties & Khata to see its full ledger")}
        />
      </div>

      {/* Action dialog */}
      <Dialog open={!!action} onOpenChange={(open) => !open && setAction(null)}>
        <DialogContent className="sm:max-w-[380px]">
          <DialogHeader>
            <DialogTitle>
              {action?.kind === "GIVEN" ? "Give advance" : action?.kind === "TAKEN" ? "Take advance" : action?.kind === "PAYMENT_IN" ? "Receive payment" : "Make payment"}
            </DialogTitle>
            <DialogDescription>{action?.party.name}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex items-center justify-between rounded-lg bg-muted/50 p-3 text-sm">
              <span className="text-muted-foreground">Current balance</span>
              <span className="font-semibold">{action ? formatCurrency(action.party.balance) : "—"}</span>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Amount (₹)</Label>
              <Input type="number" min={0} value={amount || ""} onChange={(e) => setAmount(Number(e.target.value))} className="h-9" autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Note (optional)</Label>
              <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. gold purchase advance" className="h-9" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAction(null)}>Cancel</Button>
            <Button onClick={submitAction} disabled={amount <= 0 || saving}>
              {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <HandCoins className="mr-1.5 h-4 w-4" />}
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
