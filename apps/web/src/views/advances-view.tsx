"use client"

import * as React from "react"
import {
  ArrowUpRight,
  ArrowDownLeft,
  TrendingUp,
  TrendingDown,
  Wallet,
} from "lucide-react"
import { Card, CardContent, Skeleton, SummaryTile, KhataCard, QuickAdvanceRecord, KhataActionDialog } from "@munim/ui"

import { usePartyBalances, useCreateAdvance, useRecordPayment, useParties } from "@/hooks/use-parties"
import { useAppStore } from "@/store/view-store"
import { formatCurrency } from "@/lib/format"
import type { PartyBalance } from "@/lib/types"
import { toast } from "@munim/ui"

type ActionKind = "GIVEN" | "TAKEN" | "PAYMENT_IN" | "PAYMENT_OUT"

type Action = {
  party: PartyBalance
  kind: ActionKind
} | null

export function AdvancesView() {
  const setView = useAppStore((s) => s.setView)
  const { data, isLoading } = usePartyBalances()
  const { data: allParties } = useParties()

  const [action, setAction] = React.useState<Action>(null)
  const [amount, setAmount] = React.useState(0)
  const [quickParty, setQuickParty] = React.useState("")
  const [quickKind, setQuickKind] = React.useState<"GIVEN" | "TAKEN">("GIVEN")

  const createAdvance = useCreateAdvance()
  const recordPayment = useRecordPayment()

  const receivables = data?.receivables ?? []
  const payables = data?.payables ?? []
  const totalReceivable = receivables.reduce((s, p) => s + p.balance, 0)
  const totalPayable = payables.reduce((s, p) => s + Math.abs(p.balance), 0)

  function openAction(party: PartyBalance, kind: ActionKind) {
    setAction({ party, kind })
    setAmount(0)
  }

  async function submitAction(amount: number, note: string) {
    if (!action || amount <= 0) return
    try {
      if (action.kind === "GIVEN" || action.kind === "TAKEN") {
        await createAdvance.mutateAsync({ partyId: action.party.id, direction: action.kind, amount, note })
        toast.success(action.kind === "GIVEN" ? "Advance given" : "Advance received", {
          description: `${formatCurrency(amount)} · ${action.party.name}`,
        })
      } else {
        await recordPayment.mutateAsync({
          partyId: action.party.id,
          direction: action.kind === "PAYMENT_IN" ? "IN" : "OUT",
          amount,
          note,
        })
        toast.success(action.kind === "PAYMENT_IN" ? "Payment received" : "Payment made", {
          description: `${formatCurrency(amount)} · ${action.party.name}`,
        })
      }
      setAction(null)
    } catch (err) {
      toast.error("Failed", { description: err instanceof Error ? err.message : "Unknown error" })
    }
  }

  async function submitQuick() {
    if (!quickParty || amount <= 0) return
    try {
      await createAdvance.mutateAsync({ partyId: quickParty, direction: quickKind, amount })
      toast.success(quickKind === "GIVEN" ? "Advance given" : "Advance received", { description: formatCurrency(amount) })
      setAmount(0)
    } catch (err) {
      toast.error("Failed", { description: err instanceof Error ? err.message : "Unknown error" })
    }
  }

  if (isLoading) {
    return (
      <div className="grid gap-4 lg:grid-cols-2">
        <Card><CardContent className="space-y-2 p-4">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</CardContent></Card>
        <Card><CardContent className="space-y-2 p-4">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</CardContent></Card>
      </div>
    )
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
        parties={allParties ?? []}
        partyId={quickParty}
        onPartyChange={setQuickParty}
        kind={quickKind}
        onKindChange={setQuickKind}
        amount={amount}
        onAmountChange={setAmount}
        busy={createAdvance.isPending}
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
          onViewAll={() => setView("parties")}
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
          onViewAll={() => setView("parties")}
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
        busy={createAdvance.isPending || recordPayment.isPending}
        onConfirm={({ amount: a, note }) => void submitAction(a, note)}
      />
    </div>
  )
}
