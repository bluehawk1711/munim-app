import type { ReactNode } from "react";
import { ThemeProvider } from "@/components/theme-provider";
import { ModeToggle } from "@/components/mode-toggle";
import { Sidebar } from "@/components/sidebar";
import { Toaster } from "@/components/ui/sonner";

type AppShellProps = {
  current: string;
  title: string;
  children: ReactNode;
};

export function AppShell({ current, title, children }: AppShellProps) {
  return (
    <ThemeProvider defaultTheme="system" storageKey="munim-desktop-theme">
      <div className="bg-background text-foreground flex h-screen w-screen overflow-hidden">
        <Sidebar current={current} />
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="bg-card/60 flex h-14 shrink-0 items-center justify-between border-b px-4 backdrop-blur">
            <h1 className="text-sm font-semibold">{title}</h1>
            <ModeToggle />
          </header>
          <main className="min-h-0 flex-1 overflow-y-auto p-5">{children}</main>
        </div>
      </div>
      <Toaster />
    </ThemeProvider>
  );
}
