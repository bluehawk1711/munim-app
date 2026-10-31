/**
 * Mobile sub-navigation store.
 *
 * The More tab owns its own sub-screens (Invoices, Catalog, Advances, …).
 * Screens elsewhere (e.g. Home) may deep-link into one of them by setting
 * `moreSection` here + `setActiveView('more')` on the shared app store.
 * `invoiceFilter` carries an optional status filter for the Invoices screen;
 * InvoicesScreen consumes it once on mount and resets it to 'all'.
 *
 * Billing lives on the Sales tab (one billing surface for the whole app);
 * `editingInvoiceId` seeds that screen in edit mode.
 */
import {create} from 'zustand';

export type MoreSection = 'letters' | 'reports' | 'catalog' | 'articles' | 'invoices' | 'orders' | 'settings' | 'help';
export type InvoiceStatusFilter = 'all' | 'PAID' | 'PARTIAL' | 'UNPAID' | 'DRAFT';

type NavState = {
  moreSection: MoreSection | null;
  invoiceFilter: InvoiceStatusFilter;
  /** Invoice id the Sales tab should open in EDIT mode (null = new bill).
   *  Set by InvoicesScreen's Edit action; cleared on close, when the Sales tab
   *  is left, and by any plain `openMore`, so a "Create new bill" can never
   *  inherit a stale edit target. */
  editingInvoiceId: string | null;
  /** Opens a More sub-screen (e.g. from Home) with an optional invoice filter. */
  openMore: (section: MoreSection, invoiceFilter?: InvoiceStatusFilter) => void;
  /** Opens the Sales tab (billing) in edit mode for one invoice. */
  openEditBill: (invoiceId: string) => void;
  /** Drops the edit target so the Sales tab shows a fresh bill. */
  clearEditBill: () => void;
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
  openEditBill: invoiceId => set({moreSection: null, editingInvoiceId: invoiceId}),
  clearEditBill: () => set({editingInvoiceId: null}),
  closeMore: () => set({moreSection: null, editingInvoiceId: null}),
  setInvoiceFilter: invoiceFilter => set({invoiceFilter}),
}));