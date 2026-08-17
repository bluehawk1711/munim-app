import { useState } from "react";
import { Plus, Trash2, Download } from "lucide-react";
import {
  jobLetterFromStored,
  formatDate,
} from "@munim/core";
import type { JobLetterDto, SettingsDto } from "@munim/api-client";
import {
  useJobLetters,
  useSettings,
  useSaveJobLetter,
  useDeleteJobLetter,
  useQueryState,
} from "@munim/query";
import { money } from "@/lib/format";
import { downloadJobLetterPdf } from "@/lib/jobLetterPdf";
import { toast } from "@munim/ui";
import { Button, Input, Label, Card, CardContent, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Skeleton } from "@munim/ui"
;
;
;
;
;
;
;

function companyFromSettings(s: SettingsDto | null | undefined): { name: string; address: string; email: string } | undefined {
  return s ? { name: s.shopName, address: s.shopAddress ?? "", email: s.shopEmail ?? "" } : undefined;
}

export function JobLettersPage() {
  const { data, loading } = useQueryState(useJobLetters());
  const { data: settings } = useQueryState(useSettings());
  const saveLetter = useSaveJobLetter();
  const deleteLetter = useDeleteJobLetter();

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("Job Letter");
  const [employeeName, setEmployeeName] = useState("");
  const [position, setPosition] = useState("");
  const [monthlySalary, setMonthlySalary] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);

  /** Persists the dialog fields, clears, toasts — returns success. */
  async function persistLetter(): Promise<boolean> {
    try {
      await saveLetter.mutateAsync({
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
      toast.success("Job letter saved");
      return true;
    } catch (err) {
      toast.error("Failed to save", { description: err instanceof Error ? err.message : undefined });
      return false;
    }
  }

  async function handleSave() {
    if (!employeeName.trim()) {
      toast.error("Employee name is required");
      return;
    }
    setSaving(true);
    try {
      await persistLetter();
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveAndDownload() {
    if (!employeeName.trim()) {
      toast.error("Employee name is required");
      return;
    }
    // Build the letter BEFORE persist clears the dialog fields.
    const letterData = jobLetterFromStored(
      { notes: notes.trim() },
      {
        employeeName: employeeName.trim(),
        position: position.trim() || null,
        monthlySalary: Number(monthlySalary) || 0,
      },
      companyFromSettings(settings),
    );
    setSaving(true);
    try {
      const saved = await persistLetter();
      if (!saved) return;
      await downloadJobLetterPdf(letterData);
    } catch (err) {
      toast.error("Could not generate PDF", { description: err instanceof Error ? err.message : undefined });
    } finally {
      setSaving(false);
    }
  }

  async function handleDownload(letter: JobLetterDto) {
    setExporting(true);
    try {
      await downloadJobLetterPdf(jobLetterFromStored(letter.data, letter, companyFromSettings(settings)));
    } catch (err) {
      toast.error("Could not generate PDF", { description: err instanceof Error ? err.message : undefined });
    } finally {
      setExporting(false);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Delete this job letter?")) return;
    try {
      await deleteLetter.mutateAsync(id);
      toast.success("Deleted");
    } catch (err) {
      toast.error("Delete failed", { description: err instanceof Error ? err.message : undefined });
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-sm">Job / offer letters for staff — saved to the shared database. Download the gold-bordered PDF from any letter.</p>
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
                <TableRow>
                  <TableCell colSpan={6} className="p-4">
                    <div className="space-y-2">
                      {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
                    </div>
                  </TableCell>
                </TableRow>
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
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon-sm" title="Download PDF" onClick={() => handleDownload(letter)} disabled={exporting}>
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon-sm" onClick={() => handleDelete(letter.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
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
            <DialogDescription>Basic details; the full rich form lives in the web app.</DialogDescription>
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
            <Button variant="outline" onClick={handleSave} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
            <Button onClick={handleSaveAndDownload} disabled={saving}>{saving ? "Working…" : "Save & Download PDF"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
