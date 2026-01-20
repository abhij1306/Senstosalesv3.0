"use client";
import React from "react";
import {
    Body, Box, Button, Card, Flex, Grid, Input, Label, Stack, Title3,
    Caption1, Caption2, Subhead, DocumentTemplate, StandardLabel,
    StandardValue, FieldGroup, Mini, Tiny, MetadataGrid, Accounting
} from "@/components/common";
import { Hash, Calendar, Key, User, MapPin } from "lucide-react";
import { formatDate } from "@/lib/utils";

interface DCHeaderInfoProps {
    header: any;
    poData?: any;
    totalDCValue: number;
    editable?: boolean;
    onUpdateHeader?: (key: string, value: any) => void;
    isDuplicateNumber?: boolean;
    onCheckDuplicate?: (num: string, date: string) => void;
    gcNumberEditedByUser?: React.MutableRefObject<boolean>;
    gcDateEditedByUser?: React.MutableRefObject<boolean>;
}

export function DCHeaderInfo({
    header,
    poData,
    totalDCValue,
    editable = false,
    onUpdateHeader,
    isDuplicateNumber = false,
    onCheckDuplicate,
    gcNumberEditedByUser,
    gcDateEditedByUser
}: DCHeaderInfoProps) {

    if (!editable) {
        return (
            <MetadataGrid
                padding="lg"
                columns={6}
                className="bg-surface shadow-sm"
                items={[
                    { label: "Challan No.", value: header.dc_number },
                    { label: "DC Date", value: formatDate(header.dc_date) },
                    { label: "Our Ref", value: header.our_ref },
                    { label: "PO Reference", value: header.po_number },
                    { label: "PO Date", value: header.po_date ? formatDate(header.po_date) : (poData?.po_date ? formatDate(poData.po_date) : "-") },
                    { label: "DVN (Delivery To)", value: header.department_no || poData?.department_no },
                    { label: "DC Value", value: totalDCValue, isCurrency: true },
                    { label: "Consignee", value: header.consignee_name, className: "col-span-2" },
                    { label: "Address", value: header.consignee_address, className: "col-span-3" },
                    { label: "GC Number", value: header.gc_number },
                    { label: "GC Date", value: header.gc_date ? formatDate(header.gc_date) : "-" }
                ]}
            />
        );
    }

    return (
        <Card variant="flat" padding="md" className="bg-surface shadow-sm">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-4 gap-y-4">
                <FieldGroup
                    label="DC Number"
                    value={header.dc_number || ""}
                    onChange={(v) => onUpdateHeader?.("dc_number", v)}
                    placeholder="DC-XXXX"
                    icon={<Hash size={16} />}
                    error={isDuplicateNumber}
                    tooltip={isDuplicateNumber ? "Number already exists in this FY" : undefined}
                />

                <FieldGroup
                    label="GC Number"
                    value={header.gc_number || ""}
                    onChange={(v) => {
                        if (gcNumberEditedByUser) gcNumberEditedByUser.current = true;
                        onUpdateHeader?.("gc_number", v);
                    }}
                    placeholder="GC-XXXX"
                    icon={<Key size={16} />}
                />

                <FieldGroup
                    label="DC Date"
                    value={header.dc_date}
                    onChange={(v) => {
                        onUpdateHeader?.("dc_date", v);
                        if (header.dc_number && onCheckDuplicate) onCheckDuplicate(header.dc_number, v);
                        if (gcDateEditedByUser && !gcDateEditedByUser.current) onUpdateHeader?.("gc_date", v);
                    }}
                    icon={<Calendar size={16} />}
                />

                <FieldGroup
                    label="GC Date"
                    value={header.gc_date || header.dc_date}
                    onChange={(v) => {
                        if (gcDateEditedByUser) gcDateEditedByUser.current = true;
                        onUpdateHeader?.("gc_date", v);
                    }}
                    icon={<Calendar size={16} />}
                />

                <div className="space-y-2">
                    <StandardLabel>PO Reference</StandardLabel>
                    <div className="h-10 flex items-center px-3 bg-surface-sunken/40 rounded-xl font-medium text-text-primary">
                        <Body className="text-inherit">{poData?.po_number || header.po_number || "N/A"}</Body>
                    </div>
                </div>

                <FieldGroup
                    label="Our Ref"
                    value={header.our_ref || ""}
                    onChange={(v) => onUpdateHeader?.("our_ref", v)}
                    placeholder="SSG-XXXX"
                    icon={<Hash size={16} />}
                />

                <div className="space-y-2">
                    <StandardLabel>DVN (Delivery To)</StandardLabel>
                    <div className="h-10 flex items-center px-3 bg-surface-sunken/40 rounded-xl font-medium text-text-primary">
                        <Body className="text-inherit">{poData?.department_no || header.department_no || "N/A"}</Body>
                    </div>
                </div>

                <div className="space-y-2">
                    <StandardLabel>PO Date</StandardLabel>
                    <div className="h-10 flex items-center px-3 bg-surface-sunken/40 rounded-xl font-medium text-text-primary">
                        <Body className="text-inherit">{poData?.po_date || header.po_date || "N/A"}</Body>
                    </div>
                </div>

                <div className="space-y-2">
                    <StandardLabel>DC Value</StandardLabel>
                    <div className="h-10 flex items-center px-3 bg-action-primary/5 rounded-xl font-semibold text-action-primary">
                        <Body className="text-inherit"><Accounting isCurrency>{totalDCValue}</Accounting></Body>
                    </div>
                </div>

                <div className="md:col-span-2 lg:col-span-2">
                    <FieldGroup
                        label="Consignee Name"
                        value={header.consignee_name || ""}
                        onChange={(v) => onUpdateHeader?.("consignee_name", v)}
                        placeholder="Receiver Business Name"
                        icon={<User size={16} />}
                    />
                </div>

                <div className="md:col-span-3 lg:col-span-3">
                    <FieldGroup
                        label="Consignee Address"
                        value={header.consignee_address || ""}
                        onChange={(v) => onUpdateHeader?.("consignee_address", v)}
                        placeholder="Full delivery location address"
                        icon={<MapPin size={16} />}
                    />
                </div>
            </div>
        </Card>
    );
}
