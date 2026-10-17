/**
 * Mobile sub-navigation store.
 *
 * The More tab owns its own sub-screens (Invoices, Catalog, Advances, …).
 * Screens elsewhere (e.g. Home) may deep-link into one of them by setting
 * `moreSection` here + `setActiveView('more')` on the shared app store.
 * `invoiceFilter` carries an optional status filter for the Invoices screen;
 * InvoicesScreen consumes it once on mount and resets it to 'all'.
 */
import {create} from 'zustand';

export type MoreSection = 'letters' | 'reports' | 'catalog' | 'invoices' | 'orders' | 'settings' | 'billing' | 'help';
export type InvoiceStatusFilter = 'all' | 'PAID' | 'PARTIAL' | 'UNPAID' | 'DRAFT';

type NavState = {
  moreSection: MoreSection | null;
  invoiceFilter: InvoiceStatusFilter;
  /** Invoice id the Billing screen should open in EDIT mode (null = new bill).
   *  Set by InvoicesScreen's Edit action; cleared on close and by any plain
   *  `openMore`, so a "Create new bill" can never inherit a stale edit target. */
  editingInvoiceId: string | null;
  /** Opens a More sub-screen (e.g. from Home) with an optional invoice filter. */
  openMore: (section: MoreSection, invoiceFilter?: InvoiceStatusFilter) => void;
  /** Opens More → Billing in edit mode for one invoice. */
  openEditBill: (invoiceId: string) => void;
  /** Back to the More list. */
  closeMore: () => void;
  setInvoiceFilter: (filter: InvoiceStatusFilter) => void;
};

export const useNavStore = create<NavState>(set => ({
  moreSection: null,
  invoiceFilter: 'all',
  editingInvoiceId: null,
  openMore: (section, invoiceFilter) =>
    set({moreSection: section, invoiceFilter: invoiceFilter ?? 'all', editingInvoiceId: null}),
  openEditBill: invoiceId => set({moreSection: 'billing', editingInvoiceId: invoiceId}),
  closeMore: () => set({moreSection: null, editingInvoiceId: null}),
  setInvoiceFilter: invoiceFilter => set({invoiceFilter}),
}));