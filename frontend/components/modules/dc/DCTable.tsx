"use client";

import React from "react";
import { ChevronDown, CornerDownRight, Plus, Trash2 } from "lucide-react";
import { Caption1, Body, Input, Button, Accounting, Badge, GranularInput, Mini, Tiny, Pagination, Card } from "@/components/common";
import { cn } from "@/lib/utils";

interface DCTableProps {
    items: any[];
    editable?: boolean;
    onUpdateItem?: (index: number, key: string, value: any) => void;
    expandedItems: Set<string>;
    onToggleItem: (id: string) => void;
    // Notes/Provisions for create flow
    notes?: string[];
    onAddNote?: () => void;
    onUpdateNote?: (index: number, value: string) => void;
    onRemoveNote?: (index: number) => void;
    headerData?: any;
}

/**
 * Specialized input to handle numeric typing without state-reverting frustration.
 */
function QuantityInput({ value: propValue, max, onChange }: { value: number, max: number, onChange: (val: number) => void }) {
    const [localValue, setLocalValue] = React.useState<string>(propValue === 0 ? "" : String(propValue));

    // Handle external resets (like 'Clear All' or backend updates)
    React.useEffect(() => {
        const numLocal = parseFloat(localValue) || 0;
        if (numLocal !== propValue) {
            setLocalValue(propValue === 0 ? "" : String(propValue));
        }
    }, [propValue]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const raw = e.target.value;
        // Allow anything that looks like a partial number while typing
        setLocalValue(raw);

        // Notify parent of the numeric value
        const num = parseFloat(raw);
        if (!isNaN(num)) {
            // Strict limit: Input box and state both cap at 'max'
            if (num > max) {
                setLocalValue(String(max));
                onChange(max);
            } else {
                setLocalValue(raw);
                onChange(num);
            }
        } else {
            setLocalValue(raw);
            onChange(0);
        }
    };

    return (
        <Input
            type="number"
            value={localValue}
            onChange={handleChange}
            onFocus={(e) => e.target.select()}
            className="text-center font-bold text-sm h-8 w-24 border-border-default/20 focus:border-action-primary shadow-sm"
            placeholder="0"
            min={0}
        />
    );
}

export function DCTable({
    items,
    editable = false,
    onUpdateItem,
    expandedItems,
    onToggleItem,
    notes,
    onAddNote,
    onUpdateNote,
    onRemoveNote,
    headerData
}: DCTableProps) {

    const groupedItems = React.useMemo(() => {
        const grouped: Record<string, any[]> = {};
        items.forEach((item: any) => {
            const key = item.po_item_id || item.po_item_no || item.material_code;
            if (!grouped[key]) grouped[key] = [];
            grouped[key].push(item);
        });
        return grouped;
    }, [items]);

    const allGroups = React.useMemo(() => Object.entries(groupedItems), [groupedItems]);

    // Pagination State
    const [page, setPage] = React.useState(1);
    const [pageSize, setPageSize] = React.useState(50);

    const paginatedGroups = React.useMemo(() => {
        const start = (page - 1) * pageSize;
        return allGroups.slice(start, start + pageSize);
    }, [allGroups, page, pageSize]);

    return (
        <Card variant="flat" padding="none" className="bg-surface shadow-sm flex flex-col overflow-hidden">
            <div className="bg-surface-sunken/40 px-8 py-5 border-b border-border-default/10 flex items-center justify-between">
                <div>
                    <h3 className="text-sm font-normal uppercase tracking-[0.2em] text-text-tertiary opacity-80">Material Allocation</h3>
                    <p className="text-sm text-text-tertiary mt-1 font-normal">Allocate quantities against Purchase Order line items</p>
                </div>
                {!editable && (
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-normal text-text-tertiary opacity-50 uppercase tracking-wider">Status:</span>
                        <Badge variant="success">Finalized</Badge>
                    </div>
                )}
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-left table-fixed">
                    <thead>
                        <tr className="bg-surface-sunken/40 border-none h-[40px] relative z-10">
                            <th className="py-2 px-3 first:pl-8 last:pr-8 text-center w-[40px] border-none"><Caption1>#</Caption1></th>
                            <th className="py-2 px-3 first:pl-8 last:pr-8 w-auto border-none"><Caption1>Material Details</Caption1></th>
                            <th className="py-2 px-3 first:pl-8 last:pr-8 text-center w-[60px] border-none"><Caption1>Unit</Caption1></th>
                            <th className="py-2 px-3 first:pl-8 last:pr-8 text-right w-[90px] border-none"><Caption1 className="text-text-tertiary">Rate</Caption1></th>
                            <th className="py-2 px-3 first:pl-8 last:pr-8 text-center w-[90px] border-none"><Caption1 className="text-action-primary">Ordered</Caption1></th>
                            <th className="py-2 px-3 first:pl-8 last:pr-8 text-center w-[130px] border-none">
                                <Caption1 className="text-status-warning">Dispatched</Caption1>
                            </th>
                            <th className="py-2 px-3 first:pl-8 last:pr-8 text-right w-[110px] border-none"><Caption1 className="text-status-success">Received</Caption1></th>
                            <th className="py-2 px-3 first:pl-8 last:pr-8 text-right w-[110px] border-none"><Caption1 className="text-text-primary">Value</Caption1></th>
                            <th className="py-2 px-3 first:pl-8 last:pr-8 w-[40px] border-none"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-none">
                        {paginatedGroups.map(([key, lots], groupIdxMap) => {
                            const groupIdx = (page - 1) * pageSize + groupIdxMap;
                            const firstLot = lots[0];
                            const showLots = lots.length > 1 && !editable;
                            const isExpanded = expandedItems.has(key) && !editable;

                            const totalDelivered = lots.reduce((sum, l) => sum + (l.dsp_qty || l.dispatch_qty || 0), 0);
                            // Balance = Ordered - Delivered (This DC). Note: If editing, original_pending is used for max, but display should be simple.
                            // If this is a View (saved DC), balance is what's left.
                            // However, simple math: Ord - This_DC_Qty gives context of "Remaining for this Item".
                            // But wait, if there were OTHER DCs, this math is wrong.
                            // Better to rely on backend pending if available, or just hide if complex.
                            // I'll show Balance = Ordered - TotalDelivered (This DC) ??? No.
                            // Let's just REMOVE "Received" column and widen others or leave empty.
                            // Actually, let's show "Balance" as "Pending Qty" from backend if available.
                            // item.pending_qty often exists.
                            // Reactive Balance Calculation:
                            // If creation mode: original_pending - current_dispatch_qty
                            // If view mode: (Ordered - Already_Dispatched)
                            const currentInput = firstLot.dispatch_qty || 0;
                            const balance = editable
                                ? ((firstLot.original_pending || 0) - currentInput)
                                : (firstLot.pending_qty ?? ((firstLot.ord_qty || 0) - totalDelivered));

                            return (
                                <React.Fragment key={key}>
                                    <tr
                                        className={cn(
                                            "transition-all duration-300 border-none h-[44px]",
                                            editable ? "bg-surface-sunken/10" : "hover:bg-action-primary/5 cursor-pointer group"
                                        )}
                                        onClick={() => !editable && onToggleItem(key)}
                                    >
                                        <td className="border-none text-center align-top py-2 px-3 first:pl-8 last:pr-8 text-text-tertiary font-normal text-sm">
                                            {groupIdx + 1}
                                        </td>
                                        <td className="border-none align-top py-2 px-3 first:pl-8 last:pr-8">
                                            <div className="flex flex-col gap-0.5">
                                                <Body className="text-action-primary font-normal tracking-tight">{firstLot.material_code}</Body>
                                                <Body className="text-text-secondary font-normal leading-normal line-clamp-4" title={firstLot.description}>
                                                    {firstLot.description || firstLot.material_description}
                                                </Body>
                                                <div className="flex gap-2 mt-1.5 flex-wrap">
                                                    <Mini className="px-1.5 py-0.5 rounded-md bg-surface-sunken/40 border border-border-default/10 uppercase tracking-wider">
                                                        CAT: {firstLot.mtrl_cat || "700100"}
                                                    </Mini>
                                                    {firstLot.drg_no && (
                                                        <Mini className="px-1.5 py-0.5 rounded-md bg-action-primary/10 text-action-primary border border-action-primary/20 uppercase tracking-wider">
                                                            DRG: {firstLot.drg_no}
                                                        </Mini>
                                                    )}
                                                </div>
                                            </div>
                                        </td>

                                        {!showLots || !editable ? (
                                            <>
                                                <td className="border-none text-center align-top py-2 px-3 first:pl-8 last:pr-8 font-normal text-text-tertiary text-sm">{firstLot.unit}</td>
                                                <td className="border-none text-right tabular-nums align-top py-2 px-3 first:pl-8 last:pr-8 text-text-primary font-normal text-sm">
                                                    <Accounting isCurrency>{firstLot.po_rate}</Accounting>
                                                </td>
                                                <td className="border-none text-center font-normal align-top py-2 px-3 first:pl-8 last:pr-8 text-action-primary text-sm"><Accounting>{firstLot.ord_qty}</Accounting></td>

                                                <td className="border-none text-center font-medium bg-surface-sunken/10 align-top py-2 px-3 first:pl-8 last:pr-8">
                                                    {editable ? (
                                                        <div className="flex flex-col gap-1 items-center justify-center py-2">
                                                            <QuantityInput
                                                                value={firstLot.dispatch_qty ?? 0}
                                                                max={firstLot.original_pending || 0}
                                                                onChange={(val) => onUpdateItem?.(groupIdx, "dispatch_qty", val)}
                                                            />
                                                            <div className="flex items-center gap-1">
                                                                <Caption1 className="text-[10px] uppercase opacity-40">Balance:</Caption1>
                                                                <Accounting className={cn(
                                                                    "text-[10px] tabular-nums font-bold",
                                                                    balance < 0 ? "text-status-error" : "text-status-success"
                                                                )}>
                                                                    {balance}
                                                                </Accounting>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <span className="text-status-warning font-normal"><Accounting>{totalDelivered}</Accounting></span>
                                                    )}
                                                </td>

                                                <td className="border-none text-right tabular-nums align-top py-2 px-3 first:pl-8 last:pr-8 text-status-success font-normal text-sm">
                                                    <Accounting>{firstLot.rcd_qty || 0}</Accounting>
                                                </td>
                                                <td className="text-right font-normal align-top py-2 px-3 first:pl-8 last:pr-8 text-text-primary text-sm truncate max-w-[140px]">
                                                    <Accounting isCurrency>{editable ? (currentInput * (firstLot.po_rate || 0)) : (totalDelivered * (firstLot.po_rate || 0))}</Accounting>
                                                </td>
                                                <td className="text-center align-top py-2 px-3 first:pl-8 last:pr-8 border-none">
                                                    {!editable && showLots && <ChevronDown size={16} className={cn("text-text-tertiary opacity-50 transition-transform", isExpanded && "rotate-180")} />}
                                                </td>
                                            </>
                                        ) : (
                                            <td className="text-center align-top p-4 font-medium text-text-tertiary text-xs" colSpan={5}>
                                                {/* Hidden in strict item-level edit mode */}
                                            </td>
                                        )}
                                    </tr>

                                    {showLots && !editable && isExpanded && lots.map((lot) => (
                                        <tr key={lot.id} className="bg-surface hover:bg-surface-sunken/40 transition-colors">
                                            <td className="border-none"></td>
                                            <td className="border-none align-top py-2 px-3 pl-8">
                                                <div className="flex items-center gap-2">
                                                    <CornerDownRight size={14} className="text-text-tertiary opacity-40" />
                                                    <div>
                                                        <span className="font-normal text-text-secondary text-sm uppercase tracking-tight">Lot {lot.lot_no}</span>
                                                        {lot.dely_date && <Mini className="ml-2 bg-surface-sunken/40 px-1.5 py-0.5 rounded uppercase font-normal text-sm">Due: {lot.dely_date}</Mini>}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="border-none text-center align-top py-2 px-3 text-text-tertiary text-sm font-normal">{lot.unit}</td>
                                            <td className="border-none text-center font-normal opacity-50 text-sm"><Accounting isCurrency>{lot.po_rate}</Accounting></td>
                                            <td className="border-none text-center py-2 px-3 text-action-primary text-sm font-normal"><Accounting>{lot.ord_qty}</Accounting></td>
                                            <td className="border-none text-center font-normal bg-surface-sunken/10 align-top py-2 px-3">
                                                <span className="text-status-warning font-medium"><Accounting>{lot.dsp_qty || 0}</Accounting></span>
                                            </td>
                                            <td className="text-right font-normal text-text-primary py-2 px-3 pr-4 text-sm">
                                                <Accounting isCurrency>{(lot.dsp_qty || lot.dispatch_qty || 0) * (lot.po_rate || 0)}</Accounting>
                                            </td>
                                            <td></td>
                                        </tr>
                                    ))}
                                </React.Fragment>
                            );
                        })}

                        {editable && (
                            <>
                                <tr className="border-t border-border-default/10 bg-surface-sunken/40">
                                    <td colSpan={6} className="text-center font-normal text-text-secondary border-none p-2 text-sm tracking-widest uppercase opacity-60">
                                        Policy Provisions & Terms
                                    </td>
                                    <td colSpan={2} className="text-center font-normal text-text-secondary p-2 text-sm tracking-widest uppercase border-none opacity-60">
                                        Total Dispatched Value
                                    </td>
                                </tr>
                                <tr className="bg-surface">
                                    <td colSpan={6} className="align-top border-none p-6 min-h-[300px]">
                                        <div className="space-y-4">
                                            <div className="flex items-center justify-between mb-4">
                                                <Button
                                                    variant="secondary"
                                                    size="compact"
                                                    onClick={onAddNote}
                                                    className="text-action-primary font-semibold text-xs h-8 rounded-xl border-none gap-2 transition-all"
                                                >
                                                    <Plus size={12} />
                                                    Add Row
                                                </Button>
                                            </div>

                                            <div className="flex gap-2 bg-action-primary/5 py-2 px-3 rounded-xl border border-action-primary/10 mb-4 shadow-sm">
                                                <span className="text-sm font-normal text-action-primary mt-0.5 opacity-60 uppercase tracking-tight">GC</span>
                                                <span className="flex-1 text-sm font-normal text-action-primary">
                                                    Guarantee Certificate No. {headerData?.gc_number || headerData?.dc_number || "—"} Dt. {headerData?.gc_date || headerData?.dc_date || "—"}
                                                </span>
                                                <Tiny className="text-action-primary self-center opacity-70 font-normal">Auto</Tiny>
                                            </div>

                                            {notes?.map((note, nIdx) => (
                                                <div key={nIdx} className="flex gap-2 bg-surface-sunken/40 py-1.5 px-3 rounded-xl border border-border-default/10 shadow-sm group hover:border-action-primary/30 transition-all">
                                                    <span className="text-sm font-normal text-text-tertiary mt-1">{nIdx + 1}</span>
                                                    <textarea
                                                        value={note}
                                                        onChange={(e) => onUpdateNote?.(nIdx, e.target.value)}
                                                        className="flex-1 bg-transparent border-transparent p-0 text-sm font-normal text-text-secondary focus:ring-0 resize-none min-h-[28px] outline-none"
                                                    />
                                                    <Button onClick={() => onRemoveNote?.(nIdx)} variant="ghost" className="text-text-tertiary/50 hover:text-status-error self-start p-1 h-auto min-h-0 bg-transparent border-none shadow-none"><Trash2 size={14} /></Button>
                                                </div>
                                            ))}
                                        </div>
                                    </td>
                                    <td colSpan={2} className="align-middle text-center p-8 bg-surface-sunken/10">
                                        <div className="text-2xl font-normal text-text-primary tracking-tighter">
                                            <Accounting isCurrency>{items.reduce((sum, i) => sum + ((i.dispatch_qty || 0) * (i.po_rate || 0)), 0)}</Accounting>
                                        </div>
                                    </td>
                                </tr>
                            </>
                        )}
                    </tbody>
                </table>
            </div>

            {allGroups.length > pageSize && (
                <div className="p-4 border-t border-border-default/10">
                    <Pagination
                        currentPage={page}
                        totalPages={Math.ceil(allGroups.length / pageSize)}
                        pageSize={pageSize}
                        totalItems={allGroups.length}
                        onPageChange={setPage}
                        onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
                        className="bg-transparent border-none"
                    />
                </div>
            )}
        </Card>
    );
}
