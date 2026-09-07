import { useMemo, useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  BadgeCheck,
  CheckCircle2,
  Copy,
  Loader2,
  Plus,
  Search,
  Trash2,
  Users,
} from "lucide-react";
import { formatDate, formatDateTime } from "@munim/core";
import {
  usePartyBalances,
  useParty,
  useAdvances,
  useCreateParty,
  useDeleteParty,
  useCreateAdvance,
  useRecordPartyPayment,
  useSettleAdvance,
  useQueryState,
} from "@munim/query";
import { money } from "@/lib/format";
import { toast } from "@munim/ui";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Skeleton,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  LedgerKindBadge,
  KhataActionDialog,
} from "@munim/ui";
import { cn } from "@/lib/utils";

type PartyType = "CUSTOMER" | "SUPPLIER" | "WORKER" | "OTHER";

/** Directory "category" chip — khata-flavored labels per party type. */
const CATEGORY_LABELS: Record<PartyType, string> = {
  CUSTOMER: "Retail Customer",
  SUPPLIER: "Wholesale / Bullion",
  WORKER: "Artisan / Casting",
  OTHER: "Other",
};

type FilterKey = "all" | "get" | "give" | "karigars" | "settled";

const PAGE_SIZE = 6;

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

export function PartiesPage() {
  const balancesQ = useQueryState(usePartyBalances());
  const allBalances = balancesQ.data?.balances ?? [];
  const loading = balancesQ.loading;

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [page, setPage] = useState(1);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newType, setNewType] = useState<PartyType>("CUSTOMER");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [adding, setAdding] = useState(false);

  const [advanceOpen, setAdvanceOpen] = useState(false);
  const [advanceDirection, setAdvanceDirection] = useState<"GIVEN" | "TAKEN">("GIVEN");

  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentDirection, setPaymentDirection] = useState<"IN" | "OUT">("IN");
  const [dialogBusy, setDialogBusy] = useState(false);

  const selected = allBalances.find((p) => p.id === selectedId) ?? null;
  const { data: partyDetail } = useQueryState(useParty(selectedId));
  const ledger = partyDetail?.ledger;
  const { data: advances } = useQueryState(useAdvances(selectedId ?? undefined));

  const createParty = useCreateParty();
  const deleteParty = useDeleteParty();
  const createAdvance = useCreateAdvance();
  const recordPayment = useRecordPartyPayment();
  const settleAdvance = useSettleAdvance();

  /* ── Portfolio summary (real aggregates over balances) ─────────────── */
  const summary = useMemo(() => {
    const get = allBalances.filter((p) => p.balance > 0);
    const give = allBalances.filter((p) => p.balance < 0);
    const settled = allBalances.filter((p) => p.balance === 0);
    const karigars = allBalances.filter((p) => p.type === "WORKER");
    return {
      receivables: get.reduce((acc, p) => acc + p.balance, 0),
      payables: give.reduce((acc, p) => acc + Math.abs(p.balance), 0),
      activeCount: get.length + give.length,
      customerCount: get.filter((p) => p.type === "CUSTOMER").length + give.filter((p) => p.type === "CUSTOMER").length,
      karigarCount: karigars.filter((p) => p.balance !== 0).length + give.filter((p) => p.type === "SUPPLIER").length,
      settledCount: settled.length,
      getCount: get.length,
      giveCount: give.length,
      karigarsTotal: karigars.length,
    };
  }, [allBalances]);

  /* ── Directory filter + pagination ─────────────────────────────────── */
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allBalances.filter((p) => {
      const matchesSearch = !q || p.name.toLowerCase().includes(q) || (p.phone ?? "").toLowerCase().includes(q);
      const matchesFilter =
        filter === "all"
          ? true
          : filter === "get"
            ? p.balance > 0
            : filter === "give"
              ? p.balance < 0
              : filter === "karigars"
                ? p.type === "WORKER"
                : p.balance === 0;
      return matchesSearch && matchesFilter;
    });
  }, [allBalances, search, filter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const debtors = filtered.filter((p) => p.balance > 0).length;
  const creditors = filtered.filter((p) => p.balance < 0).length;

  /* ── Mutations ─────────────────────────────────────────────────────── */
  async function handleAddParty() {
    if (!newName.trim()) {
      toast.error("Party name is required");
      return;
    }
    setAdding(true);
    try {
      const party = await createParty.mutateAsync({ name: newName.trim(), phone: newPhone.trim() || undefined, type: newType });
      setAddOpen(false);
      setNewName("");
      setNewPhone("");
      setNewType("CUSTOMER");
      setSelectedId(party.id);
      toast.success("Party added");
    } catch (err) {
      toast.error("Failed to add party", { description: err instanceof Error ? err.message : undefined });
    } finally {
      setAdding(false);
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await deleteParty.mutateAsync(deleteId);
      setDeleteId(null);
      if (selectedId === deleteId) setSelectedId(null);
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
      await createAdvance.mutateAsync({
        partyId: selectedId,
        direction: advanceDirection,
        amount,
        note: note.trim() || undefined,
      });
      setAdvanceOpen(false);
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
      await recordPayment.mutateAsync({
        partyId: selectedId,
        direction: paymentDirection,
        amount,
        method: "cash",
        note: note.trim() || undefined,
      });
      setPaymentOpen(false);
      toast.success(paymentDirection === "IN" ? "Payment received" : "Payment made");
    } catch (err) {
      toast.error("Failed to record payment", { description: err instanceof Error ? err.message : undefined });
    } finally {
      setDialogBusy(false);
    }
  }

  async function handleSettle(id: string) {
    try {
      await settleAdvance.mutateAsync(id);
      toast.success("Advance settled");
    } catch (err) {
      toast.error("Failed to settle", { description: err instanceof Error ? err.message : undefined });
    }
  }

  const FILTER_CHIPS: { key: FilterKey; label: string; count: number }[] = [
    { key: "all", label: "All Parties", count: allBalances.length },
    { key: "get", label: "You Will Get", count: summary.getCount },
    { key: "give", label: "You Will Give", count: summary.giveCount },
    { key: "karigars", label: "Karigars", count: summary.karigarsTotal },
    { key: "settled", label: "Settled", count: summary.settledCount },
  ];

  return (
    <div className="space-y-4">
      {/* ── Header band ─────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">Parties &amp; Customer Khata Ledger</h1>
              <Badge className="rounded-full bg-primary/10 text-[10px] font-bold tracking-wide text-primary uppercase">
                Active Ledger
              </Badge>
            </div>
            <p className="text-muted-foreground mt-1 max-w-2xl text-sm">
              Credit customers, udhaar, karigar receivables &amp; payables tracking — the same ledger as web &amp; mobile.
            </p>
          </div>
        </div>
        <Button onClick={() => setAddOpen(true)} className="h-9 gap-1.5">
          <Plus className="h-4 w-4" /> Add New Party
        </Button>
      </div>

      {/* ── Summary tiles ───────────────────────────────────────────── */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <p className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">Net Receivables (You'll Get)</p>
              <div className="rounded-lg bg-emerald-500/10 p-1.5 text-emerald-600 dark:text-emerald-400"><ArrowDownLeft className="h-4 w-4" /></div>
            </div>
            <p className="mt-1 text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">{money(summary.receivables)}</p>
            <p className="text-muted-foreground mt-1 text-xs">
              {summary.getCount} {summary.getCount === 1 ? "party" : "parties"} with open udhaar
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <p className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">Net Payables (You'll Give)</p>
              <div className="rounded-lg bg-red-500/10 p-1.5 text-red-600 dark:text-red-400"><ArrowUpRight className="h-4 w-4" /></div>
            </div>
            <p className="text-2xl font-bold tracking-tight text-destructive">{money(summary.payables)}</p>
            <p className="text-muted-foreground mt-1 text-xs">
              {summary.giveCount} {summary.giveCount === 1 ? "account" : "accounts"} to settle
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <p className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">Active Credit Accounts</p>
              <div className="bg-primary/10 text-primary rounded-lg p-1.5"><Users className="h-4 w-4" /></div>
            </div>
            <p className="mt-1 text-2xl font-bold tracking-tight">
              {summary.activeCount} <span className="text-sm font-semibold text-muted-foreground">Parties</span>
            </p>
            <p className="text-muted-foreground mt-1 text-xs">
              {summary.customerCount} customers · {summary.karigarCount} karigars/wholesale
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <p className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">Settled Accounts</p>
              <div className="rounded-lg bg-emerald-500/10 p-1.5 text-emerald-600 dark:text-emerald-400"><CheckCircle2 className="h-4 w-4" /></div>
            </div>
            <p className="mt-1 text-2xl font-bold tracking-tight">{summary.settledCount}</p>
            <p className="text-muted-foreground mt-1 text-xs">Accounts fully reconciled</p>
          </CardContent>
        </Card>
      </div>

      {/* ── Filter row ──────────────────────────────────────────────── */}
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
        <div className="relative w-full lg:max-w-xs">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search party by name, phone"
            className="h-9 pl-9"
          />
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {FILTER_CHIPS.map((chip) => {
            const active = filter === chip.key;
            return (
              <button
                key={chip.key}
                type="button"
                onClick={() => {
                  setFilter(chip.key);
                  setPage(1);
                }}
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "border bg-card text-muted-foreground hover:text-foreground",
                )}
              >
                {chip.label} ({chip.count})
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Directory + detail panel ────────────────────────────────── */}
      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
            <div className="flex items-baseline gap-2">
              <CardTitle className="text-base">Khata Ledger Directory</CardTitle>
              <span className="text-muted-foreground text-xs">Showing {paged.length} active ledgers</span>
            </div>
            <BadgeCheck className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead className="h-9 text-xs">Party &amp; Contact</TableHead>
                  <TableHead className="text-xs">Category</TableHead>
                  <TableHead className="text-xs">On Ledger Since</TableHead>
                  <TableHead className="text-right text-xs">Net Balance</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="p-4">
                      <div className="space-y-2">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Skeleton key={i} className="h-12 w-full" />
                        ))}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : paged.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-muted-foreground py-10 text-center text-sm">
                      No parties match this filter yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  paged.map((p) => (
                    <TableRow
                      key={p.id}
                      className={cn("cursor-pointer", p.id === selectedId && "bg-muted")}
                      onClick={() => setSelectedId(p.id)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2.5">
                          <div className="bg-primary/10 text-primary flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-bold">
                            {initials(p.name)}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold">{p.name}</p>
                            <p className="text-muted-foreground truncate text-xs">{p.phone ?? "No phone"}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="max-w-36 truncate font-normal">
                          {CATEGORY_LABELS[p.type]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">{formatDate(p.createdAt)}</TableCell>
                      <TableCell className="text-right">
                        <p
                          className={cn(
                            "text-sm font-bold tabular-nums",
                            p.balance > 0 && "text-destructive",
                            p.balance < 0 && "font-semibold text-emerald-600 dark:text-emerald-400",
                            p.balance === 0 && "text-muted-foreground",
                          )}
                        >
                          {p.balance === 0 ? "Settled" : money(Math.abs(p.balance))}
                        </p>
                        <p className="text-muted-foreground text-[10px]">
                          {p.balance > 0 ? "You'll Get" : p.balance < 0 ? "You'll Give" : "Clear"}
                        </p>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="text-destructive hover:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteId(p.id);
                          }}
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

            {/* Directory footer */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-t px-4 py-3">
              <p className="text-muted-foreground text-xs">
                Page {safePage} of {totalPages} · {debtors} debtors · {creditors} creditors
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="h-7" disabled={safePage <= 1} onClick={() => setPage((p) => p - 1)}>
                  Previous
                </Button>
                <Button variant="outline" size="sm" className="h-7" disabled={safePage >= totalPages} onClick={() => setPage((p) => p + 1)}>
                  Next
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── Selected party panel ──────────────────────────────────── */}
        <div className="space-y-4">
          {!selected ? (
            <Card className="h-full">
              <CardContent className="flex h-full min-h-72 flex-col items-center justify-center p-8 text-center">
                <Users className="text-muted-foreground mb-3 h-8 w-8" />
                <p className="text-sm font-semibold">No party selected</p>
                <p className="text-muted-foreground mt-1 text-xs">
                  Pick a ledger from the directory to see the net position, advances and recent entries.
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="bg-primary text-primary-foreground flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-base font-bold">
                      {initials(selected.name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-base font-bold">{selected.name}</p>
                      <p className="text-muted-foreground truncate text-xs">
                        {CATEGORY_LABELS[selected.type]}
                        {selected.phone ? ` · ${selected.phone}` : ""}
                      </p>
                    </div>
                    {selected.phone ? (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Copy phone number"
                        onClick={() => {
                          void navigator.clipboard.writeText(selected.phone ?? "");
                          toast.success("Phone copied");
                        }}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    ) : null}
                  </div>

                  {/* Net position */}
                  <div className="bg-muted/50 mt-3 rounded-xl border p-3">
                    <div className="flex items-center justify-between">
                      <p className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">Current Net Position</p>
                      <span
                        className={cn(
                          "text-[11px] font-semibold",
                          selected.balance > 0 ? "text-destructive" : selected.balance < 0 ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground",
                        )}
                      >
                        {selected.balance > 0 ? "You'll Get" : selected.balance < 0 ? "You Owe" : "Settled"}
                      </span>
                    </div>
                    <p
                      className={cn(
                        "mt-1 text-2xl font-bold tracking-tight",
                        selected.balance > 0 && "text-destructive",
                        selected.balance < 0 && "text-emerald-600 dark:text-emerald-400",
                      )}
                    >
                      {money(Math.abs(selected.balance))}
                    </p>
                  </div>

                  {/* Advances chips */}
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <div className="rounded-lg border p-2.5">
                      <p className="text-muted-foreground text-[10px] font-semibold tracking-wide uppercase">Advances Given</p>
                      <p className="mt-0.5 text-sm font-bold tabular-nums">{money(selected.given)}</p>
                    </div>
                    <div className="rounded-lg border p-2.5">
                      <p className="text-muted-foreground text-[10px] font-semibold tracking-wide uppercase">Advances Taken</p>
                      <p className="mt-0.5 text-sm font-bold tabular-nums">{money(selected.taken)}</p>
                    </div>
                  </div>

                  {/* Actions */}
                  <Button
                    className="mt-3 w-full gap-1.5"
                    onClick={() => {
                      setAdvanceDirection("GIVEN");
                      setAdvanceOpen(true);
                    }}
                  >
                    <ArrowUpRight className="h-4 w-4" /> Give Cash / Bank Advance
                  </Button>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs"
                      onClick={() => {
                        setAdvanceDirection("TAKEN");
                        setAdvanceOpen(true);
                      }}
                    >
                      Advance taken
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs"
                      onClick={() => {
                        setPaymentDirection("IN");
                        setPaymentOpen(true);
                      }}
                    >
                      Money in
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs"
                      onClick={() => {
                        setPaymentDirection("OUT");
                        setPaymentOpen(true);
                      }}
                    >
                      Money out
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Recent ledger entries */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Recent Ledger Entries</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {!ledger || ledger.lines.length === 0 ? (
                    <p className="text-muted-foreground text-sm">No transactions yet.</p>
                  ) : (
                    ledger.lines.slice(0, 5).map((line) => (
                      <div key={line.id} className="flex items-start justify-between gap-2 border-b pb-2 last:border-0 last:pb-0">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <LedgerKindBadge kind={line.kind} />
                            <span className="text-muted-foreground text-[10px]">{formatDateTime(line.date)}</span>
                          </div>
                          <p className="mt-0.5 line-clamp-1 text-xs">{line.description}</p>
                        </div>
                        <p
                          className={cn(
                            "shrink-0 text-sm font-bold tabular-nums",
                            line.debit > 0 && "text-destructive",
                            line.credit > 0 && "font-semibold text-emerald-600 dark:text-emerald-400",
                          )}
                        >
                          {line.debit > 0 ? `+${money(line.debit)}` : `−${money(line.credit)}`}
                        </p>
                      </div>
                    ))
                  )}

                  {/* Open advances for this party */}
                  {advances && advances.some((a) => a.status === "OPEN") ? (
                    <div className="mt-2 space-y-1.5 border-t pt-2">
                      {advances
                        .filter((a) => a.status === "OPEN")
                        .map((a) => (
                          <div key={a.id} className="flex items-center justify-between gap-2 text-xs">
                            <span className="min-w-0 truncate">
                              {a.direction === "GIVEN" ? "Given" : "Taken"} {money(a.amount)} · {formatDate(a.date)}
                            </span>
                            <Button variant="outline" size="sm" className="h-6 text-[11px]" onClick={() => void handleSettle(a.id)}>
                              Settle
                            </Button>
                          </div>
                        ))}
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>

      {/* ── Add party dialog ────────────────────────────────────────── */}
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
            <Button onClick={handleAddParty} disabled={adding || !newName.trim()}>
              {adding ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Adding…</> : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete dialog ───────────────────────────────────────────── */}
      <Dialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <DialogContent className="sm:max-w-[360px]">
          <DialogHeader>
            <DialogTitle>Delete party?</DialogTitle>
            <DialogDescription>All advances and ledger history for this party will be removed.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting} className="gap-1.5">
              {deleting ? <><Loader2 className="h-4 w-4 animate-spin" /> Deleting…</> : <><Trash2 className="h-4 w-4" /> Delete</>}
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
