"use client";
import {
    Accounting,
    Badge,
    Body,
    Box,
    Button,
    Caption1,
    Caption2,
    Card,
    Flex,
    Input,
    Label,
    SmallText,
    Stack,
    StandardLabel,
    StandardValue,
    SummaryCards,
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
    Title3,
    MetadataItem
} from "@/components/common";

import React from "react";
import {
    Info,
    FileText,
    ShieldCheck,
    Receipt,
    Calendar
} from "lucide-react";
import { formatDate, formatIndianCurrency, cn } from "@/lib/utils";
import { usePOStore } from "@/store/poStore";

interface PODetailInfoProps {
    srvs: any[];
    editMode: boolean;
    onSRVClick: (srvNumber: string) => void;
    activeTab: string;
    setActiveTab: (tab: string) => void;
}

export const PODetailInfo = ({
    srvs,
    editMode,
    onSRVClick,
    activeTab,
    setActiveTab,
}: PODetailInfoProps) => {
    const header = usePOStore((state) => state.data?.header);
    const items = usePOStore((state) => state.data?.items);
    const updateHeader = usePOStore((state) => state.updateHeader);

    const commonDelyDate = React.useMemo(() => {
        if (items && items.length > 0 && items[0]?.deliveries?.[0]?.dely_date) {
            return items[0].deliveries[0].dely_date;
        }
        return null;
    }, [items]);

    if (!header) return null;

    return (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="mb-4 bg-surface-sunken/50 p-1.5 rounded-2xl w-fit border-none shadow-sm backdrop-blur-md">
                <TabsTrigger value="basic">Basic Info</TabsTrigger>
                <TabsTrigger value="references">References</TabsTrigger>
                <TabsTrigger value="financial">Financial Details</TabsTrigger>
                <TabsTrigger value="issuer">Issuing Authority</TabsTrigger>
                <TabsTrigger value="srvs">Store Receipts ({srvs.length})</TabsTrigger>
            </TabsList>

            <div key={activeTab} className="animate-fade-in">
                <Card variant="flat" padding="lg" className="bg-surface min-h-[180px] shadow-sm">
                    <TabsContent value="basic" className="m-0">
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-x-10 gap-y-6">
                            <MetadataItem label="PO Number" value={header.po_number} />
                            <MetadataItem label="PO Date" value={formatDate(header.po_date)} />
                            <MetadataItem label="Supplier Name" value={header.supplier_name} editable={editMode} onChange={(v) => updateHeader("supplier_name", v)} />
                            <MetadataItem label="Supplier Code" value={header.supplier_code} editable={editMode} onChange={(v) => updateHeader("supplier_code", v)} />
                            <MetadataItem label="Phone" value={header.supplier_phone} editable={editMode} onChange={(v) => updateHeader("supplier_phone", v)} />
                            <MetadataItem label="Email" value={header.supplier_email || ""} editable={editMode} onChange={(v) => updateHeader("supplier_email", v)} />
                            <MetadataItem label="Supplier GSTIN" value={header.supplier_gstin || ""} editable={editMode} onChange={(v) => updateHeader("supplier_gstin", v)} />
                            <MetadataItem label="Our Ref" value={header.our_ref || ""} editable={editMode} onChange={(v) => updateHeader("our_ref", v)} />
                            <MetadataItem label="Dept No" value={header.department_no} editable={editMode} onChange={(v) => updateHeader("department_no", v)} />
                        </div>
                    </TabsContent>

                    <TabsContent value="references" className="m-0">
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-x-10 gap-y-6">
                            <MetadataItem label="Enquiry Number" value={header.enquiry_no} editable={editMode} onChange={(v) => updateHeader("enquiry_no", v)} />
                            <MetadataItem label="Enquiry Date" value={formatDate(header.enquiry_date)} editable={editMode} onChange={(v) => updateHeader("enquiry_date", v)} />
                            <MetadataItem label="Quotation Ref" value={header.quotation_ref} editable={editMode} onChange={(v) => updateHeader("quotation_ref", v)} />
                            <MetadataItem label="Quotation Date" value={formatDate(header.quotation_date)} editable={editMode} onChange={(v) => updateHeader("quotation_date", v)} />
                            <MetadataItem label="RC Number" value={header.rc_no} editable={editMode} onChange={(v) => updateHeader("rc_no", v)} />
                            <MetadataItem label="Order Type" value={header.order_type} editable={editMode} onChange={(v) => updateHeader("order_type", v)} />
                            <MetadataItem label="PO Status" value={header.po_status} />
                            <MetadataItem label="AMD Number" value={header.amend_no} editable={editMode} onChange={(v) => updateHeader("amend_no", v)} />
                        </div>
                    </TabsContent>

                    <TabsContent value="financial" className="m-0">
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-x-10 gap-y-6">
                            <MetadataItem label="PO Value" value={header.po_value} isCurrency editable={editMode} onChange={(v) => updateHeader("po_value", v)} />
                            <MetadataItem label="FOB Value" value={header.fob_value} isCurrency editable={editMode} onChange={(v) => updateHeader("fob_value", v)} />
                            <MetadataItem label="Net Value" value={header.net_po_value} isCurrency editable={editMode} onChange={(v) => updateHeader("net_po_value", v)} />
                            <MetadataItem label="TIN No" value={header.tin_no} editable={editMode} onChange={(v) => updateHeader("tin_no", v)} />
                            <MetadataItem label="ECC No" value={header.ecc_no} editable={editMode} onChange={(v) => updateHeader("ecc_no", v)} />
                            <MetadataItem label="MPCT No" value={header.mpct_no} editable={editMode} onChange={(v) => updateHeader("mpct_no", v)} />
                            <MetadataItem label="Currency" value={header.currency} editable={editMode} onChange={(v) => updateHeader("currency", v)} />
                            <MetadataItem label="Ex Rate" value={header.ex_rate} editable={editMode} onChange={(v) => updateHeader("ex_rate", v)} />
                        </div>
                    </TabsContent>

                    <TabsContent value="issuer" className="m-0">
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-x-10 gap-y-6">
                            <MetadataItem label="Inspection By" value={header.inspection_by} editable={editMode} onChange={(v) => updateHeader("inspection_by", v)} />
                            <MetadataItem label="Inspection At" value={header.inspection_at || ""} editable={editMode} onChange={(v) => updateHeader("inspection_at", v)} />
                            <MetadataItem label="Consignee Name" value={header.consignee_name || ""} editable={editMode} onChange={(v) => updateHeader("consignee_name", v)} />
                            <MetadataItem label="Issuer Name" value={header.issuer_name} editable={editMode} onChange={(v) => updateHeader("issuer_name", v)} />
                            <MetadataItem label="Designation" value={header.issuer_designation} editable={editMode} onChange={(v) => updateHeader("issuer_designation", v)} />
                            <div className="col-span-2">
                                <MetadataItem label="Consignee Address" value={header.consignee_address || ""} editable={editMode} onChange={(v) => updateHeader("consignee_address", v)} />
                            </div>
                            <div className="col-span-full mt-2">
                                <Stack gap={1}>
                                    <StandardLabel className="opacity-60">Remarks</StandardLabel>
                                    {editMode ? (
                                        <Input
                                            value={header.remarks || ""}
                                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateHeader("remarks", e.target.value)}
                                            className="w-full h-8 px-3 text-sm border-none bg-surface-sunken/60 rounded-xl focus:ring-1 focus:ring-action-primary/30 transition-all font-sans text-text-primary"
                                            placeholder="Enter additional remarks..."
                                        />
                                    ) : (
                                        <StandardValue className="text-text-secondary opacity-80 backdrop-blur-sm bg-surface/5 px-2 py-1 rounded-lg">
                                            {header.remarks || "No remarks provided."}
                                        </StandardValue>
                                    )}
                                </Stack>
                            </div>
                        </div>
                    </TabsContent>

                    <TabsContent value="srvs" className="m-0">
                        {srvs.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {srvs.map((srv: any) => (
                                    <div
                                        key={srv.srv_number}
                                        className="p-4 rounded-xl bg-surface-sunken/40 hover:bg-surface-sunken/60 transition-all duration-300 group cursor-pointer border-none"
                                        onClick={() => onSRVClick(srv.srv_number)}
                                    >
                                        <Flex justify="between" align="start" className="mb-3">
                                            <Stack gap={1}>
                                                <Caption1 className="text-text-primary group-hover:text-action-primary">
                                                    SRV-{srv.srv_number}
                                                </Caption1>
                                                <Caption2 className="gap-1 uppercase tracking-tight flex items-center">
                                                    <Calendar className="w-2.5 h-2.5 mr-1" />
                                                    {formatDate(srv.srv_date)}
                                                </Caption2>
                                            </Stack>
                                            <div className="w-6 h-6 rounded-lg bg-status-info-container flex items-center justify-center text-on-status-info">
                                                <Receipt className="w-3 h-3" />
                                            </div>
                                        </Flex>
                                        <div className="grid grid-cols-2 pt-2 mt-2 gap-2 border-t border-border-default/10">
                                            <div>
                                                <Caption2 className="text-status-success uppercase tracking-widest font-medium">
                                                    Accepted
                                                </Caption2>
                                                <Accounting className="text-xs text-status-success font-medium">
                                                    {srv.total_accepted_qty || 0}
                                                </Accounting>
                                            </div>
                                            <div className="text-right">
                                                <Caption2 className="text-status-error uppercase tracking-widest font-medium">
                                                    Rejected
                                                </Caption2>
                                                <Accounting className="text-xs text-status-error font-medium">
                                                    {srv.total_rejected_qty || 0}
                                                </Accounting>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-6 text-text-tertiary text-sm">
                                No linked SRVs found.
                            </div>
                        )}
                    </TabsContent>
                </Card>
            </div>
        </Tabs>
    );
};