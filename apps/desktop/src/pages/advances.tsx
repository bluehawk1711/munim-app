import { useMemo, useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  Coins,
  FileSpreadsheet,
  Scale,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { formatCurrency, formatDate, formatNumber, type AdvanceDto } from "@munim/core";
import type { PartyBalanceDto } from "@munim/api-client";
import {
  usePartyBalances,
  useParties,
  useAdvances,
  useCreateAdvance,
  useSettleAdvance,
  useDeleteAdvance,
  useRecordPartyPayment,
  useQueryState,
} from "@munim/query";
import { toast } from "@munim/ui";
import { PageHeader } from "@/components/page-header";
import { money } from "@/lib/format";
import {
  Badge,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Skeleton,
  SummaryTile,
  KhataCard,
  QuickAdvanceRecord,
  KhataActionDialog,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  type KhataActionKind,
} from "@munim/ui";

type Action = { party: PartyBalanceDto; kind: KhataActionKind } | null;
type DaybookFilter = "all" | "GIVEN" | "TAKEN" | "OPEN";
const PAGE_SIZE = 8;

export function AdvancesPage() {
  const balances = useQueryState(usePartyBalances());
  const partiesQ = useQueryState(useParties());
  const advancesQ = useQueryState(useAdvances());
  const createAdvance = useCreateAdvance();
  const recordPayment = useRecordPartyPayment();
  const settleAdvance = useSettleAdvance();
  const deleteAdvance = useDeleteAdvance();
  const loading = balances.loading || partiesQ.loading;

  const [action, setAction] = useState<Action>(null);
  const [amount, setAmount] = useState(0);
  const [quickParty, setQuickParty] = useState("");
  const [quickKind, setQuickKind] = useState<"GIVEN" | "TAKEN">("GIVEN");
  const [saving, setSaving] = useState(false);
  const [daybookFilter, setDaybookFilter] = useState<DaybookFilter>("all");
  const [page, setPage] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState<AdvanceDto | null>(null);
  const [deleting, setDeleting] = useState(false);

  const receivables = balances.data?.receivables ?? [];
  const payables = balances.data?.payables ?? [];
  const totalReceivable = receivables.reduce((s, p) => s + p.balance, 0);
  const totalPayable = payables.reduce((s, p) => s + Math.abs(p.balance), 0);
  const net = totalReceivable - totalPayable;

  /* ── Daybook: every advance, newest first, with party names ─────── */

  const advances = useMemo(
    () => [...(advancesQ.data ?? [])].sort((a, b) => +new Date(b.date) - +new Date(a.date)),
    [advancesQ.data],
  );
  const partyById = useMemo(() => {
    const map = new Map<string, { name: string; type: string }>();
    for (const p of [...(partiesQ.data ?? []), ...receivables, ...payables]) {
      if (!map.has(p.id)) map.set(p.id, { name: p.name, type: p.type });
    }
    return map;
  }, [partiesQ.data, receivables, payables]);

  const openAdvances = advances.filter((a) => a.status === "OPEN");
  const openTotal = openAdvances.reduce((s, a) => s + a.amount, 0);
  const givenTotal = advances.filter((a) => a.direction === "GIVEN").reduce((s, a) => s + a.amount, 0);
  const takenTotal = advances.filter((a) => a.direction === "TAKEN").reduce((s, a) => s + a.amount, 0);

  const filteredAdvances = useMemo(() => {
    switch (daybookFilter) {
      case "GIVEN":
        return advances.filter((a) => a.direction === "GIVEN");
      case "TAKEN":
        return advances.filter((a) => a.direction === "TAKEN");
      case "OPEN":
        return advances.filter((a) => a.status === "OPEN");
      default:
        return advances;
    }
  }, [advances, daybookFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredAdvances.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = filteredAdvances.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

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

  async function handleSettle(a: AdvanceDto) {
    try {
      const updated = await settleAdvance.mutateAsync(a.id);
      toast.success("Advance settled", { description: `${formatCurrency(updated.amount)} · ${partyById.get(a.partyId)?.name ?? "Party"}` });
    } catch (err) {
      toast.error("Settle failed", { description: err instanceof Error ? err.message : undefined });
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteAdvance.mutateAsync(deleteTarget.id);
      toast.success("Advance removed", { description: formatCurrency(deleteTarget.amount) });
      setDeleteTarget(null);
    } catch (err) {
      toast.error("Delete failed", { description: err instanceof Error ? err.message : undefined });
    } finally {
      setDeleting(false);
    }
  }

  function exportDaybookCsv() {
    const rows = filteredAdvances;
    if (rows.length === 0) {
      toast.info("Nothing to export");
      return;
    }
    const header = ["Date", "Party", "Type", "Direction", "Amount", "Status", "Note"];
    const csv = [
      header.join(","),
      ...rows.map((a) =>
        [
          new Date(a.date).toLocaleString("en-IN"),
          `"${(partyById.get(a.partyId)?.name ?? "Unknown").replace(/"/g, '""')}"`,
          partyById.get(a.partyId)?.type ?? "",
          a.direction,
          a.amount,
          a.status,
          `"${(a.note ?? "").replace(/"/g, '""')}"`,
        ].join(","),
      ),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `cash-daybook-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success(`Exported ${rows.length} entries`);
  }

  const partyTypeLabel = (p?: { type: string }) =>
    p ? (p.type === "WORKER" ? "Karigar" : p.type === "CUSTOMER" ? "Customer" : p.type === "SUPPLIER" ? "Supplier" : "Other") : "Unknown";

  if (loading) {
    return (
      <div className="space-y-4">
        <PageHeader title="Advances & Cash Movement" badge="Cash Flow" subtitle="Loading the cash ledger…" />
        <div className="grid gap-4 lg:grid-cols-2">
          <Card><CardContent className="space-y-2 p-4">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</CardContent></Card>
          <Card><CardContent className="space-y-2 p-4">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</CardContent></Card>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Advances & Cash Movement"
        badge="Cash Flow"
        subtitle="Whole-glance money view — track customer advances, workshop disbursements and every cash movement across the khata ledger."
        actions={
          <Button variant="outline" size="sm" className="gap-1.5" onClick={exportDaybookCsv}>
            <FileSpreadsheet className="h-4 w-4" /> Export Day Book
          </Button>
        }
      />

      {/* ── Summary tiles ──────────────────────────────────────────── */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryTile label="We will receive (Customers)" value={money(totalReceivable)} icon={TrendingUp} accent="emerald" />
        <SummaryTile label="We owe (Payables)" value={money(totalPayable)} icon={TrendingDown} accent="red" />
        <SummaryTile label="Net Position (Ledgerwise)" value={money(net)} icon={Scale} accent="primary" />
        <SummaryTile
          label="Open Advances Outstanding"
          value={money(openTotal)}
          icon={Banknote}
          accent="default"
        />
      </div>
      <div className="text-muted-foreground flex flex-wrap gap-x-5 gap-y-1 px-1 text-xs">
        <span className="inline-flex items-center gap-1.5">
          <ArrowUpRight className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
          {receivables.length} parties owe us · advances {money(totalReceivable > 0 ? totalReceivable : 0)}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <ArrowDownLeft className="h-3.5 w-3.5 text-destructive" />
          {payables.length} karigars & suppliers to pay
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Coins className="h-3.5 w-3.5" />
          {openAdvances.length} open · {advances.length - openAdvances.length} settled advances
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Wallet className="h-3.5 w-3.5" />
          Lifetime: given {money(givenTotal)} · taken {money(takenTotal)}
        </span>
      </div>

      {/* ── Quick entry ────────────────────────────────────────────── */}
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

      {/* ── Whom we gave / whom we owe ─────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-2">
        <KhataCard
          title="Whom I Gave Advance / Money"
          description="These parties owe us money — open advances and unpaid invoices"
          icon={ArrowUpRight}
          accent="emerald"
          parties={receivables}
          emptyText="No receivables — you haven't given anyone money."
          onAction={openAction}
          onViewAll={() => toast.info("Open a party in Parties & Khata to see its full ledger")}
        />
        <KhataCard
          title="Whom I Still Have to Give Money"
          description="We owe these parties — advances taken and unpaid dues"
          icon={ArrowDownLeft}
          accent="red"
          parties={payables}
          emptyText="No payables — you owe no one."
          onAction={openAction}
          onViewAll={() => toast.info("Open a party in Parties & Khata to see its full ledger")}
        />
      </div>

      {/* ── Recent cash movement & daybook ─────────────────────────── */}
      <Card>
        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-sm font-bold">Recent Cash Movement &amp; Daybook</h3>
            <p className="text-muted-foreground mt-0.5 text-xs">
              {formatNumber(advances.length)} advance entries · every rupee given or taken, newest first
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                { key: "all", label: "All Movements" },
                { key: "GIVEN", label: "Given" },
                { key: "TAKEN", label: "Taken" },
                { key: "OPEN", label: "Open only" },
              ] as const
            ).map((f) => {
              const active = daybookFilter === f.key;
              return (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => {
                    setDaybookFilter(f.key);
                    setPage(1);
                  }}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                    active
                      ? "border-primary bg-primary text-primary-foreground"
                      : "bg-card text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {f.label}
                </button>
              );
            })}
          </div>
        </div>
        <CardContent className="p-0">
          {advancesQ.loading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="text-xs">Date &amp; Time</TableHead>
                    <TableHead className="text-xs">Party (Type)</TableHead>
                    <TableHead className="text-xs">Direction</TableHead>
                    <TableHead className="text-xs">Note</TableHead>
                    <TableHead className="text-right text-xs">Amount</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-right text-xs">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pageRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-muted-foreground py-10 text-center text-sm">
                        No cash movements recorded yet — use the quick entry above.
                      </TableCell>
                    </TableRow>
                  ) : (
                    pageRows.map((a) => {
                      const party = partyById.get(a.partyId);
                      const given = a.direction === "GIVEN";
                      return (
                        <TableRow key={a.id} className="hover:bg-muted/30">
                          <TableCell className="text-muted-foreground whitespace-nowrap text-xs">
                            {formatDate(a.date)}
                            <p className="text-[11px]">
                              {new Date(a.date).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                            </p>
                          </TableCell>
                          <TableCell>
                            <p className="max-w-40 truncate text-sm font-medium">{party?.name ?? "Unknown party"}</p>
                            <p className="text-muted-foreground text-xs">{partyTypeLabel(party)}</p>
                          </TableCell>
                          <TableCell>
                            <Badge variant={given ? "warning" : "secondary"} className="gap-1">
                              {given ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownLeft className="h-3 w-3" />}
                              {given ? "Advance Given" : "Advance Taken"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground max-w-44 truncate text-xs">
                            {a.note || "—"}
                          </TableCell>
                          <TableCell className={`text-right font-semibold tabular-nums ${given ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}`}>
                            {given ? "+" : "−"}
                            {money(a.amount)}
                          </TableCell>
                          <TableCell>
                            <Badge variant={a.status === "OPEN" ? "warning" : "success"}>{a.status === "OPEN" ? "Open" : "Settled"}</Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-end gap-1.5">
                              {a.status === "OPEN" ? (
                                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => void handleSettle(a)}>
                                  Settle
                                </Button>
                              ) : null}
                              <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive hover:text-destructive" onClick={() => setDeleteTarget(a)}>
                                Delete
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>

              {/* Footer: totals + pagination */}
              <div className="flex flex-col gap-2 border-t p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                  <span>
                    Showing{" "}
                    {filteredAdvances.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1}–
                    {Math.min(safePage * PAGE_SIZE, filteredAdvances.length)} of {filteredAdvances.length} entries
                  </span>
                  <span>
                    Given <span className="text-foreground font-semibold">{money(givenTotal)}</span> · Taken{" "}
                    <span className="text-foreground font-semibold">{money(takenTotal)}</span> · Open{" "}
                    <span className="text-foreground font-semibold">{money(openTotal)}</span>
                  </span>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="h-7" disabled={safePage <= 1} onClick={() => setPage((p) => p - 1)}>
                    Previous
                  </Button>
                  <span className="text-muted-foreground inline-flex items-center px-1 text-xs tabular-nums">
                    Page {safePage} of {totalPages}
                  </span>
                  <Button variant="outline" size="sm" className="h-7" disabled={safePage >= totalPages} onClick={() => setPage((p) => p + 1)}>
                    Next
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* ── Action dialog (give/take/receive/pay) ──────────────────── */}
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

      {/* ── Delete confirm ─────────────────────────────────────────── */}
      <Dialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Remove this advance entry?</DialogTitle>
            <DialogDescription>
              {deleteTarget
                ? `${partyById.get(deleteTarget.partyId)?.name ?? "Party"} · ${formatCurrency(deleteTarget.amount)} · ${
                    deleteTarget.direction === "GIVEN" ? "given" : "taken"
                  }. This cannot be undone.`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => void handleDelete()} disabled={deleting}>
              {deleting ? "Removing…" : "Remove entry"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
