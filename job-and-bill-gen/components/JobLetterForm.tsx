"use client";

import { JobLetterData } from "../app/types";

interface JobLetterFormProps {
  formData: JobLetterData;
  onChange: (data: JobLetterData) => void;
}

export default function JobLetterForm({
  formData,
  onChange,
}: JobLetterFormProps) {
  const handleChange = (field: keyof JobLetterData, value: string | number) => {
    onChange({ ...formData, [field]: value });
  };

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

  return (
    <div className="form-container space-y-8">
      {/* Company Information */}
      <div className="space-y-4">
        <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider border-b border-white/10 pb-2 mb-4">
          Company Information
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="form-group md:col-span-1">
            <label className="block text-xs font-medium text-slate-400 mb-1.5 ml-1">
              Company Name
            </label>
            <input
              type="text"
              id="companyName"
              value={formData.companyName}
              onChange={(e) => handleChange("companyName", e.target.value)}
              placeholder="Enter company name"
              className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition-all placeholder:text-slate-600"
            />
          </div>
          <div className="form-group md:col-span-1">
            <label className="block text-xs font-medium text-slate-400 mb-1.5 ml-1">
              Company Address
            </label>
            <input
              type="text"
              id="companyAddress"
              value={formData.companyAddress}
              onChange={(e) => handleChange("companyAddress", e.target.value)}
              placeholder="Enter company address"
              className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition-all placeholder:text-slate-600"
            />
          </div>
          <div className="form-group md:col-span-2">
            <label className="block text-xs font-medium text-slate-400 mb-1.5 ml-1">
              Company Email
            </label>
            <input
              type="email"
              id="companyEmail"
              value={formData.companyEmail}
              onChange={(e) => handleChange("companyEmail", e.target.value)}
              placeholder="Enter company email"
              className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition-all placeholder:text-slate-600"
            />
          </div>
        </div>
      </div>

      {/* Employee Information */}
      <div className="space-y-4">
        <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider border-b border-white/10 pb-2 mb-4">
          Employee Information
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="form-group">
            <label className="block text-xs font-medium text-slate-400 mb-1.5 ml-1">
              Employee Name *
            </label>
            <input
              type="text"
              id="employeeName"
              value={formData.employeeName}
              onChange={(e) => handleChange("employeeName", e.target.value)}
              placeholder="Enter employee name"
              required
              className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition-all placeholder:text-slate-600"
            />
          </div>
          <div className="form-group">
            <label className="block text-xs font-medium text-slate-400 mb-1.5 ml-1">
              Position / Designation *
            </label>
            <input
              type="text"
              id="position"
              value={formData.position}
              onChange={(e) => handleChange("position", e.target.value)}
              placeholder="e.g., Sales Executive"
              required
              className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition-all placeholder:text-slate-600"
            />
          </div>
          <div className="form-group md:col-span-2">
            <label className="block text-xs font-medium text-slate-400 mb-1.5 ml-1">
              Employee Address
            </label>
            <input
              type="text"
              id="employeeAddress"
              value={formData.employeeAddress}
              onChange={(e) => handleChange("employeeAddress", e.target.value)}
              placeholder="Enter employee address"
              className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition-all placeholder:text-slate-600"
            />
          </div>
        </div>
      </div>

      {/* Job Details */}
      <div className="space-y-4">
        <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider border-b border-white/10 pb-2 mb-4">
          Job Details
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="form-group">
            <label className="block text-xs font-medium text-slate-400 mb-1.5 ml-1">
              Joining Date *
            </label>
            <input
              type="date"
              id="joiningDate"
              value={formData.joiningDate}
              onChange={(e) => handleChange("joiningDate", e.target.value)}
              required
              className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition-all text-slate-200"
            />
          </div>
          <div className="form-group">
            <label className="block text-xs font-medium text-slate-400 mb-1.5 ml-1">
              Monthly Salary (₹) *
            </label>
            <input
              type="number"
              id="monthlySalary"
              value={formData.monthlySalary || ""}
              onChange={(e) =>
                handleChange("monthlySalary", parseInt(e.target.value) || 0)
              }
              placeholder="e.g., 25000"
              min="0"
              required
              className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition-all placeholder:text-slate-600"
            />
          </div>
          <div className="form-group">
            <label className="block text-xs font-medium text-slate-400 mb-1.5 ml-1">
              Probation Period (Months)
            </label>
            <input
              type="number"
              id="probationMonths"
              value={formData.probationMonths || ""}
              onChange={(e) =>
                handleChange("probationMonths", parseInt(e.target.value) || 0)
              }
              placeholder="e.g., 3"
              min="0"
              className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition-all placeholder:text-slate-600"
            />
          </div>
          <div className="form-group">
            <label className="block text-xs font-medium text-slate-400 mb-1.5 ml-1">
              Additional Tasks
            </label>
            <input
              type="text"
              id="additionalTasks"
              value={formData.additionalTasks}
              onChange={(e) => handleChange("additionalTasks", e.target.value)}
              placeholder="e.g., Whatsapp Handling"
              className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition-all placeholder:text-slate-600"
            />
          </div>
        </div>
      </div>

      {/* Working Hours */}
      <div className="space-y-4">
        <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider border-b border-white/10 pb-2 mb-4">
          Working Hours
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="form-group md:col-span-2">
            <label className="block text-xs font-medium text-slate-400 mb-1.5 ml-1">
              Working Hours Description
            </label>
            <input
              type="text"
              id="workingHoursDescription"
              value={formData.workingHoursDescription}
              onChange={(e) =>
                handleChange("workingHoursDescription", e.target.value)
              }
              placeholder="e.g., 9 hours per day"
              className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition-all placeholder:text-slate-600"
            />
          </div>

          {/* From Time Selector */}
          <div className="form-group">
            <label className="block text-xs font-medium text-slate-400 mb-1.5 ml-1">
              From Time
            </label>
            <div className="flex gap-2 items-center bg-slate-900/50 border border-white/10 rounded-xl p-2 px-3">
              <select
                className="bg-transparent text-white text-sm outline-none cursor-pointer"
                id="workingHoursFromHour"
                value={formData.workingHoursFrom.split(":")[0] || "09"}
                onChange={(e) => {
                  const minutes =
                    formData.workingHoursFrom.split(":")[1] || "00";
                  const period =
                    formData.workingHoursFrom.split(" ")[1] || "AM";
                  handleChange(
                    "workingHoursFrom",
                    `${e.target.value}:${minutes} ${period}`,
                  );
                }}
              >
                {hours.map((hour) => (
                  <option key={hour} value={hour} className="text-black">
                    {hour}
                  </option>
                ))}
              </select>
              <span className="text-slate-500">:</span>
              <select
                className="bg-transparent text-white text-sm outline-none cursor-pointer"
                id="workingHoursFromMinute"
                value={
                  formData.workingHoursFrom.split(":")[1]?.split(" ")[0] || "00"
                }
                onChange={(e) => {
                  const hour = formData.workingHoursFrom.split(":")[0] || "09";
                  const period =
                    formData.workingHoursFrom.split(" ")[1] || "AM";
                  handleChange(
                    "workingHoursFrom",
                    `${hour}:${e.target.value} ${period}`,
                  );
                }}
              >
                {minutes.map((min) => (
                  <option key={min} value={min} className="text-black">
                    {min}
                  </option>
                ))}
              </select>
              <select
                className="bg-transparent text-amber-500 font-bold text-sm outline-none cursor-pointer ml-auto"
                id="workingHoursFromPeriod"
                value={formData.workingHoursFrom.split(" ")[1] || "AM"}
                onChange={(e) => {
                  const timePart =
                    formData.workingHoursFrom.split(" ")[0] || "09:00";
                  handleChange(
                    "workingHoursFrom",
                    `${timePart} ${e.target.value}`,
                  );
                }}
              >
                {periods.map((period) => (
                  <option key={period} value={period} className="text-black">
                    {period}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* To Time Selector */}
          <div className="form-group">
            <label className="block text-xs font-medium text-slate-400 mb-1.5 ml-1">
              To Time
            </label>
            <div className="flex gap-2 items-center bg-slate-900/50 border border-white/10 rounded-xl p-2 px-3">
              <select
                className="bg-transparent text-white text-sm outline-none cursor-pointer"
                id="workingHoursToHour"
                value={formData.workingHoursTo.split(":")[0] || "06"}
                onChange={(e) => {
                  const minutes = formData.workingHoursTo.split(":")[1] || "00";
                  const period = formData.workingHoursTo.split(" ")[1] || "PM";
                  handleChange(
                    "workingHoursTo",
                    `${e.target.value}:${minutes} ${period}`,
                  );
                }}
              >
                {hours.map((hour) => (
                  <option key={hour} value={hour} className="text-black">
                    {hour}
                  </option>
                ))}
              </select>
              <span className="text-slate-500">:</span>
              <select
                className="bg-transparent text-white text-sm outline-none cursor-pointer"
                id="workingHoursToMinute"
                value={
                  formData.workingHoursTo.split(":")[1]?.split(" ")[0] || "00"
                }
                onChange={(e) => {
                  const hour = formData.workingHoursTo.split(":")[0] || "06";
                  const period = formData.workingHoursTo.split(" ")[1] || "PM";
                  handleChange(
                    "workingHoursTo",
                    `${hour}:${e.target.value} ${period}`,
                  );
                }}
              >
                {minutes.map((min) => (
                  <option key={min} value={min} className="text-black">
                    {min}
                  </option>
                ))}
              </select>
              <select
                className="bg-transparent text-amber-500 font-bold text-sm outline-none cursor-pointer ml-auto"
                id="workingHoursToPeriod"
                value={formData.workingHoursTo.split(" ")[1] || "PM"}
                onChange={(e) => {
                  const timePart =
                    formData.workingHoursTo.split(" ")[0] || "06:00";
                  handleChange(
                    "workingHoursTo",
                    `${timePart} ${e.target.value}`,
                  );
                }}
              >
                {periods.map((period) => (
                  <option key={period} value={period} className="text-black">
                    {period}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label
              className="block text-xs font-medium text-slate-400 mb-1.5 ml-1"
              htmlFor="weeklyOff1"
            >
              Weekly Off (Day 1)
            </label>
            <select
              id="weeklyOff1"
              value={formData.weeklyOff1}
              onChange={(e) => handleChange("weeklyOff1", e.target.value)}
              className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition-all text-slate-200 cursor-pointer"
            >
              {weekDays.map((day) => (
                <option key={day} value={day} className="text-black">
                  {day}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label
              className="block text-xs font-medium text-slate-400 mb-1.5 ml-1"
              htmlFor="weeklyOff2"
            >
              Weekly Off (Day 2)
            </label>
            <select
              id="weeklyOff2"
              value={formData.weeklyOff2}
              onChange={(e) => handleChange("weeklyOff2", e.target.value)}
              className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition-all text-slate-200 cursor-pointer"
            >
              <option value="" className="text-black">
                None
              </option>
              {weekDays.map((day) => (
                <option key={day} value={day} className="text-black">
                  {day}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}
