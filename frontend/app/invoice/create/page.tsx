"use client";
import { Accounting, ActionConfirmationModal, Autocomplete, Badge, Button, DocumentTemplate, Input, Label, SearchBar, Caption2, AsyncAutocomplete } from "@/components/common";

import React, { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Save, Loader2, AlertCircle, Receipt } from "lucide-react";
import { api, type Buyer } from "@/lib/api";
import { SearchResult } from "@/types";
import { useInvoiceStore } from "@/store/invoiceStore";
import { InvoiceSheet } from "@/components/modules/invoice/InvoiceSheet";
import { useDebounce } from "@/hooks/useDebounce";

function CreateInvoicePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const dcIdFromUrl = searchParams?.get("dc") || "";

  const data = useInvoiceStore(s => s.data);
  const isCheckingNumber = useInvoiceStore(s => s.isCheckingNumber);
  const isDuplicateNumber = useInvoiceStore(s => s.isDuplicateNumber);
  const setHeader = useInvoiceStore(s => s.setHeader);
  const setInvoice = useInvoiceStore(s => s.setInvoice);
  const updateHeader = useInvoiceStore(s => s.updateHeader);
  const setDCData = useInvoiceStore(s => s.setDCData);
  const setItems = useInvoiceStore(s => s.setItems);
  const setNumberStatus = useInvoiceStore(s => s.setNumberStatus);
  const reset = useInvoiceStore(s => s.reset);
  const clear = useInvoiceStore(s => s.clear);

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manualDcId, setManualDcId] = useState(dcIdFromUrl);
  const [isInitialized, setIsInitialized] = useState(false);

  const [buyers, setBuyers] = useState<Buyer[]>([]);
  const [selectedBuyerId, setSelectedBuyerId] = useState<string>("");
  const [showWarning, setShowWarning] = useState(false);
  const [companySettings, setCompanySettings] = useState<any>(null);
  const [taxRates, setTaxRates] = useState({ cgst: 9.0, sgst: 9.0 });

  const defaultHeader = {
    invoice_number: "",
    invoice_date: new Date().toISOString().split("T")[0],
    dc_number: dcIdFromUrl,
    payment_terms: "45",
    buyer_name: "",
    buyer_gstin: "",
    buyer_address: "",
    buyer_state: "",
    place_of_supply: "",
    total_taxable_value: 0,
    cgst_total: 0,
    sgst_total: 0,
    total_invoice_value: 0,
  } as any;

  // STRICT GATE: Ignore store data until fully initialized and reset
  const header = (isInitialized && data?.header) ? data.header : defaultHeader;
  const items = (isInitialized && data?.items) ? data.items : [];
  const debouncedInvoiceNumber = useDebounce(header.invoice_number, 500);

  useEffect(() => {
    if (debouncedInvoiceNumber && debouncedInvoiceNumber.length >= 3) {
      checkNumberDuplicate(debouncedInvoiceNumber, header.invoice_date);
    } else {
      setNumberStatus(false, false);
    }
  }, [debouncedInvoiceNumber, header.invoice_date]);

  useEffect(() => {
    // Prevent hydration flicker by resetting store BEFORE rendering form
    // CRITICAL FIX: Use setInvoice instead of clear+setHeader to guarantee atomic replacement and no stale merge.
    setIsInitialized(false);
    setInvoice({
      header: {
        invoice_number: "",
        invoice_date: new Date().toISOString().split("T")[0],
        payment_terms: "45",
      } as any,
      items: []
    });
    fetchInitialData();

    // Cleanup on unmount to prevent stale data persisting to next session
    return () => {
      reset();
    };
  }, [dcIdFromUrl]);



  const fetchInitialData = async () => {
    try {
      const [buyerList, settings] = await Promise.all([
        api.getBuyers(),
        api.getSettings()
      ]);
      setBuyers(buyerList);

      if (settings) {
        setCompanySettings(settings);
        const cgst = parseFloat((settings as any).cgst_rate) || 9.0;
        const sgst = parseFloat((settings as any).sgst_rate) || 9.0;
        setTaxRates({ cgst, sgst });
      }

      // Auto-select default buyer or first available if no DC is linked
      if (!dcIdFromUrl && buyerList.length > 0) {
        const defaultBuyer = buyerList.find(b => b.is_default) || buyerList[0];
        setSelectedBuyerId(defaultBuyer.id.toString());
        applyBuyerToStore(defaultBuyer);
      }

      if (dcIdFromUrl) {
        await loadDC(dcIdFromUrl, settings, buyerList);
      }
    } catch (e) {
      console.error(e);
    } finally {
      // P1 HARDENING: Only show form after data is ready to prevent flicker
      setIsInitialized(true);
    }
  };

  const applyBuyerToStore = (buyer: Buyer) => {
    const updatedHeader = {
      ...header,
      buyer_name: buyer.name,
      buyer_gstin: buyer.gstin,
      buyer_address: (buyer as any).address || buyer.billing_address,
      buyer_state: buyer.state || "",
      buyer_state_code: buyer.state_code || "",
      place_of_supply: buyer.place_of_supply,
    };
    setHeader(updatedHeader);
  };

  const handleBuyerChange = (id: string) => {
    setSelectedBuyerId(id);
    const buyer = buyers.find((b) => b.id.toString() === id);
    if (buyer) applyBuyerToStore(buyer);
  };

  const checkNumberDuplicate = async (num: string, date: string) => {
    if (!num || num.length < 3) return;
    setNumberStatus(true, false);
    try {
      const res = await api.checkDuplicateNumber("Invoice", num, date);
      setNumberStatus(false, res.exists);
    } catch {
      setNumberStatus(false, false);
    }
  };

  const loadDC = async (id: string, existingSettings?: any, buyerList?: Buyer[]) => {
    if (!id) return;
    setIsLoading(true);
    setError(null);
    try {
      const preview = await api.getInvoicePreview(id);

      const initialHeader = {
        invoice_number: "",
        invoice_date: new Date().toISOString().split("T")[0],
        payment_terms: "45 Days",
        ...preview.header, // Spread backend-generated header
        // FORCE OVERRIDE: Do not use DC snapshot for Supplier. Use Settings (handled by InvoiceSheet fallback).
        supplier_name: "",
        supplier_address: "",
        supplier_gstin: "",
        supplier_contact: "",
        // FORCE OVERRIDE: Do not blindly use DC Consignee as Buyer. Only use if matched.
        buyer_name: "",
        buyer_address: "",
        buyer_gstin: "",
        buyer_state: "",
        buyer_state_code: "",
        place_of_supply: "",
      };

      // Match Buyer
      const currentBuyerList = buyerList || buyers;
      if (currentBuyerList.length > 0 && preview.header.buyer_name) {
        const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
        const targetName = normalize(preview.header.buyer_name);

        const match = currentBuyerList.find(b => {
          const bName = normalize(b.name);
          return bName.includes(targetName) || targetName.includes(bName);
        });

        if (match) {
          setSelectedBuyerId(match.id.toString());
          Object.assign(initialHeader, {
            buyer_name: match.name,
            buyer_gstin: match.gstin,
            buyer_address: (match as any).address || match.billing_address,
            buyer_state: match.state,
            buyer_state_code: match.state_code,
            place_of_supply: match.place_of_supply
          });
        } else {
          // Fallback: Use Default or First Buyer if no match is found
          const defaultBuyer = currentBuyerList.find(b => b.is_default) || currentBuyerList[0];
          if (defaultBuyer) {
            setSelectedBuyerId(defaultBuyer.id.toString());
            Object.assign(initialHeader, {
              buyer_name: defaultBuyer.name,
              buyer_gstin: defaultBuyer.gstin,
              buyer_address: (defaultBuyer as any).address || defaultBuyer.billing_address,
              buyer_state: defaultBuyer.state,
              buyer_state_code: defaultBuyer.state_code,
              place_of_supply: defaultBuyer.place_of_supply
            });
          }
        }
      } else if (currentBuyerList.length > 0) {
        // No buyer name in DC Header at all? Use Default.
        const defaultBuyer = currentBuyerList.find(b => b.is_default) || currentBuyerList[0];
        if (defaultBuyer) {
          setSelectedBuyerId(defaultBuyer.id.toString());
          Object.assign(initialHeader, {
            buyer_name: defaultBuyer.name,
            buyer_gstin: defaultBuyer.gstin,
            buyer_address: (defaultBuyer as any).address || defaultBuyer.billing_address,
            buyer_state: defaultBuyer.state,
            buyer_state_code: defaultBuyer.state_code,
            place_of_supply: defaultBuyer.place_of_supply
          });
        }
      }

      setHeader(initialHeader as any);
      setItems(preview.items); // Items already consolidated and calculated by backend

    } catch (err: any) {
      // Handle the strict error from backend (Already invoiced, Not found)
      setError(err.message || "Failed to load DC");
    } finally {
      setIsLoading(false);
    }
  };

  const updateItemProperty = (index: number, key: string, value: any) => {
    const newItems = [...items];
    const item = { ...newItems[index], [key]: value };

    const taxableValue = (item.quantity || 0) * (item.rate || 0);
    item.taxable_value = taxableValue;
    item.cgst_amount = (taxableValue * taxRates.cgst) / 100;
    item.sgst_amount = (taxableValue * taxRates.sgst) / 100;
    item.total_amount = taxableValue + item.cgst_amount + item.sgst_amount;

    newItems[index] = item;
    setItems(newItems);
    calculateTotals(newItems);
  };

  const calculateTotals = (currentItems: any[]) => {
    const taxable = currentItems.reduce((sum, item) => sum + (item.taxable_value || 0), 0);
    const cgst = currentItems.reduce((sum, item) => sum + (item.cgst_amount || 0), 0);
    const sgst = currentItems.reduce((sum, item) => sum + (item.sgst_amount || 0), 0);
    const total = taxable + cgst + sgst;

    setHeader({
      ...useInvoiceStore.getState().data?.header || header,
      total_taxable_value: taxable,
      cgst_total: cgst,
      sgst_total: sgst,
      total_invoice_value: total
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    setShowWarning(false);

    if (!header.buyer_name || !header.invoice_number) {
      setError("Please ensure Invoice Number and Buyer details are present.");
      setIsSaving(false);
      return;
    }

    if (isDuplicateNumber) {
      setError("Duplicate Invoice Number detected. Must be unique across DCs and Invoices.");
      setIsSaving(false);
      return;
    }

    try {
      const payload = { ...header, buyer_id: Number(selectedBuyerId) || null, items: items };
      await api.createInvoice(payload);
      router.push(`/invoice/${header.invoice_number}`);
    } catch (err: any) {
      setError(err.message || "Failed to create invoice");
    } finally {
      setIsSaving(false);
    }
  };

  const isGenerateMode = !!dcIdFromUrl;

  const topActions = (
    <div className="flex items-center gap-4">
      {!isGenerateMode && (
        <div className="flex items-center gap-2 mr-4">
          <AsyncAutocomplete
            placeholder="Search & Link DC..."
            value={manualDcId || ""}
            onChange={setManualDcId}
            fetcher={async (q: string) => {
              const res = await api.searchGlobal(q);
              return res.filter((r: SearchResult) => r.type === "DC");
            }}
            getLabel={(item: SearchResult) => item.number}
            renderOption={(item: SearchResult) => (
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center justify-between">
                  <span className="font-[500] text-text-primary">{item.number}</span>
                  <span className="text-[11px] text-text-tertiary">{item.date}</span>
                </div>
                <div className="text-[11px] text-text-secondary truncate">{item.party}</div>
              </div>
            )}
            onSelect={(item: SearchResult) => loadDC(item.number)}
            className="w-64"
          />
          <Button
            variant="secondary"
            onClick={() => manualDcId && loadDC(manualDcId)}
            disabled={!manualDcId || isLoading}
          >
            {isLoading ? <Loader2 size={16} className="animate-spin" /> : "Link DC"}
          </Button>
        </div>
      )}
      <Button variant="ghost" onClick={() => router.back()} disabled={isSaving}>Cancel</Button>
      <Button
        variant="primary"
        onClick={() => setShowWarning(true)}
        disabled={isSaving || !header.invoice_number || items.length === 0 || !header.buyer_name || isDuplicateNumber || isCheckingNumber}
      >
        {isSaving ? <Loader2 size={16} className="animate-spin mr-2" /> : <Save size={16} className="mr-2" />}
        Save Invoice
      </Button>
    </div>
  );

  if (!isInitialized) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-surface-nav">
        <div className="flex flex-col items-center gap-6">
          <div className="w-16 h-16 rounded-[2rem] bg-white/80 shadow-tahoe-elevated flex items-center justify-center glass border border-white/60">
            <Loader2 className="animate-spin text-action-primary" size={32} />
          </div>
          <p className="text-[11px] font-[700] text-text-tertiary uppercase tracking-[0.2em] animate-pulse">Initializing Terminal...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-nav pb-20 font-inter">
      <DocumentTemplate
        title="Create Invoice"
        description={isGenerateMode ? "Reconciling with Delivery Challan" : "Generate new financial document"}
        actions={topActions}
        onBack={() => router.back()}
        icon={<Receipt size={24} />}
      >
        {error && (
          <div className="mx-auto max-w-7xl px-8 mt-8">
            <div className="p-5 bg-status-error/10 border border-status-error/20 rounded-[2rem] flex items-center gap-4 text-status-error shadow-sm glass animate-in fade-in slide-in-from-top-4 duration-500">
              <AlertCircle size={20} />
              <p className="text-[13px] font-[700] tracking-tight">{error}</p>
            </div>
          </div>
        )}

        <div className="max-w-7xl mx-auto px-8 py-6 flex flex-col gap-8">
          <div className="space-y-6">
            <div className="space-y-6">
              <InvoiceSheet
                header={header}
                items={items}
                companySettings={companySettings}
                taxRates={taxRates}
                editable={true}
                onUpdateHeader={updateHeader}
                onUpdateItem={updateItemProperty}
                isDuplicateNumber={isDuplicateNumber}
                isCheckingNumber={isCheckingNumber}
                buyerActions={
                  <Autocomplete
                    value={selectedBuyerId}
                    onChange={(val) => handleBuyerChange(val)}
                    options={buyers.map(b => ({
                      value: b.id.toString(),
                      label: b.name,
                      subLabel: b.gstin
                    }))}
                    placeholder="Search & Select Buyer..."
                    className="max-w-[240px]"
                  />
                }
              />

              <div className="p-6 glass-elevated rounded-[2.5rem] border-none shadow-glass max-w-[1400px] mx-auto mt-8">
                <Caption2 className="text-action-primary font-[700] leading-relaxed text-center uppercase tracking-widest opacity-60">
                  Note: This is a computer-rendered document draft. Verify all details before saving.
                </Caption2>
              </div>
            </div>
          </div>
        </div >
      </DocumentTemplate >

      <ActionConfirmationModal
        isOpen={showWarning}
        onClose={() => setShowWarning(false)}
        onConfirm={handleSave}
        title="Generate Invoice?"
        subtitle="Financial Lock Action"
        warningText="Generating this invoice will finalize financial reconciliation."
        confirmLabel="Generate"
        cancelLabel="Cancel"
      />
    </div >
  );
}

export default function CreateInvoicePage() {
  return (
    <Suspense fallback={<div className="h-screen w-full bg-background animate-pulse" />}>
      <CreateInvoicePageContent />
    </Suspense>
  );
}
