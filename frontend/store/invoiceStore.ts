import { create } from "zustand";
import { useShallow } from "zustand/react/shallow";
import { InvoiceDetail, InvoiceHeader, InvoiceItem } from "@/types";

interface InvoiceState {
    data: InvoiceDetail | null;
    isEditing: boolean;
    dcData: any | null; // For creation flow
    isCheckingNumber: boolean;
    isDuplicateNumber: boolean;

    setInvoice: (data: InvoiceDetail) => void;
    setHeader: (header: InvoiceHeader) => void;
    updateHeader: (field: string, value: any) => void;
    updateItem: (index: number, field: string, value: any) => void;
    setEditing: (isEditing: boolean) => void;
    setDCData: (data: any) => void;
    setItems: (items: InvoiceItem[]) => void;
    setNumberStatus: (checking: boolean, duplicate: boolean) => void;
    reset: () => void;
    clear: () => void;
}

export const useInvoiceStore = create<InvoiceState>((set) => ({
    data: null,
    isEditing: false,
    dcData: null,
    isCheckingNumber: false,
    isDuplicateNumber: false,

    setInvoice: (data) => set({ data, isEditing: false }),
    setHeader: (header) => set((state) => ({
        data: state.data ? { ...state.data, header } : { header, items: [] } as any
    })),
    updateHeader: (field, value) => set((state) => {
        if (!state.data) return state;
        return {
            data: {
                ...state.data,
                header: {
                    ...state.data.header,
                    [field]: value
                }
            }
        };
    }),
    updateItem: (index, field, value) => set((state) => {
        if (!state.data || !state.data.items) return state;
        const newItems = [...state.data.items];
        newItems[index] = { ...newItems[index], [field]: value };
        return {
            data: {
                ...state.data,
                items: newItems
            }
        };
    }),
    setEditing: (isEditing) => set({ isEditing }),
    setDCData: (dcData) => set({ dcData }),
    setItems: (items) => set((state) => ({
        data: state.data ? { ...state.data, items } : { items } as any
    })),
    setNumberStatus: (isCheckingNumber, isDuplicateNumber) => set({ isCheckingNumber, isDuplicateNumber }),
    reset: () => set({ data: null, isEditing: false, dcData: null, isCheckingNumber: false, isDuplicateNumber: false }),
    clear: () => set({ data: null, isEditing: false, dcData: null, isCheckingNumber: false, isDuplicateNumber: false })
}));

// Optimized Selectors - Prevent unnecessary re-renders
export const useInvoiceHeader = () => useInvoiceStore(useShallow(s => s.data?.header));
export const useInvoiceItems = () => useInvoiceStore(useShallow(s => s.data?.items || []));
export const useInvoiceDCData = () => useInvoiceStore(useShallow(s => s.dcData));
export const useInvoiceNumberStatus = () => useInvoiceStore(useShallow(s => ({
    isChecking: s.isCheckingNumber,
    isDuplicate: s.isDuplicateNumber
})));
export const useInvoiceActions = () => useInvoiceStore(useShallow(s => ({
    setInvoice: s.setInvoice,
    setHeader: s.setHeader,
    updateHeader: s.updateHeader,
    updateItem: s.updateItem,
    setEditing: s.setEditing,
    setDCData: s.setDCData,
    setItems: s.setItems,
    setNumberStatus: s.setNumberStatus,
    reset: s.reset
})));
