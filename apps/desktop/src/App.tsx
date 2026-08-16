import type { ReactNode } from "react";
import { AnimatePresence, LazyMotion, domMax } from "motion/react";
import * as m from "motion/react-m";
import { pingDatabase } from "@munim/core";
import { PinGate } from "@munim/ui";
import { createAppDb } from "@/lib/core";
import { AppShell } from "@/components/app-shell";
import { useCurrentPath } from "@/lib/navigation";
import { DashboardPage } from "@/pages/dashboard";
import { ProductsPage } from "@/pages/products";
import { CatalogPage } from "@/pages/catalog";
import { SalesPage } from "@/pages/sales";
import { BillingPage } from "@/pages/billing";
import { InvoicesPage } from "@/pages/invoices";
import { PartiesPage } from "@/pages/parties";
import { AdvancesPage } from "@/pages/advances";
import { JobLettersPage } from "@/pages/job-letters";
import { ReportsPage } from "@/pages/reports";
import { SettingsPage } from "@/pages/settings";

const ROUTES: { path: string; title: string; element: ReactNode }[] = [
  { path: "/", title: "Dashboard", element: <DashboardPage /> },
  { path: "/products", title: "Products & Stock", element: <ProductsPage /> },
  { path: "/catalog", title: "Catalog", element: <CatalogPage /> },
  { path: "/sales", title: "Sales", element: <SalesPage /> },
  { path: "/billing", title: "New Bill", element: <BillingPage /> },
  { path: "/invoices", title: "Invoices", element: <InvoicesPage /> },
  { path: "/parties", title: "Parties & Khata", element: <PartiesPage /> },
  { path: "/advances", title: "Advances", element: <AdvancesPage /> },
  { path: "/job-letters", title: "Job Letters", element: <JobLettersPage /> },
  { path: "/reports", title: "Reports", element: <ReportsPage /> },
  { path: "/settings", title: "Settings", element: <SettingsPage /> },
];

const FALLBACK_ROUTE = ROUTES[0]!;

export function App() {
  const current = useCurrentPath();
  const route = ROUTES.find((r) => r.path === current) ?? FALLBACK_ROUTE;
  return (
    <PinGate
      onboarding
      pingDatabase={async (url) => {
        // Same platform-fetch path as getCore() (Tauri HTTP plugin → no CORS).
        await pingDatabase(createAppDb(url));
      }}
    >
      <LazyMotion features={domMax}>
        <AppShell current={route.path} title={route.title}>
          <AnimatePresence mode="wait" initial={false}>
            <m.div
              key={route.path}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="h-full"
            >
              {route.element}
            </m.div>
          </AnimatePresence>
        </AppShell>
      </LazyMotion>
    </PinGate>
  );
}
