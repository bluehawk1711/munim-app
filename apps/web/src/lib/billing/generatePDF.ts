import { jsPDF } from "jspdf";
import { numberToWords } from "@munim/core";
import type { JobLetterData } from "./types";

export function generateJobLetterPDF(data: JobLetterData): void {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;

  drawDecorativeBorder(doc, pageWidth, pageHeight, margin);

  const headerY = 35;

  // Company Header with elegant styling
  doc.setFont("times", "bold");
  doc.setFontSize(26);
  doc.setTextColor(139, 119, 42);
  doc.text(data.companyName, pageWidth / 2, headerY, { align: "center" });

  // Decorative underline
  doc.setDrawColor(180, 160, 100);
  doc.setLineWidth(0.5);
  doc.line(pageWidth / 2 - 45, headerY + 4, pageWidth / 2 + 45, headerY + 4);

  doc.setFontSize(10);
  doc.setFont("times", "normal");
  doc.setTextColor(80, 80, 80);
  doc.text(data.companyAddress, pageWidth / 2, headerY + 12, {
    align: "center",
  });
  doc.text("Email: " + data.companyEmail, pageWidth / 2, headerY + 18, {
    align: "center",
  });

  // Main divider
  doc.setDrawColor(139, 119, 42);
  doc.setLineWidth(0.8);
  doc.line(margin + 10, headerY + 25, pageWidth - margin - 10, headerY + 25);

  let currentY = headerY + 42;
  const leftMargin = margin + 15;
  const lineHeight = 7;

  // Recipients section
  doc.setTextColor(40, 40, 40);
  doc.setFontSize(11);
  doc.setFont("times", "normal");

  doc.text("To,", leftMargin, currentY);
  currentY += lineHeight;
  doc.setFont("times", "bold");
  doc.text("Name: " + (data.employeeName || "_____________________________"), leftMargin, currentY);
  doc.setFont("times", "normal");
  currentY += lineHeight;
  doc.text("Address: " + (data.employeeAddress || "_____________________________"), leftMargin, currentY);
  currentY += lineHeight * 2;

  // Subject line with emphasis
  doc.setFontSize(13);
  doc.setFont("times", "bold");
  doc.setTextColor(139, 119, 42);
  doc.text("Subject: Appointment & Joining Confirmation Letter", leftMargin, currentY);

  // Underline for subject
  doc.setDrawColor(180, 160, 100);
  doc.setLineWidth(0.3);
  doc.line(leftMargin, currentY + 2, leftMargin + 100, currentY + 2);
  currentY += lineHeight * 2;

  // Letter body
  doc.setFontSize(11);
  doc.setFont("times", "normal");
  doc.setTextColor(40, 40, 40);

  doc.text("Dear " + (data.employeeName ? "Mr./Ms. " + data.employeeName : "_______________") + ",", leftMargin, currentY);
  currentY += lineHeight * 1.5;

  // Position paragraph
  const positionText =
    "We are pleased to offer you the position of " +
    (data.position || "____________") +
    " at " +
    data.companyName +
    ".";
  doc.text(positionText, leftMargin, currentY);
  currentY += lineHeight;

  // Joining date
  const joiningDateObj = data.joiningDate ? new Date(data.joiningDate) : null;
  const joiningText =
    joiningDateObj && !isNaN(joiningDateObj.getTime())
      ? joiningDateObj.toLocaleDateString("en-IN", {
          day: "2-digit",
          month: "long",
          year: "numeric",
        })
      : "_________ (Joining Date)";
  doc.text("You are required to join on " + joiningText + ".", leftMargin, currentY);
  currentY += lineHeight;

  if (data.additionalTasks) {
    doc.text("Additional responsibilities: " + data.additionalTasks, leftMargin, currentY);
    currentY += lineHeight;
  }
  currentY += lineHeight * 0.5;

  // Salary details
  const salaryInWords = data.monthlySalary > 0 ? numberToWords(data.monthlySalary) : "____________";
  const salaryFormatted =
    data.monthlySalary > 0 ? data.monthlySalary.toLocaleString("en-IN") : "________";

  doc.setFont("times", "bold");
  doc.text("Compensation:", leftMargin, currentY);
  doc.setFont("times", "normal");
  currentY += lineHeight;
  doc.text("Monthly Salary: Rs. " + salaryFormatted + " (" + salaryInWords + ")", leftMargin + 5, currentY);
  currentY += lineHeight * 1.5;

  // Working hours
  doc.setFont("times", "bold");
  doc.text("Working Hours:", leftMargin, currentY);
  doc.setFont("times", "normal");
  currentY += lineHeight;

  if (data.workingHoursDescription) {
    doc.text(data.workingHoursDescription, leftMargin + 5, currentY);
    currentY += lineHeight;
  }
  doc.text(
    "Timing: " + (data.workingHoursFrom || "_________") + " to " + (data.workingHoursTo || "_________"),
    leftMargin + 5,
    currentY,
  );
  currentY += lineHeight;
  doc.text(
    "Weekly Off: " + (data.weeklyOff1 || "____________") + (data.weeklyOff2 ? ", " + data.weeklyOff2 : ""),
    leftMargin + 5,
    currentY,
  );
  currentY += lineHeight * 1.5;

  // Probation
  doc.text(
    "You will be under probation for " +
      (data.probationMonths > 0 ? data.probationMonths.toString() : "_") +
      " month(s) from the date of joining.",
    leftMargin,
    currentY,
  );
  currentY += lineHeight * 2.5;

  // Closing
  doc.text("Sincerely,", leftMargin, currentY);
  currentY += lineHeight * 2;

  doc.setDrawColor(139, 119, 42);
  doc.setLineWidth(0.3);
  doc.line(leftMargin, currentY, leftMargin + 50, currentY);
  currentY += lineHeight;
  doc.setFont("times", "bold");
  doc.text("Authorized Signatory", leftMargin, currentY);
  currentY += lineHeight;
  doc.setFont("times", "normal");
  doc.text(data.companyName, leftMargin, currentY);

  doc.save(
    data.employeeName ? "Job_Letter_" + data.employeeName.replace(/\s+/g, "_") + ".pdf" : "Job_Letter.pdf",
  );
}

function drawDecorativeBorder(
  doc: jsPDF,
  pageWidth: number,
  pageHeight: number,
  margin: number,
): void {
  // Outer gold border
  doc.setDrawColor(180, 160, 100);
  doc.setLineWidth(2);
  doc.rect(margin, margin, pageWidth - 2 * margin, pageHeight - 2 * margin);

  // Inner lighter border
  doc.setDrawColor(200, 180, 120);
  doc.setLineWidth(0.5);
  doc.rect(margin + 4, margin + 4, pageWidth - 2 * margin - 8, pageHeight - 2 * margin - 8);

  // Corner flourishes
  const cornerSize = 15;
  doc.setDrawColor(180, 160, 100);
  doc.setLineWidth(1.2);

  // Top-left corner
  doc.line(margin + 6, margin + cornerSize, margin + 6, margin + 6);
  doc.line(margin + 6, margin + 6, margin + cornerSize, margin + 6);

  // Top-right corner
  doc.line(pageWidth - margin - 6, margin + cornerSize, pageWidth - margin - 6, margin + 6);
  doc.line(pageWidth - margin - cornerSize, margin + 6, pageWidth - margin - 6, margin + 6);

  // Bottom-left corner
  doc.line(margin + 6, pageHeight - margin - cornerSize, margin + 6, pageHeight - margin - 6);
  doc.line(margin + 6, pageHeight - margin - 6, margin + cornerSize, pageHeight - margin - 6);

  // Bottom-right corner
  doc.line(pageWidth - margin - 6, pageHeight - margin - cornerSize, pageWidth - margin - 6, pageHeight - margin - 6);
  doc.line(pageWidth - margin - cornerSize, pageHeight - margin - 6, pageWidth - margin - 6, pageHeight - margin - 6);

  // Corner diamonds
  doc.setFillColor(180, 160, 100);
  const diamondSize = 2;
  [
    [margin + 8, margin + 8],
    [pageWidth - margin - 8, margin + 8],
    [margin + 8, pageHeight - margin - 8],
    [pageWidth - margin - 8, pageHeight - margin - 8],
  ].forEach((corner) => {
    doc.circle(corner[0]!, corner[1]!, diamondSize, "F");
  });
}
