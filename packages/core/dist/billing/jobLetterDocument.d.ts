/**
 * Shared job-letter model — THE single source of truth for appointment /
 * joining confirmation letters across all three apps (web, desktop, mobile).
 *
 * The web app keeps its rich jsPDF template on top of this data; desktop and
 * mobile render `renderJobLetterHtml` (jsPDF html() / expo-print) so a letter
 * generated on any platform has the same content.
 */
export interface JobLetterData {
    companyName: string;
    companyAddress: string;
    companyEmail: string;
    employeeName: string;
    employeeAddress: string;
    position: string;
    joiningDate: string;
    monthlySalary: number;
    workingHoursDescription: string;
    workingHoursFrom: string;
    workingHoursTo: string;
    timeFormat: "AM" | "PM";
    weeklyOff1: string;
    weeklyOff2: string;
    probationMonths: number;
    additionalTasks: string;
}
export declare const defaultJobLetterData: JobLetterData;
/** The subset of a saved `job_letters` row that can feed the letter. */
export type JobLetterRowLike = {
    employeeName?: string | null;
    position?: string | null;
    monthlySalary?: number | null;
};
/** Company fields usually filled from the shop settings row. */
export type JobLetterCompanyFallback = {
    name?: string | null;
    address?: string | null;
    email?: string | null;
};
/**
 * Merges a saved letter's `data` snapshot (web stores the full typed form;
 * desktop/mobile store sparse rows) over the defaults, falling back to the
 * row's own columns and optionally the shop settings for company info.
 * Result is always a complete, renderable `JobLetterData`.
 */
export declare function jobLetterFromStored(stored: Record<string, unknown> | null, row: JobLetterRowLike, company?: JobLetterCompanyFallback): JobLetterData;
/** "2026-08-11" → "11 August 2026" (deterministic — no Intl dependency). */
export declare function formatJoiningDate(iso: string): string;
/**
 * HTML render of a job letter — the shared, print-friendly markup used by
 * desktop (jsPDF html()) and mobile (expo-print). Gold-bordered, matching the
 * web app's classic letter template. All values are HTML-escaped; the salary
 * words come from the shared numberToWords logic.
 */
export declare function renderJobLetterHtml(data: JobLetterData): string;
//# sourceMappingURL=jobLetterDocument.d.ts.map