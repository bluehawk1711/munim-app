import { useState } from "react";
import { Plus, ArrowUpRight, ArrowDownLeft, Search, Trash2, Users } from "lucide-react";
import {
  createParty,
  deleteParty,
  getPartyBalances,
  getPartyLedger,
  listAdvances,
  createAdvance,
  recordPayment,
  settleAdvance,
  formatDate,
} from "@munim/core";
import { getCore } from "@/lib/core";
import { useAsync } from "@/lib/use-async";
import { money } from "@/lib/format";
import { toast } from "sonner";
import {
  Button, Input, Label, Card, CardContent, CardHeader, CardTitle, Skeleton,
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
  LedgerKindBadge,
  KhataActionDialog,
} from "@munim/ui";

type PartyType = "CUSTOMER" | "SUPPLIER" | "WORKER" | "OTHER";

const TYPE_LABELS: Record<PartyType, string> = {
  CUSTOMER: "Customer",
  SUPPLIER: "Supplier",
  WORKER: "Worker",
  OTHER: "Other",
};

export function PartiesPage() {
  const [search, setSearch] = useState("");
  const [type, setType] = useState("all");
  const { data: allBalances, loading, reload: reloadParties } = useAsync(
    () => getPartyBalances(getCore()),
    [],
  );

  // Client-side filter (web parity) — PartyBalance rows carry type + balance.
  const parties = (allBalances ?? []).filter((p) => {
    const matchesType = type === "all" || p.type === type;
    const q = search.trim().toLowerCase();
    const matchesSearch = !q || p.name.toLowerCase().includes(q) || (p.phone ?? "").toLowerCase().includes(q);
    return matchesType && matchesSearch;
  });

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newType, setNewType] = useState<PartyType>("CUSTOMER");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [advanceOpen, setAdvanceOpen] = useState(false);
  const [advanceDirection, setAdvanceDirection] = useState<"GIVEN" | "TAKEN">("GIVEN");

  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentDirection, setPaymentDirection] = useState<"IN" | "OUT">("IN");
  const [dialogBusy, setDialogBusy] = useState(false);

  const selected = (parties ?? []).find((p) => p.id === selectedId) ?? null;
  const { data: ledger, reload: reloadLedger } = useAsync(
    () => (selectedId ? getPartyLedger(getCore(), selectedId) : Promise.resolve({ lines: [], balance: 0 })),
    [selectedId],
  );
  const { data: advances, reload: reloadAdvances } = useAsync(
    () => (selectedId ? listAdvances(getCore(), selectedId) : Promise.resolve([])),
    [selectedId],
  );

  function refresh() {
    reloadParties();
    reloadLedger();
    reloadAdvances();
  }

  async function handleAddParty() {
    if (!newName.trim()) {
      toast.error("Party name is required");
      return;
    }
    try {
      const party = await createParty(getCore(), { name: newName.trim(), phone: newPhone.trim() || undefined, type: newType });
      setAddOpen(false);
      setNewName("");
      setNewPhone("");
      setNewType("CUSTOMER");
      setSelectedId(party.id);
      refresh();
      toast.success("Party added");
    } catch (err) {
      toast.error("Failed to add party", { description: err instanceof Error ? err.message : undefined });
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await deleteParty(getCore(), deleteId);
      setDeleteId(null);
      setSelectedId(null);
      reloadParties();
      toast.success("Party deleted");
    } catch (err) {
      toast.error("Delete failed", { description: err instanceof Error ? err.message : undefined });
    } finally {
      setDeleting(false);
    }
  }

  async function handleAddAdvance(amount: number, note: string) {
    if (!selectedId || amount <= 0) return;
    setDialogBusy(true);
    try {
      await createAdvance(getCore(), {
        partyId: selectedId,
        direction: advanceDirection,
        amount,
        note: note.trim() || undefined,
      });
      setAdvanceOpen(false);
      refresh();
      toast.success(advanceDirection === "GIVEN" ? "Advance given recorded" : "Advance taken recorded");
    } catch (err) {
      toast.error("Failed to record advance", { description: err instanceof Error ? err.message : undefined });
    } finally {
      setDialogBusy(false);
    }
  }

  async function handleAddPayment(amount: number, note: string) {
    if (!selectedId || amount <= 0) return;
    setDialogBusy(true);
    try {
      await recordPayment(getCore(), {
        partyId: selectedId,
        direction: paymentDirection,
        amount,
        method: "cash",
        note: note.trim() || undefined,
      });
      setPaymentOpen(false);
      refresh();
      toast.success(paymentDirection === "IN" ? "Payment received" : "Payment made");
    } catch (err) {
      toast.error("Failed to record payment", { description: err instanceof Error ? err.message : undefined });
    } finally {
      setDialogBusy(false);
    }
  }

  async function handleSettle(id: string) {
    try {
      await settleAdvance(getCore(), id);
      refresh();
      toast.success("Advance settled");
    } catch (err) {
      toast.error("Failed to settle", { description: err instanceof Error ? err.message : undefined });
    }
  }

  return (
    <div className="space-y-4">
      {/* Toolbar (web parity) */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative w-full sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, phone…" className="h-9 pl-9" />
          </div>
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
        <Button onClick={() => setAddOpen(true)} className="h-9 gap-1.5">
          <Plus className="h-4 w-4" /> Add Party
        </Button>
      </div>

      <div className="grid gap-5 xl:grid-cols-5">
        <Card className="xl:col-span-2">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Users className="h-4 w-4" /> Parties
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead className="text-right"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="p-4">
                      <div className="space-y-2">
                        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : !parties || parties.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-muted-foreground text-center">No parties yet</TableCell></TableRow>
                ) : (
                  parties.map((p) => (
                    <TableRow
                      key={p.id}
                      className={p.id === selectedId ? "bg-muted cursor-pointer" : "cursor-pointer"}
                      onClick={() => setSelectedId(p.id)}
                    >
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell>
                        <span className="text-xs text-muted-foreground">{TYPE_LABELS[p.type] ?? p.type}</span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={p.balance > 0 ? "text-destructive font-medium" : p.balance < 0 ? "text-emerald-600 font-medium dark:text-emerald-400" : "text-muted-foreground"}>
                          {p.balance > 0 ? `${money(p.balance)} due` : p.balance < 0 ? `${money(-p.balance)} owed` : "Settled"}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="text-destructive hover:text-destructive"
                          onClick={(e) => { e.stopPropagation(); setDeleteId(p.id); }}
                          aria-label={`Delete ${p.name}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <div className="space-y-5 xl:col-span-3">
          {!selected ? (
            <Card>
              <CardContent className="p-8 text-center text-sm text-muted-foreground">
                Select a party to see the khata — who owes whom, advances given/taken and the full ledger.
              </CardContent>
            </Card>
          ) : (
            <>
              <Card>
                <CardHeader className="flex-row items-center justify-between space-y-0">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-sm">
                      {selected.name}
                      <span className="rounded-full border bg-muted/50 px-2 py-0.5 text-[11px] font-normal text-muted-foreground">
                        {TYPE_LABELS[selected.type] ?? selected.type}
                      </span>
                    </CardTitle>
                    <p className="text-muted-foreground text-xs">{selected.phone ?? "No phone"}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => { setAdvanceDirection("GIVEN"); setAdvanceOpen(true); }}>
                      <ArrowUpRight className="h-4 w-4" /> Advance given
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => { setAdvanceDirection("TAKEN"); setAdvanceOpen(true); }}>
                      <ArrowDownLeft className="h-4 w-4" /> Advance taken
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => { setPaymentDirection("IN"); setPaymentOpen(true); }}>
                      <ArrowDownLeft className="h-4 w-4" /> Money in
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => { setPaymentDirection("OUT"); setPaymentOpen(true); }}>
                      <ArrowUpRight className="h-4 w-4" /> Money out
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-lg border p-3">
                      <p className="text-muted-foreground text-xs">Net balance</p>
                      <p className={`text-xl font-bold ${selected.balance > 0 ? "text-destructive" : selected.balance < 0 ? "text-emerald-600 dark:text-emerald-400" : ""}`}>
                        {selected.balance > 0 ? `${money(selected.balance)} due to you` : selected.balance < 0 ? `${money(-selected.balance)} you owe` : "Settled"}
                      </p>
                    </div>
                    <div className="rounded-lg border p-3">
                      <p className="text-muted-foreground text-xs">Advance given</p>
                      <p className="text-xl font-bold">{money(selected.given)}</p>
                    </div>
                    <div className="rounded-lg border p-3">
                      <p className="text-muted-foreground text-xs">Advance taken</p>
                      <p className="text-xl font-bold">{money(selected.taken)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Ledger</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead className="text-right">Debit</TableHead>
                        <TableHead className="text-right">Credit</TableHead>
                        <TableHead className="text-right">Balance</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {!ledger || ledger.lines.length === 0 ? (
                        <TableRow><TableCell colSpan={5} className="text-muted-foreground text-center">No transactions</TableCell></TableRow>
                      ) : (
                        ledger.lines.map((line) => (
                          <TableRow key={line.id}>
                            <TableCell>{formatDate(line.date)}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <LedgerKindBadge kind={line.kind} />
                                <span>{line.description}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-right">{line.debit > 0 ? money(line.debit) : "—"}</TableCell>
                            <TableCell className="text-right">{line.credit > 0 ? money(line.credit) : "—"}</TableCell>
                            <TableCell className={`text-right font-medium ${line.balance > 0 ? "text-destructive" : line.balance < 0 ? "text-emerald-600 dark:text-emerald-400" : ""}`}>
                              {money(line.balance)}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {advances && advances.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Open advances</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {advances.filter((a) => a.status === "OPEN").map((a) => (
                      <div key={a.id} className="flex items-center justify-between rounded-lg border p-3 text-sm">
                        <div>
                          <p className="font-medium">{a.direction === "GIVEN" ? "Given" : "Taken"} — {money(a.amount)}</p>
                          <p className="text-muted-foreground text-xs">{formatDate(a.date)}{a.note ? ` · ${a.note}` : ""}</p>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => handleSettle(a.id)}>Settle</Button>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Add party</DialogTitle>
            <DialogDescription>Customers, suppliers or workers you track money with.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="party-name">Name *</Label>
              <Input id="party-name" value={newName} onChange={(e) => setNewName(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="party-phone">Phone</Label>
                <Input id="party-phone" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="party-type">Type</Label>
                <Select value={newType} onValueChange={(v) => setNewType(v as PartyType)}>
                  <SelectTrigger id="party-type" className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CUSTOMER">Customer</SelectItem>
                    <SelectItem value="SUPPLIER">Supplier</SelectItem>
                    <SelectItem value="WORKER">Worker</SelectItem>
                    <SelectItem value="OTHER">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={handleAddParty}>Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <DialogContent className="sm:max-w-[360px]">
          <DialogHeader>
            <DialogTitle>Delete party?</DialogTitle>
            <DialogDescription>All advances and ledger history for this party will be removed.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting} className="gap-1.5">
              <Trash2 className="h-4 w-4" /> Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Advance given/taken — shared khata action dialog (web-identical) */}
      <KhataActionDialog
        key={advanceOpen ? `advance-${advanceDirection}` : "closed"}
        open={advanceOpen}
        onOpenChange={setAdvanceOpen}
        title={advanceDirection === "GIVEN" ? "Advance given" : "Advance taken"}
        subtitle={selected?.name}
        balance={selected?.balance}
        busy={dialogBusy}
        confirmLabel="Save advance"
        onConfirm={({ amount, note }) => void handleAddAdvance(amount, note)}
      />

      {/* Money in/out — shared khata action dialog */}
      <KhataActionDialog
        key={paymentOpen ? `payment-${paymentDirection}` : "closed"}
        open={paymentOpen}
        onOpenChange={setPaymentOpen}
        title={paymentDirection === "IN" ? "Money in (received)" : "Money out (paid)"}
        subtitle={selected?.name}
        balance={selected?.balance}
        busy={dialogBusy}
        confirmLabel="Save payment"
        onConfirm={({ amount, note }) => void handleAddPayment(amount, note)}
      />
    </div>
  );
}
