import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { DashboardPage } from "@/pages/dashboard";
import { ProductsPage } from "@/pages/products";
import { SalesPage } from "@/pages/sales";
import { BillingPage } from "@/pages/billing";
import { PartiesPage } from "@/pages/parties";
import { JobLettersPage } from "@/pages/job-letters";
import { SettingsPage } from "@/pages/settings";

const ROUTES: { path: string; title: string; element: ReactNode }[] = [
  { path: "/", title: "Dashboard", element: <DashboardPage /> },
  { path: "/products", title: "Products & Stock", element: <ProductsPage /> },
  { path: "/sales", title: "Sales", element: <SalesPage /> },
  { path: "/billing", title: "Billing / Invoices", element: <BillingPage /> },
  { path: "/parties", title: "Parties & Khata", element: <PartiesPage /> },
  { path: "/job-letters", title: "Job Letters", element: <JobLettersPage /> },
  { path: "/settings", title: "Settings", element: <SettingsPage /> },
];

const FALLBACK_ROUTE = ROUTES[0]!;

export function App() {
  const current = window.location.pathname;
  const route = ROUTES.find((r) => r.path === current) ?? FALLBACK_ROUTE;
  return (
    <AppShell current={route.path} title={route.title}>
      {route.element}
    </AppShell>
  );
}
