import { create } from "zustand";
import { useShallow } from "zustand/react/shallow";
import { DCDetail, DCItemRow, POHeader } from "@/types";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/utils";

const generateDefaultNotes = (dcNumber: string = "", date?: string) => {
    const today = formatDate(date || new Date().toISOString());
    return [
        `GST Bill No.   Dt. ${today}`,
        `Guarantee Certificate No.   Dt. ${today}`,
        "Dimension Report ",
        "TC No:-   dt.   Of ",
        "TC No   dt.   Of ",
        "Lot No.   - ",
        `Consignment Value of Engineering PSU DC ${dcNumber || ""}`
    ];
};

interface DCState {
    data: DCDetail | null;
    originalData: DCDetail | null;
    isEditing: boolean;
    poData: POHeader | null;
    notes: string[];
    isCheckingNumber: boolean;
    isDuplicateNumber: boolean;
    conflictType: string | null;

    setDC: (data: DCDetail) => void;
    setHeader: (header: any) => void;
    updateHeader: (field: string, value: any) => void;
    updateItem: (index: number, field: string, value: any) => void;
    setEditing: (isEditing: boolean) => void;
    reset: () => void;

    setPOData: (data: POHeader | null) => void;
    setItems: (items: DCItemRow[]) => void;
    setNotes: (notes: string[]) => void;
    addNote: () => void;
    updateNote: (index: number, value: string) => void;
    removeNote: (index: number) => void;
    setNumberStatus: (isChecking: boolean, isDuplicate: boolean, conflictType: string | null) => void;
    clear: () => void;
}

export const useDCStore = create<DCState>((set) => ({
    data: null,
    originalData: null,
    isEditing: false,
    poData: null,
    notes: generateDefaultNotes(),
    isCheckingNumber: false,
    isDuplicateNumber: false,
    conflictType: null,

    setDC: (data: DCDetail) => set({
        data,
        originalData: data,
        notes: data.header.remarks ? data.header.remarks.split("\n\n") : []
    }),
    setHeader: (header: POHeader) => set((state: DCState) => ({
        data: state.data ? { ...state.data, header } : { header, items: [] }
    }) as Partial<DCState>),
    updateHeader: (field: string, value: any) => set((state: DCState) => {
        if (!state.data) return state;

        // Sync dates in notes if dc_date changes
        let newNotes = state.notes;
        if (field === "dc_date" && value) {
            const dateStr = formatDate(value);
            if (dateStr !== "-") {
                newNotes = state.notes.map((note: string, i: number) => {
                    // Update First two lines: GST Bill No and Guarantee Cert
                    if (i === 0 || i === 1) {
                        // Robust regex: Matches "Dt." followed by anything until end or defined pattern
                        if (note.includes("Dt.")) {
                            return note.replace(/Dt\..*$/, `Dt. ${dateStr}`);
                        }
                    }
                    return note;
                });
            }
        }

        return {
            notes: newNotes,
            data: {
                ...state.data,
                header: {
                    ...state.data.header,
                    [field]: value
                }
            }
        } as Partial<DCState>;
    }),
    updateItem: (index: number, field: string, value: any) => set((state: DCState) => {
        if (!state.data || !state.data.items) return state;
        const newItems = [...state.data.items];
        newItems[index] = { ...newItems[index], [field]: value };
        return {
            data: {
                ...state.data,
                items: newItems
            }
        } as Partial<DCState>;
    }),
    setEditing: (isEditing: boolean) => set({ isEditing }),
    reset: () => set((state: DCState) =>
        state.originalData
            ? ({ data: state.originalData, isEditing: false } as Partial<DCState>)
            : ({ data: null, isEditing: false, poData: null, notes: generateDefaultNotes() } as Partial<DCState>)
    ),

    setPOData: (poData: POHeader | null) => set((state: DCState) => ({
        poData
    }) as Partial<DCState>),
    setItems: (items: DCItemRow[]) => set((state: DCState) => ({
        data: state.data ? { ...state.data, items } : { header: {} as any, items }
    }) as Partial<DCState>),
    setNotes: (notes: string[]) => set({ notes } as Partial<DCState>),
    addNote: () => set((state: DCState) => ({ notes: [...state.notes, ""] }) as Partial<DCState>),
    updateNote: (index: number, value: string) => set((state: DCState) => {
        const newNotes = [...state.notes];
        newNotes[index] = value;
        return { notes: newNotes } as Partial<DCState>;
    }),
    removeNote: (index: number) => set((state: DCState) => ({
        notes: state.notes.filter((_: string, i: number) => i !== index)
    }) as Partial<DCState>),
    setNumberStatus: (isCheckingNumber: boolean, isDuplicateNumber: boolean, conflictType: string | null) =>
        set({ isCheckingNumber, isDuplicateNumber, conflictType } as Partial<DCState>),
    clear: () => set({
        data: null,
        originalData: null,
        poData: null,
        notes: generateDefaultNotes(),
        isEditing: false,
        isCheckingNumber: false,
        isDuplicateNumber: false,
        conflictType: null
    })
}));

// Optimized Selectors
export const useDCHeader = () => useDCStore(useShallow((s: DCState) => s.data?.header));
export const useDCItems = () => useDCStore(useShallow((s: DCState) => s.data?.items || []));
export const usePOData = () => useDCStore(useShallow((s: DCState) => s.poData));
export const useDCNotes = () => useDCStore(useShallow((s: DCState) => s.notes));
export const useDCNumberStatus = () => useDCStore(useShallow((s: DCState) => ({
    isChecking: s.isCheckingNumber,
    isDuplicate: s.isDuplicateNumber,
    conflictType: s.conflictType
})));
export const useDCActions = () => useDCStore(useShallow((s: DCState) => ({
    updateHeader: s.updateHeader,
    setHeader: s.setHeader,
    updateItem: s.updateItem,
    setPOData: s.setPOData,
    setItems: s.setItems,
    addNote: s.addNote,
    updateNote: s.updateNote,
    removeNote: s.removeNote,
    setNumberStatus: s.setNumberStatus,
    clear: s.clear
})));
