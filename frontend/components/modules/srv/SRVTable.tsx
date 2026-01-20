"use client";

import React from "react";
import { Body, Badge, Mini, Tiny, Accounting, StandardLabel, StandardValue, Flex, Card, Caption1 } from "@/components/common";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";

interface SRVTableProps {
    items: any[];
}

export function SRVTable({ items }: SRVTableProps) {
    return (
        <Card variant="flat" padding="none" className="bg-surface shadow-sm transition-all flex flex-col min-h-[400px]">
            <div className="bg-surface-sunken/40 px-6 py-4 border-b border-border-default/10">
                <Caption1 className="opacity-80">Receipt Items</Caption1>
                <StandardLabel className="opacity-40 mt-0.5 block">Digital Verification Ledger</StandardLabel>
            </div>

            <div className="w-full overflow-hidden">
                <table className="w-full text-left border-collapse table-fixed">
                    <thead>
                        <tr className="bg-surface-sunken/40 border-none h-[40px] hidden md:table-row">
                            <th className="w-[80px] py-2 px-3 first:pl-8 last:pr-8 border-none text-center">
                                <Caption1>PO Item</Caption1>
                            </th>
                            <th className="w-[80px] py-2 px-3 first:pl-8 last:pr-8 border-none text-center">
                                <Caption1>SRV Item</Caption1>
                            </th>
                            <th className="w-[50px] py-2 px-3 first:pl-8 last:pr-8 border-none text-center">
                                <Caption1>Rev</Caption1>
                            </th>
                            <th className="py-2 px-3 first:pl-8 last:pr-8 border-none text-left">
                                <Caption1>Material Identity</Caption1>
                            </th>
                            <th className="w-[60px] py-2 px-3 first:pl-8 last:pr-8 border-none text-center">
                                <Caption1>Unit</Caption1>
                            </th>
                            <th className="w-[100px] py-2 px-3 first:pl-8 last:pr-8 border-none text-right">
                                <Caption1 className="text-action-primary">Ordered</Caption1>
                            </th>
                            <th className="w-[100px] py-2 px-3 first:pl-8 last:pr-8 border-none text-right">
                                <Caption1 className="text-status-warning">Dispatched</Caption1>
                            </th>
                            <th className="w-[100px] py-2 px-3 first:pl-8 last:pr-8 border-none text-right bg-surface-sunken/10">
                                <Caption1>Received</Caption1>
                            </th>
                            <th className="w-[100px] py-2 px-3 first:pl-8 last:pr-8 border-none text-right">
                                <Caption1 className="text-status-success">Accepted</Caption1>
                            </th>
                            <th className="w-[100px] py-2 px-3 first:pl-8 last:pr-8 border-none text-right">
                                <Caption1 className="text-status-error">Rejected</Caption1>
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-none">
                        {items.map((item, idx) => (
                            <tr key={idx} className="transition-all duration-300 group border-none h-[48px] hover:bg-action-primary/5 rounded-xl">
                                <td className="py-2 px-3 first:pl-8 last:pr-8 border-none text-center align-top pt-3">
                                    <StandardValue className="font-normal tabular-nums">#{item.po_item_no}{item.lot_no ? `.${item.lot_no}` : ''}</StandardValue>
                                </td>
                                <td className="py-2 px-3 first:pl-8 last:pr-8 border-none text-center align-top pt-3">
                                    <StandardValue className="text-text-tertiary tabular-nums font-mono opacity-80">{item.srv_item_no || ""}</StandardValue>
                                </td>
                                <td className="py-2 px-3 first:pl-8 last:pr-8 border-none text-center align-top pt-3">
                                    <StandardValue className="text-text-tertiary tabular-nums font-mono opacity-60">{item.rev_no || "0"}</StandardValue>
                                </td>
                                <td className="py-2 px-3 border-none align-top pt-2 overflow-hidden">
                                    <div className="flex flex-col gap-0.5">
                                        {item.material_code && (
                                            <Body className="text-action-primary font-normal tracking-tight">{item.material_code}</Body>
                                        )}
                                        <Body className="text-text-secondary font-normal leading-normal line-clamp-2 text-sm" title={item.material_description || item.description}>
                                            {item.material_description || item.description || "Description not found"}
                                        </Body>
                                        <div className="flex gap-2 mt-1.5 flex-wrap">
                                            {item.mtrl_cat && (
                                                <Mini className="px-1.5 py-0.5 rounded-md bg-surface-sunken border border-border-default uppercase tracking-wider">
                                                    CAT: {item.mtrl_cat}
                                                </Mini>
                                            )}
                                            {item.drg_no && (
                                                <Mini className="px-1.5 py-0.5 rounded-md bg-action-primary/10 text-action-primary border border-action-primary/20 uppercase tracking-wider truncate max-w-[150px]" title={item.drg_no}>
                                                    DRG: {item.drg_no}
                                                </Mini>
                                            )}
                                        </div>
                                    </div>
                                </td>
                                <td className="py-2 px-3 first:pl-8 last:pr-8 border-none text-center align-top pt-3">
                                    <StandardLabel className="opacity-60">{item.unit || "NOS"}</StandardLabel>
                                </td>
                                <td className="py-2 px-3 first:pl-8 last:pr-8 border-none text-right align-top pt-3">
                                    <Accounting className="text-action-primary text-sm font-normal tabular-nums">{item.ord_qty}</Accounting>
                                </td>
                                <td className="py-2 px-3 first:pl-8 last:pr-8 border-none text-right align-top pt-3">
                                    <Accounting className="text-status-warning text-sm font-normal tabular-nums">{item.challan_qty || 0}</Accounting>
                                </td>
                                <td className="py-2 px-3 first:pl-8 last:pr-8 border-none text-right bg-surface-sunken/10 align-top pt-3">
                                    <Accounting className="text-text-primary text-sm font-normal tabular-nums">{item.rcd_qty}</Accounting>
                                </td>
                                <td className="py-2 px-3 first:pl-8 last:pr-8 border-none text-right align-top pt-3">
                                    <Accounting className="text-status-success text-sm font-normal tabular-nums">{item.accepted_qty}</Accounting>
                                </td>
                                <td className="py-2 px-3 first:pl-8 last:pr-8 border-none text-right align-top pt-3">
                                    <span className={cn("font-normal tabular-nums text-sm", item.rej_qty > 0 ? "text-status-error" : "text-text-tertiary opacity-40")}>
                                        {item.rej_qty || 0}
                                    </span>
                                </td>
                            </tr>
                        ))}
                        {items.length === 0 && (
                            <tr>
                                <td colSpan={10} className="py-20 text-center border-none">
                                    <StandardLabel className="opacity-20">No line items found</StandardLabel>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </Card>
    );
}
