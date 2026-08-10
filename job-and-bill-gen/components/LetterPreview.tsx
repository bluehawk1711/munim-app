"use client";

import { JobLetterData } from "../app/types";
import { numberToWords, formatCurrency } from "../app/utils/numberToWords";

interface LetterPreviewProps {
  data: JobLetterData;
}

export default function LetterPreview({ data }: LetterPreviewProps) {
  const formatDate = (dateString: string) => {
    if (!dateString) return "_________";
    return new Date(dateString).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  };

  const formatTime = (timeString: string) => {
    if (!timeString) return "_________";
    return timeString;
  };

  return (
    <div className="letter-preview">
      <div className="letter-border">
        <div className="letter-content p-6 md:p-10 text-black font-serif">
          {/* Header */}
          <div className="letter-header text-center mb-8 pb-5 border-b-2 border-[#b8860b]">
            <h1 className="company-name text-2xl md:text-4xl font-bold text-[#8b7a2b] m-0">
              {data.companyName || "Company Name"}
            </h1>
            <p className="company-address text-sm text-[#666] my-1">
              {data.companyAddress || "Company Address"}
            </p>
            <p className="company-email text-sm text-[#666] my-1">
              Email: {data.companyEmail || "company@email.com"}
            </p>
          </div>

          {/* To Section */}
          <div className="letter-to mb-8 text-base">
            <p className="my-1.5">To,</p>
            <p className="my-1.5 font-bold">
              Name of Employee: {data.employeeName || "_____________________"}
            </p>
            <p className="my-1.5">
              Address: {data.employeeAddress || "_____________________________"}
            </p>
          </div>

          {/* Subject */}
          <h2 className="letter-subject text-lg md:text-xl text-[#8b7a2b] font-bold underline mb-8">
            Subject: Appointment & Joining Confirmation Letter
          </h2>

          {/* Body */}
          <div className="letter-body text-sm md:text-base leading-relaxed text-justify">
            <p className="mb-5">
              Dear Mr/Ms: {data.employeeName || "_______________"}
            </p>

            <p className="mb-4">
              We are pleased to offer the position of{" "}
              <span className="font-bold">
                {data.position || "____________"}
              </span>{" "}
              at {data.companyName}. You are required to join on{" "}
              <span className="font-bold">{formatDate(data.joiningDate)}</span>.
            </p>

            {data.additionalTasks && (
              <p className="mb-4">
                Any additional tasks: {data.additionalTasks}
              </p>
            )}

            <p className="mb-4">
              Your monthly salary will be Rs.{" "}
              <span className="font-bold">
                {data.monthlySalary > 0
                  ? formatCurrency(data.monthlySalary)
                  : "________"}
              </span>{" "}
              (in words:{" "}
              <span className="font-bold">
                {data.monthlySalary > 0
                  ? numberToWords(data.monthlySalary)
                  : "____________"}
              </span>
              )
            </p>

            {data.workingHoursDescription && (
              <p className="mb-4">
                Your working hours will (in words:{" "}
                {data.workingHoursDescription}).
              </p>
            )}

            <p className="mb-4">
              Your working hours will: From: {formatTime(data.workingHoursFrom)}{" "}
              to {formatTime(data.workingHoursTo)}
            </p>

            <p className="mb-4">
              Weekly Off: {data.weeklyOff1 || "____________"}
              {data.weeklyOff2 && ` | Weekly Off: ${data.weeklyOff2}`}
            </p>

            <p className="mb-8">
              You will be under your probation period of{" "}
              <span className="font-bold">{data.probationMonths || "_"}</span>{" "}
              months from date of joining.
            </p>
          </div>

          {/* Closing */}
          <div className="letter-closing mt-12">
            <p className="my-1.5">Sincerely,</p>
            <p className="my-1.5 font-bold">Authorized Signatory</p>
            <p className="my-1.5 font-bold">{data.companyName}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
