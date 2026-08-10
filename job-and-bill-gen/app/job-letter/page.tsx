"use client";

import React, { useState, Suspense } from "react";
import { useStore, JobLetterData, defaultFormData } from "@/app/store/useStore";
import { Button } from "@/components/ui/button";
import {
  Save,
  Eye,
  Zap,
  ArrowRight,
  ArrowLeft,
  Lightbulb,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useRouter, useSearchParams } from "next/navigation";
import { numberToWords, formatCurrency } from "@/app/utils/numberToWords";
import { generateJobLetterPDF } from "@/app/utils/generatePDF";

const weekDays = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const hours = Array.from({ length: 12 }, (_, i) =>
  (i + 1).toString().padStart(2, "0"),
);
const minutes = ["00", "15", "30", "45"];
const periods = ["AM", "PM"];

const steps = [
  { id: 1, label: "Details", sub: "Company & Employee Info" },
  { id: 2, label: "Job Info", sub: "Salary, Hours & Terms" },
  { id: 3, label: "Preview", sub: "Review & Download" },
];

function JobLetterPageContent() {
  const { companyDetails, addDocument, updateDocument, getDocument } =
    useStore();
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("id");

  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<JobLetterData>(() => {
    if (editId) {
      const doc = getDocument(editId);
      if (doc && doc.type === "job-letter") {
        return doc.data as JobLetterData;
      }
    }
    return {
      ...defaultFormData,
      companyName: companyDetails.name || defaultFormData.companyName,
      companyEmail: companyDetails.email || defaultFormData.companyEmail,
      companyAddress: companyDetails.address || defaultFormData.companyAddress,
    };
  });

  const handleChange = <K extends keyof JobLetterData>(
    field: K,
    value: JobLetterData[K],
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = (status: "draft" | "pending") => {
    if (editId) {
      updateDocument(editId, {
        title: `${formData.employeeName || "Unnamed"} - Job Letter`,
        clientName: formData.employeeName || "Unknown Employee",
        date: new Date().toISOString(),
        status,
        data: formData,
      });
    } else {
      const id = Math.random().toString(36).substr(2, 9);
      addDocument({
        id,
        type: "job-letter",
        title: `${formData.employeeName || "Unnamed"} - Job Letter`,
        clientName: formData.employeeName || "Unknown Employee",
        date: new Date().toISOString(),
        status,
        data: formData,
      });
    }
    router.push("/dashboard");
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "_________";
    return new Date(dateString).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  };

  // Completeness calculation
  const completeness = (() => {
    const fields = [
      formData.companyName,
      formData.companyAddress,
      formData.companyEmail,
      formData.employeeName,
      formData.position,
      formData.joiningDate,
      formData.monthlySalary > 0 ? "filled" : "",
      formData.workingHoursFrom,
      formData.workingHoursTo,
      formData.weeklyOff1,
    ];
    const filled = fields.filter(Boolean).length;
    return Math.round((filled / fields.length) * 100);
  })();

  const inputClass =
    "w-full bg-[#0a1628] border border-slate-700/50 rounded-lg px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30 outline-none transition-all";
  const labelClass = "block text-sm font-medium text-slate-300 mb-2";
  const selectClass =
    "w-full bg-[#0a1628] border border-slate-700/50 rounded-lg px-4 py-3 text-sm text-white focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30 outline-none cursor-pointer transition-all";

  const proTips = [
    "Adding a professional title helps the recipient understand your role immediately.",
    "Include the exact salary and joining date for a legally complete letter.",
    "Review working hours and weekly offs before generating.",
  ];

  return (
    <div className="flex-1 h-[calc(100vh-64px)] overflow-hidden flex flex-col">
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[1400px] mx-auto p-6 lg:p-8">
          <div className="flex flex-col lg:flex-row gap-8">
            {/* Left Sidebar - Progress Stepper */}
            <div className="lg:w-[240px] shrink-0">
              <div className="bg-[#0d1b2a] rounded-2xl p-6 border border-slate-800/50 sticky top-8">
                <p className="text-amber-500 text-xs font-bold tracking-widest uppercase mb-1">
                  Progress
                </p>
                <h2 className="text-xl font-bold text-white mb-6">
                  {editId ? "Edit Letter" : "Create Letter"}
                </h2>

                <div className="space-y-6">
                  {steps.map((step) => (
                    <button
                      key={step.id}
                      onClick={() => setCurrentStep(step.id)}
                      className="flex items-start gap-3 w-full text-left group"
                    >
                      <div
                        className={cn(
                          "w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0 transition-all",
                          currentStep === step.id
                            ? "bg-amber-500 text-black"
                            : currentStep > step.id
                              ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                              : "bg-slate-800 text-slate-500 border border-slate-700",
                        )}
                      >
                        {currentStep > step.id ? <Check size={16} /> : step.id}
                      </div>
                      <div>
                        <p
                          className={cn(
                            "font-semibold text-sm transition-colors",
                            currentStep === step.id
                              ? "text-white"
                              : "text-slate-500",
                          )}
                        >
                          {step.label}
                        </p>
                        <p className="text-xs text-slate-600">{step.sub}</p>
                      </div>
                    </button>
                  ))}
                </div>

                {/* Pro Tip */}
                <div className="mt-8 bg-[#1a1a2e] rounded-xl p-4 border border-slate-800/50">
                  <div className="flex items-center gap-2 mb-2">
                    <Lightbulb className="h-4 w-4 text-amber-500" />
                    <span className="text-amber-500 text-xs font-bold uppercase">
                      Pro Tip
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    {proTips[currentStep - 1]}
                  </p>
                </div>
              </div>
            </div>

            {/* Center - Form */}
            <div className="flex-1 min-w-0">
              {currentStep === 1 && (
                <div className="space-y-8">
                  {/* Company Details */}
                  <div>
                    <h3 className="text-2xl font-bold text-white mb-1">
                      Company Details
                    </h3>
                    <p className="text-slate-400 text-sm mb-6">
                      Enter the company information for the letter header.
                    </p>
                    <div className="space-y-4">
                      <div>
                        <label className={labelClass}>Company Name</label>
                        <input
                          type="text"
                          value={formData.companyName}
                          onChange={(e) =>
                            handleChange("companyName", e.target.value)
                          }
                          placeholder="Your Company Name"
                          className={inputClass}
                        />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className={labelClass}>Company Email</label>
                          <input
                            type="email"
                            value={formData.companyEmail}
                            onChange={(e) =>
                              handleChange("companyEmail", e.target.value)
                            }
                            placeholder="email@company.com"
                            className={inputClass}
                          />
                        </div>
                        <div>
                          <label className={labelClass}>Company Address</label>
                          <input
                            type="text"
                            value={formData.companyAddress}
                            onChange={(e) =>
                              handleChange("companyAddress", e.target.value)
                            }
                            placeholder="123 Business St, City"
                            className={inputClass}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Employee Details */}
                  <div>
                    <h3 className="text-xl font-bold text-white mb-1">
                      Employee Details
                    </h3>
                    <p className="text-slate-400 text-sm mb-6">
                      Information about the employee being offered the position.
                    </p>
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className={labelClass}>Employee Name</label>
                          <input
                            type="text"
                            value={formData.employeeName}
                            onChange={(e) =>
                              handleChange("employeeName", e.target.value)
                            }
                            placeholder="Full Name"
                            className={inputClass}
                          />
                        </div>
                        <div>
                          <label className={labelClass}>
                            Position / Designation
                          </label>
                          <input
                            type="text"
                            value={formData.position}
                            onChange={(e) =>
                              handleChange("position", e.target.value)
                            }
                            placeholder="e.g., Sales Executive"
                            className={inputClass}
                          />
                        </div>
                      </div>
                      <div>
                        <label className={labelClass}>Employee Address</label>
                        <input
                          type="text"
                          value={formData.employeeAddress}
                          onChange={(e) =>
                            handleChange("employeeAddress", e.target.value)
                          }
                          placeholder="Employee Address"
                          className={inputClass}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {currentStep === 2 && (
                <div className="space-y-8">
                  {/* Job Details */}
                  <div>
                    <h3 className="text-2xl font-bold text-white mb-1">
                      Job Details
                    </h3>
                    <p className="text-slate-400 text-sm mb-6">
                      Specify joining date, salary, and probation terms.
                    </p>
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className={labelClass}>Joining Date</label>
                          <input
                            type="date"
                            value={formData.joiningDate}
                            onChange={(e) =>
                              handleChange("joiningDate", e.target.value)
                            }
                            className={inputClass}
                          />
                        </div>
                        <div>
                          <label className={labelClass}>
                            Monthly Salary (₹)
                          </label>
                          <input
                            type="number"
                            value={formData.monthlySalary || ""}
                            onChange={(e) =>
                              handleChange(
                                "monthlySalary",
                                parseInt(e.target.value) || 0,
                              )
                            }
                            placeholder="e.g., 25000"
                            min="0"
                            className={inputClass}
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className={labelClass}>
                            Probation Period (Months)
                          </label>
                          <input
                            type="number"
                            value={formData.probationMonths || ""}
                            onChange={(e) =>
                              handleChange(
                                "probationMonths",
                                parseInt(e.target.value) || 0,
                              )
                            }
                            placeholder="e.g., 3"
                            min="0"
                            className={inputClass}
                          />
                        </div>
                        <div>
                          <label className={labelClass}>Additional Tasks</label>
                          <input
                            type="text"
                            value={formData.additionalTasks}
                            onChange={(e) =>
                              handleChange("additionalTasks", e.target.value)
                            }
                            placeholder="e.g., WhatsApp Handling"
                            className={inputClass}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Working Hours */}
                  <div>
                    <h3 className="text-xl font-bold text-white mb-1">
                      Working Hours
                    </h3>
                    <p className="text-slate-400 text-sm mb-6">
                      Define the working schedule and weekly offs.
                    </p>
                    <div className="space-y-4">
                      <div>
                        <label className={labelClass}>
                          Working Hours Description
                        </label>
                        <input
                          type="text"
                          value={formData.workingHoursDescription}
                          onChange={(e) =>
                            handleChange(
                              "workingHoursDescription",
                              e.target.value,
                            )
                          }
                          placeholder="e.g., 9 hours per day"
                          className={inputClass}
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* From Time */}
                        <div>
                          <label className={labelClass}>From Time</label>
                          <div className="flex gap-2 items-center bg-[#0a1628] border border-slate-700/50 rounded-lg p-3">
                            <select
                              className="bg-transparent text-white text-sm outline-none cursor-pointer flex-1"
                              value={
                                formData.workingHoursFrom.split(":")[0] || "09"
                              }
                              onChange={(e) => {
                                const parts =
                                  formData.workingHoursFrom.split(/[: ]/);
                                handleChange(
                                  "workingHoursFrom",
                                  `${e.target.value}:${parts[1] || "00"} ${parts[2] || "AM"}`,
                                );
                              }}
                            >
                              {hours.map((h) => (
                                <option
                                  key={h}
                                  value={h}
                                  className="bg-slate-900"
                                >
                                  {h}
                                </option>
                              ))}
                            </select>
                            <span className="text-slate-500">:</span>
                            <select
                              className="bg-transparent text-white text-sm outline-none cursor-pointer flex-1"
                              value={
                                formData.workingHoursFrom
                                  .split(":")[1]
                                  ?.split(" ")[0] || "00"
                              }
                              onChange={(e) => {
                                const parts =
                                  formData.workingHoursFrom.split(/[: ]/);
                                handleChange(
                                  "workingHoursFrom",
                                  `${parts[0] || "09"}:${e.target.value} ${parts[2] || "AM"}`,
                                );
                              }}
                            >
                              {minutes.map((m) => (
                                <option
                                  key={m}
                                  value={m}
                                  className="bg-slate-900"
                                >
                                  {m}
                                </option>
                              ))}
                            </select>
                            <select
                              className="bg-transparent text-amber-500 font-bold text-sm outline-none cursor-pointer"
                              value={
                                formData.workingHoursFrom.split(" ")[1] || "AM"
                              }
                              onChange={(e) => {
                                const timePart =
                                  formData.workingHoursFrom.split(" ")[0] ||
                                  "09:00";
                                handleChange(
                                  "workingHoursFrom",
                                  `${timePart} ${e.target.value}`,
                                );
                              }}
                            >
                              {periods.map((p) => (
                                <option
                                  key={p}
                                  value={p}
                                  className="bg-slate-900"
                                >
                                  {p}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        {/* To Time */}
                        <div>
                          <label className={labelClass}>To Time</label>
                          <div className="flex gap-2 items-center bg-[#0a1628] border border-slate-700/50 rounded-lg p-3">
                            <select
                              className="bg-transparent text-white text-sm outline-none cursor-pointer flex-1"
                              value={
                                formData.workingHoursTo.split(":")[0] || "06"
                              }
                              onChange={(e) => {
                                const parts =
                                  formData.workingHoursTo.split(/[: ]/);
                                handleChange(
                                  "workingHoursTo",
                                  `${e.target.value}:${parts[1] || "00"} ${parts[2] || "PM"}`,
                                );
                              }}
                            >
                              {hours.map((h) => (
                                <option
                                  key={h}
                                  value={h}
                                  className="bg-slate-900"
                                >
                                  {h}
                                </option>
                              ))}
                            </select>
                            <span className="text-slate-500">:</span>
                            <select
                              className="bg-transparent text-white text-sm outline-none cursor-pointer flex-1"
                              value={
                                formData.workingHoursTo
                                  .split(":")[1]
                                  ?.split(" ")[0] || "00"
                              }
                              onChange={(e) => {
                                const parts =
                                  formData.workingHoursTo.split(/[: ]/);
                                handleChange(
                                  "workingHoursTo",
                                  `${parts[0] || "06"}:${e.target.value} ${parts[2] || "PM"}`,
                                );
                              }}
                            >
                              {minutes.map((m) => (
                                <option
                                  key={m}
                                  value={m}
                                  className="bg-slate-900"
                                >
                                  {m}
                                </option>
                              ))}
                            </select>
                            <select
                              className="bg-transparent text-amber-500 font-bold text-sm outline-none cursor-pointer"
                              value={
                                formData.workingHoursTo.split(" ")[1] || "PM"
                              }
                              onChange={(e) => {
                                const timePart =
                                  formData.workingHoursTo.split(" ")[0] ||
                                  "06:00";
                                handleChange(
                                  "workingHoursTo",
                                  `${timePart} ${e.target.value}`,
                                );
                              }}
                            >
                              {periods.map((p) => (
                                <option
                                  key={p}
                                  value={p}
                                  className="bg-slate-900"
                                >
                                  {p}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>

                      {/* Weekly Offs */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className={labelClass}>
                            Weekly Off (Day 1)
                          </label>
                          <select
                            value={formData.weeklyOff1}
                            onChange={(e) =>
                              handleChange("weeklyOff1", e.target.value)
                            }
                            className={selectClass}
                          >
                            {weekDays.map((day) => (
                              <option
                                key={day}
                                value={day}
                                className="bg-slate-900"
                              >
                                {day}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className={labelClass}>
                            Weekly Off (Day 2)
                          </label>
                          <select
                            value={formData.weeklyOff2}
                            onChange={(e) =>
                              handleChange("weeklyOff2", e.target.value)
                            }
                            className={selectClass}
                          >
                            <option value="" className="bg-slate-900">
                              None
                            </option>
                            {weekDays.map((day) => (
                              <option
                                key={day}
                                value={day}
                                className="bg-slate-900"
                              >
                                {day}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {currentStep === 3 && (
                <div>
                  <h3 className="text-2xl font-bold text-white mb-1">
                    Preview
                  </h3>
                  <p className="text-slate-400 text-sm mb-6">
                    Review the generated job letter before saving or
                    downloading.
                  </p>
                  {/* Full preview at this step */}
                  <div className="bg-white rounded-xl shadow-2xl overflow-hidden">
                    <div className="p-8 md:p-12 text-black font-serif text-sm">
                      <div className="text-center mb-8 pb-5 border-b-2 border-[#b8860b]">
                        <h1 className="text-2xl font-bold text-[#8b7a2b] m-0">
                          {formData.companyName || "Company Name"}
                        </h1>
                        <p className="text-xs text-[#666] my-1">
                          {formData.companyAddress || "Company Address"}
                        </p>
                        <p className="text-xs text-[#666] my-1">
                          Email: {formData.companyEmail || "company@email.com"}
                        </p>
                      </div>

                      <div className="mb-8 text-sm">
                        <p className="my-1.5">To,</p>
                        <p className="my-1.5 font-bold">
                          Name of Employee:{" "}
                          {formData.employeeName || "_____________________"}
                        </p>
                        <p className="my-1.5">
                          Address:{" "}
                          {formData.employeeAddress ||
                            "_____________________________"}
                        </p>
                      </div>

                      <h2 className="text-base text-[#8b7a2b] font-bold underline mb-8">
                        Subject: Appointment & Joining Confirmation Letter
                      </h2>

                      <div className="text-xs leading-relaxed text-justify">
                        <p className="mb-5">
                          Dear Mr/Ms:{" "}
                          {formData.employeeName || "_______________"}
                        </p>
                        <p className="mb-4">
                          We are pleased to offer the position of{" "}
                          <strong>{formData.position || "____________"}</strong>{" "}
                          at {formData.companyName}. You are required to join on{" "}
                          <strong>{formatDate(formData.joiningDate)}</strong>.
                        </p>
                        {formData.additionalTasks && (
                          <p className="mb-4">
                            Any additional tasks: {formData.additionalTasks}
                          </p>
                        )}
                        <p className="mb-4">
                          Your monthly salary will be Rs.{" "}
                          <strong>
                            {formData.monthlySalary > 0
                              ? formatCurrency(formData.monthlySalary)
                              : "________"}
                          </strong>{" "}
                          (in words:{" "}
                          <strong>
                            {formData.monthlySalary > 0
                              ? numberToWords(formData.monthlySalary)
                              : "____________"}
                          </strong>
                          )
                        </p>
                        {formData.workingHoursDescription && (
                          <p className="mb-4">
                            Your working hours will (in words:{" "}
                            {formData.workingHoursDescription}).
                          </p>
                        )}
                        <p className="mb-4">
                          Your working hours will: From:{" "}
                          {formData.workingHoursFrom || "_________"} to{" "}
                          {formData.workingHoursTo || "_________"}
                        </p>
                        <p className="mb-4">
                          Weekly Off: {formData.weeklyOff1 || "____________"}
                          {formData.weeklyOff2 &&
                            ` | Weekly Off: ${formData.weeklyOff2}`}
                        </p>
                        <p className="mb-8">
                          You will be under your probation period of{" "}
                          <strong>{formData.probationMonths || "_"}</strong>{" "}
                          months from date of joining.
                        </p>
                      </div>

                      <div className="mt-12">
                        <p className="my-1.5">Sincerely,</p>
                        <p className="my-1.5 font-bold">Authorized Signatory</p>
                        <p className="my-1.5 font-bold">
                          {formData.companyName}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Step Navigation */}
              <div className="flex justify-between items-center mt-8 pt-6 border-t border-slate-800/50">
                <Button
                  variant="ghost"
                  className="text-slate-400 hover:text-white"
                  onClick={() =>
                    currentStep > 1
                      ? setCurrentStep(currentStep - 1)
                      : router.push("/dashboard")
                  }
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  {currentStep > 1 ? "Back" : "Cancel"}
                </Button>
                {currentStep < 3 ? (
                  <Button
                    className="bg-amber-500 hover:bg-amber-600 text-black font-bold px-8"
                    onClick={() => setCurrentStep(currentStep + 1)}
                  >
                    Next Step
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                ) : (
                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      className="border-slate-700 bg-slate-800 text-white hover:bg-slate-700"
                      onClick={() => handleSave("draft")}
                    >
                      <Save className="mr-2 h-4 w-4" /> Save Draft
                    </Button>
                    <Button
                      className="bg-amber-500 hover:bg-amber-600 text-black font-bold"
                      onClick={() => {
                        handleSave("pending");
                        generateJobLetterPDF(formData);
                      }}
                    >
                      <Zap className="mr-2 h-4 w-4 fill-current" /> Generate
                      Letter
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* Right Panel - Live Preview */}
            <div className="hidden xl:block w-[300px] shrink-0">
              <div className="sticky top-8 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Eye className="h-4 w-4 text-amber-500" />
                    <span className="text-sm font-bold text-white">
                      Live Preview
                    </span>
                  </div>
                  <span className="text-xs bg-slate-800 text-slate-400 px-2 py-1 rounded">
                    A4 Document
                  </span>
                </div>

                {/* Mini Preview Card */}
                <div className="bg-white rounded-xl shadow-lg overflow-hidden">
                  <div
                    className="p-4 text-black font-serif"
                    style={{ fontSize: "6px" }}
                  >
                    <div className="text-center mb-2 pb-1 border-b border-[#b8860b]">
                      <p
                        className="font-bold text-[#8b7a2b]"
                        style={{ fontSize: "8px" }}
                      >
                        {formData.companyName || "Company Name"}
                      </p>
                      <p className="text-[#999]" style={{ fontSize: "5px" }}>
                        {formData.companyAddress || "Address"}
                      </p>
                    </div>
                    <p className="mb-1">To,</p>
                    <p className="font-bold mb-1">
                      {formData.employeeName || "Employee Name"}
                    </p>
                    <p
                      className="text-[#8b7a2b] font-bold underline mb-2"
                      style={{ fontSize: "6px" }}
                    >
                      Subject: Appointment Letter
                    </p>
                    <div className="space-y-1 text-[#444]">
                      <p>Position: {formData.position || "___"}</p>
                      <p>
                        Salary: ₹
                        {formData.monthlySalary > 0
                          ? formData.monthlySalary.toLocaleString()
                          : "___"}
                      </p>
                      <p>Joining: {formData.joiningDate || "___"}</p>
                    </div>
                  </div>
                </div>

                {/* Completeness */}
                <div className="bg-[#0d1b2a] rounded-xl p-4 border border-slate-800/50">
                  <div className="flex justify-between text-xs mb-2">
                    <span className="text-slate-400">Completeness</span>
                    <span className="text-white font-bold">
                      {completeness}%
                    </span>
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-1.5">
                    <div
                      className="h-1.5 rounded-full transition-all duration-500"
                      style={{
                        width: `${completeness}%`,
                        background:
                          completeness < 50
                            ? "#ef4444"
                            : completeness < 80
                              ? "#f59e0b"
                              : "#22c55e",
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function JobLetterPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen"><div className="text-white">Loading...</div></div>}>
      <JobLetterPageContent />
    </Suspense>
  );
}
