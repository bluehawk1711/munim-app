"use client";

import React, { useState, Suspense } from "react";
import { useStore, BillData, defaultBillData } from "@/app/store/useStore";
import { Button } from "@/components/ui/button";
import { Plus, Save, Eye, Zap, FileText, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRouter, useSearchParams } from "next/navigation";
import { generateBillPDF } from "@/app/utils/generatePDF";

function InvoicePageContent() {
  const {
    companyDetails,
    addDocument,
    updateDocument,
    getDocument,
    sidebarCollapsed,
  } = useStore();
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("id");

  const [data, setData] = useState<BillData>(() => {
    if (editId) {
      const doc = getDocument(editId);
      if (doc && doc.type === "invoice") {
        return doc.data as BillData;
      }
    }
    return {
      ...defaultBillData,
      shopDetails: {
        ...defaultBillData.shopDetails,
        name: companyDetails.name || defaultBillData.shopDetails.name,
        email: companyDetails.email || defaultBillData.shopDetails.email,
        address: companyDetails.address || defaultBillData.shopDetails.address,
      },
    };
  });

  const [notes, setNotes] = useState("");
  const [activeBillTab, setActiveBillTab] = useState<"bill1" | "bill2">(
    "bill1",
  );

  const currentBill =
    activeBillTab === "bill1" ? data : data.secondBill || data;

  const handleBillChange = (field: string, value: unknown) => {
    if (activeBillTab === "bill1") {
      setData((prev) => ({ ...prev, [field]: value }));
    } else {
      setData((prev) => ({
        ...prev,
        secondBill: { ...(prev.secondBill || prev), [field]: value },
      }));
    }
  };

  const handleSettingsChange = (field: string, value: unknown) => {
    setData((prev) => ({
      ...prev,
      settings: { ...prev.settings, [field]: value },
    }));
  };

  const handleShopChange = (field: string, value: unknown) => {
    setData((prev) => ({
      ...prev,
      shopDetails: { ...prev.shopDetails, [field]: value },
    }));
  };

  const handleItemChange = (
    index: number,
    field: string,
    value: string | number,
  ) => {
    const newItems = [...currentBill.items];
    newItems[index] = { ...newItems[index], [field]: value };
    handleBillChange("items", newItems);
  };

  const addItem = () => {
    handleBillChange("items", [
      ...currentBill.items,
      { productName: "", description: "", quantity: 1, price: 0 },
    ]);
  };

  const removeItem = (index: number) => {
    const newItems = currentBill.items.filter((_, i) => i !== index);
    handleBillChange("items", newItems);
  };

  const subtotal = currentBill.items.reduce(
    (acc, item) => acc + item.quantity * item.price,
    0,
  );
  const deliveryCharge = currentBill.deliveryCharge || 0;
  const totalDue = subtotal + deliveryCharge;

  const handleSave = (status: "draft" | "pending") => {
    if (editId) {
      updateDocument(editId, {
        title: `Invoice #${data.billNo}`,
        clientName: currentBill.customerName || "Unknown Client",
        date: new Date().toISOString(),
        status,
        amount: totalDue,
        data,
      });
    } else {
      const id = Math.random().toString(36).substr(2, 9);
      addDocument({
        id,
        type: "invoice",
        title: `Invoice #${data.billNo}`,
        clientName: currentBill.customerName || "Unknown Client",
        date: new Date().toISOString(),
        status,
        amount: totalDue,
        data,
      });
    }
    router.push("/dashboard");
  };

  const inputClass =
    "w-full bg-transparent border-b border-slate-700/50 px-1 py-2.5 text-sm text-white placeholder:text-slate-600 focus:border-amber-500/50 outline-none transition-all";
  const boxInputClass =
    "w-full bg-[#0a1628] border border-slate-700/50 rounded-lg px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30 outline-none transition-all";

  return (
    <div className="flex-1 h-[calc(100vh-64px)] overflow-hidden flex flex-col">
      <div className="flex-1 overflow-y-auto pb-24">
        <div className="max-w-[1100px] mx-auto p-6 lg:p-8">
          {/* Header */}
          <div className="bg-[#0d1b2a] rounded-2xl border border-slate-800/50 p-8 mb-8">
            <div className="flex justify-between items-start mb-2">
              <div className="flex items-center gap-3">
                <div className="bg-amber-500 rounded-lg p-2">
                  <FileText className="h-6 w-6 text-black" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-white">
                    {editId ? "Edit Invoice" : "New Invoice"}
                  </h1>
                  <p className="text-slate-400 text-sm mt-1">
                    Create a professional invoice in seconds.
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-amber-500 text-xs font-bold tracking-wider uppercase">
                  Invoice Number
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-slate-500">#</span>
                  <input
                    type="text"
                    value={currentBill.billNo}
                    onChange={(e) => handleBillChange("billNo", e.target.value)}
                    className="bg-transparent text-2xl font-bold text-white outline-none text-right w-48"
                    placeholder="INV-001"
                  />
                </div>
              </div>
            </div>

            {/* Bill Settings Row */}
            <div className="flex flex-wrap items-center gap-4 mt-6 pt-5 border-t border-slate-800/50">
              <div className="flex items-center gap-2">
                <label className="text-xs text-slate-400">Template:</label>
                <select
                  value={data.settings.template}
                  onChange={(e) =>
                    handleSettingsChange("template", e.target.value)
                  }
                  className="bg-[#0a1628] border border-slate-700/50 rounded-lg px-3 py-1.5 text-xs text-white outline-none cursor-pointer"
                >
                  <option value="jewellery" className="bg-slate-900">
                    Classic Jewellery
                  </option>
                  <option value="ecommerce" className="bg-slate-900">
                    Modern E-commerce
                  </option>
                </select>
              </div>

              {data.settings.template === "jewellery" && (
                <div className="flex items-center gap-2">
                  <label className="text-xs text-slate-400">Color:</label>
                  <button
                    onClick={() => handleSettingsChange("classicColor", "red")}
                    className={cn(
                      "w-6 h-6 rounded-full border-2 transition-all",
                      data.settings.classicColor === "red" ||
                        !data.settings.classicColor
                        ? "border-white scale-110 bg-red-600"
                        : "border-transparent bg-red-600/60",
                    )}
                  />
                  <button
                    onClick={() =>
                      handleSettingsChange("classicColor", "yellow")
                    }
                    className={cn(
                      "w-6 h-6 rounded-full border-2 transition-all",
                      data.settings.classicColor === "yellow"
                        ? "border-white scale-110 bg-yellow-500"
                        : "border-transparent bg-yellow-500/60",
                    )}
                  />
                </div>
              )}

              <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-400 ml-auto">
                <input
                  type="checkbox"
                  checked={data.settings.twoInOne}
                  onChange={(e) =>
                    handleSettingsChange("twoInOne", e.target.checked)
                  }
                  className="accent-amber-500"
                />
                2 in 1 Bill
              </label>

              {data.settings.twoInOne && (
                <div className="flex items-center gap-3 text-xs">
                  <label className="flex items-center gap-1 cursor-pointer text-slate-400">
                    <input
                      type="radio"
                      name="billMode"
                      checked={
                        data.settings.mode === "duplicate" ||
                        !data.settings.mode
                      }
                      onChange={() => handleSettingsChange("mode", "duplicate")}
                      className="accent-amber-500"
                    />
                    Duplicate
                  </label>
                  <label className="flex items-center gap-1 cursor-pointer text-slate-400">
                    <input
                      type="radio"
                      name="billMode"
                      checked={data.settings.mode === "distinct"}
                      onChange={() => handleSettingsChange("mode", "distinct")}
                      className="accent-amber-500"
                    />
                    Separate
                  </label>
                </div>
              )}
            </div>
          </div>

          {/* Bill Tabs for distinct mode */}
          {data.settings.twoInOne && data.settings.mode === "distinct" && (
            <div className="flex gap-2 mb-6">
              <button
                className={cn(
                  "px-5 py-2.5 rounded-lg font-medium text-sm transition-all",
                  activeBillTab === "bill1"
                    ? "bg-amber-500 text-black shadow-lg shadow-amber-500/20"
                    : "bg-slate-800/50 text-slate-400 hover:text-white border border-slate-700/50",
                )}
                onClick={() => setActiveBillTab("bill1")}
              >
                Bill 1
              </button>
              <button
                className={cn(
                  "px-5 py-2.5 rounded-lg font-medium text-sm transition-all",
                  activeBillTab === "bill2"
                    ? "bg-amber-500 text-black shadow-lg shadow-amber-500/20"
                    : "bg-slate-800/50 text-slate-400 hover:text-white border border-slate-700/50",
                )}
                onClick={() => setActiveBillTab("bill2")}
              >
                Bill 2
              </button>
            </div>
          )}

          {/* Bill From / Bill To / Invoice Details */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            {/* Bill From */}
            <div className="bg-[#0d1b2a] rounded-xl border border-slate-800/50 p-5 relative">
              <span className="absolute -top-2.5 left-4 bg-amber-500 text-black text-[10px] font-bold px-2 py-0.5 rounded">
                Bill From
              </span>
              <div className="space-y-3 mt-2">
                <input
                  type="text"
                  value={data.shopDetails.name}
                  onChange={(e) => handleShopChange("name", e.target.value)}
                  placeholder="Your Business Name"
                  className={cn(inputClass, "text-lg font-semibold")}
                />
                <input
                  type="text"
                  value={data.shopDetails.email}
                  onChange={(e) => handleShopChange("email", e.target.value)}
                  placeholder="email@business.com"
                  className={inputClass}
                />
                <input
                  type="text"
                  value={data.shopDetails.address}
                  onChange={(e) => handleShopChange("address", e.target.value)}
                  placeholder="123 Business St, City, Country"
                  className={inputClass}
                />
              </div>
            </div>

            {/* Bill To */}
            <div className="bg-[#0d1b2a] rounded-xl border border-slate-800/50 p-5 relative">
              <span className="absolute -top-2.5 left-4 bg-amber-500 text-black text-[10px] font-bold px-2 py-0.5 rounded">
                Bill To
              </span>
              <div className="space-y-3 mt-2">
                <input
                  type="text"
                  value={currentBill.customerName}
                  onChange={(e) =>
                    handleBillChange("customerName", e.target.value)
                  }
                  placeholder="Client Name"
                  className={cn(inputClass, "text-lg font-semibold")}
                />
                <input
                  type="text"
                  value={currentBill.customerPhone || ""}
                  onChange={(e) =>
                    handleBillChange("customerPhone", e.target.value)
                  }
                  placeholder="client@company.com"
                  className={inputClass}
                />
                <input
                  type="text"
                  value={currentBill.customerAddress}
                  onChange={(e) =>
                    handleBillChange("customerAddress", e.target.value)
                  }
                  placeholder="Client Address"
                  className={inputClass}
                />
              </div>
            </div>

            {/* Invoice Details */}
            <div className="bg-[#0d1b2a] rounded-xl border border-slate-800/50 p-5">
              <h3 className="text-sm font-bold text-white mb-4">
                Invoice Details
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">
                    Issue Date
                  </label>
                  <input
                    type="date"
                    value={currentBill.date}
                    onChange={(e) => handleBillChange("date", e.target.value)}
                    className={boxInputClass}
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">
                    Delivery Charge (₹)
                  </label>
                  <input
                    type="number"
                    value={currentBill.deliveryCharge || 0}
                    onChange={(e) =>
                      handleBillChange(
                        "deliveryCharge",
                        parseInt(e.target.value) || 0,
                      )
                    }
                    placeholder="0"
                    min="0"
                    className={boxInputClass}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Line Items Table */}
          <div className="bg-[#0d1b2a] rounded-xl border border-slate-800/50 overflow-hidden mb-8">
            {/* Table Header */}
            <div className="grid grid-cols-[1fr_100px_120px_120px_40px] gap-4 px-6 py-3 border-b border-slate-800/50">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                Product Name
              </span>
              <span className="text-xs font-bold text-slate-500 uppercase tracking-widest text-center">
                Qty
              </span>
              <span className="text-xs font-bold text-slate-500 uppercase tracking-widest text-center">
                Rate
              </span>
              <span className="text-xs font-bold text-slate-500 uppercase tracking-widest text-right">
                Amount
              </span>
              <span></span>
            </div>

            {/* Items */}
            {currentBill.items.map((item, index) => (
              <div
                key={index}
                className="grid grid-cols-[1fr_100px_120px_120px_40px] gap-4 px-6 py-4 border-b border-slate-800/30 items-center group hover:bg-slate-800/20 transition-colors"
              >
                <div>
                  <input
                    type="text"
                    value={item.productName}
                    onChange={(e) =>
                      handleItemChange(index, "productName", e.target.value)
                    }
                    placeholder="Product name"
                    className="w-full bg-transparent text-sm font-medium text-white placeholder:text-slate-600 outline-none"
                  />
                  <input
                    type="text"
                    value={item.description}
                    onChange={(e) =>
                      handleItemChange(index, "description", e.target.value)
                    }
                    placeholder="Description (optional)"
                    className="w-full bg-transparent text-xs text-slate-500 placeholder:text-slate-700 outline-none mt-1"
                  />
                </div>
                <div className="flex justify-center">
                  <input
                    type="number"
                    value={item.quantity}
                    onChange={(e) =>
                      handleItemChange(
                        index,
                        "quantity",
                        parseInt(e.target.value) || 0,
                      )
                    }
                    className="w-16 bg-[#060e1a] border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-white text-center outline-none focus:border-amber-500/50"
                  />
                </div>
                <div className="flex items-center justify-center gap-1">
                  <span className="text-slate-500 text-sm">₹</span>
                  <input
                    type="number"
                    value={item.price}
                    onChange={(e) =>
                      handleItemChange(
                        index,
                        "price",
                        parseFloat(e.target.value) || 0,
                      )
                    }
                    className="w-20 bg-[#060e1a] border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-white text-center outline-none focus:border-amber-500/50"
                  />
                </div>
                <div className="text-right text-sm font-semibold text-white">
                  ₹
                  {(item.quantity * item.price).toLocaleString("en-IN", {
                    minimumFractionDigits: 2,
                  })}
                </div>
                <button
                  onClick={() => removeItem(index)}
                  className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 transition-all"
                >
                  <X size={16} />
                </button>
              </div>
            ))}

            {/* Add Line Item */}
            <button
              onClick={addItem}
              className="w-full py-3 border-2 border-dashed border-slate-700/50 text-amber-500 text-sm font-medium hover:border-amber-500/50 hover:bg-amber-500/5 transition-all flex items-center justify-center gap-2"
            >
              <Plus size={16} /> Add Line Item
            </button>
          </div>

          {/* Notes & Summary */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div>
              <h3 className="text-sm font-bold text-white mb-3">
                Notes / Terms
              </h3>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder='Enter any notes to the client here (e.g. "Thank you for your business!")'
                rows={4}
                className="w-full bg-[#0d1b2a] border border-slate-800/50 rounded-xl px-4 py-3 text-sm text-white placeholder:text-slate-600 focus:border-amber-500/50 outline-none resize-none"
              />
            </div>
            <div className="bg-[#0d1b2a] rounded-xl border border-slate-800/50 p-5">
              <div className="space-y-3">
                <div className="flex justify-between text-sm text-slate-400">
                  <span>Subtotal</span>
                  <span className="text-white font-mono">
                    ₹
                    {subtotal.toLocaleString("en-IN", {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                </div>
                {deliveryCharge > 0 && (
                  <div className="flex justify-between text-sm text-slate-400">
                    <span>Delivery</span>
                    <span className="text-white font-mono">
                      ₹
                      {deliveryCharge.toLocaleString("en-IN", {
                        minimumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                )}
                <div className="border-t border-slate-800/50 pt-3 mt-3 flex justify-between items-center">
                  <span className="text-white font-bold">Total Due</span>
                  <span className="text-2xl font-bold text-amber-500 font-mono">
                    ₹
                    {totalDue.toLocaleString("en-IN", {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Action Bar */}
      <div
        className={cn(
          "fixed bottom-0 right-0 left-0 px-8 py-4 bg-[#060e1a]/90 backdrop-blur-md border-t border-slate-800/50 flex justify-between items-center z-40 transition-all duration-300",
          sidebarCollapsed ? "lg:left-20" : "lg:left-72",
        )}
      >
        <Button
          variant="ghost"
          className="text-slate-500 hover:text-white"
          onClick={() => {
            setData({
              ...defaultBillData,
              shopDetails: {
                ...defaultBillData.shopDetails,
                name: companyDetails.name || defaultBillData.shopDetails.name,
              },
            });
            setNotes("");
          }}
        >
          Clear Form
        </Button>
        <div className="flex gap-3">
          <Button
            variant="outline"
            className="border-slate-700 bg-slate-800 text-white hover:bg-slate-700"
            onClick={() => handleSave("draft")}
          >
            <Save className="mr-2 h-4 w-4" /> Save Draft
          </Button>
          <Button
            variant="outline"
            className="border-slate-700 bg-slate-800 text-white hover:bg-slate-700"
          >
            <Eye className="mr-2 h-4 w-4" /> Preview
          </Button>
          <Button
            className="bg-amber-500 hover:bg-amber-600 text-black font-bold"
            onClick={() => {
              handleSave("pending");
              generateBillPDF(data);
            }}
          >
            <Zap className="mr-2 h-4 w-4 fill-current" /> Generate Bill
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function InvoicePage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen"><div className="text-white">Loading...</div></div>}>
      <InvoicePageContent />
    </Suspense>
  );
}
