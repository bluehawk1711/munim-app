import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { saveJobLetter, listJobLetters, deleteJobLetter, formatDate } from "@munim/core";
import { getCore } from "@/lib/core";
import { useAsync } from "@/lib/use-async";
import { money } from "@/lib/format";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export function JobLettersPage() {
  const { data, loading, reload } = useAsync(() => listJobLetters(getCore(), 100), []);

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("Job Letter");
  const [employeeName, setEmployeeName] = useState("");
  const [position, setPosition] = useState("");
  const [monthlySalary, setMonthlySalary] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!employeeName.trim()) {
      toast.error("Employee name is required");
      return;
    }
    setSaving(true);
    try {
      await saveJobLetter(getCore(), {
        title: title.trim() || "Job Letter",
        employeeName: employeeName.trim(),
        position: position.trim() || undefined,
        monthlySalary: Number(monthlySalary) || 0,
        data: { notes: notes.trim() },
      });
      setOpen(false);
      setEmployeeName("");
      setPosition("");
      setMonthlySalary("");
      setNotes("");
      reload();
      toast.success("Job letter saved");
    } catch (err) {
      toast.error("Failed to save", { description: err instanceof Error ? err.message : undefined });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Delete this job letter?")) return;
    try {
      await deleteJobLetter(getCore(), id);
      reload();
      toast.success("Deleted");
    } catch (err) {
      toast.error("Delete failed", { description: err instanceof Error ? err.message : undefined });
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-sm">Job / offer letters for staff — saved to the shared database.</p>
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> New letter
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Employee</TableHead>
                <TableHead>Position</TableHead>
                <TableHead className="text-right">Salary</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={6} className="text-muted-foreground text-center">Loading…</TableCell></TableRow>
              ) : !data || data.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-muted-foreground text-center">No job letters yet</TableCell></TableRow>
              ) : (
                data.map((letter) => (
                  <TableRow key={letter.id}>
                    <TableCell className="font-medium">{letter.title}</TableCell>
                    <TableCell>{letter.employeeName ?? "—"}</TableCell>
                    <TableCell>{letter.position ?? "—"}</TableCell>
                    <TableCell className="text-right">{money(letter.monthlySalary)}</TableCell>
                    <TableCell>{formatDate(letter.createdAt)}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon-sm" onClick={() => handleDelete(letter.id)}>
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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New job letter</DialogTitle>
            <DialogDescription>Basic details; the rich letter template lives in the web app.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="j-title">Title</Label>
              <Input id="j-title" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="j-name">Employee name *</Label>
              <Input id="j-name" value={employeeName} onChange={(e) => setEmployeeName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="j-position">Position</Label>
              <Input id="j-position" value={position} onChange={(e) => setPosition(e.target.value)} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="j-salary">Monthly salary</Label>
              <Input id="j-salary" type="number" min={0} value={monthlySalary} onChange={(e) => setMonthlySalary(e.target.value)} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="j-notes">Notes</Label>
              <Input id="j-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
