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

export type MoreSection = 'letters' | 'reports' | 'catalog' | 'invoices' | 'advances' | 'settings';
export type InvoiceStatusFilter = 'all' | 'PAID' | 'PARTIAL' | 'UNPAID' | 'DRAFT';

type NavState = {
  moreSection: MoreSection | null;
  invoiceFilter: InvoiceStatusFilter;
  /** Opens a More sub-screen (e.g. from Home) with an optional invoice filter. */
  openMore: (section: MoreSection, invoiceFilter?: InvoiceStatusFilter) => void;
  /** Back to the More list. */
  closeMore: () => void;
  setInvoiceFilter: (filter: InvoiceStatusFilter) => void;
};

export const useNavStore = create<NavState>(set => ({
  moreSection: null,
  invoiceFilter: 'all',
  openMore: (section, invoiceFilter) =>
    set({moreSection: section, invoiceFilter: invoiceFilter ?? 'all'}),
  closeMore: () => set({moreSection: null}),
  setInvoiceFilter: invoiceFilter => set({invoiceFilter}),
}));