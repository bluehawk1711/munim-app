import type { ViewKey } from "@/store/view-store"

/** Per-view header metadata — shared by the topbar (h1/subtitle) and the
 * dynamic document title (SEO). Keep in one place so both stay in sync. */
export const VIEW_TITLES: Record<ViewKey, { title: string; subtitle: string }> = {
  dashboard: { title: "Dashboard", subtitle: "Business overview & analytics" },
  products: { title: "Products", subtitle: "Manage your inventory" },
  sales: { title: "Sales", subtitle: "Record sales & view history" },
  invoices: { title: "Invoices", subtitle: "All bills & payment statuses" },
  billing: { title: "New Bill", subtitle: "Create a bill / invoice" },
  "job-letter": { title: "Job Letters", subtitle: "Offer & joining letters" },
  parties: { title: "Parties", subtitle: "Khata — customers, suppliers, workers" },
  advances: { title: "Advances", subtitle: "Who owes whom — given & taken" },
  reports: { title: "Reports", subtitle: "Generate & export reports" },
  catalog: { title: "Catalog", subtitle: "Manage colors & sizes" },
  settings: { title: "Settings", subtitle: "Shop profile & shared database" },
}
