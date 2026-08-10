"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, ArrowUpRight, Receipt, Bell, Search } from "lucide-react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useStore } from "@/app/store/useStore";

export default function Dashboard() {
  const { documents } = useStore();
  const recentDocs = documents.slice(0, 5); // Show last 5 docs

  return (
    <div className="flex-1 space-y-8 p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-white">
            Dashboard
          </h2>
          <p className="text-slate-400">
            {new Date().toLocaleDateString("en-US", {
              weekday: "long",
              month: "short",
              day: "numeric",
            })}
          </p>
        </div>
        <div className="flex items-center space-x-4">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              type="search"
              placeholder="Search docs, clients..."
              className="w-64 pl-9 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 focus-visible:ring-indigo-500"
            />
          </div>
          <Button
            size="icon"
            variant="ghost"
            className="relative text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <Bell className="h-5 w-5" />
            <span className="absolute top-2 right-2 h-2 w-2 bg-indigo-500 rounded-full"></span>
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
        {/* Create New Section - Spans 7 columns on large screens */}
        <div className="col-span-7">
          <h3 className="text-xl font-semibold text-white mb-4">Create New</h3>
          <div className="grid gap-6 md:grid-cols-2">
            {/* New Job Letter Card */}
            <Card className="bg-linear-to-br from-indigo-900/50 to-slate-900 border-indigo-500/20 hover:border-indigo-500/40 transition-colors">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div className="h-12 w-12 rounded-2xl bg-indigo-500/20 flex items-center justify-center">
                  <FileText className="h-6 w-6 text-indigo-400" />
                </div>
                <ArrowUpRight className="h-4 w-4 text-slate-400" />
              </CardHeader>
              <CardContent className="pt-4">
                <CardTitle className="text-xl text-white mb-2">
                  New Job Letter
                </CardTitle>
                <p className="text-sm text-slate-400 mb-6">
                  Create a professional proposal or cover letter using our
                  premium templates.
                </p>
                <Link href="/job-letter">
                  <Button
                    variant="ghost"
                    className="text-indigo-400 hover:text-indigo-300 hover:bg-indigo-950 p-0 h-auto font-medium"
                  >
                    Start Drafting <ArrowUpRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </CardContent>
            </Card>

            {/* New Invoice Card */}
            <Card className="bg-linear-to-br from-amber-900/20 to-slate-900 border-amber-500/20 hover:border-amber-500/40 transition-colors">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div className="h-12 w-12 rounded-2xl bg-amber-500/20 flex items-center justify-center">
                  <Receipt className="h-6 w-6 text-amber-400" />
                </div>
                <ArrowUpRight className="h-4 w-4 text-slate-400" />
              </CardHeader>
              <CardContent className="pt-4">
                <CardTitle className="text-xl text-white mb-2">
                  New Invoice
                </CardTitle>
                <p className="text-sm text-slate-400 mb-6">
                  Generate a detailed bill for your clients with automatic tax
                  calculation.
                </p>
                <Link href="/invoice">
                  <Button
                    variant="ghost"
                    className="text-amber-400 hover:text-amber-300 hover:bg-amber-950 p-0 h-auto font-medium"
                  >
                    Create Bill <ArrowUpRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Recent Documents Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold text-white">Recent Documents</h3>
          {recentDocs.length > 0 && (
            <Button
              variant="link"
              className="text-amber-500 hover:text-amber-400"
            >
              View All
            </Button>
          )}
        </div>

        {recentDocs.length === 0 ? (
          <div className="text-center py-12 bg-slate-900 rounded-xl border border-slate-800 border-dashed">
            <p className="text-slate-500">No documents created yet.</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-3">
            {recentDocs.map((doc) => (
              <Link
                key={doc.id}
                href={`/${doc.type === "invoice" ? "invoice" : "job-letter"}?id=${doc.id}`}
                className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/50 hover:bg-slate-800 transition-colors cursor-pointer group block"
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div
                      className={`p-2 rounded-lg ${
                        doc.type === "invoice"
                          ? "bg-amber-500/10 text-amber-400 group-hover:bg-amber-500/20"
                          : "bg-blue-500/10 text-blue-400 group-hover:bg-blue-500/20"
                      } transition-colors`}
                    >
                      {doc.type === "invoice" ? (
                        <Receipt size={18} />
                      ) : (
                        <FileText size={18} />
                      )}
                    </div>
                    <div className="overflow-hidden">
                      <h4 className="text-sm font-medium text-white truncate w-32">
                        {doc.title}
                      </h4>
                      <p className="text-xs text-slate-400 truncate w-32">
                        {doc.clientName}
                      </p>
                    </div>
                  </div>
                  <Badge
                    variant={doc.status === "paid" ? "outline" : "secondary"}
                    className={
                      doc.status === "paid"
                        ? "border-green-500/30 text-green-400 bg-green-500/10"
                        : "bg-slate-700/50 text-slate-300"
                    }
                  >
                    {doc.status.toUpperCase()}
                  </Badge>
                </div>
                <div className="flex justify-between items-center text-xs text-slate-500">
                  <span>{new Date(doc.date).toLocaleDateString()}</span>
                  {doc.amount && (
                    <span className="text-sm font-semibold text-white">
                      ${doc.amount.toFixed(2)}
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
