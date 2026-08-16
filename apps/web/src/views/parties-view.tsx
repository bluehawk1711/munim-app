"use client"

import * as React from "react"
import {
  Users,
  Plus,
  Search,
  Loader2,
  Trash2,
  ArrowLeft,
  HandCoins,
  Phone,
  Mail,
  MapPin,
} from "lucide-react"
import { Button, Input, Label, Card, CardContent, Badge, Skeleton, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, LedgerKindBadge } from "@munim/ui"








import {
  useParties,
  useParty,
  useCreateParty,
  useDeleteParty,
  useCreateAdvance,
} from "@/hooks/use-parties"
import { useAppStore } from "@/store/view-store"
import { formatCurrency, formatDate } from "@/lib/format"
import type { Party } from "@/lib/types"
import { cn } from "@/lib/utils"
import { toast } from "@munim/ui"

const TYPE_LABELS: Record<Party["type"], string> = {
  CUSTOMER: "Customer",
  SUPPLIER: "Supplier",
  WORKER: "Worker",
  OTHER: "Other",
}

export function PartiesView() {
  const [search, setSearch] = React.useState("")
  const [type, setType] = React.useState("all")
  const { data: parties, isLoading } = useParties(type, search)

  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const [createOpen, setCreateOpen] = React.useState(false)
  const [deleteId, setDeleteId] = React.useState<string | null>(null)

  const del = useDeleteParty()

  if (selectedId) {
    return <PartyLedger id={selectedId} onBack={() => setSelectedId(null)} />
  }

  async function handleDelete() {
    if (!deleteId) return
    try {
      await del.mutateAsync(deleteId)
      toast.success("Party deleted")
      setDeleteId(null)
    } catch (err) {
      toast.error("Delete failed", { description: err instanceof Error ? err.message : "Unknown error" })
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div className="flex w-full flex-col gap-2">
          <div className="relative w-full sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, phone…" className="h-9 pl-9" />
          </div>
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border/60 bg-muted/30 px-2.5 py-2">
            <Select value={type} onValueChange={setType}>
              <SelectTrigger className="h-9 w-[150px]"><SelectValue placeholder="Type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                <SelectItem value="CUSTOMER">Customers</SelectItem>
                <SelectItem value="SUPPLIER">Suppliers</SelectItem>
                <SelectItem value="WORKER">Workers</SelectItem>
                <SelectItem value="OTHER">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="h-9 gap-1.5">
          <Plus className="h-4 w-4" /> Add Party
        </Button>
      </div>

      {isLoading ? (
        <Card><CardContent className="space-y-2 p-4">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</CardContent></Card>
      ) : !parties || parties.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Users className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-semibold">No parties yet</p>
              <p className="text-xs text-muted-foreground">Add customers, suppliers or workers to start the khata.</p>
            </div>
            <Button size="sm" onClick={() => setCreateOpen(true)} className="gap-1.5"><Plus className="h-4 w-4" /> Add party</Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y">
              {parties.map((p) => (
                <div key={p.id} className="group flex items-center justify-between gap-3 px-4 py-3 hover:bg-muted/30">
                  <button type="button" className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => setSelectedId(p.id)}>
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                      {p.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium">{p.name}</span>
                        <Badge variant="secondary" className="font-normal">{TYPE_LABELS[p.type]}</Badge>
                      </div>
                      <p className="truncate text-xs text-muted-foreground">
                        {[p.phone, p.email, p.address].filter(Boolean).join(" · ") || "No contact info"}
                      </p>
                    </div>
                  </button>
                  <div className="flex shrink-0 items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setSelectedId(p.id)} className="gap-1 text-xs">
                      <HandCoins className="h-3.5 w-3.5" /> Khata
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteId(p.id)} aria-label={`Delete ${p.name}`}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <CreatePartyDialog open={createOpen} onOpenChange={setCreateOpen} />
      <DeletePartyDialog id={deleteId} onClose={() => setDeleteId(null)} onConfirm={handleDelete} />
    </div>
  )
}

function PartyLedger({ id, onBack }: { id: string; onBack: () => void }) {
  const { data, isLoading } = useParty(id)
  const createAdvance = useCreateAdvance()
  const [advanceOpen, setAdvanceOpen] = React.useState(false)
  const [advanceKind, setAdvanceKind] = React.useState<"GIVEN" | "TAKEN">("GIVEN")
  const [amount, setAmount] = React.useState(0)
  const [note, setNote] = React.useState("")

  const party = data?.party
  const balance = data?.ledger.balance ?? 0
  const lines = data?.ledger.lines ?? []

  async function submitAdvance() {
    if (amount <= 0) return
    try {
      await createAdvance.mutateAsync({ partyId: id, direction: advanceKind, amount, note })
      toast.success("Advance recorded")
      setAdvanceOpen(false)
      setAmount(0)
      setNote("")
    } catch (err) {
      toast.error("Failed", { description: err instanceof Error ? err.message : "Unknown error" })
    }
  }

  if (isLoading) {
    return <Card><CardContent className="space-y-2 p-4">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</CardContent></Card>
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" className="h-9 w-9" onClick={onBack} aria-label="Back to parties">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold">{party?.name}</h2>
              {party && <Badge variant="secondary" className="font-normal">{TYPE_LABELS[party.type]}</Badge>}
            </div>
            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
              {party?.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {party.phone}</span>}
              {party?.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" /> {party.email}</span>}
              {party?.address && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {party.address}</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => { setAdvanceKind("TAKEN"); setAdvanceOpen(true) }} className="h-9 gap-1">
            <HandCoins className="h-4 w-4" /> Took advance
          </Button>
          <Button size="sm" onClick={() => { setAdvanceKind("GIVEN"); setAdvanceOpen(true) }} className="h-9 gap-1">
            <Plus className="h-4 w-4" /> Gave advance
          </Button>
        </div>
      </div>

      {/* Balance card */}
      <Card className={cn(balance >= 0 ? "border-emerald-500/30 bg-emerald-500/5" : "border-red-500/30 bg-red-500/5")}>
        <CardContent className="flex flex-col gap-1 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs text-muted-foreground">
              {balance > 0 ? "This party owes us" : balance < 0 ? "We owe this party" : "Balance settled"}
            </p>
            <p className="text-2xl font-bold">{formatCurrency(Math.abs(balance))}</p>
          </div>
          <p className="text-xs text-muted-foreground">{lines.length} ledger entries</p>
        </CardContent>
      </Card>

      {/* Ledger */}
      <Card>
        <CardContent className="p-0">
          {lines.length === 0 ? (
            <p className="px-4 py-10 text-center text-xs text-muted-foreground">No transactions yet for this party.</p>
          ) : (
            <div className="divide-y">
              {[...lines].reverse().map((line) => (
                <div key={line.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <LedgerKindBadge kind={line.kind} />
                      <span className="truncate text-sm">{line.description}</span>
                    </div>
                    <p className="pl-1 text-xs text-muted-foreground">{formatDate(line.date)}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    {line.debit > 0 && <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">+{formatCurrency(line.debit)}</p>}
                    {line.credit > 0 && <p className="text-sm font-medium text-red-600 dark:text-red-400">−{formatCurrency(line.credit)}</p>}
                    <p className="text-xs tabular-nums text-muted-foreground">Bal: {formatCurrency(Math.abs(line.balance))} {line.balance < 0 ? "ow" : "due"}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Advance dialog */}
      <Dialog open={advanceOpen} onOpenChange={setAdvanceOpen}>
        <DialogContent className="sm:max-w-[380px]">
          <DialogHeader>
            <DialogTitle>{advanceKind === "GIVEN" ? "Give advance" : "Take advance"}</DialogTitle>
            <DialogDescription>{party?.name}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Amount (₹)</Label>
              <Input type="number" min={0} value={amount || ""} onChange={(e) => setAmount(Number(e.target.value))} className="h-9" autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Note (optional)</Label>
              <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. raw material advance" className="h-9" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdvanceOpen(false)}>Cancel</Button>
            <Button onClick={submitAdvance} disabled={amount <= 0 || createAdvance.isPending}>
              {createAdvance.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              Record
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function CreatePartyDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [form, setForm] = React.useState<{
    name: string
    phone: string
    email: string
    address: string
    type: "CUSTOMER" | "SUPPLIER" | "WORKER" | "OTHER"
    notes: string
  }>({ name: "", phone: "", email: "", address: "", type: "CUSTOMER", notes: "" })
  const create = useCreateParty()

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) return
    try {
      await create.mutateAsync(form)
      toast.success("Party added", { description: form.name })
      onOpenChange(false)
      setForm({ name: "", phone: "", email: "", address: "", type: "CUSTOMER", notes: "" })
    } catch (err) {
      toast.error("Failed", { description: err instanceof Error ? err.message : "Unknown error" })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>Add party</DialogTitle>
          <DialogDescription>Customers, suppliers and workers share one khata ledger.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Name *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="h-9" required />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Type</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as typeof form.type })}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="CUSTOMER">Customer</SelectItem>
                  <SelectItem value="SUPPLIER">Supplier</SelectItem>
                  <SelectItem value="WORKER">Worker</SelectItem>
                  <SelectItem value="OTHER">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Phone</Label>
            <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="h-9" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Email</Label>
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="h-9" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Address</Label>
            <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="h-9" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={create.isPending || !form.name.trim()}>
              {create.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              Add party
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function DeletePartyDialog({ id, onClose, onConfirm }: { id: string | null; onClose: () => void; onConfirm: () => void }) {
  return (
    <Dialog open={!!id} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[360px]">
        <DialogHeader>
          <DialogTitle>Delete party?</DialogTitle>
          <DialogDescription>All advances and ledger history for this party will be removed.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="destructive" onClick={onConfirm}><Trash2 className="mr-1.5 h-4 w-4" /> Delete</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
