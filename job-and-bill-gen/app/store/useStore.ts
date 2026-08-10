import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import {
  JobLetterData,
  BillData,
  defaultFormData,
  defaultBillData,
} from "@/app/types";

interface CompanyDetails {
  name: string;
  email: string;
  address: string;
  logo?: string;
  phoneNumber?: string;
}

export interface SavedDocument {
  id: string;
  type: "invoice" | "job-letter";
  title: string;
  clientName: string;
  date: string;
  status: "draft" | "paid" | "pending" | "sent";
  amount?: number;
  data: JobLetterData | BillData;
}

interface SettingsState {
  theme: "light" | "dark";
  sidebarCollapsed: boolean;
  companyDetails: CompanyDetails;
  documents: SavedDocument[];
  setTheme: (theme: "light" | "dark") => void;
  toggleSidebar: () => void;
  updateCompanyDetails: (details: Partial<CompanyDetails>) => void;
  addDocument: (doc: SavedDocument) => void;
  updateDocument: (id: string, doc: Partial<SavedDocument>) => void;
  deleteDocument: (id: string) => void;
  getDocument: (id: string) => SavedDocument | undefined;
  clearAllDocuments: () => void;
  resetAll: () => void;
}

const defaultCompanyDetails: CompanyDetails = {
  name: "",
  email: "",
  address: "",
};

export const useStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      theme: "dark",
      sidebarCollapsed: false,
      companyDetails: defaultCompanyDetails,
      documents: [],
      setTheme: (theme) => set({ theme }),
      toggleSidebar: () =>
        set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      updateCompanyDetails: (details) =>
        set((state) => ({
          companyDetails: { ...state.companyDetails, ...details },
        })),
      addDocument: (doc) =>
        set((state) => ({
          documents: [doc, ...state.documents],
        })),
      updateDocument: (id, updates) =>
        set((state) => ({
          documents: state.documents.map((doc) =>
            doc.id === id ? { ...doc, ...updates } : doc,
          ),
        })),
      deleteDocument: (id) =>
        set((state) => ({
          documents: state.documents.filter((d) => d.id !== id),
        })),
      getDocument: (id) => get().documents.find((d) => d.id === id),
      clearAllDocuments: () => set({ documents: [] }),
      resetAll: () =>
        set({
          documents: [],
          companyDetails: defaultCompanyDetails,
        }),
    }),
    {
      name: "app-storage",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);

// Re-export types for convenience
export type { JobLetterData, BillData };
export { defaultFormData, defaultBillData };
