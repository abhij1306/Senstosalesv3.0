"use client";

import React, { useMemo, useState, useEffect } from "react";
import {
    Button,
    Input,
    Accounting,
    SmallText,
    Body,
    Label,
    MonoCode,
    Card,
    Caption1,
    Flex,
    Stack,
    Grid,
    Title2,
    Badge,
    GranularInput,
    Mini,
    Tiny,
    Micro,
    Pagination
} from "@/components/common";
import {
    Plus,
    Trash2,
    ChevronDown,
    ChevronUp,
    AlertCircle
} from "lucide-react";
import { formatDate, cn } from "@/lib/utils";
import { usePOStore, usePOItems } from "@/store/poStore";

interface PODetailItemsProps {
    editMode: boolean;
    expandedItems: Set<number>;
    toggleItem: (itemNo: number) => void;
}

// Local GranularInput purged in favor of global common component

const LotRow = React.memo(({
    itemIdx,
    lotIdx,
    editMode,
}: {
    itemIdx: number;
    lotIdx: number;
    editMode: boolean;
}) => {
    // Select specific delivery to avoid re-rendering on unrelated changes
    const delivery = usePOStore((state) => state.data?.items[itemIdx]?.deliveries[lotIdx]);
    const updateDelivery = usePOStore((state) => state.updateDelivery);
    const removeDelivery = usePOStore((state) => state.removeDelivery);

    if (!delivery) return null;

    return (
        <tr className="bg-surface-sunken/40 border-none transition-all hover:bg-surface/80 group/lot">
            <td className="py-1 px-3 border-none"></td>
            <td className="py-1 px-3 border-none" colSpan={1}>
                <Flex align="center" gap={3} className="py-1">
                    <Flex align="center" gap={1.5}>
                        <Tiny className="px-1 py-0 rounded border border-border-default/50 bg-action-primary/5 text-action-primary font-bold">LOT {lotIdx + 1}</Tiny>
                        {editMode ? (
                            <GranularInput
                                value={delivery.dest_code || ""}
                                onUpdate={(v) => updateDelivery(itemIdx, lotIdx, "dest_code", v)}
                                className="h-6 w-16 text-xs bg-action-primary/5"
                                placeholder="Dest"
                            />
                        ) : (
                            delivery.dest_code && <Tiny className="text-text-tertiary font-semibold">@{delivery.dest_code}</Tiny>
                        )}
                    </Flex>

                    <Flex align="center" gap={1.5}>
                        <div className="flex items-center gap-1">
                            <Micro className="text-text-tertiary/60 font-bold uppercase text-[8px] tracking-tighter">Dly:</Micro>
                            {editMode ? (
                                <GranularInput
                                    type="date"
                                    value={delivery.dely_date || ""}
                                    onUpdate={(v) => updateDelivery(itemIdx, lotIdx, "dely_date", v)}
                                    className="h-6 w-28 text-xs bg-action-primary/5"
                                />
                            ) : (
                                <Tiny className="text-text-secondary font-medium tracking-tight whitespace-nowrap">{formatDate(delivery.dely_date)}</Tiny>
                            )}
                        </div>

                        <div className="w-[1px] h-3 bg-border-default/30 mx-0.5" />

                        <div className="flex items-center gap-1">
                            <Micro className="text-text-tertiary/60 font-bold uppercase text-[8px] tracking-tighter">Entry Allow:</Micro>
                            {editMode ? (
                                <GranularInput
                                    type="text"
                                    value={delivery.entry_allow_date || delivery.remarks || ""}
                                    onUpdate={(v) => updateDelivery(itemIdx, lotIdx, "entry_allow_date", v)}
                                    className="h-6 w-32 text-xs bg-action-primary/5"
                                />
                            ) : (
                                <Tiny className="text-text-secondary font-medium tracking-tight whitespace-nowrap">
                                    {delivery.entry_allow_date ? formatDate(delivery.entry_allow_date) : (delivery.remarks || "-")}
                                </Tiny>
                            )}
                        </div>
                    </Flex>
                </Flex>
            </td>
            <td className="border-none" colSpan={1} />
            <td className="py-1 px-3 border-none text-right">
                {/* Space for Rate Column */}
                <span className="text-text-tertiary opacity-5">—</span>
            </td>
            <td className="py-1 px-3 border-none text-right">
                <Accounting className="pr-1 text-action-primary font-semibold text-sm">{delivery.ord_qty || 0}</Accounting>
            </td>
            <td className="py-1 px-3 border-none text-right">
                {editMode ? (
                    <GranularInput
                        type="number"
                        value={delivery.manual_override_qty || delivery.dsp_qty || 0}
                        onUpdate={(v) => updateDelivery(itemIdx, lotIdx, "manual_override_qty", v)}
                        className="h-6 w-16 text-xs bg-action-primary/5 text-right"
                    />
                ) : (
                    <Accounting className="pr-1 text-text-tertiary font-medium text-sm">
                        {(delivery.manual_override_qty || 0) > 0 ? delivery.manual_override_qty : (delivery.dsp_qty || 0)}
                    </Accounting>
                )}
            </td>
            <td className="py-1 px-3 border-none text-right">
                <Accounting className="pr-1 text-text-tertiary/40 font-medium text-sm">
                    {Math.max(0, (delivery.ord_qty || 0) - (delivery.manual_override_qty || delivery.dsp_qty || 0))}
                </Accounting>
            </td>
            <td className="py-1 px-3 border-none text-right">
                <Accounting className="pr-1 text-text-secondary font-medium text-sm">
                    {delivery.rcd_qty || 0}
                </Accounting>
            </td>
            <td className="py-1 px-3 border-none text-center">
                {editMode && (
                    <Button
                        variant="ghost"
                        size="compact"
                        onClick={() => removeDelivery(itemIdx, lotIdx)}
                        className="h-5 w-5 p-0 text-status-error hover:bg-status-error/10"
                    >
                        <Trash2 className="w-3 h-3" />
                    </Button>
                )}
            </td>
        </tr>
    );
});
LotRow.displayName = "LotRow";

const ItemRow = React.memo(({
    idx,
    editMode,
    isExpanded,
    toggleItem,
}: {
    idx: number;
    editMode: boolean;
    isExpanded: boolean;
    toggleItem: (n: number) => void;
}) => {
    const item = usePOStore((state) => state.data?.items[idx]);
    const updateItem = usePOStore((state) => state.updateItem);
    const removeItem = usePOStore((state) => state.removeItem);
    const addDelivery = usePOStore((state) => state.addDelivery);

    if (!item) return null;

    const { tOrd, tDsp, tRecd, tBal } = useMemo(() => {
        // Enforce parent-level truth: Sum lot quantities for the parent row's Ordered Qty
        const ord = item.deliveries && item.deliveries.length > 0
            ? item.deliveries.reduce((sum, d) => sum + (d.ord_qty || 0), 0)
            : (item.ord_qty || 0);

        const dsp = item.dsp_qty || 0;
        const recd = item.rcd_qty || 0;
        return {
            tOrd: ord,
            tDsp: dsp,
            tRecd: recd,
            tBal: Math.max(0, ord - dsp)
        };
    }, [item.ord_qty, item.dsp_qty, item.rcd_qty, item.deliveries]);

    return (
        <React.Fragment>
            <tr className={cn(
                "transition-all duration-300 group border-none h-[44px]",
                isExpanded
                    ? "bg-surface shadow-elevated z-10"
                    : "hover:bg-action-primary/5 hover-elevate"
            )}>
                <td className="py-2 px-3 text-center w-[50px] border-none">
                    <span className="text-xs font-bold text-action-primary opacity-60 animate-pulse-slow">#{item.po_item_no}</span>
                </td>
                <td className="py-2 px-3 border-none text-left">
                    <div className="flex flex-col gap-0.5">
                        <Body className="text-action-primary font-semibold tracking-tight">
                            {editMode ? (
                                <GranularInput
                                    value={item.material_code || ""}
                                    onUpdate={(val) => updateItem(idx, "material_code", val)}
                                    className="bg-action-primary/5 font-semibold mb-1"
                                    placeholder="Code"
                                />
                            ) : (
                                item.material_code
                            )}
                        </Body>

                        <Body className={cn(
                            "text-text-secondary font-medium leading-normal line-clamp-12",
                            !editMode && "cursor-help"
                        )} title={item.material_description || ""}>
                            {editMode ? (
                                <GranularInput
                                    value={item.material_description || ""}
                                    onUpdate={(val) => updateItem(idx, "material_description", val)}
                                    className="bg-action-primary/5 mb-1"
                                    placeholder="Description"
                                />
                            ) : (
                                item.material_description
                            )}
                        </Body>

                        <div className="flex gap-2 mt-1.5 flex-wrap">
                            <div className="flex items-center gap-1">
                                {editMode ? (
                                    <div className="flex items-center gap-1">
                                        <GranularInput
                                            value={item.mtrl_cat || ""}
                                            onUpdate={(val) => updateItem(idx, "mtrl_cat", val)}
                                            className="px-1.5 py-0.5 h-6 w-24 bg-action-primary/5 text-xs"
                                            placeholder="Cat/HSN"
                                        />
                                    </div>
                                ) : (
                                    <Micro className="px-1 py-0 rounded border border-border-default/50 bg-surface-sunken text-text-tertiary tracking-tight">
                                        CAT: {item.mtrl_cat || "700100"}
                                    </Micro>
                                )}
                            </div>
                            {(item.drg_no || editMode) && (
                                <div className="flex items-center">
                                    {editMode ? (
                                        <GranularInput
                                            value={item.drg_no || ""}
                                            onUpdate={(val) => updateItem(idx, "drg_no", val)}
                                            className="px-1.5 py-0.5 h-6 w-32 bg-action-primary/5 text-xs"
                                            placeholder="Drawing No."
                                        />
                                    ) : (
                                        <Micro className="px-1 py-0 rounded border border-action-primary/20 bg-action-primary/5 text-action-primary tracking-tight">
                                            DRG: {item.drg_no}
                                        </Micro>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </td>
                <td className="py-2 px-3 w-[60px] border-none text-left">
                    <span className="text-text-tertiary uppercase text-2xs font-medium opacity-60">{item.unit}</span>
                </td>
                <td className="py-2 px-3 w-[90px] text-right border-none">
                    <Accounting className="text-text-primary pr-1 text-sm">{(item.po_rate || 0).toFixed(2)}</Accounting>
                </td>
                <td className="py-2 px-3 w-[90px] text-right border-none">
                    <Accounting className="text-action-primary pr-1 text-sm font-semibold">{tOrd}</Accounting>
                </td>
                <td className="py-2 px-3 w-[120px] text-right border-none">
                    {editMode ? (
                        <GranularInput
                            type="number"
                            value={item.dsp_qty || 0}
                            onUpdate={(v) => updateItem(idx, "dsp_qty", v)}
                            min={0}
                            max={tOrd}
                            realTime={true}
                            className="text-right font-mono bg-status-warning/10 shadow-inner text-status-warning"
                        />
                    ) : (
                        <Accounting className="text-status-warning pr-1 text-sm font-semibold">{tDsp}</Accounting>
                    )}
                </td>
                <td className="py-2 px-3 w-[100px] text-right border-none">
                    <Accounting className="text-text-tertiary pr-1 text-xs opacity-50 font-semibold">{tBal}</Accounting>
                </td>
                <td className="py-2 px-3 w-[110px] text-right border-none">
                    <Accounting className="text-status-success pr-1 text-sm font-semibold">{tRecd}</Accounting>
                </td>
                <td className="py-2 px-3 w-[60px] border-none text-center">
                    <Flex gap={1} justify="center">
                        <Button
                            variant="outline"
                            size="compact"
                            onClick={() => toggleItem(item.po_item_no)}
                            className="h-6 w-6 p-0 rounded-full bg-surface/80 border border-border-default shadow-sm"
                        >
                            {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                        </Button>
                        {editMode && (
                            <Button
                                variant="ghost"
                                size="compact"
                                onClick={() => removeItem(idx)}
                                className="h-6 w-6 p-0 text-status-error hover:bg-status-error/10 rounded-full"
                            >
                                <Trash2 size={12} />
                            </Button>
                        )}
                    </Flex>
                </td>
            </tr>

            {isExpanded && (
                <React.Fragment>
                    {item.deliveries && item.deliveries.map((_, lIdx) => (
                        <LotRow
                            key={`${item.po_item_no}-lot-${lIdx}`}
                            itemIdx={idx}
                            lotIdx={lIdx}
                            editMode={editMode}
                        />
                    ))}
                    {editMode && (
                        <tr className="bg-surface-sunken/40 border-none">
                            <td className="py-2 px-3 border-none"></td>
                            <td className="py-2 px-3 border-none" colSpan={8}>
                                <Button
                                    variant="ghost"
                                    size="compact"
                                    className="text-action-primary font-medium gap-2"
                                    onClick={() => addDelivery(idx)}
                                >
                                    <Plus size={12} /> <Mini className="text-inherit">Add Delivery Lot</Mini>
                                </Button>
                            </td>
                        </tr>
                    )}
                </React.Fragment>
            )}
        </React.Fragment>
    );
});
ItemRow.displayName = "ItemRow";

export const PODetailItems = ({
    editMode,
    expandedItems,
    toggleItem,
}: PODetailItemsProps) => {
    // Select specific dependencies to reduce re-renders
    const items = usePOItems();
    const addItem = usePOStore((state) => state.addItem);

    // Pagination State
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(50);

    const paginatedItems = useMemo(() => {
        const start = (page - 1) * pageSize;
        return items.slice(start, start + pageSize);
    }, [items, page, pageSize]);

    return (
        <Stack gap={3}>
            <Flex align="center" justify="between" className="px-2">
                <Caption1 className="opacity-80">
                    Procurement Structure
                </Caption1>
                {editMode && (
                    <Button onClick={addItem} variant="secondary" size="compact" className="h-6">
                        <Plus className="w-3 h-3 mr-1" /> New Item
                    </Button>
                )}
            </Flex>

            {/* Removed overflow-hidden from parent to prevent dropdown clipping */}
            <Card variant="flat" padding="none" className="bg-surface shadow-sm transition-all flex flex-col">
                <div className="overflow-x-auto w-full no-scrollbar rounded-t-2xl">
                    <table className="w-full border-collapse table-auto">
                        <thead>
                            <tr className="bg-surface-sunken/40 border-none h-[40px]">
                                <th className="py-2 px-3 text-center w-[50px] border-none"><Caption1>#</Caption1></th>
                                <th className="py-2 px-3 text-left w-auto border-none min-w-[600px]"><Caption1>Material Details</Caption1></th>
                                <th className="py-2 px-3 text-left w-[60px] border-none"><Caption1>Unit</Caption1></th>
                                <th className="py-2 px-3 text-right w-[90px] border-none pr-4"><Caption1>Rate</Caption1></th>
                                <th className="py-2 px-3 text-right w-[90px] border-none pr-4"><Caption1 className="text-action-primary">Ordered</Caption1></th>
                                <th className="py-2 px-3 text-right w-[120px] border-none pr-4"><Caption1 className="text-status-warning">Dispatched</Caption1></th>
                                <th className="py-2 px-3 text-right w-[100px] border-none pr-4"><Caption1>Balance</Caption1></th>
                                <th className="py-2 px-3 text-right w-[110px] border-none pr-4"><Caption1 className="text-status-success">Received</Caption1></th>
                                <th className="py-2 px-3 w-[60px] border-none"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-none">
                            {paginatedItems.length > 0 ? (
                                paginatedItems.map((item, idx) => (
                                    <ItemRow
                                        key={item.po_item_no}
                                        idx={(page - 1) * pageSize + idx}
                                        editMode={editMode}
                                        isExpanded={expandedItems.has(item.po_item_no)}
                                        toggleItem={toggleItem}
                                    />
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={9} className="py-20 text-center border-none">
                                        {editMode && (
                                            <Button onClick={addItem} variant="outline">
                                                <Plus className="w-5 h-5 mr-2" /> Add first procurement item
                                            </Button>
                                        )}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination outside scroll container */}
                {items.length > pageSize && (
                    <div className="p-4 border-t border-surface-sunken/40">
                        <Pagination
                            currentPage={page}
                            totalPages={Math.ceil(items.length / pageSize)}
                            pageSize={pageSize}
                            totalItems={items.length}
                            onPageChange={setPage}
                            onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
                            className="bg-transparent border-none"
                        />
                    </div>
                )}
            </Card>
        </Stack>
    );
};
