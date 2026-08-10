"use client"

import * as React from "react"
import {
  HandCoins,
  ArrowUpRight,
  ArrowDownLeft,
  Plus,
  Users,
  Loader2,
  TrendingUp,
  TrendingDown,
  Wallet,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { usePartyBalances, useCreateAdvance, useRecordPayment, useParties } from "@/hooks/use-parties"
import { useAppStore } from "@/store/view-store"
import { formatCurrency } from "@/lib/format"
import type { PartyBalance } from "@/lib/types"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

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
  const [note, setNote] = React.useState("")
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
    setNote("")
  }

  async function submitAction() {
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
      await createAdvance.mutateAsync({ partyId: quickParty, direction: quickKind, amount, note })
      toast.success(quickKind === "GIVEN" ? "Advance given" : "Advance received", { description: formatCurrency(amount) })
      setAmount(0)
      setNote("")
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
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">We are owed (udhaar)</p>
              <p className="text-lg font-semibold">{formatCurrency(totalReceivable)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-500/15 text-red-600 dark:text-red-400">
              <TrendingDown className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">We owe (payable)</p>
              <p className="text-lg font-semibold">{formatCurrency(totalPayable)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Wallet className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Net position</p>
              <p className="text-lg font-semibold">{formatCurrency(totalReceivable - totalPayable)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick record */}
      <Card className="border-primary/20 bg-primary/[0.03]">
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-1.5">
            <Label className="text-xs">Party</Label>
            <Select value={quickParty} onValueChange={setQuickParty}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Select party…" /></SelectTrigger>
              <SelectContent>
                {allParties?.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
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
          <Button onClick={submitQuick} disabled={!quickParty || amount <= 0 || createAdvance.isPending} className="h-9 gap-1.5">
            {createAdvance.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
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
            <Button onClick={submitAction} disabled={amount <= 0 || createAdvance.isPending || recordPayment.isPending}>
              {createAdvance.isPending || recordPayment.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <HandCoins className="mr-1.5 h-4 w-4" />}
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function KhataCard({
  title,
  description,
  icon: Icon,
  accent,
  parties,
  emptyText,
  onAction,
  onViewAll,
}: {
  title: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  accent: "emerald" | "red"
  parties: PartyBalance[]
  emptyText: string
  onAction: (party: PartyBalance, kind: "GIVEN" | "TAKEN" | "PAYMENT_IN" | "PAYMENT_OUT") => void
  onViewAll: () => void
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <div className="flex items-center gap-2.5">
          <div className={cn(
            "flex h-9 w-9 items-center justify-center rounded-lg",
            accent === "emerald" ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : "bg-red-500/15 text-red-600 dark:text-red-400"
          )}>
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-sm">{title}</CardTitle>
            <CardDescription className="text-xs">{description}</CardDescription>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={onViewAll} className="text-xs">View all</Button>
      </CardHeader>
      <CardContent className="p-0">
        {parties.length === 0 ? (
          <p className="px-4 py-8 text-center text-xs text-muted-foreground">{emptyText}</p>
        ) : (
          <div className="divide-y">
            {parties.slice(0, 8).map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <div className="flex min-w-0 items-center gap-2.5">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                    {p.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{p.name}</p>
                    <p className="text-xs text-muted-foreground capitalize">{p.type.toLowerCase()}</p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className={cn(
                    "text-sm font-semibold tabular-nums",
                    accent === "emerald" ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
                  )}>
                    {formatCurrency(accent === "emerald" ? p.balance : Math.abs(p.balance))}
                  </span>
                  <Badge
                    variant="outline"
                    className={cn(
                      "cursor-pointer font-normal",
                      accent === "emerald" ? "hover:border-emerald-500/50" : "hover:border-red-500/50"
                    )}
                    onClick={() => onAction(p, accent === "emerald" ? "PAYMENT_IN" : "PAYMENT_OUT")}
                  >
                    {accent === "emerald" ? "Collect" : "Pay"}
                  </Badge>
                  <Badge
                    variant="outline"
                    className="cursor-pointer font-normal"
                    onClick={() => onAction(p, accent === "emerald" ? "GIVEN" : "TAKEN")}
                  >
                    +{accent === "emerald" ? "Give" : "Take"}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
