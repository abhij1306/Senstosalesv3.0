"use client";

import React from "react";
import { MetadataGrid } from "@/components/common";
import { formatDate } from "@/lib/utils";

interface SRVHeaderInfoProps {
    header: any;
    metaItem?: any;
}

export function SRVHeaderInfo({ header, metaItem = {} }: SRVHeaderInfoProps) {
    return (
        <div className="space-y-6">
            <MetadataGrid
                padding="lg"
                columns={4}
                className="bg-surface shadow-sm"
                items={[
                    { label: "SRV Number", value: header.srv_number },
                    { label: "SRV Date", value: formatDate(header.srv_date) },
                    { label: "PO Number", value: header.po_number },
                    { label: "Division", value: metaItem.div_code },
                    { label: "Invoice No", value: metaItem.invoice_no },
                    { label: "Invoice Date", value: formatDate(metaItem.invoice_date) },
                    { label: "Challan No", value: metaItem.challan_no },
                    { label: "Challan Date", value: formatDate(metaItem.challan_date) },
                    { label: "CNote No", value: metaItem.cnote_no },
                    { label: "CNote Date", value: formatDate(metaItem.cnote_date) },
                    { label: "Finance Date", value: formatDate(metaItem.finance_date) },
                    { label: "PMIR No", value: metaItem.pmir_no }
                ]}
            />
        </div>
    );
}
