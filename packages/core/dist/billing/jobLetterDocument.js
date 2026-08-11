import { amountInWords } from "../utils/numberToWords";
export const defaultJobLetterData = {
    companyName: "Jewellery Wala",
    companyAddress: "",
    companyEmail: "",
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
};
/**
 * Merges a saved letter's `data` snapshot (web stores the full typed form;
 * desktop/mobile store sparse rows) over the defaults, falling back to the
 * row's own columns and optionally the shop settings for company info.
 * Result is always a complete, renderable `JobLetterData`.
 */
export function jobLetterFromStored(stored, row, company) {
    const s = stored ?? {};
    const str = (key) => (typeof s[key] === "string" ? s[key] : "");
    const num = (key) => {
        const value = s[key];
        const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
        return Number.isFinite(n) ? n : 0;
    };
    const storedSalary = num("monthlySalary");
    const rowSalary = row.monthlySalary ?? 0;
    const storedProbation = num("probationMonths");
    return {
        companyName: str("companyName") || company?.name || defaultJobLetterData.companyName,
        companyAddress: str("companyAddress") || company?.address || defaultJobLetterData.companyAddress,
        companyEmail: str("companyEmail") || company?.email || defaultJobLetterData.companyEmail,
        employeeName: str("employeeName") || (row.employeeName ?? ""),
        employeeAddress: str("employeeAddress") || "",
        position: str("position") || (row.position ?? ""),
        joiningDate: str("joiningDate") || "",
        monthlySalary: storedSalary > 0 ? storedSalary : rowSalary,
        workingHoursDescription: str("workingHoursDescription") || "9 hours per day",
        workingHoursFrom: str("workingHoursFrom") || "09:00 AM",
        workingHoursTo: str("workingHoursTo") || "06:00 PM",
        timeFormat: str("timeFormat") === "PM" ? "PM" : "AM",
        weeklyOff1: str("weeklyOff1") || "Sunday",
        weeklyOff2: str("weeklyOff2") || "",
        probationMonths: storedProbation > 0 ? storedProbation : 3,
        additionalTasks: str("additionalTasks") || str("notes") || "",
    };
}
const esc = (s) => (s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
const MONTHS = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
];
/** "2026-08-11" → "11 August 2026" (deterministic — no Intl dependency). */
export function formatJoiningDate(iso) {
    if (!iso)
        return "________ (Joining Date)";
    const date = new Date(`${iso}T00:00:00`);
    if (Number.isNaN(date.getTime()))
        return "________ (Joining Date)";
    return `${date.getDate()} ${MONTHS[date.getMonth()] ?? ""} ${date.getFullYear()}`.replace(/\s+/g, " ");
}
/**
 * HTML render of a job letter — the shared, print-friendly markup used by
 * desktop (jsPDF html()) and mobile (expo-print). Gold-bordered, matching the
 * web app's classic letter template. All values are HTML-escaped; the salary
 * words come from the shared numberToWords logic.
 */
export function renderJobLetterHtml(data) {
    const salary = Math.max(0, data.monthlySalary);
    const salaryFormatted = salary > 0 ? salary.toLocaleString("en-IN") : "________";
    const salaryWords = salary > 0 ? amountInWords(salary) : "____________";
    const joiningDate = formatJoiningDate(data.joiningDate);
    const weeklyOff = [data.weeklyOff1, data.weeklyOff2].filter((d) => d.trim() !== "").join(", ");
    const probationMonths = Math.max(0, data.probationMonths);
    const additionalTasks = data.additionalTasks.trim() !== ""
        ? `<p class="body">Additional responsibilities: ${esc(data.additionalTasks)}</p>`
        : "";
    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>
  body { font-family: Georgia, "Times New Roman", serif; color: #2a2a2a; margin: 0; padding: 34px; }
  .page { position: relative; border: 2px solid #b4903a; padding: 26px 34px 20px; background: #fffdf7; }
  .corner { position: absolute; width: 16px; height: 16px; }
  .corner.tl { top: -2px; left: -2px; border-top: 2px solid #8b772a; border-left: 2px solid #8b772a; }
  .corner.tr { top: -2px; right: -2px; border-top: 2px solid #8b772a; border-right: 2px solid #8b772a; }
  .corner.bl { bottom: -2px; left: -2px; border-bottom: 2px solid #8b772a; border-left: 2px solid #8b772a; }
  .corner.br { bottom: -2px; right: -2px; border-bottom: 2px solid #8b772a; border-right: 2px solid #8b772a; }
  .company { text-align: center; margin-bottom: 4px; }
  .company h1 { margin: 0; color: #8b772a; font-size: 26px; letter-spacing: 1px; font-weight: 700; }
  .company p { margin: 2px 0; color: #666; font-size: 12px; }
  .divider { height: 1px; background: #d9c48a; margin: 14px 0 18px; }
  .to { font-size: 12.5px; line-height: 1.7; }
  .subject { text-align: center; color: #8b772a; font-size: 15px; font-weight: 700; margin: 20px 0 4px; letter-spacing: 0.3px; }
  .subject-rule { width: 230px; height: 1px; background: #d9c48a; margin: 0 auto 16px; }
  p.body { font-size: 12.5px; line-height: 1.75; margin: 0 0 10px; }
  h2 { font-size: 11.5px; text-transform: uppercase; letter-spacing: 1.2px; color: #8b772a; margin: 14px 0 4px; }
  .sig { margin-top: 24px; }
  .sig .line { width: 170px; border-top: 1px solid #666; margin-top: 36px; }
  .sig .label { font-size: 11px; color: #555; margin-top: 4px; }
  .foot { margin-top: 18px; border-top: 1px solid #e3d5ae; padding-top: 8px; display: flex; justify-content: space-between; font-size: 10px; color: #999; }
</style>
</head>
<body>
  <div class="page">
    <div class="corner tl"></div>
    <div class="corner tr"></div>
    <div class="corner bl"></div>
    <div class="corner br"></div>

    <div class="company">
      <h1>${esc(data.companyName)}</h1>
      ${data.companyAddress ? `<p>${esc(data.companyAddress)}</p>` : ""}
      ${data.companyEmail ? `<p>Email: ${esc(data.companyEmail)}</p>` : ""}
    </div>
    <div class="divider"></div>

    <div class="to">
      <b>To,</b><br/>
      Name: ${esc(data.employeeName) || "_____________________________"}<br/>
      Address: ${esc(data.employeeAddress) || "_____________________________"}
    </div>

    <div class="subject">Subject: Appointment &amp; Joining Confirmation Letter</div>
    <div class="subject-rule"></div>

    <p class="body">Dear ${esc(data.employeeName) ? `Mr./Ms. ${esc(data.employeeName)}` : "_______________"},</p>
    <p class="body">We are pleased to offer you the position of ${esc(data.position) || "____________"} at ${esc(data.companyName)}.</p>
    <p class="body">You are required to join on ${joiningDate}.</p>
    ${additionalTasks}

    <h2>Compensation</h2>
    <p class="body">Monthly Salary: ₹${salaryFormatted} (${salaryWords})</p>

    <h2>Working Hours</h2>
    <p class="body">
      ${esc(data.workingHoursDescription) || "9 hours per day"}<br/>
      Timing: ${esc(data.workingHoursFrom) || "09:00 AM"} to ${esc(data.workingHoursTo) || "06:00 PM"}<br/>
      Weekly Off: ${esc(weeklyOff) || "________"}
    </p>

    <p class="body">You will be under probation for ${probationMonths > 0 ? probationMonths : "_"} month(s) from the date of joining.</p>

    <p class="body" style="margin-top: 14px;">Sincerely,</p>
    <div class="sig">
      <div class="line"></div>
      <div class="label">Authorized Signatory — ${esc(data.companyName)}</div>
    </div>

    <div class="foot">
      <span>Generated by Munim</span>
      <span>Thank you for your business!</span>
    </div>
  </div>
</body>
</html>`;
}
//# sourceMappingURL=jobLetterDocument.js.map