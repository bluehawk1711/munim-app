"use client"

import * as React from "react"
import { FileText, Zap, Loader2, Save, History, Trash2 } from "lucide-react"
import { Button, Input, Label, Card, CardContent, CardHeader, CardTitle, Separator, Badge } from "@munim/ui"






import { useJobLetters, useSaveJobLetter } from "@/hooks/use-job-letters"
import { useSettings } from "@/hooks/use-settings"
import { generateJobLetterPDF } from "@/lib/billing/generatePDF"
import type { JobLetterData } from "@/lib/billing/types"
import { formatDate } from "@/lib/format"
import { toast } from "sonner"

const WEEK_DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
const HOURS = Array.from({ length: 12 }, (_, i) => (i + 1).toString().padStart(2, "0"))
const MINUTES = ["00", "15", "30", "45"]
const PERIODS = ["AM", "PM"]

export function JobLetterView() {
  const { data: settings } = useSettings()
  const { data: history } = useJobLetters()
  const saveLetter = useSaveJobLetter()

  const [form, setForm] = React.useState<JobLetterData>(() => ({
    companyName: settings?.shopName || "Jewellery Wala",
    companyAddress: settings?.shopAddress || "Jhalamand Circle, Jodhpur",
    companyEmail: settings?.shopEmail || "jewellerywalaonline@gmail.com",
    employeeName: "",
    employeeAddress: "",
    position: "",
    joiningDate: "",
    monthlySalary: 0,
    workingHoursDescription: "9 hours per day",
    workingHoursFrom: "09:00 AM",
    workingHoursTo: "06:00 PM",
    timeFormat: "AM",
    weeklyOff1: "Sunday",
    weeklyOff2: "",
    probationMonths: 3,
    additionalTasks: "",
  }))

  function set<K extends keyof JobLetterData>(key: K, value: JobLetterData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSaveAndPrint() {
    if (!form.employeeName.trim() || !form.position.trim()) {
      toast.error("Employee name and position are required")
      return
    }
    try {
      await saveLetter.mutateAsync({
        title: `Job Letter — ${form.employeeName}`,
        employeeName: form.employeeName,
        position: form.position,
        monthlySalary: form.monthlySalary,
        data: { ...form },
      })
      toast.success("Job letter saved")
    } catch {
      toast.error("Failed to save job letter")
    }
    generateJobLetterPDF(form)
  }

  function loadLetter(data: Record<string, unknown>) {
    setForm((prev) => ({ ...prev, ...(data as Partial<JobLetterData>) }))
    toast.success("Letter loaded")
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-500/15 text-indigo-600 dark:text-indigo-400">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold">Job / Offer Letter</h2>
            <p className="text-xs text-muted-foreground">Appointment &amp; joining confirmation letter</p>
          </div>
        </div>
        <Button onClick={handleSaveAndPrint} disabled={saveLetter.isPending} className="gap-1.5">
          {saveLetter.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
          Save &amp; Generate PDF
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {/* Company */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Company Information</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Company name</Label>
                <Input value={form.companyName} onChange={(e) => set("companyName", e.target.value)} className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Company email</Label>
                <Input value={form.companyEmail} onChange={(e) => set("companyEmail", e.target.value)} className="h-9" />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-xs">Company address</Label>
                <Input value={form.companyAddress} onChange={(e) => set("companyAddress", e.target.value)} className="h-9" />
              </div>
            </CardContent>
          </Card>

          {/* Employee */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Employee &amp; Job</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Employee name *</Label>
                <Input value={form.employeeName} onChange={(e) => set("employeeName", e.target.value)} className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Position *</Label>
                <Input value={form.position} onChange={(e) => set("position", e.target.value)} className="h-9" />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-xs">Employee address</Label>
                <Input value={form.employeeAddress} onChange={(e) => set("employeeAddress", e.target.value)} className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Joining date</Label>
                <Input type="date" value={form.joiningDate} onChange={(e) => set("joiningDate", e.target.value)} className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Monthly salary (₹)</Label>
                <Input type="number" min={0} value={form.monthlySalary || ""} onChange={(e) => set("monthlySalary", Number(e.target.value))} className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Probation (months)</Label>
                <Input type="number" min={0} value={form.probationMonths || ""} onChange={(e) => set("probationMonths", Number(e.target.value))} className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Additional tasks</Label>
                <Input value={form.additionalTasks} onChange={(e) => set("additionalTasks", e.target.value)} className="h-9" />
              </div>
            </CardContent>
          </Card>

          {/* Hours */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Working Hours</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Description</Label>
                <Input value={form.workingHoursDescription} onChange={(e) => set("workingHoursDescription", e.target.value)} className="h-9" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">From</Label>
                  <TimePicker value={form.workingHoursFrom} onChange={(v) => set("workingHoursFrom", v)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">To</Label>
                  <TimePicker value={form.workingHoursTo} onChange={(v) => set("workingHoursTo", v)} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Weekly off 1</Label>
                <select value={form.weeklyOff1} onChange={(e) => set("weeklyOff1", e.target.value)} className="h-9 w-full rounded-md border bg-background px-3 text-sm outline-none">
                  {WEEK_DAYS.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Weekly off 2</Label>
                <select value={form.weeklyOff2} onChange={(e) => set("weeklyOff2", e.target.value)} className="h-9 w-full rounded-md border bg-background px-3 text-sm outline-none">
                  <option value="">None</option>
                  {WEEK_DAYS.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* History */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm"><History className="h-4 w-4" /> Saved Letters</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {!history || history.length === 0 ? (
                <p className="px-4 py-8 text-center text-xs text-muted-foreground">No letters saved yet.</p>
              ) : (
                <div className="divide-y">
                  {history.slice(0, 10).map((l) => (
                    <button key={l.id} type="button" onClick={() => loadLetter(l.data)} className="flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left transition-colors hover:bg-muted/40">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{l.employeeName || l.title}</p>
                        <p className="text-xs text-muted-foreground">{l.position} · {formatDate(l.createdAt)}</p>
                      </div>
                      <Badge variant="secondary" className="shrink-0 font-normal">{formatDate(l.createdAt)}</Badge>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
          <Separator />
          <p className="text-xs text-muted-foreground">
            The PDF uses the classic gold-bordered letter template. Amount-in-words is generated automatically for the salary.
          </p>
        </div>
      </div>
    </div>
  )
}

function TimePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [hour, minute, period] = value.split(/[: ]/)
  return (
    <div className="flex h-9 items-center gap-1 rounded-md border bg-background px-2">
      <select
        value={hour || "09"}
        onChange={(e) => onChange(`${e.target.value}:${minute || "00"} ${period || "AM"}`)}
        className="bg-transparent text-sm outline-none"
      >
        {HOURS.map((h) => <option key={h} value={h}>{h}</option>)}
      </select>
      <span className="text-muted-foreground">:</span>
      <select
        value={minute || "00"}
        onChange={(e) => onChange(`${hour || "09"}:${e.target.value} ${period || "AM"}`)}
        className="bg-transparent text-sm outline-none"
      >
        {MINUTES.map((m) => <option key={m} value={m}>{m}</option>)}
      </select>
      <select
        value={period || "AM"}
        onChange={(e) => onChange(`${hour || "09"}:${minute || "00"} ${e.target.value}`)}
        className="ml-auto bg-transparent text-sm font-semibold text-indigo-500 outline-none"
      >
        {PERIODS.map((p) => <option key={p} value={p}>{p}</option>)}
      </select>
    </div>
  )
}
