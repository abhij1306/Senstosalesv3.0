"use client";

import React from "react";
import { cn, amountInWords, formatIndianCurrency, formatDate } from "@/lib/utils";
import { Accounting, StandardLabel, StandardValue, Badge, Body, Caption1, FieldGroup, MetadataItem, Tiny, Mini, Input } from "@/components/common";

interface InvoiceSheetProps {
    header: any;
    items: any[];
    companySettings?: any;
    taxRates?: { cgst: number; sgst: number };
    onUpdateHeader?: (key: string, value: any) => void;
    onUpdateItem?: (index: number, key: string, value: any) => void;
    editable?: boolean;
    buyerActions?: React.ReactNode;
    isDuplicateNumber?: boolean;
    isCheckingNumber?: boolean;
}

export function InvoiceSheet({
    header,
    items,
    companySettings,
    taxRates = { cgst: 9.0, sgst: 9.0 },
    onUpdateHeader,
    onUpdateItem,
    editable = false,
    buyerActions,
    isDuplicateNumber = false,
    isCheckingNumber = false
}: InvoiceSheetProps) {

    const grouped: Record<string, any[]> = {};
    items.forEach((item: any, idx) => {
        const itemWithIdx = { ...item, _originalIdx: idx };
        // Group by SL No AND rate to avoid misleading consolidation of items with different prices
        const key = `${item.po_item_no || 'item'}-${item.rate || '0'}-${item.description?.slice(0, 20)}`;
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(itemWithIdx);
    });

    const getSafeValue = (val: any, fallback: string = "") => {
        if (!val || ["NULL", "null", "Null", "None", "NOT SET", "Not Set"].includes(String(val).trim())) return fallback;
        return val;
    };

    return (
        <div className="bg-surface border border-border-default/10 rounded-2xl text-text-primary font-medium text-xs w-full max-w-[1400px] mx-auto shadow-sm printable-document overflow-hidden">
            {/* HEADER GRID: 2 Column Layout (Left: Parties, Right: Logistics) */}
            <div className="grid grid-cols-12 border-b border-border-default/10 min-h-[160px]">

                {/* LEFT SIDE: SUPPLIER & BUYER (Stacked) */}
                <div className="col-span-5 flex flex-col border-r border-border-default/10 min-h-[160px]">
                    {/* 1. Supplier Section */}
                    <div className="p-4 space-y-2">
                        <Caption1 className="text-text-secondary uppercase tracking-widest text-[10px] font-bold mb-1 block">Supplier Details</Caption1>
                        <div className="space-y-1.5">
                            {editable ? (
                                <div className="space-y-1.5">
                                    <div className="flex items-center gap-2">
                                        <label className="w-24 shrink-0 text-[10px] font-bold text-text-secondary uppercase tracking-tight">Supplier Name</label>
                                        <Input
                                            value={header.supplier_name || companySettings?.supplier_name || ""}
                                            onChange={(e) => onUpdateHeader?.("supplier_name", e.target.value)}
                                            className="h-8 text-xs bg-surface-sunken/40 border border-border-default/40 focus:border-action-primary/30"
                                        />
                                    </div>
                                    <div className="flex items-start gap-2">
                                        <label className="w-24 shrink-0 text-[10px] font-bold text-text-secondary uppercase tracking-tight pt-1.5">Address</label>
                                        <Input
                                            value={header.supplier_address || companySettings?.supplier_address || ""}
                                            onChange={(e) => onUpdateHeader?.("supplier_address", e.target.value)}
                                            className="h-8 text-[11px] bg-surface border-border-default/20"
                                        />
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <label className="w-24 shrink-0 text-[10px] font-bold text-text-secondary uppercase tracking-tight">GSTIN / Contact</label>
                                        <div className="flex-1 grid grid-cols-2 gap-2">
                                            <Input
                                                value={header.supplier_gstin || companySettings?.supplier_gstin || ""}
                                                onChange={(e) => onUpdateHeader?.("supplier_gstin", e.target.value)}
                                                placeholder="GSTIN"
                                                className="h-8 text-xs bg-surface-sunken/40 border border-border-default/40 focus:border-action-primary/30"
                                            />
                                            <Input
                                                value={header.supplier_contact || companySettings?.supplier_contact || ""}
                                                onChange={(e) => onUpdateHeader?.("supplier_contact", e.target.value)}
                                                placeholder="Contact"
                                                className="h-8 text-xs bg-surface-sunken/40 border border-border-default/40 focus:border-action-primary/30"
                                            />
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-1">
                                    <h2 className="font-bold text-sm text-text-primary leading-tight uppercase tracking-tight">
                                        {getSafeValue(header.supplier_name || companySettings?.supplier_name, "")}
                                    </h2>
                                    <p className="text-[11px] text-text-tertiary leading-normal font-medium whitespace-pre-wrap">
                                        {getSafeValue(header.supplier_address || companySettings?.supplier_address, "")}
                                    </p>
                                    <div className="flex gap-4 pt-1 text-[10px] font-bold text-text-secondary uppercase tracking-wider">
                                        <span>GSTIN: {getSafeValue(header.supplier_gstin || companySettings?.supplier_gstin, "-")}</span>
                                        <span>TEL: {getSafeValue(header.supplier_contact || companySettings?.supplier_contact, "-")}</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* 2. Buyer Section */}
                    <div className="p-4 pt-1 space-y-2 flex-1 relative bg-surface-sunken/5">
                        <div className="flex justify-between items-center mb-1">
                            <Caption1 className="text-text-secondary uppercase tracking-widest text-[10px] font-bold">Billed To (Buyer)</Caption1>
                            {editable && (
                                <div className="shadow-lg shadow-black/5 ring-1 ring-border-default/10 rounded-lg bg-surface flex items-center px-1">
                                    {buyerActions}
                                </div>
                            )}
                        </div>
                        <div className="space-y-1.5">
                            {editable ? (
                                <div className="space-y-1.5">
                                    <div className="flex items-center gap-2">
                                        <label className="w-24 shrink-0 text-[10px] font-bold text-text-secondary uppercase tracking-tight">Buyer Name</label>
                                        <Input
                                            value={header.buyer_name || ""}
                                            onChange={(e) => onUpdateHeader?.("buyer_name", e.target.value)}
                                            className="h-8 text-xs bg-surface-sunken/40 border border-border-default/40 focus:border-action-primary/30"
                                        />
                                    </div>
                                    <div className="flex items-start gap-2">
                                        <label className="w-24 shrink-0 text-[10px] font-bold text-text-secondary uppercase tracking-tight pt-1.5">Address</label>
                                        <Input
                                            value={header.buyer_address || ""}
                                            onChange={(e) => onUpdateHeader?.("buyer_address", e.target.value)}
                                            className="h-8 text-[11px] bg-surface border-border-default/20"
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="flex items-center gap-2">
                                            <label className="w-24 shrink-0 text-[10px] font-bold text-text-secondary uppercase tracking-tight">GSTIN</label>
                                            <Input
                                                value={header.buyer_gstin || ""}
                                                onChange={(e) => onUpdateHeader?.("buyer_gstin", e.target.value)}
                                                className="h-8 text-xs bg-surface-sunken/40 border border-border-default/40 focus:border-action-primary/30"
                                            />
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <label className="w-16 shrink-0 text-[10px] font-bold text-text-secondary uppercase tracking-tight">STATE</label>
                                            <Input
                                                value={header.buyer_state || ""}
                                                onChange={(e) => onUpdateHeader?.("buyer_state", e.target.value)}
                                                className="h-8 text-xs bg-surface-sunken/40 border border-border-default/40 focus:border-action-primary/30"
                                            />
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <label className="w-24 shrink-0 text-[10px] font-bold text-text-secondary uppercase tracking-tight">POS</label>
                                        <Input
                                            value={header.place_of_supply || ""}
                                            onChange={(e) => onUpdateHeader?.("place_of_supply", e.target.value)}
                                            className="h-8 text-xs bg-surface-sunken/40 border border-border-default/40 focus:border-action-primary/30"
                                            placeholder="Place of Supply"
                                        />
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-1">
                                    <h3 className="font-bold text-sm text-text-primary uppercase tracking-tight">{header.buyer_name || "SEARCH BUYER ABOVE"}</h3>
                                    <p className="text-[11px] text-text-tertiary font-medium leading-relaxed min-h-[32px]">{getSafeValue(header.buyer_address, "-")}</p>
                                    <div className="flex gap-4 pt-1 text-[10px] font-bold text-text-secondary uppercase tracking-wider">
                                        <span>GSTIN: {header.buyer_gstin || "-"}</span>
                                        <span>STATE: {header.buyer_state || "-"}</span>
                                        <span>POS: {header.place_of_supply || "-"}</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* RIGHT SIDE: DOCUMENT LOGISTICS */}
                <div className="col-span-7 p-4 bg-surface-sunken/10">

                    <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
                        {/* INV & DATE */}
                        <div className="flex items-center gap-2">
                            <label className="w-24 shrink-0 text-[10px] font-bold text-text-secondary uppercase tracking-tight">Invoice No.</label>
                            <Input
                                value={header.invoice_number}
                                onChange={(e) => onUpdateHeader?.("invoice_number", e.target.value)}
                                disabled={!editable}
                                className={cn("h-8 text-xs bg-surface-sunken/40 border border-border-default/40 focus:border-action-primary/30", isDuplicateNumber && "text-status-error font-bold border-status-error")}
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <label className="w-24 shrink-0 text-[10px] font-bold text-text-secondary uppercase tracking-tight text-right">Dated</label>
                            <Input
                                type="date"
                                value={editable ? header.invoice_date : formatDate(header.invoice_date)}
                                onChange={(e) => onUpdateHeader?.("invoice_date", e.target.value)}
                                disabled={!editable}
                                className="h-8 text-xs bg-surface-sunken/40 border border-border-default/40 focus:border-action-primary/30"
                            />
                        </div>

                        {/* GEMC & TERMS */}
                        <div className="flex items-center gap-2">
                            <label className="w-24 shrink-0 text-[10px] font-bold text-text-secondary uppercase tracking-tight">GEMC No/Dt</label>
                            <div className="flex-1 grid grid-cols-2 gap-1">
                                <Input
                                    value={header.gemc_number || ""}
                                    onChange={(e) => onUpdateHeader?.("gemc_number", e.target.value)}
                                    disabled={!editable}
                                    className="h-8 text-xs bg-surface-sunken/40 border border-border-default/40 focus:border-action-primary/30"
                                    placeholder="GEMC #"
                                />
                                <Input
                                    type="date"
                                    value={editable ? header.gemc_date : formatDate(header.gemc_date)}
                                    onChange={(e) => onUpdateHeader?.("gemc_date", e.target.value)}
                                    disabled={!editable}
                                    className="h-8 text-xs bg-surface-sunken/40 border border-border-default/40 focus:border-action-primary/30 px-1"
                                />
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <label className="w-24 shrink-0 text-[10px] font-bold text-text-secondary uppercase tracking-tight text-right">Terms</label>
                            <Input
                                value={header.payment_terms || ""}
                                onChange={(e) => onUpdateHeader?.("payment_terms", e.target.value)}
                                disabled={!editable}
                                className="h-8 text-xs bg-surface-sunken/40 border border-border-default/40 focus:border-action-primary/30"
                                placeholder="e.g. 45 Days"
                            />
                        </div>

                        {/* CHALLAN (ReadOnly) */}
                        <div className="flex items-center gap-2 opacity-60">
                            <label className="w-24 shrink-0 text-[9px] font-bold text-text-secondary uppercase tracking-tight italic">Challan No.</label>
                            <Input value={header.dc_number || "-"} disabled className="h-7 text-xs bg-surface-sunken border-transparent" />
                        </div>
                        <div className="flex items-center gap-2 opacity-60">
                            <label className="w-24 shrink-0 text-[9px] font-bold text-text-secondary uppercase tracking-tight text-right italic">Dated</label>
                            <Input value={formatDate(header.dc_date)} disabled className="h-7 text-xs bg-surface-sunken border-transparent" />
                        </div>

                        {/* ORDER (ReadOnly) */}
                        <div className="flex items-center gap-2 opacity-60">
                            <label className="w-24 shrink-0 text-[9px] font-bold text-text-secondary uppercase tracking-tight italic">Order No.</label>
                            <Input value={header.buyers_order_no || "-"} disabled className="h-7 text-xs bg-surface-sunken border-transparent" />
                        </div>
                        <div className="flex items-center gap-2 opacity-60">
                            <label className="w-24 shrink-0 text-[9px] font-bold text-text-secondary uppercase tracking-tight text-right italic">Dated</label>
                            <Input value={formatDate(header.buyers_order_date)} disabled className="h-7 text-xs bg-surface-sunken border-transparent" />
                        </div>

                        {/* DESPATCH DOC & SRV */}
                        <div className="flex items-center gap-2">
                            <label className="w-24 shrink-0 text-[10px] font-bold text-text-secondary uppercase tracking-tight">Despatch Doc.</label>
                            <Input
                                value={header.despatch_doc_no || ""}
                                onChange={(e) => onUpdateHeader?.("despatch_doc_no", e.target.value)}
                                disabled={!editable}
                                className="h-8 text-xs bg-surface-sunken/40 border border-border-default/40 focus:border-action-primary/30"
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <label className="w-24 shrink-0 text-[10px] font-bold text-text-secondary uppercase tracking-tight text-right">SRV No/Dt</label>
                            <div className="flex-1 grid grid-cols-2 gap-1">
                                <Input
                                    value={header.srv_no || ""}
                                    onChange={(e) => onUpdateHeader?.("srv_no", e.target.value)}
                                    disabled={!editable}
                                    className="h-8 text-xs bg-surface-sunken/40 border border-border-default/40 focus:border-action-primary/30"
                                    placeholder="SRV #"
                                />
                                <Input
                                    type="date"
                                    value={editable ? header.srv_date : formatDate(header.srv_date)}
                                    onChange={(e) => onUpdateHeader?.("srv_date", e.target.value)}
                                    disabled={!editable}
                                    className="h-8 text-xs bg-surface-sunken/40 border border-border-default/40 focus:border-action-primary/30 px-1"
                                />
                            </div>
                        </div>

                        {/* VIA & DEST */}
                        <div className="flex items-center gap-2">
                            <label className="w-24 shrink-0 text-[10px] font-bold text-text-secondary uppercase tracking-tight">Despatch Via</label>
                            <Input
                                value={header.despatch_through || header.transporter || ""}
                                onChange={(e) => onUpdateHeader?.("despatch_through", e.target.value)}
                                disabled={!editable}
                                className="h-8 text-xs bg-surface-sunken/40 border border-border-default/40 focus:border-action-primary/30"
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <label className="w-24 shrink-0 text-[10px] font-bold text-text-secondary uppercase tracking-tight text-right">Destination</label>
                            <Input
                                value={header.destination || ""}
                                onChange={(e) => onUpdateHeader?.("destination", e.target.value)}
                                disabled={!editable}
                                className="h-8 text-xs bg-surface-sunken/40 border border-border-default/40 focus:border-action-primary/30"
                            />
                        </div>

                        {/* TERMS (Span 2) */}
                        <div className="col-span-2 flex items-center gap-2">
                            <label className="w-24 shrink-0 text-[10px] font-bold text-text-secondary uppercase tracking-tight">Delivery Terms</label>
                            <Input
                                value={header.terms_of_delivery || ""}
                                onChange={(e) => onUpdateHeader?.("terms_of_delivery", e.target.value)}
                                disabled={!editable}
                                className="h-8 text-xs bg-surface-sunken/40 border border-border-default/40 focus:border-action-primary/30"
                            />
                        </div>
                    </div>
                </div>
            </div>

            <div className="w-full overflow-x-auto">
                <table className="w-full text-left border-collapse table-fixed min-w-[1080px]">
                    <colgroup>
                        <col style={{ width: '40px' }} />  {/* S.N. */}
                        <col style={{ width: '280px' }} /> {/* Description */}
                        <col style={{ width: '80px' }} />  {/* HSN */}
                        <col style={{ width: '80px' }} />  {/* Dispatched */}
                        <col style={{ width: '100px' }} /> {/* Rate */}
                        <col style={{ width: '110px' }} /> {/* Taxable */}
                        <col style={{ width: '55px' }} />  {/* CGST Rate */}
                        <col style={{ width: '95px' }} />  {/* CGST Amt */}
                        <col style={{ width: '55px' }} />  {/* SGST Rate */}
                        <col style={{ width: '95px' }} />  {/* SGST Amt */}
                        <col style={{ width: '120px' }} /> {/* Total */}
                    </colgroup>
                    <thead className="bg-surface-sunken/40">
                        <tr className="border-b border-border-default/10">
                            <th className="px-2 py-4 border-r border-border-default/10 text-center"><Caption1>S.N.</Caption1></th>
                            <th className="p-4 border-r border-border-default/10 text-left"><Caption1>Description of Goods</Caption1></th>
                            <th className="p-4 border-r border-border-default/10 text-center"><Caption1>HSN/SAC</Caption1></th>
                            <th className="p-4 border-r border-border-default/10 text-center bg-status-warning/5"><Caption1 className="text-status-warning">DISPATCHED</Caption1></th>
                            <th className="p-4 border-r border-border-default/10 text-right"><Caption1>Rate</Caption1></th>
                            <th className="p-4 border-r border-border-default/10 text-right"><Caption1>Taxable</Caption1></th>
                            <th className="p-2 border-r border-border-default/10 text-center bg-action-primary/5" colSpan={2}><Caption1 className="text-action-primary">CGST</Caption1></th>
                            <th className="p-2 border-r border-border-default/10 text-center bg-status-success/5" colSpan={2}><Caption1 className="text-status-success">SGST</Caption1></th>
                            <th className="p-4 text-right bg-surface-sunken/40"><Caption1>Total</Caption1></th>
                        </tr>
                        <tr className="border-b border-border-default/10 bg-surface-sunken/20 h-8">
                            <th colSpan={6} className="border-r border-border-default/10"></th>
                            <th className="p-1 border-r border-border-default/10 text-center"><Tiny className="text-[9px] uppercase font-bold opacity-60">Rate</Tiny></th>
                            <th className="p-1 border-r border-border-default/10 text-right pr-2"><Tiny className="text-[9px] uppercase font-bold opacity-60">Amount</Tiny></th>
                            <th className="p-1 border-r border-border-default/10 text-center"><Tiny className="text-[9px] uppercase font-bold opacity-60">Rate</Tiny></th>
                            <th className="p-1 border-r border-border-default/10 text-right pr-2"><Tiny className="text-[9px] uppercase font-bold opacity-60">Amount</Tiny></th>
                            <th className="bg-surface-sunken/40"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border-default/10">
                        {Object.entries(grouped).map(([key, groupItems], groupIdx) => {
                            const firstItem = groupItems[0];
                            const totalQty = groupItems.reduce((s, i) => s + (i.quantity || 0), 0);
                            const totalPkts = groupItems.reduce((s, i) => s + (i.no_of_packets || 1), 0);
                            const totalTaxable = groupItems.reduce((s, i) => s + (i.taxable_value || 0), 0);
                            const totalCgst = groupItems.reduce((s, i) => s + (i.cgst_amount || 0), 0);
                            const totalSgst = groupItems.reduce((s, i) => s + (i.sgst_amount || 0), 0);
                            const totalValue = groupItems.reduce((s, i) => s + (i.total_amount || 0), 0);

                            return (
                                <React.Fragment key={key}>
                                    <tr className="min-h-[45px] hover:bg-surface-sunken/20 transition-colors">
                                        <td className="border-r border-border-default/10 text-center font-table-meta text-text-tertiary">
                                            {groupIdx + 1}
                                        </td>
                                        <td className="border-r border-border-default/10 p-3">
                                            <div className="flex flex-col gap-0.5">
                                                {firstItem.material_code && (
                                                    <span className="font-table-cell text-action-primary font-medium tracking-tight">
                                                        {firstItem.material_code}
                                                    </span>
                                                )}
                                                <div
                                                    className="font-table-cell text-text-tertiary leading-normal line-clamp-2 cursor-help truncate"
                                                    title={firstItem.description}
                                                >
                                                    {firstItem.description}
                                                </div>
                                                <div className="flex gap-2 mt-1.5 flex-wrap">
                                                    {firstItem.mtrl_cat != null && (
                                                        <span className="font-table-meta px-1.5 py-0.5 rounded bg-surface-sunken/40 text-text-tertiary border border-border-default/10 uppercase tracking-wider">
                                                            CAT: {firstItem.mtrl_cat}
                                                        </span>
                                                    )}
                                                    {firstItem.drg_no && String(firstItem.drg_no).trim() !== "" && (
                                                        <span className="font-table-meta px-1.5 py-0.5 rounded bg-action-primary/10 text-action-primary border border-action-primary/20 uppercase tracking-wider">
                                                            DRG: {firstItem.drg_no}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="border-r border-border-default/10 text-center font-table-cell font-mono text-text-tertiary p-0">
                                            {editable ? (
                                                <Input
                                                    type="text"
                                                    value={firstItem.hsn_sac || ""}
                                                    onChange={(e) => onUpdateItem?.(firstItem._originalIdx, "hsn_sac", e.target.value)}
                                                    className="w-full h-full text-center bg-transparent border-none outline-none focus:bg-action-primary/5 transition-colors py-3"
                                                    placeholder="HSN"
                                                />
                                            ) : (
                                                <div className="p-3">{firstItem.hsn_sac}</div>
                                            )}
                                        </td>
                                        <td className="border-r border-border-default/10 text-center bg-status-warning/5 font-table-cell text-status-warning font-bold">
                                            {totalQty}
                                        </td>
                                        <td className="border-r border-border-default/10 text-right p-3 font-table-cell text-text-secondary tabular-nums pr-4 truncate">
                                            {firstItem.rate?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                        </td>
                                        <td className="border-r border-border-default/10 text-right p-3 font-table-cell font-bold text-text-primary bg-surface-sunken/20 tabular-nums pr-4 truncate">
                                            {totalTaxable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                        </td>

                                        <td className="border-r border-border-default/10 text-center font-table-meta text-text-tertiary">{taxRates.cgst}%</td>
                                        <td className="border-r border-border-default/10 text-right p-3 text-text-tertiary tabular-nums font-table-cell pr-4 truncate">
                                            {totalCgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                        </td>
                                        <td className="border-r border-border-default/10 text-center font-table-meta text-text-tertiary">{taxRates.sgst}%</td>
                                        <td className="border-r border-border-default/10 text-right p-3 text-text-tertiary tabular-nums font-table-cell pr-4 truncate">
                                            {totalSgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                        </td>

                                        <td className="text-right p-4 font-bold bg-action-primary/5 text-text-primary tabular-nums text-sm pr-4 truncate">
                                            {totalValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                        </td>
                                    </tr>
                                    {groupItems.length > 1 && groupItems.map((item, subIdx) => (
                                        <tr key={`${key}-sub-${subIdx}`} className="bg-surface-sunken/10">
                                            <td className="border-r border-border-default/10"></td>
                                            <td className="border-r border-border-default/10 p-1 px-3 border-l-2 border-l-action-primary/20 ml-4">
                                                <Mini>Lot {item.lot_no || (subIdx + 1)}: {item.dsp_qty || item.quantity} {item.unit}</Mini>
                                            </td>
                                            <td colSpan={8} className="border-r border-border-default/10"></td>
                                            <td className="text-right p-1 px-3 truncate">
                                                <Mini>{(item.taxable_value || 0).toFixed(2)}</Mini>
                                            </td>
                                        </tr>
                                    ))}
                                </React.Fragment>
                            );
                        })}
                    </tbody>
                    <tfoot>
                        <tr className="border-y border-border-default/10 bg-surface-sunken/40 font-bold h-11">
                            <td colSpan={3} className="text-center border-r border-border-default/10 font-bold">
                                <Mini>Final Aggregation</Mini>
                            </td>
                            <td className="text-center border-r border-border-default/10 text-text-primary font-bold">
                                {items.reduce((sum, i) => sum + (i.quantity || 0), 0)}
                            </td>
                            <td className="border-r border-border-default/10"></td>
                            <td className="text-right p-3 border-r border-border-default/10 text-text-primary tabular-nums font-bold">
                                {Math.max(header.total_taxable_value || 0, items.reduce((s, i) => s + (i.taxable_value || 0), 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="border-r border-border-default/10"></td>
                            <td className="text-right p-3 border-r border-border-default/10 text-text-secondary tabular-nums font-medium">
                                {Math.max(header.cgst_total || 0, items.reduce((s, i) => s + (i.cgst_amount || 0), 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="border-r border-border-default/10"></td>
                            <td className="text-right p-3 border-r border-border-default/10 text-text-secondary tabular-nums font-medium">
                                {Math.max(header.sgst_total || 0, items.reduce((s, i) => s + (i.sgst_amount || 0), 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="text-right p-3 pr-3 bg-surface-sunken/40 text-text-primary tabular-nums text-sm font-medium">
                                {Math.max(header.total_invoice_value || 0, items.reduce((s, i) => s + (i.total_amount || 0), 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                        </tr>
                    </tfoot>
                </table>
            </div>

            {/* BOTTOM SECTION */}
            <div className="grid grid-cols-12 min-h-[160px] border-t border-border-default/10">
                {/* AMOUNT IN WORDS & DECLARATION */}
                <div className="col-span-8 p-8 space-y-8 flex flex-col justify-between">
                    <div>
                        <Caption1 className="uppercase text-text-tertiary tracking-[0.2em] block mb-2">Total Amount (In Words)</Caption1>
                        <p className="text-sm font-medium text-text-primary uppercase leading-tight">
                            {amountInWords(Math.round(header.total_invoice_value || 0))}
                        </p>
                    </div>
                    <div className="pt-6 border-t border-border-default/10">
                        <Caption1 className="uppercase text-text-tertiary tracking-[0.2em] block mb-2">Declaration</Caption1>
                        <p className="text-2xs text-text-tertiary leading-relaxed max-w-2xl">
                            We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.
                            Applicable GST has been calculated as per current statutory norms.
                        </p>
                    </div>
                </div>

                {/* TAX DISCLOSURE BLOCK */}
                <div className="col-span-4 bg-surface-sunken/20 p-8 space-y-4 border-l border-border-default/10">
                    <div className="space-y-3">
                        <div className="flex justify-between items-center text-xs">
                            <span className="text-text-tertiary font-medium">Taxable Value</span>
                            <span className="font-medium text-text-primary">{Math.max(header.total_taxable_value || 0, items.reduce((s, i) => s + (i.taxable_value || 0), 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                            <span className="text-text-tertiary font-medium">Central Tax ({taxRates.cgst}%)</span>
                            <span className="font-medium text-text-primary">{Math.max(header.cgst_total || 0, items.reduce((s, i) => s + (i.cgst_amount || 0), 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                            <span className="text-text-tertiary font-medium">State Tax ({taxRates.sgst}%)</span>
                            <span className="font-medium text-text-primary">{Math.max(header.sgst_total || 0, items.reduce((s, i) => s + (i.sgst_amount || 0), 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                        </div>
                    </div>
                    <div className="h-px bg-border-default/10 my-2"></div>
                    <div className="pt-2">
                        <div className="flex justify-between items-baseline">
                            <span className="text-2xs font-medium uppercase text-text-tertiary tracking-[0.2em]">Grand Total</span>
                            <div className="text-right">
                                <p className="text-xl font-semibold text-text-primary tracking-tight leading-none">
                                    {formatIndianCurrency(Math.max(header.total_invoice_value || 0, items.reduce((s, i) => s + (i.total_amount || 0), 0)))}
                                </p>
                                <Tiny className="text-text-tertiary font-medium mt-1">Inclusive of all taxes</Tiny>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ACTION FOOTER / SIGNATURE AREA */}
            <div className="p-8 pb-12 flex justify-between items-end border-t border-border-default/10 bg-surface">
                <div className="flex flex-col gap-1">
                    <Tiny className="text-text-quaternary uppercase tracking-[0.3em]">System Generated Document</Tiny>
                    <Tiny className="text-text-tertiary">State/UT - {formatDate(new Date().toISOString())}</Tiny>
                </div>
                <div className="text-right flex flex-col items-center">
                    <span className="text-2xs font-medium text-text-primary mb-16">
                        For {getSafeValue(companySettings?.company_name, "")}
                    </span>
                    <div className="w-56 h-px bg-border-default/10 mb-2"></div>
                    <span className="text-2xs font-semibold text-text-primary uppercase tracking-[0.2em]">Authorised Signatory</span>
                </div>
            </div>

            {/* JURISDICTION BAR */}
            <div className="bg-surface-sunken/40 py-4 text-center border-t border-border-default/10">
                <Tiny className="text-text-tertiary tracking-[0.5em] font-bold opacity-40">SUBJECT TO STATE JURISDICTION</Tiny>
            </div>
        </div>
    );
}


