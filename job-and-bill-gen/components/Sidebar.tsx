"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  LayoutDashboard,
  FileText,
  Receipt,
  Settings,
  Menu,
  Sparkles,
  LogOut,
  User,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { useStore } from "@/app/store/useStore";

export function Sidebar({ className }: { className?: string }) {
  const { sidebarCollapsed, toggleSidebar } = useStore();

  return (
    <div
      className={cn(
        "hidden md:flex flex-col fixed inset-y-0 z-50 bg-slate-900 text-white border-r border-slate-800 transition-all duration-300",
        sidebarCollapsed ? "w-20" : "w-72",
        className,
      )}
    >
      <SidebarContent collapsed={sidebarCollapsed} />
      <div className="p-3 border-t border-slate-800">
        <Button
          onClick={toggleSidebar}
          variant="ghost"
          className="w-full justify-center text-slate-400 hover:text-white"
        >
          {sidebarCollapsed ? (
            <PanelLeftOpen className="h-5 w-5" />
          ) : (
            <div className="flex items-center gap-2">
              <PanelLeftClose className="h-5 w-5" />
              <span>Collapse Sidebar</span>
            </div>
          )}
        </Button>
      </div>
    </div>
  );
}

export function MobileSidebar() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Close sidebar on route change
  React.useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden text-white hover:bg-white/10"
        >
          <Menu className="h-6 w-6" />
        </Button>
      </SheetTrigger>
      <SheetContent
        side="left"
        className="p-0 bg-slate-900 border-r-slate-800 w-72 text-white"
      >
        <SidebarContent collapsed={false} />
      </SheetContent>
    </Sheet>
  );
}

function SidebarContent({ collapsed }: { collapsed: boolean }) {
  const pathname = usePathname();
  const { companyDetails } = useStore();

  const routes = [
    {
      label: "Dashboard",
      icon: LayoutDashboard,
      href: "/dashboard",
      color: "text-sky-500",
    },
    {
      label: "Job Letters",
      icon: FileText,
      href: "/job-letter",
      color: "text-violet-500",
    },
    {
      label: "Bill Creator",
      icon: Receipt,
      href: "/invoice",
      color: "text-pink-700",
    },
    {
      label: "Settings",
      icon: Settings,
      href: "/settings",
      color: "text-slate-400",
    },
  ];

  return (
    <div className="space-y-4 py-4 h-full flex flex-col w-full">
      <div className="px-3 py-2 flex-1">
        <Link
          href="/dashboard"
          className={cn(
            "flex items-center mb-14 transition-all duration-300",
            collapsed ? "justify-center pl-0" : "pl-3",
          )}
        >
          <div className="relative">
            <div className="absolute inset-0 bg-linear-to-tr from-amber-400 to-orange-500 rounded-lg blur-sm opacity-50"></div>
            <div className="relative bg-linear-to-br from-amber-400 to-orange-600 p-2 rounded-lg">
              <Sparkles className="h-6 w-6 text-white" />
            </div>
          </div>
          {!collapsed && (
            <div className="ml-4 overflow-hidden transition-all duration-300">
              <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-linear-to-r from-amber-400 to-orange-200 truncate">
                {companyDetails.name || "DocGen"}
              </h1>
              <p className="text-xs text-slate-400">PREMIUM</p>
            </div>
          )}
        </Link>
        <div className="space-y-1">
          {routes.map((route) => (
            <Link
              key={route.href}
              href={route.href}
              className={cn(
                "text-sm group flex p-3 w-full font-medium cursor-pointer hover:text-white hover:bg-white/10 rounded-lg transition duration-200",
                pathname === route.href
                  ? "text-white bg-white/10"
                  : "text-zinc-400",
                collapsed ? "justify-center" : "justify-start",
              )}
            >
              <div className="flex items-center">
                <route.icon
                  className={cn("h-5 w-5", route.color, !collapsed && "mr-3")}
                />
                {!collapsed && route.label}
              </div>
            </Link>
          ))}
        </div>
      </div>
      <div className="mt-auto px-3">
        {!collapsed ? (
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-linear-to-r from-indigo-500 to-purple-500 flex items-center justify-center shrink-0">
                <User className="h-5 w-5 text-white" />
              </div>
              <div className="flex-1 overflow-hidden">
                <p className="text-sm font-medium text-white truncate">
                   Gaurav
                </p>
                <p className="text-xs text-slate-400 truncate">
                  gouradadhich13@gmail.com
                </p>
              </div>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 ml-auto text-slate-400 hover:text-white shrink-0"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex justify-center">
            <div className="h-10 w-10 rounded-full bg-linear-to-r from-indigo-500 to-purple-500 flex items-center justify-center shrink-0 relative group">
              <User className="h-5 w-5 text-white" />
              {/* Tooltip-like popup for user info could go here */}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
