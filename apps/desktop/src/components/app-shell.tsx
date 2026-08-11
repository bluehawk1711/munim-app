import type { ReactNode } from "react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { Palette } from "lucide-react";
import { ThemeProvider } from "@/components/theme-provider";
import { ModeToggle } from "@/components/mode-toggle";
import { Sidebar } from "@/components/sidebar";
import { Toaster, Button, DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuTrigger } from "@munim/ui"
;
;
;
import { ThemeSwatches, useAccentTheme } from "@/components/theme-swatches";

type AppShellProps = {
  current: string;
  title: string;
  children: ReactNode;
};

export function AppShell({ current, title, children }: AppShellProps) {
  return (
    <ThemeProvider defaultTheme="system" storageKey="munim-desktop-theme">
      <MotionConfig reducedMotion="user">
      <div className="bg-background text-foreground flex h-screen w-screen overflow-hidden">
        <Sidebar current={current} />
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="bg-card/60 flex h-14 shrink-0 items-center justify-between border-b px-4 backdrop-blur">
            <div className="overflow-hidden">
              <AnimatePresence mode="wait" initial={false}>
                <motion.h1
                  key={title}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.16, ease: [0.25, 0.46, 0.45, 0.94] }}
                  className="text-sm font-semibold"
                >
                  {title}
                </motion.h1>
              </AnimatePresence>
            </div>
            <div className="flex items-center gap-1.5">
              <ThemeDropdown />
              <ModeToggle />
            </div>
          </header>
          <main className="min-h-0 flex-1 overflow-y-auto p-5">{children}</main>
        </div>
      </div>
      </MotionConfig>
      <Toaster />
    </ThemeProvider>
  );
}

function ThemeDropdown() {
  const { themeName, setThemeName } = useAccentTheme();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" aria-label="Change color theme">
          <Palette className="h-[1.2rem] w-[1.2rem]" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="text-xs text-muted-foreground">Color theme</DropdownMenuLabel>
        <div className="px-2 pb-2">
          <ThemeSwatches value={themeName} onChange={setThemeName} />
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
