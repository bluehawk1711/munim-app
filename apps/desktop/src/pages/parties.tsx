import { useState } from "react";
import { Plus, ArrowUpRight, ArrowDownLeft } from "lucide-react";
import {
  createParty,
  getPartyBalances,
  getPartyLedger,
  listAdvances,
  createAdvance,
  recordPayment,
  settleAdvance,
  formatDate,
  type PartyBalance,
} from "@munim/core";
import { getCore } from "@/lib/core";
import { useAsync } from "@/lib/use-async";
import { money } from "@/lib/format";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export function PartiesPage() {
  const { data: parties, loading, reload: reloadParties } = useAsync(() => getPartyBalances(getCore()), []);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");

  const [advanceOpen, setAdvanceOpen] = useState(false);
  const [advanceDirection, setAdvanceDirection] = useState<"GIVEN" | "TAKEN">("GIVEN");
  const [advanceAmount, setAdvanceAmount] = useState("");
  const [advanceNote, setAdvanceNote] = useState("");

  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentDirection, setPaymentDirection] = useState<"IN" | "OUT">("IN");
  const [paymentAmount, setPaymentAmount] = useState("");

  const selected = parties?.find((p) => p.id === selectedId) ?? null;
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
      const party = await createParty(getCore(), { name: newName.trim(), phone: newPhone.trim() || undefined });
      setAddOpen(false);
      setNewName("");
      setNewPhone("");
      setSelectedId(party.id);
      refresh();
      toast.success("Party added");
    } catch (err) {
      toast.error("Failed to add party", { description: err instanceof Error ? err.message : undefined });
    }
  }

  async function handleAddAdvance() {
    if (!selectedId) return;
    const amount = Number(advanceAmount);
    if (!amount || amount <= 0) {
      toast.error("Enter a positive amount");
      return;
    }
    try {
      await createAdvance(getCore(), {
        partyId: selectedId,
        direction: advanceDirection,
        amount,
        note: advanceNote.trim() || undefined,
      });
      setAdvanceOpen(false);
      setAdvanceAmount("");
      setAdvanceNote("");
      refresh();
      toast.success(advanceDirection === "GIVEN" ? "Advance given recorded" : "Advance taken recorded");
    } catch (err) {
      toast.error("Failed to record advance", { description: err instanceof Error ? err.message : undefined });
    }
  }

  async function handleAddPayment() {
    if (!selectedId) return;
    const amount = Number(paymentAmount);
    if (!amount || amount <= 0) {
      toast.error("Enter a positive amount");
      return;
    }
    try {
      await recordPayment(getCore(), {
        partyId: selectedId,
        direction: paymentDirection,
        amount,
        method: "cash",
      });
      setPaymentOpen(false);
      setPaymentAmount("");
      refresh();
      toast.success(paymentDirection === "IN" ? "Payment received" : "Payment made");
    } catch (err) {
      toast.error("Failed to record payment", { description: err instanceof Error ? err.message : undefined });
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
    <div className="grid gap-5 xl:grid-cols-5">
      <Card className="xl:col-span-2">
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-sm">Parties</CardTitle>
          <Button variant="outline" size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" /> Add
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead className="text-right">Balance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={2} className="text-muted-foreground text-center">Loading…</TableCell></TableRow>
              ) : !parties || parties.length === 0 ? (
                <TableRow><TableCell colSpan={2} className="text-muted-foreground text-center">No parties yet</TableCell></TableRow>
              ) : (
                parties.map((p: PartyBalance) => (
                  <TableRow
                    key={p.id}
                    className={p.id === selectedId ? "bg-muted cursor-pointer" : "cursor-pointer"}
                    onClick={() => setSelectedId(p.id)}
                  >
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell className="text-right">
                      <span className={p.balance > 0 ? "text-destructive font-medium" : p.balance < 0 ? "text-emerald-600 font-medium dark:text-emerald-400" : "text-muted-foreground"}>
                        {p.balance > 0 ? `${money(p.balance)} due` : p.balance < 0 ? `${money(-p.balance)} owed` : "Settled"}
                      </span>
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
                  <CardTitle className="text-sm">{selected.name}</CardTitle>
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
                          <TableCell>{line.description}</TableCell>
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
            <div className="space-y-1.5">
              <Label htmlFor="party-phone">Phone</Label>
              <Input id="party-phone" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={handleAddParty}>Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={advanceOpen} onOpenChange={setAdvanceOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{advanceDirection === "GIVEN" ? "Advance given" : "Advance taken"}</DialogTitle>
            <DialogDescription>
              {advanceDirection === "GIVEN"
                ? `Money you gave ${selected?.name ?? "this party"} (they owe you).`
                : `Money you received from ${selected?.name ?? "this party"} (you owe them).`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="adv-amount">Amount</Label>
              <Input id="adv-amount" type="number" min={0} value={advanceAmount} onChange={(e) => setAdvanceAmount(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="adv-note">Note</Label>
              <Input id="adv-note" value={advanceNote} onChange={(e) => setAdvanceNote(e.target.value)} placeholder="e.g. raw material advance" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdvanceOpen(false)}>Cancel</Button>
            <Button onClick={handleAddAdvance}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={paymentOpen} onOpenChange={setPaymentOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{paymentDirection === "IN" ? "Money in" : "Money out"}</DialogTitle>
            <DialogDescription>
              {paymentDirection === "IN" ? `Received from ${selected?.name ?? "party"}.` : `Paid to ${selected?.name ?? "party"}.`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="pay-amount">Amount</Label>
            <Input id="pay-amount" type="number" min={0} value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentOpen(false)}>Cancel</Button>
            <Button onClick={handleAddPayment}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
