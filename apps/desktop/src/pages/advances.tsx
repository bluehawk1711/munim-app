import { useState } from "react";
import { ArrowUpRight, ArrowDownLeft, TrendingUp, TrendingDown, Wallet } from "lucide-react";
import { formatCurrency } from "@munim/core";
import type { PartyBalanceDto } from "@munim/api-client";
import {
  usePartyBalances,
  useParties,
  useCreateAdvance,
  useRecordPartyPayment,
  useQueryState,
} from "@munim/query";
import { toast } from "@munim/ui";
import {
  Card,
  CardContent,
  Skeleton,
  SummaryTile,
  KhataCard,
  QuickAdvanceRecord,
  KhataActionDialog,
  type KhataActionKind,
} from "@munim/ui";

type Action = { party: PartyBalanceDto; kind: KhataActionKind } | null;

export function AdvancesPage() {
  const balances = useQueryState(usePartyBalances());
  const partiesQ = useQueryState(useParties());
  const createAdvance = useCreateAdvance();
  const recordPayment = useRecordPartyPayment();
  const loading = balances.loading || partiesQ.loading;

  const [action, setAction] = useState<Action>(null);
  const [amount, setAmount] = useState(0);
  const [quickParty, setQuickParty] = useState("");
  const [quickKind, setQuickKind] = useState<"GIVEN" | "TAKEN">("GIVEN");
  const [saving, setSaving] = useState(false);

  const receivables = balances.data?.receivables ?? [];
  const payables = balances.data?.payables ?? [];
  const totalReceivable = receivables.reduce((s, p) => s + p.balance, 0);
  const totalPayable = payables.reduce((s, p) => s + Math.abs(p.balance), 0);

  function openAction(party: PartyBalanceDto, kind: KhataActionKind) {
    setAction({ party, kind });
    setAmount(0);
  }

  async function submitAction(amount: number, note: string) {
    if (!action || amount <= 0) return;
    setSaving(true);
    try {
      if (action.kind === "GIVEN" || action.kind === "TAKEN") {
        await createAdvance.mutateAsync({ partyId: action.party.id, direction: action.kind, amount, note: note.trim() || undefined });
        toast.success(action.kind === "GIVEN" ? "Advance given" : "Advance received", {
          description: `${formatCurrency(amount)} · ${action.party.name}`,
        });
      } else {
        await recordPayment.mutateAsync({
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
      await createAdvance.mutateAsync({ partyId: quickParty, direction: quickKind, amount });
      toast.success(quickKind === "GIVEN" ? "Advance given" : "Advance received", { description: formatCurrency(amount) });
      setAmount(0);
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
      <QuickAdvanceRecord
        parties={partiesQ.data ?? []}
        partyId={quickParty}
        onPartyChange={setQuickParty}
        kind={quickKind}
        onKindChange={setQuickKind}
        amount={amount}
        onAmountChange={setAmount}
        busy={saving}
        onRecord={() => void submitQuick()}
      />

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
      <KhataActionDialog
        key={action ? `${action.party.id}-${action.kind}` : "closed"}
        open={!!action}
        onOpenChange={(open) => !open && setAction(null)}
        title={
          action?.kind === "GIVEN"
            ? "Give advance"
            : action?.kind === "TAKEN"
            ? "Take advance"
            : action?.kind === "PAYMENT_IN"
            ? "Receive payment"
            : "Make payment"
        }
        subtitle={action?.party.name}
        balance={action?.party.balance}
        busy={saving}
        onConfirm={({ amount: a, note }) => void submitAction(a, note)}
      />
    </div>
  );
}
