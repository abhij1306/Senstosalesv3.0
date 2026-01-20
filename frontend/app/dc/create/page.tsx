"use client";

import { ActionConfirmationModal, Badge, Button, DocumentTemplate, SearchBar, useToast, AsyncAutocomplete } from "@/components/common";
import { DCHeaderInfo } from "@/components/modules/dc/DCHeaderInfo";
import { DCTable } from "@/components/modules/dc/DCTable";

import React, { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Save, AlertCircle, Loader2, Truck } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { DCItemRow, SearchResult } from "@/types";
import { useDCHeader, useDCItems, usePOData, useDCNotes, useDCNumberStatus, useDCActions } from "@/store/dcStore";
import { useDebounce } from "@/hooks/useDebounce";

function CreateDCPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const initialPoNumber = searchParams ? searchParams.get("po") : "";

  // Simplified header - logistics removed per user requirement
  const defaultHeader = {
    dc_number: "",
    dc_date: new Date().toISOString().split("T")[0],
    our_ref: "",  // NEW: Our Ref field
    consignee_name: "",
    consignee_address: "",
    department_no: "",  // DVN - fetched from PO
    gc_number: "",
    gc_date: new Date().toISOString().split("T")[0],
  };

  const [poNumber, setPONumber] = useState(initialPoNumber || "");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showWarning, setShowWarning] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // Track if user manually edited GC fields (to prevent auto-overwrite)
  const gcNumberEditedByUser = React.useRef(false);
  const gcDateEditedByUser = React.useRef(false);

  // Read store state - but gate behind isInitialized to prevent stale data flash
  const storeHeader = useDCHeader();
  const header = isInitialized ? (storeHeader || defaultHeader) : defaultHeader;
  const items = useDCItems();
  const poData = usePOData();
  const notes = useDCNotes();
  const { isChecking: isCheckingNumber, isDuplicate: isDuplicateNumber, conflictType } = useDCNumberStatus();
  const { updateHeader, setHeader, updateItem, setPOData, setItems, addNote, updateNote, removeNote, setNumberStatus, clear } = useDCActions();

  const debouncedDCNumber = useDebounce(header.dc_number, 500);

  useEffect(() => {
    if (!isInitialized) return;
    if (debouncedDCNumber && debouncedDCNumber.trim() !== "") {
      checkNumberDuplicate(debouncedDCNumber, header.dc_date);
      // Keep syncing GC Number with DC Number as long as user hasn't manually edited it
      if (!gcNumberEditedByUser.current) {
        updateHeader("gc_number", debouncedDCNumber);
      }
      // Keep syncing GC Date with DC Date as long as user hasn't manually edited it
      if (!gcDateEditedByUser.current) {
        updateHeader("gc_date", header.dc_date);
      }
    } else {
      setNumberStatus(false, false, null);
    }
  }, [debouncedDCNumber, isInitialized, header.dc_date]); // Added header.dc_date back to ensure GC Date syncs when DC Date changes

  const groupedItems = React.useMemo(() => {
    return Object.values(items.reduce((acc, item) => {
      const key = item.po_item_id;
      if (!acc[key]) acc[key] = [];
      acc[key].push(item);
      return acc;
    }, {} as Record<string, typeof items>));
  }, [items]);

  useEffect(() => {
    const init = async () => {
      setIsInitialized(false); // Flag as not ready
      clear(); // Force clear stale data
      if (initialPoNumber) {
        await loadInitialData(initialPoNumber);
      }
      setIsInitialized(true);
    };
    init();
    return () => { setIsInitialized(false); clear(); };
  }, [initialPoNumber]);

  const loadInitialData = async (po: string) => {
    setIsLoading(true);
    setError(null);
    try {
      // P1 PERFORMANCE FIX: Use lean endpoint with pre-computed balances
      const data = await api.getDispatchableItems(po);

      if (!data || !data.items) {
        setError("No dispatchable items found for this PO.");
        setIsLoading(false);
        return;
      }

      // Items come pre-filtered (balance > 0) and pre-computed from backend
      const mappedItems: DCItemRow[] = data.items.map((item: any) => ({
        id: item.id,
        po_item_id: item.po_item_id.toString(),
        po_item_no: item.po_item_no,
        lot_no: item.lot_no,
        material_code: item.material_code,
        description: item.description,
        drg_no: item.drg_no,
        mtrl_cat: item.mtrl_cat,
        unit: item.unit,
        po_rate: item.po_rate,
        ord_qty: item.ord_qty,
        dsp_qty: item.dsp_qty,
        rcd_qty: item.rcd_qty,
        dispatch_qty: 0,
        pending_post_dc: item.balance_quantity,
        original_pending: item.balance_quantity,
        dely_date: item.dely_date,
      }));

      // AGGREGATE LOTS TO ITEMS (New Item-level Requirement)
      const aggregatedMap: Record<string, DCItemRow> = {};
      mappedItems.forEach(item => {
        const key = item.po_item_id;
        if (!aggregatedMap[key]) {
          aggregatedMap[key] = { ...item, lot_no: undefined }; // Item-level row
        } else {
          // Accumulate quantities for the same PO item
          aggregatedMap[key].ord_qty = (aggregatedMap[key].ord_qty || 0) + (item.ord_qty || 0);
          aggregatedMap[key].dsp_qty = (aggregatedMap[key].dsp_qty || 0) + (item.dsp_qty || 0);
          aggregatedMap[key].rcd_qty = (aggregatedMap[key].rcd_qty || 0) + (item.rcd_qty || 0);
          aggregatedMap[key].original_pending = (aggregatedMap[key].original_pending || 0) + (item.original_pending || 0);
          aggregatedMap[key].pending_post_dc = (aggregatedMap[key].pending_post_dc || 0) + (item.pending_post_dc || 0);
        }
      });

      const aggregatedItems = Object.values(aggregatedMap);
      setItems(aggregatedItems);

      if (data.header) {
        setPOData(data.header);
        setHeader({
          dc_number: "",
          dc_date: new Date().toISOString().split("T")[0],
          our_ref: data.header.our_ref || "",  // Fetch from PO if available
          consignee_name: data.header.consignee_name || "",
          consignee_address: data.header.consignee_address || "",
          department_no: data.header.department_no || "",  // DVN from PO
        });
      }

      if (aggregatedItems.length === 0) {
        setError("No dispatchable items remaining for this PO.");
      }
    } catch (err: any) {
      console.error("Load Error:", err);
      setError(err.message || "Failed to load initial data");
    } finally {
      setIsLoading(false);
    }
  };

  const checkNumberDuplicate = async (num: string, date: string) => {
    if (!num || num.trim() === "") return;
    setNumberStatus(true, false, null);
    try {
      const res = await api.checkDuplicateNumber("DC", num, date);
      setNumberStatus(false, res.exists, res.conflict_type || null);
    } catch {
      setNumberStatus(false, false, null);
      toast("Duplicate Check Failed", "Could not verify DC number uniqueness. Please check connection.", "warning");
    }
  };

  const handleSave = () => {
    if (!header.dc_number || !header.dc_date) {
      setError("DC Number and Date are required");
      return;
    }
    if (isDuplicateNumber) {
      setError("Duplicate Number detected. Must be unique across DCs and Invoices.");
      return;
    }
    if (items.some(i => (i.dispatch_qty || 0) > 0)) {
      setShowWarning(true);
    } else {
      setError("Please dispatch at least one item.");
    }
  };

  const confirmSave = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      const dcPayload = {
        dc_number: header.dc_number,
        dc_date: header.dc_date,
        our_ref: header.our_ref || "",
        po_number: poData?.po_number || initialPoNumber || poNumber || undefined,
        consignee_name: header.consignee_name,
        consignee_address: header.consignee_address,
        department_no: header.department_no ? parseInt(header.department_no.toString()) || null : null,
        remarks: notes.join("\n\n"),
        gc_number: header.gc_number || header.dc_number,
        gc_date: header.gc_date || header.dc_date,
      };

      const dispatchItems = items.filter(i => (i.dispatch_qty || 0) > 0);
      const itemsPayload = dispatchItems.map((item) => ({
        po_item_id: item.po_item_id,
        lot_no: item.lot_no ? parseInt(item.lot_no.toString()) : undefined,
        dispatch_qty: item.dispatch_qty,
        hsn_code: null,
        hsn_rate: null,
      }));

      const response = await api.createDC(dcPayload, itemsPayload) as any;
      setNumberStatus(false, false, null);
      router.push(`/dc/${response.dc_number || header.dc_number}`);

    } catch (err: any) {
      if (err.status === 422 && Array.isArray(err.data?.detail)) {
        const details = err.data.detail.map((d: any) => `${d.loc.join(".")}: ${d.msg}`).join(", ");
        setError(`Validation Error: ${details}`);
      } else {
        setError(err.message || "Failed to create Delivery Challan");
      }
      setIsSubmitting(false);
    } finally {
      setShowWarning(false);
    }
  };

  const totalDCValue = items.reduce((sum, i) => sum + ((i.dispatch_qty || 0) * (i.po_rate || 0)), 0);
  const isGenerateMode = !!initialPoNumber;

  // Sync totalDCValue into the "Consignment Value" note
  useEffect(() => {
    if (!isInitialized) return;
    const formattedValue = totalDCValue.toLocaleString('en-IN', { style: 'currency', currency: 'INR' });
    const noteIndex = notes.findIndex(n => n.trim().startsWith("Consignment Value of Document"));
    if (noteIndex !== -1) {
      const newNote = `Consignment Value of Document DC ${formattedValue}`;
      if (notes[noteIndex] !== newNote) {
        updateNote(noteIndex, newNote);
      }
    }
  }, [totalDCValue, isInitialized]);

  if (!isInitialized || isLoading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-surface-nav">
        <div className="flex flex-col items-center gap-6">
          <div className="w-16 h-16 rounded-2xl bg-white shadow-sm flex items-center justify-center border border-border-default/50">
            <Loader2 className="animate-spin text-action-primary" size={32} />
          </div>
          <p className="text-xs font-bold text-text-tertiary animate-pulse">Initializing Document Terminal...</p>
        </div>
      </div>
    );
  }

  const topActions = (
    <div className="flex items-center gap-4">
      {!isGenerateMode && (
        <div className="flex items-center gap-2 mr-4">
          <AsyncAutocomplete
            placeholder="Search & Link PO..."
            value={poNumber || ""}
            onChange={setPONumber}
            fetcher={async (q: string) => {
              const res = await api.searchGlobal(q);
              return res.filter((r: SearchResult) => r.type === "PO");
            }}
            getLabel={(item: SearchResult) => item.number}
            renderOption={(item: SearchResult) => (
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-text-primary">{item.number}</span>
                  <span className="text-xs text-text-tertiary">{item.date}</span>
                </div>
                <div className="text-xs text-text-secondary truncate">{item.party}</div>
              </div>
            )}
            onSelect={(item: SearchResult) => loadInitialData(item.number)}
            className="w-64"
          />
          <Button
            variant="secondary"
            onClick={() => poNumber && loadInitialData(poNumber)}
            disabled={!poNumber || isLoading}
            className="whitespace-nowrap"
          >
            {isLoading ? <Loader2 size={16} className="animate-spin" /> : "Link PO"}
          </Button>
        </div>
      )}

      <Button variant="ghost" onClick={() => router.back()} disabled={isSubmitting}>Cancel</Button>
      <Button
        variant="primary"
        onClick={handleSave}
        disabled={isSubmitting || items.length === 0 || isDuplicateNumber || isCheckingNumber || !header.dc_number || isLoading}
      >
        {isSubmitting ? <Loader2 size={18} className="animate-spin mr-2" /> : <Save size={18} className="mr-2" />}
        {isSubmitting ? "Generating..." : "Save Challan"}
      </Button>
    </div>
  );

  return (
    <div className="min-h-screen bg-surface-nav pb-20">
      <DocumentTemplate
        title="Create Delivery Challan"
        description={
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-3">
              <div className="flex items-center text-sm">
                <span className="text-text-secondary mr-2 font-bold">PO Source:</span>
                {poData ? (
                  <span className="font-bold text-action-primary hover:underline cursor-pointer" onClick={() => window.open(`/po/${poData.po_number}`, '_blank')}>#{poData.po_number}</span>
                ) : <span className="text-text-tertiary">Unlinked</span>}
              </div>
            </div>
          </div>
        }
        actions={topActions}
        onBack={() => router.back()}
        icon={<Truck size={24} />}
      >
        {error && (
          <div className="mx-auto max-w-7xl px-8 mt-8">
            <div className="p-5 bg-status-error/10 border border-status-error/20 rounded-2xl flex items-center gap-4 text-status-error shadow-sm bg-surface animate-in fade-in slide-in-from-top-4 duration-500">
              <AlertCircle size={20} />
              <p className="text-sm font-bold tracking-tight">{error}</p>
            </div>
          </div>
        )}

        <div className="max-w-7xl mx-auto px-6 py-5 space-y-6">
          <div className="p-5 rounded-2xl border border-border-default/50 shadow-sm bg-surface">
            <DCHeaderInfo
              header={header}
              poData={poData}
              totalDCValue={totalDCValue}
              editable={true}
              onUpdateHeader={updateHeader}
              isDuplicateNumber={isDuplicateNumber}
              onCheckDuplicate={checkNumberDuplicate}
              gcNumberEditedByUser={gcNumberEditedByUser}
              gcDateEditedByUser={gcDateEditedByUser}
            />
          </div>

          <DCTable
            items={items}
            editable={true}
            onUpdateItem={updateItem}
            expandedItems={new Set()} // Create page usually has all items expanded or flat
            onToggleItem={() => { }}
            notes={notes}
            onAddNote={addNote}
            onUpdateNote={updateNote}
            onRemoveNote={removeNote}
            headerData={header}
          />
        </div>
      </DocumentTemplate >

      <ActionConfirmationModal
        isOpen={showWarning}
        onClose={() => setShowWarning(false)}
        onConfirm={confirmSave}
        title="Confirm Challan Generation"
        subtitle="Final verification before record locking"
        warningText="Generating this Delivery Challan will deduct quantities from the remaining PO balance. Ensure vehicle and consignee details match physical movement."
        confirmLabel={isSubmitting ? "Generating..." : "Generate DC Now"}
        variant="danger"
      />
    </div >
  );
}

// Local MetadataInput removed in favor of global FieldGroup


export default function CreateDCPage() {

  return (
    <Suspense fallback={<div className="h-screen w-full bg-background animate-pulse" />}>
      <CreateDCPageContent />
    </Suspense>
  );
}