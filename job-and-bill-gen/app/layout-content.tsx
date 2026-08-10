"use client";

import { useStore } from "@/app/store/useStore";
import { Sidebar, MobileSidebar } from "@/components/Sidebar";
import { cn } from "@/lib/utils";

export default function LayoutContent({
  children,
}: {
  children: React.ReactNode;
}) {
  const { sidebarCollapsed } = useStore();

  return (
    <div className="h-full relative">
      <Sidebar className="hidden md:flex" />
      <main
        className={cn(
          "h-full transition-all duration-300",
          sidebarCollapsed ? "md:pl-20" : "md:pl-72",
        )}
      >
        <div className="md:hidden p-4 fixed top-0 left-0 z-50">
          <MobileSidebar />
        </div>
        {children}
      </main>
    </div>
  );
}
