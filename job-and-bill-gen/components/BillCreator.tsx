"use client";

import { useState } from "react";
import { BillData } from "../app/types";
import { Plus, Trash2, Download, Eye, FileText } from "lucide-react";

interface BillCreatorProps {
  data: BillData;
  onChange: (data: BillData) => void;
  onDownload: () => void;
}

export default function BillCreator({
  data,
  onChange,
  onDownload,
}: BillCreatorProps) {
  const [activeTab, setActiveTab] = useState<"form" | "preview">("form");
  const [activeBillTab, setActiveBillTab] = useState<"bill1" | "bill2">(
    "bill1",
  );

  const currentBill =
    activeBillTab === "bill1" ? data : data.secondBill || data;

  const handleBillChange = (
    field: keyof BillData,
    value: BillData[keyof BillData],
  ) => {
    if (activeBillTab === "bill1") {
      onChange({ ...data, [field]: value });
    } else {
      onChange({
        ...data,
        secondBill: { ...data.secondBill!, [field]: value },
      });
    }
  };

  const handleSettingsChange = (
    field: keyof BillData["settings"],
    value: BillData["settings"][keyof BillData["settings"]],
  ) => {
    onChange({ ...data, settings: { ...data.settings, [field]: value } });
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

  return (
    <div className="space-y-6">
      {/* Mobile Tab Switcher within Bill Creator */}
      <div className="flex gap-2 bg-slate-900/50 p-1.5 rounded-xl mb-6 border border-white/5 lg:hidden">
        <button
          className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === "form" ? "bg-amber-500 text-slate-900 shadow-lg" : "text-slate-400 hover:text-white"}`}
          onClick={() => setActiveTab("form")}
        >
          Edit Bill
        </button>
        <button
          className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === "preview" ? "bg-amber-500 text-slate-900 shadow-lg" : "text-slate-400 hover:text-white"}`}
          onClick={() => setActiveTab("preview")}
        >
          Preview
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        <div
          className={`space-y-6 ${
            activeTab === "form" ? "block" : "hidden xl:block"
          }`}
        >
          <div className="glass-card p-6 border-t-amber-500/50">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-amber-500/20 rounded-lg text-amber-400">
                <FileText size={20} />
              </div>
              <h3 className="text-xl font-semibold text-white">Bill Details</h3>
            </div>

            <div className="form-container space-y-6">
              <section className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="form-group">
                    <label className="block text-xs font-medium text-slate-400 mb-1.5 ml-1">
                      Bill No
                    </label>
                    <input
                      type="text"
                      value={currentBill.billNo}
                      onChange={(e) =>
                        handleBillChange("billNo", e.target.value)
                      }
                      className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition-all placeholder:text-slate-600"
                    />
                  </div>
                  <div className="form-group">
                    <label className="block text-xs font-medium text-slate-400 mb-1.5 ml-1">
                      Date
                    </label>
                    <input
                      type="date"
                      value={currentBill.date}
                      onChange={(e) => handleBillChange("date", e.target.value)}
                      className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition-all text-slate-200"
                    />
                  </div>
                  <div className="form-group md:col-span-2">
                    <label className="block text-xs font-medium text-slate-400 mb-1.5 ml-1">
                      Template Style
                    </label>
                    <select
                      value={data.settings.template}
                      onChange={(e) =>
                        handleSettingsChange(
                          "template",
                          e.target.value as BillData["settings"]["template"],
                        )
                      }
                      className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition-all text-slate-200 cursor-pointer"
                    >
                      <option value="jewellery" className="text-black">
                        Classic Jewellery
                      </option>
                      <option value="ecommerce" className="text-black">
                        Modern E-commerce
                      </option>
                    </select>
                  </div>
                  {data.settings.template === "jewellery" && (
                    <div className="form-group md:col-span-2">
                      <label className="block text-xs font-medium text-slate-400 mb-1.5 ml-1">
                        Color Theme
                      </label>
                      <div className="flex gap-4 mt-2 bg-slate-900/30 p-3 rounded-xl border border-white/5">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="classicColor"
                            style={{ width: "auto" }}
                            checked={
                              data.settings.classicColor === "red" ||
                              !data.settings.classicColor
                            }
                            onChange={() =>
                              handleSettingsChange("classicColor", "red")
                            }
                          />
                          <span className="flex items-center gap-1 text-sm text-slate-300">
                            <span className="w-4 h-4 rounded-full bg-red-600 inline-block border border-white/20"></span>
                            Red
                          </span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="classicColor"
                            style={{ width: "auto" }}
                            checked={data.settings.classicColor === "yellow"}
                            onChange={() =>
                              handleSettingsChange("classicColor", "yellow")
                            }
                          />
                          <span className="flex items-center gap-1 text-sm text-slate-300">
                            <span className="w-4 h-4 rounded-full bg-yellow-500 inline-block border border-white/20"></span>
                            Yellow/Gold
                          </span>
                        </label>
                      </div>
                    </div>
                  )}
                  <div className="form-group">
                    <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-300">
                      <input
                        type="checkbox"
                        style={{ width: "auto" }}
                        checked={data.settings.twoInOne}
                        onChange={(e) =>
                          handleSettingsChange("twoInOne", e.target.checked)
                        }
                      />
                      2 Bills per page
                    </label>
                  </div>
                  {data.settings.twoInOne && (
                    <div className="form-group md:col-span-2">
                      <label className="block text-xs font-medium text-slate-400 mb-2 ml-1">
                        Mode
                      </label>
                      <div className="flex gap-4 bg-slate-900/30 p-3 rounded-xl border border-white/5">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="mode"
                            style={{ width: "auto" }}
                            checked={
                              data.settings.mode === "duplicate" ||
                              !data.settings.mode
                            }
                            onChange={() =>
                              handleSettingsChange("mode", "duplicate")
                            }
                          />
                          <span className="text-sm text-slate-300">
                            Duplicate Copy
                          </span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="mode"
                            style={{ width: "auto" }}
                            checked={data.settings.mode === "distinct"}
                            onChange={() =>
                              handleSettingsChange("mode", "distinct")
                            }
                          />
                          <span className="text-sm text-slate-300">
                            Separate Bill
                          </span>
                        </label>
                      </div>
                    </div>
                  )}
                </div>
              </section>

              <section className="space-y-4 pt-4 border-t border-white/10">
                {data.settings.twoInOne &&
                  data.settings.mode === "distinct" && (
                    <div className="grid grid-cols-2 gap-3 mb-8 px-1.5 bg-slate-900/50 p-1.5 rounded-xl">
                      <button
                        className={`px-4 py-3 rounded-lg font-medium text-sm transition-colors ${
                          activeBillTab === "bill1"
                            ? "bg-amber-500 text-black shadow-lg"
                            : "text-slate-400 hover:text-white"
                        }`}
                        onClick={() => setActiveBillTab("bill1")}
                      >
                        Bill 1
                      </button>
                      <button
                        className={`px-4 py-3 rounded-lg font-medium text-sm transition-colors ${
                          activeBillTab === "bill2"
                            ? "bg-amber-500 text-black shadow-lg"
                            : "text-slate-400 hover:text-white"
                        }`}
                        onClick={() => setActiveBillTab("bill2")}
                      >
                        Bill 2
                      </button>
                    </div>
                  )}
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider border-b border-white/10 pb-2 mb-4">
                  Customer Details
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="form-group">
                    <label className="block text-xs font-medium text-slate-400 mb-1.5 ml-1">
                      Name
                    </label>
                    <input
                      type="text"
                      value={currentBill.customerName}
                      onChange={(e) =>
                        handleBillChange("customerName", e.target.value)
                      }
                      className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition-all placeholder:text-slate-600"
                    />
                  </div>
                  <div className="form-group">
                    <label className="block text-xs font-medium text-slate-400 mb-1.5 ml-1">
                      Phone
                    </label>
                    <input
                      type="text"
                      value={currentBill.customerPhone}
                      onChange={(e) =>
                        handleBillChange("customerPhone", e.target.value)
                      }
                      className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition-all placeholder:text-slate-600"
                    />
                  </div>
                  <div className="form-group md:col-span-2">
                    <label className="block text-xs font-medium text-slate-400 mb-1.5 ml-1">
                      Address
                    </label>
                    <input
                      type="text"
                      value={currentBill.customerAddress}
                      onChange={(e) =>
                        handleBillChange("customerAddress", e.target.value)
                      }
                      className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition-all placeholder:text-slate-600"
                    />
                  </div>
                </div>
              </section>

              <section className="space-y-4 pt-4 border-t border-white/10">
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider border-b border-white/10 pb-2 mb-4">
                  Products
                </h3>
                {currentBill.items.map((item, index) => (
                  <div
                    key={index}
                    className="space-y-3 p-4 bg-slate-900/40 rounded-xl mb-4 border border-white/5"
                  >
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-semibold text-amber-500">
                        Item #{index + 1}
                      </span>
                      <button
                        onClick={() => removeItem(index)}
                        className="text-red-400 hover:text-red-300 transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="form-group col-span-2">
                        <label className="block text-xs font-medium text-slate-400 mb-1.5 ml-1">
                          Product Name
                        </label>
                        <input
                          type="text"
                          value={item.productName}
                          onChange={(e) =>
                            handleItemChange(
                              index,
                              "productName",
                              e.target.value,
                            )
                          }
                          className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-4 py-2 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition-all placeholder:text-slate-600"
                        />
                      </div>
                      <div className="form-group">
                        <label className="block text-xs font-medium text-slate-400 mb-1.5 ml-1">
                          Qty
                        </label>
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
                          className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-4 py-2 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition-all placeholder:text-slate-600"
                        />
                      </div>
                      <div className="form-group">
                        <label className="block text-xs font-medium text-slate-400 mb-1.5 ml-1">
                          Price
                        </label>
                        <input
                          type="number"
                          value={item.price}
                          onChange={(e) =>
                            handleItemChange(
                              index,
                              "price",
                              parseInt(e.target.value) || 0,
                            )
                          }
                          className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-4 py-2 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition-all placeholder:text-slate-600"
                        />
                      </div>
                      <div className="form-group col-span-2">
                        <label className="block text-xs font-medium text-slate-400 mb-1.5 ml-1">
                          Description
                        </label>
                        <input
                          type="text"
                          value={item.description}
                          onChange={(e) =>
                            handleItemChange(
                              index,
                              "description",
                              e.target.value,
                            )
                          }
                          className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-4 py-2 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition-all placeholder:text-slate-600"
                        />
                      </div>
                    </div>
                  </div>
                ))}
                <button
                  className="w-full py-3 rounded-xl border border-dashed border-white/20 hover:bg-white/5 text-slate-300 transition-colors flex items-center justify-center gap-2 text-sm font-medium"
                  onClick={addItem}
                >
                  <Plus size={16} /> Add Product
                </button>

                <div className="form-group mt-4">
                  <label className="block text-xs font-medium text-slate-400 mb-1.5 ml-1">
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
                    className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition-all placeholder:text-slate-600"
                  />
                </div>
              </section>
            </div>
            <div className="mt-8 pt-6 border-t border-white/10">
              <button
                className="w-full py-4 rounded-xl font-bold bg-linear-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black shadow-lg shadow-amber-500/25 transition-all transform hover:-translate-y-1 flex items-center justify-center gap-2"
                onClick={onDownload}
              >
                <Download size={20} /> Download Invoice PDF
              </button>
            </div>
          </div>

          <div
            className={`space-y-6 ${
              activeTab === "preview" ? "block" : "hidden xl:block"
            }`}
          >
            <div className="glass-card p-6 border-t-purple-500/50">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-purple-500/20 rounded-lg text-purple-400">
                  <Eye size={20} />
                </div>
                <h3 className="text-xl font-semibold text-white">
                  Live Preview
                </h3>
              </div>

              {/* Preview Content Wrapper */}
              <div className="rounded-xl overflow-hidden border border-white/10 shadow-2xl">
                <div
                  className="bill-preview bg-white rounded-lg  text-black shadow-2xl overflow-hidden relative"
                  style={{
                    minHeight: "842px",
                    width: "100%",
                    maxWidth: "800px",
                    margin: "0 auto",
                    fontFamily:
                      data.settings.template === "ecommerce"
                        ? "sans-serif"
                        : "serif",
                  }}
                >
                  {data.settings.template === "ecommerce" ? (
                    <div className="ecommerce-template p-6">
                      {/* Header with dark background */}
                      <div className="bg-slate-900 -mx-6 -mt-6 px-6 py-5 mb-6 flex justify-between items-start">
                        <div>
                          <h2 className="text-xl font-bold text-white">
                            {data.shopDetails.name}
                          </h2>
                          <p className="text-xs text-amber-400 mt-1">
                            {data.shopDetails.address}
                          </p>
                          <p className="text-xs text-amber-400">
                            Tel: {data.shopDetails.phones.join(" | ")}
                          </p>
                        </div>
                        <div className="text-right">
                          <h1 className="text-2xl font-bold text-amber-400">
                            INVOICE
                          </h1>
                          <p className="text-sm text-white mt-1">
                            #{currentBill.billNo}
                          </p>
                          <p className="text-xs text-white">
                            Date: {currentBill.date}
                          </p>
                        </div>
                      </div>

                      {/* Bill To section */}
                      <div className="mb-6">
                        <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2 border-b-2 border-amber-400 pb-1 inline-block">
                          Bill To:
                        </h3>
                        <p className="font-bold text-base text-slate-900">
                          {currentBill.customerName || "â€”"}
                        </p>
                        <p className="text-xs text-slate-500">
                          {currentBill.customerAddress}
                        </p>
                        <p className="text-xs text-slate-500">
                          {currentBill.customerPhone}
                        </p>
                      </div>

                      {/* Items Table */}
                      <div className="mb-6 overflow-x-auto">
                        <table className="w-full text-left min-w-[500px]">
                          <thead>
                            <tr className="bg-slate-100 text-xs font-bold uppercase text-slate-900">
                              <th className="py-2 px-2">Product</th>
                              <th className="py-2 text-center w-16">Qty</th>
                              <th className="py-2 text-right w-24">Price</th>
                              <th className="py-2 text-right w-24">Total</th>
                            </tr>
                          </thead>
                          <tbody className="text-sm">
                            {currentBill.items.map((item, i) => (
                              <tr key={i} className="border-b border-slate-100">
                                <td className="py-3 px-2">
                                  <p className="font-bold text-slate-900">
                                    {item.productName || "â€”"}
                                  </p>
                                </td>
                                <td className="py-3 text-center text-slate-600">
                                  {item.quantity}
                                </td>
                                <td className="py-3 text-right text-slate-600">
                                  â‚¹{item.price.toLocaleString()}
                                </td>
                                <td className="py-3 text-right font-bold text-slate-900">
                                  â‚¹
                                  {(
                                    item.quantity * item.price
                                  ).toLocaleString()}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Totals */}
                      <div className="flex justify-end">
                        <div className="w-48">
                          <div className="flex justify-between text-xs text-slate-500 py-1">
                            <span>Subtotal:</span>
                            <span>
                              â‚¹
                              {currentBill.items
                                .reduce(
                                  (acc, item) =>
                                    acc + item.quantity * item.price,
                                  0,
                                )
                                .toLocaleString()}
                            </span>
                          </div>
                          {(currentBill.deliveryCharge || 0) > 0 && (
                            <div className="flex justify-between text-xs text-slate-500 py-1">
                              <span>Delivery:</span>
                              <span>
                                â‚¹
                                {(
                                  currentBill.deliveryCharge || 0
                                ).toLocaleString()}
                              </span>
                            </div>
                          )}
                          <div className="bg-slate-900 -mx-2 px-2 py-2 mt-2 flex justify-between items-center rounded">
                            <span className="text-xs text-white font-bold">
                              TOTAL
                            </span>
                            <span className="text-lg font-bold text-amber-400">
                              â‚¹
                              {(
                                currentBill.items.reduce(
                                  (acc, item) =>
                                    acc + item.quantity * item.price,
                                  0,
                                ) + (currentBill.deliveryCharge || 0)
                              ).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Footer */}
                      <div className="mt-12 pt-4 border-t border-slate-200 flex justify-between items-end">
                        <p className="text-xs text-slate-400 italic">
                          Thank you for your business!
                        </p>
                        <div className="text-right">
                          <div className="h-10 w-32 border-b border-slate-300 mb-1"></div>
                          <p className="text-xs font-bold text-slate-600">
                            Authorized Signature
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div
                      className="jewellery-template"
                      style={
                        {
                          color:
                            data.settings.classicColor === "yellow"
                              ? "#b08c32"
                              : "#c00",
                          "--theme-color":
                            data.settings.classicColor === "yellow"
                              ? "#b08c32"
                              : "#c00",
                          "--theme-color-light":
                            data.settings.classicColor === "yellow"
                              ? "rgba(176, 140, 50, 0.1)"
                              : "rgba(200, 0, 0, 0.1)",
                        } as React.CSSProperties
                      }
                    >
                      <div className="flex justify-between text-sm font-bold">
                        <span>Mo. {data.shopDetails.phones[0]}</span>
                        <span>Mo. {data.shopDetails.phones[1]}</span>
                      </div>
                      <div
                        className="text-center pb-6 mb-8 mt-4"
                        style={{
                          borderBottom: `2px solid ${
                            data.settings.classicColor === "yellow"
                              ? "#b08c32"
                              : "#c00"
                          }`,
                        }}
                      >
                        <div className="text-xs font-black tracking-widest mb-1">
                          à¥¥ JAI SHREE SHYAM à¥¥
                        </div>
                        <h1 className="text-6xl font-black tracking-tighter uppercase">
                          {data.shopDetails.name}
                        </h1>
                        <div
                          className="text-white px-6 py-2 inline-block rounded-full text-sm font-black mt-4 uppercase tracking-wider"
                          style={{
                            backgroundColor:
                              data.settings.classicColor === "yellow"
                                ? "#b08c32"
                                : "#c00",
                          }}
                        >
                          âœ¦ Gold & Silver Jewellery Experts âœ¦
                        </div>
                        <div className="mt-4 text-lg italic font-bold">
                          ðŸ“ {data.shopDetails.address}
                        </div>
                      </div>

                      <div
                        className="flex justify-between font-black text-xl mb-8 pb-4"
                        style={{
                          borderBottom: `1px solid ${
                            data.settings.classicColor === "yellow"
                              ? "rgba(176, 140, 50, 0.2)"
                              : "rgba(200, 0, 0, 0.2)"
                          }`,
                        }}
                      >
                        <span>
                          Bill No.{" "}
                          <span className="text-black">
                            {currentBill.billNo}
                          </span>
                        </span>
                        <span>
                          Date:{" "}
                          <span className="text-black">{currentBill.date}</span>
                        </span>
                      </div>

                      <div className="space-y-8 text-2xl font-bold">
                        <div className="flex items-end gap-4">
                          <span className="shrink-0 mb-1">Mr./Ms.</span>
                          <span
                            className="flex-1 pb-1 text-black min-h-[40px] px-2"
                            style={{
                              borderBottom: `2px dotted ${
                                data.settings.classicColor === "yellow"
                                  ? "#b08c32"
                                  : "#c00"
                              }`,
                            }}
                          >
                            {currentBill.customerName}
                          </span>
                        </div>
                        <div className="flex items-end gap-4">
                          <span className="shrink-0 mb-1">Add.</span>
                          <span
                            className="flex-1 pb-1 text-black min-h-[40px] px-2"
                            style={{
                              borderBottom: `2px dotted ${
                                data.settings.classicColor === "yellow"
                                  ? "#b08c32"
                                  : "#c00"
                              }`,
                            }}
                          >
                            {currentBill.customerAddress}
                          </span>
                        </div>
                      </div>

                      <div className="mt-12 overflow-x-auto">
                        <table className="w-full border-collapse min-w-[500px]">
                          <thead>
                            <tr
                              className="text-sm font-black"
                              style={{
                                borderTop: `2px solid ${
                                  data.settings.classicColor === "yellow"
                                    ? "#b08c32"
                                    : "#c00"
                                }`,
                                borderBottom: `2px solid ${
                                  data.settings.classicColor === "yellow"
                                    ? "#b08c32"
                                    : "#c00"
                                }`,
                                backgroundColor:
                                  data.settings.classicColor === "yellow"
                                    ? "rgba(176, 140, 50, 0.05)"
                                    : "rgba(200, 0, 0, 0.05)",
                              }}
                            >
                              <th className="py-3 px-2 text-left">
                                Description
                              </th>
                              <th className="py-3 px-2 text-center w-24">
                                Qty
                              </th>
                              <th className="py-3 px-2 text-right w-40">
                                Amount
                              </th>
                            </tr>
                          </thead>
                          <tbody className="text-xl">
                            {currentBill.items.map((item, i) => (
                              <tr
                                key={i}
                                style={{
                                  borderBottom: `1px solid ${
                                    data.settings.classicColor === "yellow"
                                      ? "rgba(176, 140, 50, 0.1)"
                                      : "rgba(200, 0, 0, 0.1)"
                                  }`,
                                }}
                              >
                                <td className="py-6 px-2">
                                  <p className="font-black text-black">
                                    {item.productName}
                                  </p>
                                  <p className="text-sm italic font-bold">
                                    {item.description}
                                  </p>
                                </td>
                                <td className="py-6 px-2 text-center text-black font-bold">
                                  {item.quantity}
                                </td>
                                <td className="py-6 px-2 text-right text-black font-black">
                                  â‚¹
                                  {(
                                    item.quantity * item.price
                                  ).toLocaleString()}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            {(currentBill.deliveryCharge || 0) > 0 && (
                              <tr>
                                <td
                                  colSpan={2}
                                  className="py-2 text-right text-sm px-4"
                                >
                                  Subtotal
                                </td>
                                <td className="py-2 text-right font-bold text-lg px-2">
                                  â‚¹
                                  {currentBill.items
                                    .reduce(
                                      (acc, item) =>
                                        acc + item.quantity * item.price,
                                      0,
                                    )
                                    .toLocaleString()}
                                </td>
                              </tr>
                            )}
                            {(currentBill.deliveryCharge || 0) > 0 && (
                              <tr>
                                <td
                                  colSpan={2}
                                  className="py-2 text-right text-sm px-4"
                                >
                                  Delivery
                                </td>
                                <td className="py-2 text-right font-bold text-lg px-2">
                                  â‚¹
                                  {(
                                    currentBill.deliveryCharge || 0
                                  ).toLocaleString()}
                                </td>
                              </tr>
                            )}
                            <tr
                              style={{
                                borderTop: `2px solid ${
                                  data.settings.classicColor === "yellow"
                                    ? "#b08c32"
                                    : "#c00"
                                }`,
                              }}
                            >
                              <td
                                colSpan={2}
                                className="py-6 text-right font-black uppercase text-sm px-4"
                              >
                                Grand Total
                              </td>
                              <td className="py-6 text-right font-black text-3xl px-2">
                                â‚¹
                                {(
                                  currentBill.items.reduce(
                                    (acc, item) =>
                                      acc + item.quantity * item.price,
                                    0,
                                  ) + (currentBill.deliveryCharge || 0)
                                ).toLocaleString()}
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>

                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[250px] font-black opacity-[0.05] pointer-events-none select-none">
                        JW
                      </div>

                      <div className="mt-32 flex justify-end">
                        <div className="text-center">
                          <p className="text-2xl font-black mb-12 uppercase">
                            {data.shopDetails.name}
                          </p>
                          <div
                            className="w-64 mx-auto"
                            style={{
                              borderTop: `2px solid ${
                                data.settings.classicColor === "yellow"
                                  ? "#b08c32"
                                  : "#c00"
                              }`,
                            }}
                          ></div>
                          <p className="text-xs font-black mt-2 uppercase tracking-widest">
                            Authorized Signature
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
