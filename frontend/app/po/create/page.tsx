"use client";

import React, { useState, useCallback, useEffect, Suspense } from "react";
import { useRouter } from "next/navigation";
import { Save, Plus, Trash2, Package, Loader2, FileText, Calendar, Building2, Truck, ClipboardList, Info } from "lucide-react";
import {
  Accounting,
  Button,
  Input,
  Card,
  DocumentTemplate,
  Badge,
  StandardLabel,
  Caption1,
  Title3
} from "@/components/common";
import { api } from "@/lib/api";
import { usePOStore } from "@/store/poStore";
import { formatIndianCurrency } from "@/lib/utils";

function CreatePOPageContent() {
  const router = useRouter();
  const {
    data,
    setHeader,
    updateHeader,
    addItem,
    removeItem,
    updateItem,
    reset
  } = usePOStore();

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    reset();
    const defaultHeader = {
      po_number: "",
      po_date: new Date().toISOString().split("T")[0],
      supplier_name: "",
      supplier_code: "",
      supplier_phone: "",
      supplier_fax: "",
      supplier_email: "",
      department_no: "",
      enquiry_no: "",
      enquiry_date: "",
      quotation_ref: "",
      quotation_date: "",
      rc_no: "",
      order_type: "",
      po_status: "New",
      amend_no: 0,
      po_value: 0,
      fob_value: 0,
      net_po_value: 0,
      tin_no: "",
      ecc_no: "",
      mpct_no: "",
      inspection_by: "",
      inspection_at: "",
      consignee_name: "",
      consignee_address: "",
      issuer_name: "",
      issuer_designation: "",
      issuer_phone: "",
      remarks: "",
    };
    setHeader(defaultHeader);
  }, [setHeader, reset]);

  const { header, items = [] } = data || { header: {} as any, items: [] };

  const handleSave = useCallback(async () => {
    if (!data?.header?.po_number) {
      setError("PO Number is required");
      return;
    }
    if (!data?.header?.po_date) {
      setError("PO Date is required");
      return;
    }

    const invalidItems = items.filter(
      (item: any) => !item.material_description || !item.material_code || !item.unit || item.ord_qty <= 0 || item.po_rate <= 0
    );

    if (invalidItems.length > 0) {
      setError(`Item ${invalidItems[0].po_item_no} has missing mandatory fields (Description, Code, Unit, Qty, Rate)`);
      return;
    }

    setError(null);
    setSaving(true);
    try {
      const payload = {
        header: {
          ...data.header,
          po_number: String(data.header.po_number),
        },
        items: items.map((item: any) => ({
          ...item,
          item_value: item.item_value || (item.ord_qty || 0) * (item.po_rate || 0),
        })),
      };

      await api.createPO(payload);
      router.push(`/po/${data.header.po_number}`);
    } catch (err: any) {
      setError(err.message || "Failed to save Purchase Order");
    } finally {
      setSaving(false);
    }
  }, [data, items, router]);

  if (!data || !data.header) return (
    <div className="flex items-center justify-center min-h-[400px]">
      <Loader2 className="animate-spin text-action-primary" size={32} />
    </div>
  );

  const topActions = (
    <div className="flex items-center gap-3">
      <Button variant="ghost" onClick={() => router.back()} disabled={saving}>
        Cancel
      </Button>
      <Button
        variant="primary"
        onClick={handleSave}
        disabled={saving || !header.po_number || items.length === 0}
      >
        {saving ? <Loader2 size={16} className="animate-spin mr-2" /> : <Save size={16} className="mr-2" />}
        {saving ? "Saving..." : "Save PO"}
      </Button>
    </div>
  );

  const totalValue = items.reduce((acc: number, cur: any) => acc + (cur.item_value || 0), 0);

  return (
    <div className="min-h-screen bg-background pb-20">
      <DocumentTemplate
        title="Create Purchase Order"
        description="Establish formal procurement contract"
        actions={topActions}
        onBack={() => router.back()}
        icon={null}
      >
        {error && (
          <div className="mx-auto mt-6 mb-6">
            <div className="p-4 bg-status-error/10 border border-status-error/20 rounded-xl flex items-center gap-3 text-status-error shadow-sm">
              <ClipboardList size={18} />
              <p className="text-sm font-medium">{error}</p>
            </div>
          </div>
        )}

        <div className="space-y-8">
          {/* Metadata Grid */}
          <div className="rounded-2xl border border-border-default/50 shadow-sm bg-surface p-8">
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-y-6 gap-x-8">
              <div className="space-y-1.5">
                <StandardLabel>PO Number <span className="text-status-error">*</span></StandardLabel>
                <Input
                  value={header.po_number || ""}
                  onChange={(e) => updateHeader("po_number", e.target.value)}
                  placeholder="PO-001"
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <StandardLabel>PO Date <span className="text-status-error">*</span></StandardLabel>
                <Input
                  type="date"
                  value={header.po_date || ""}
                  onChange={(e) => updateHeader("po_date", e.target.value)}
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <StandardLabel>Department</StandardLabel>
                <Input
                  value={header.department_no || ""}
                  onChange={(e) => updateHeader("department_no", e.target.value)}
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <StandardLabel>Order Type</StandardLabel>
                <Input
                  value={header.order_type || ""}
                  onChange={(e) => updateHeader("order_type", e.target.value)}
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <StandardLabel>Supplier Code</StandardLabel>
                <Input
                  value={header.supplier_code || ""}
                  onChange={(e) => updateHeader("supplier_code", e.target.value)}
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1.5 col-span-2">
                <StandardLabel>Supplier Name</StandardLabel>
                <Input
                  value={header.supplier_name || ""}
                  onChange={(e) => updateHeader("supplier_name", e.target.value)}
                  className="h-9 text-sm uppercase"
                  placeholder="Supplier Name..."
                />
              </div>
              <div className="space-y-1.5">
                <StandardLabel>Supplier GSTIN</StandardLabel>
                <Input
                  value={header.supplier_gstin || ""}
                  onChange={(e) => updateHeader("supplier_gstin", e.target.value)}
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <StandardLabel>Quotation Ref</StandardLabel>
                <Input
                  value={header.quotation_ref || ""}
                  onChange={(e) => updateHeader("quotation_ref", e.target.value)}
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <StandardLabel>RC Number</StandardLabel>
                <Input
                  value={header.rc_no || ""}
                  onChange={(e) => updateHeader("rc_no", e.target.value)}
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <StandardLabel>TIN No</StandardLabel>
                <Input
                  value={header.tin_no || ""}
                  onChange={(e) => updateHeader("tin_no", e.target.value)}
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <StandardLabel>ECC No</StandardLabel>
                <Input
                  value={header.ecc_no || ""}
                  onChange={(e) => updateHeader("ecc_no", e.target.value)}
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <StandardLabel>MPCT No</StandardLabel>
                <Input
                  value={header.mpct_no || ""}
                  onChange={(e) => updateHeader("mpct_no", e.target.value)}
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <StandardLabel>Our Ref</StandardLabel>
                <Input
                  value={header.our_ref || ""}
                  onChange={(e) => updateHeader("our_ref", e.target.value)}
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1.5 col-span-2">
                <StandardLabel>Inspection Terms</StandardLabel>
                <Input
                  value={header.inspection_at || ""}
                  onChange={(e) => updateHeader("inspection_at", e.target.value)}
                  className="h-9 text-sm"
                  placeholder="Inspection at..."
                />
              </div>
              <div className="space-y-1.5 col-span-2">
                <StandardLabel>Consignee Name</StandardLabel>
                <Input
                  value={header.consignee_name || ""}
                  onChange={(e) => updateHeader("consignee_name", e.target.value)}
                  className="h-9 text-sm"
                  placeholder="Consignee Name"
                />
              </div>
            </div>
          </div>

          {/* Items Table Card */}
          <div className="rounded-2xl border border-border-default/50 shadow-sm bg-surface flex flex-col overflow-hidden min-h-[400px]">
            <div className="bg-surface-sunken/40 px-8 py-5 border-b border-border-subtle/20 flex justify-between items-center">
              <h3 className="font-bold text-text-primary text-xs uppercase tracking-widest opacity-60">Item Details</h3>
              <Button variant="outline" onClick={addItem} size="compact" className="h-8">
                <Plus size={14} className="mr-2" /> Add Item
              </Button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse table-fixed text-sm table-dense">
                <thead>
                  <tr>
                    <th className="w-[50px] text-center p-2 border-b border-r border-border-default bg-surface-primary"><StandardLabel>#</StandardLabel></th>
                    <th className="p-2 border-b border-r border-border-default bg-surface-primary"><StandardLabel>Material Description</StandardLabel></th>
                    <th className="w-[120px] p-2 border-b border-r border-border-default bg-surface-primary"><StandardLabel>Mat Code</StandardLabel></th>
                    <th className="w-[100px] p-2 border-b border-r border-border-default bg-surface-primary"><StandardLabel>HSN / CAT</StandardLabel></th>
                    <th className="w-[80px] text-center p-2 border-b border-r border-border-default bg-surface-primary"><StandardLabel>Unit</StandardLabel></th>
                    <th className="w-[100px] text-right p-2 border-b border-r border-border-default bg-surface-primary"><StandardLabel>Quantity</StandardLabel></th>
                    <th className="w-[120px] text-right p-2 border-b border-r border-border-default bg-surface-primary"><StandardLabel>Rate</StandardLabel></th>
                    <th className="w-[120px] text-right p-2 border-b border-r border-border-default bg-surface-primary"><StandardLabel>Value</StandardLabel></th>
                    <th className="w-[50px] border-b border-border-default bg-surface-primary"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {items.length === 0 && (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-text-tertiary">
                        No items added. Click "Add Item" to begin.
                      </td>
                    </tr>
                  )}
                  {items.map((item: any, idx: number) => (
                    <React.Fragment key={idx}>
                      <tr className="group hover:bg-surface-secondary transition-colors">
                        <td className="text-center font-table-meta align-top p-2 border-r border-border-default text-text-tertiary">{idx + 1}</td>
                        <td className="p-2 border-r border-border-default align-top">
                          <Input
                            value={item.material_description}
                            onChange={e => updateItem(idx, "material_description", e.target.value)}
                            className="w-full h-8 text-sm border-transparent bg-transparent hover:bg-surface-secondary focus:bg-surface-secondary focus:border-action-primary p-1 rounded-sm"
                            placeholder="Description"
                          />
                        </td>
                        <td className="p-2 border-r border-border-default align-top">
                          <Input
                            value={item.material_code}
                            onChange={e => updateItem(idx, "material_code", e.target.value)}
                            className="h-8 text-xs font-mono border-transparent bg-transparent hover:bg-surface-secondary focus:bg-surface-secondary focus:border-action-primary p-1 rounded-sm"
                            placeholder="Code"
                          />
                        </td>
                        <td className="p-2 border-r border-border-default align-top space-y-1">
                          <Input
                            value={item.hsn_code}
                            onChange={e => updateItem(idx, "hsn_code", e.target.value)}
                            className="h-7 text-[10px] font-mono border-transparent bg-transparent hover:bg-surface-secondary focus:bg-surface-secondary focus:border-action-primary p-1 rounded-sm"
                            placeholder="HSN"
                          />
                          <Input
                            type="number"
                            value={item.mtrl_cat}
                            onChange={e => updateItem(idx, "mtrl_cat", parseInt(e.target.value))}
                            className="h-7 text-[10px] font-mono border-transparent bg-transparent hover:bg-surface-secondary focus:bg-surface-secondary focus:border-action-primary p-1 rounded-sm"
                            placeholder="CAT"
                          />
                        </td>
                        <td className="p-2 border-r border-border-default align-top text-center">
                          <Input
                            value={item.unit}
                            onChange={e => updateItem(idx, "unit", e.target.value)}
                            className="h-8 text-xs text-center uppercase border-transparent bg-transparent hover:bg-surface-secondary focus:bg-surface-secondary focus:border-action-primary p-1 rounded-sm"
                            placeholder="NOS"
                          />
                        </td>
                        <td className="p-2 border-r border-border-default align-top text-right">
                          <div className="h-8 text-sm text-right tabular-nums p-1.5 font-semibold text-action-primary">
                            <Accounting>{item.ord_qty || 0}</Accounting>
                          </div>
                        </td>
                        <td className="p-2 border-r border-border-subtle/20 align-top text-right">
                          <Input
                            type="number"
                            value={item.po_rate}
                            onChange={e => updateItem(idx, "po_rate", parseFloat(e.target.value))}
                            className="h-8 text-sm text-right tabular-nums border-transparent bg-transparent hover:bg-surface-secondary/40 focus:bg-surface-secondary/60 focus:border-action-primary/30 p-1 rounded-lg transition-all"
                          />
                        </td>
                        <td className="p-2 border-r border-border-default align-top text-right font-medium text-text-primary">
                          <div className="pt-1.5">
                            <Accounting isCurrency>{(item.ord_qty || 0) * (item.po_rate || 0)}</Accounting>
                          </div>
                        </td>
                        <td className="p-2 align-top text-center">
                          <Button onClick={() => removeItem(idx)} className="text-text-quaternary hover:text-status-error transition-colors pt-1.5 h-auto min-h-0 bg-transparent border-none shadow-none">
                            <Trash2 size={16} />
                          </Button>
                        </td>
                      </tr>
                      {/* Delivery Schedule Snap */}
                      <tr className="bg-surface-sunken/10">
                        <td className="p-2 border-r border-border-default"></td>
                        <td colSpan={8} className="p-4">
                          <div className="flex flex-col gap-4">
                            <div className="flex items-center justify-between px-2">
                              <span className="text-[10px] uppercase tracking-widest font-bold text-text-tertiary">Delivery Schedule Snapshot</span>
                              <Button
                                variant="ghost"
                                size="compact"
                                className="h-6 text-[10px] text-action-primary"
                                onClick={() => usePOStore.getState().addDelivery(idx)}
                              >
                                <Plus size={10} className="mr-1" /> Add Lot
                              </Button>
                            </div>

                            <div className="overflow-hidden rounded-xl border border-border-subtle/20 bg-surface/50">
                              <table className="w-full text-left border-collapse table-fixed text-[10px]">
                                <thead className="bg-surface-sunken/30">
                                  <tr>
                                    <th className="w-[60px] p-2 font-bold uppercase tracking-tight text-text-tertiary">Lot #</th>
                                    <th className="w-[100px] p-2 font-bold uppercase tracking-tight text-text-tertiary">Quantity</th>
                                    <th className="w-[140px] p-2 font-bold uppercase tracking-tight text-text-tertiary">Delivery Date</th>
                                    <th className="w-[140px] p-2 font-bold uppercase tracking-tight text-text-tertiary">Allowance Date</th>
                                    <th className="p-2 font-bold uppercase tracking-tight text-text-tertiary">Destination</th>
                                    <th className="w-[40px]"></th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-border-subtle/10">
                                  {(item.deliveries || []).map((lot: any, lIdx: number) => (
                                    <tr key={lIdx} className="hover:bg-action-primary/5 transition-colors">
                                      <td className="p-2 font-bold text-action-primary">#{lot.lot_no || lIdx + 1}</td>
                                      <td className="p-1">
                                        <Input
                                          type="number"
                                          value={lot.ord_qty}
                                          onChange={e => usePOStore.getState().updateDelivery(idx, lIdx, "ord_qty", parseFloat(e.target.value))}
                                          className="h-7 text-[10px] p-1 bg-transparent border-transparent focus:bg-surface focus:border-action-primary/30"
                                        />
                                      </td>
                                      <td className="p-1">
                                        <Input
                                          type="date"
                                          value={lot.dely_date}
                                          onChange={e => usePOStore.getState().updateDelivery(idx, lIdx, "dely_date", e.target.value)}
                                          className="h-7 text-[10px] p-1 bg-transparent border-transparent focus:bg-surface focus:border-action-primary/30"
                                        />
                                      </td>
                                      <td className="p-1">
                                        <Input
                                          type="date"
                                          value={lot.entry_allow_date || ""}
                                          onChange={e => usePOStore.getState().updateDelivery(idx, lIdx, "entry_allow_date", e.target.value)}
                                          className="h-7 text-[10px] p-1 bg-transparent border-transparent focus:bg-surface focus:border-action-primary/30"
                                        />
                                      </td>
                                      <td className="p-1">
                                        <Input
                                          type="number"
                                          value={lot.dest_code}
                                          onChange={e => usePOStore.getState().updateDelivery(idx, lIdx, "dest_code", parseInt(e.target.value))}
                                          className="h-7 text-[10px] p-1 bg-transparent border-transparent focus:bg-surface focus:border-action-primary/30"
                                        />
                                      </td>
                                      <td className="p-2 text-right">
                                        {item.deliveries.length > 1 && (
                                          <button
                                            onClick={() => usePOStore.getState().removeDelivery(idx, lIdx)}
                                            className="text-status-error opacity-40 hover:opacity-100 transition-opacity"
                                          >
                                            <Trash2 size={12} />
                                          </button>
                                        )}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </td>
                      </tr>
                    </React.Fragment>
                  ))}
                  {/* Footer Row */}
                  <tr className="bg-surface-secondary border-t border-border-default">
                    <td colSpan={7} className="p-3 text-right font-bold text-text-secondary text-xs uppercase tracking-wider border-r border-border-default">Total Value</td>
                    <td className="p-3 text-right font-bold text-text-primary text-sm border-r border-border-default">
                      <Accounting isCurrency>{totalValue}</Accounting>
                    </td>
                    <td></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Logistics Split */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="rounded-2xl border border-border-default/50 shadow-sm bg-surface p-8 space-y-4">
              <h3 className="font-bold text-text-primary text-xs uppercase tracking-widest opacity-60">Consignee Address</h3>
              <textarea
                value={header.consignee_address || ""}
                onChange={e => updateHeader("consignee_address", e.target.value)}
                className="w-full h-28 p-4 rounded-xl border border-border-subtle/20 text-sm bg-surface-sunken/40 focus:bg-surface-secondary/60 focus:border-action-primary/30 outline-none transition-all resize-none shadow-inner"
                placeholder="Enter address..."
              />
            </div>
            <div className="rounded-2xl border border-border-default/50 shadow-sm bg-surface p-8 space-y-4">
              <h3 className="font-bold text-text-primary text-xs uppercase tracking-widest opacity-60">Inspection Terms</h3>
              <textarea
                value={header.inspection_at || ""}
                onChange={e => updateHeader("inspection_at", e.target.value)}
                className="w-full h-28 p-4 rounded-xl border border-border-subtle/20 text-sm bg-surface-sunken/40 focus:bg-surface-secondary/60 focus:border-action-primary/30 outline-none transition-all resize-none shadow-inner"
                placeholder="Enter terms..."
              />
            </div>
          </div>

        </div>
      </DocumentTemplate>
    </div>
  );
}

export default function CreatePOPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen bg-background">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="animate-spin text-action-primary" size={48} />
            <Caption1 className="text-text-tertiary animate-pulse font-medium">Initializing Procurement Terminal</Caption1>
          </div>
        </div>
      }
    >
      <CreatePOPageContent />
    </Suspense>
  );
}
