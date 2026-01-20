"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import {
    Plus,
    FileDown,
    Truck,
    Edit3,
    PlusCircle,
    ChevronDown,
    CornerDownRight,
    Trash2
} from "lucide-react";
import { API_BASE_URL, api } from "@/lib/api";
import { formatDate, formatIndianCurrency, cn } from "@/lib/utils";
import {
    DocumentTemplate, Button,
    Badge,
    ActionConfirmationModal, useToast,
    StandardValue, StandardLabel,
    DeviationsSection
} from "@/components/common";
import { DCHeaderInfo } from "./DCHeaderInfo";
import { DCTable } from "./DCTable";
import Link from "next/link";
import { DCDetail } from "@/types";
import { useDCStore } from "@/store/dcStore";

interface DCDetailClientProps {
    initialData: DCDetail;
    initialInvoiceData: { has_invoice: boolean; invoice_number?: string } | null;
}

export function DCDetailClient({ initialData, initialInvoiceData }: DCDetailClientProps) {
    const router = useRouter();
    const { data, setDC, updateHeader } = useDCStore();
    const { toast } = useToast();
    const [showDeleteModal, setShowDeleteModal] = React.useState(false);
    const [isDeleting, setIsDeleting] = React.useState(false);
    const [isDownloading, setIsDownloading] = React.useState(false);

    const handleDownload = async () => {
        setIsDownloading(true);
        try {
            const result = await import("@/lib/api").then(m => m.downloadFile(`/api/dc/${h.dc_number}/download`, `DC_${h.dc_number}.xlsx`));
            if (result.success && result.message) {
                toast("Download Complete", result.message, "success");
            } else if (!result.success) {
                toast("Download Failed", result.message || "Unknown error", "error");
            }
        } catch (e: any) {
            toast("Error", e.message, "error");
        } finally {
            setIsDownloading(false);
        }
    };

    useEffect(() => {
        if (initialData) setDC(initialData);
    }, [initialData, setDC]);

    const displayData = data?.header ? data : initialData;

    if (!displayData?.header) return <div className="p-8 text-center text-text-tertiary">Loading details...</div>;

    const h = displayData.header;
    const items = displayData.items || [];

    const hasInvoice = h?.invoice_number ? true : (initialInvoiceData?.has_invoice || false);
    const invoiceNumber = h?.invoice_number || initialInvoiceData?.invoice_number || null;

    const [expandedItems, setExpandedItems] = React.useState<Set<string>>(new Set());
    const toggleItem = (id: string) => {
        const next = new Set(expandedItems);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setExpandedItems(next);
    };

    const totalDCValue = items.reduce((sum: number, item: any) => sum + ((item.dsp_qty || 0) * (item.po_rate || 0)), 0);

    const handleDelete = async () => {
        setIsDeleting(true);
        try {
            await api.deleteDC(h.dc_number);
            toast("Challan deleted", `DC ${h.dc_number} has been deleted successfully.`, "success");
            router.push("/dc");
            router.refresh();
        } catch (error: any) {
            toast("Delete failed", error.message || "Failed to delete challan", "error");
            setShowDeleteModal(false);
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <>
            <DocumentTemplate
                title="Delivery Challan Details"
                description={
                    <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-3">
                            <div className="flex items-center">
                                <StandardLabel className="mr-2">PO:</StandardLabel>
                                <Link
                                    href={`/po/${h.po_number}`}
                                    className="text-sm font-bold text-action-primary hover:text-action-primary-hover transition-colors"
                                >
                                    #{h.po_number}
                                </Link>
                            </div>
                        </div>
                    </div>
                }
                icon={<Truck size={24} />}
                onBack={() => router.push("/dc")}
                actions={
                    <div className="flex gap-3">
                        <Button
                            variant="success"
                            size="md"
                            onClick={handleDownload}
                            disabled={isDownloading}
                        >
                            <FileDown size={16} className="mr-2" />
                            {isDownloading ? "Saving..." : "Download DC"}
                        </Button>

                        <Button
                            variant="success"
                            size="md"
                            onClick={async () => {
                                try {
                                    const result = await import("@/lib/api").then(m => m.downloadFile(`/api/dc/${h.dc_number}/download-gc`, `GC_${h.dc_number}.xlsx`));
                                    if (result.success) toast("Success", "GC Downloaded", "success");
                                    else toast("Error", "Download failed", "error");
                                } catch (e) { toast("Error", "Download failed", "error"); }
                            }}
                        >
                            <FileDown size={16} className="mr-2" />
                            Download GC
                        </Button>

                        <Button
                            variant="primary"
                            onClick={() => hasInvoice
                                ? router.push(`/invoice/${encodeURIComponent(invoiceNumber!)}`)
                                : router.push(`/invoice/create?dc=${h.dc_number}`)
                            }
                            className="shadow-sm"
                        >
                            <PlusCircle size={18} className="mr-2" />
                            {hasInvoice ? "View Invoice" : "Generate Invoice"}
                        </Button>

                        <Button
                            variant="destructive"
                            onClick={() => setShowDeleteModal(true)}
                        >
                            <Trash2 size={16} className="mr-2" />
                            Delete
                        </Button>
                    </div>
                }
            >
                <div className="space-y-6">
                    <DeviationsSection poNumber={h.po_number} />
                    <DCHeaderInfo
                        header={h}
                        poData={initialData?.header} // Using initialData as poData fallback
                        totalDCValue={totalDCValue}
                    />

                    <DCTable
                        items={items}
                        expandedItems={expandedItems}
                        onToggleItem={toggleItem}
                    />
                </div>
            </DocumentTemplate >
            <ActionConfirmationModal
                isOpen={showDeleteModal}
                onClose={() => setShowDeleteModal(false)}
                onConfirm={handleDelete}
                title="Delete Delivery Challan?"
                warningText={`Are you sure you want to delete DC #${h.dc_number}? This action cannot be undone.`}
                confirmLabel="Delete Challan"
                variant="danger"
                isLoading={isDeleting}
            />
        </>
    );
}

// ... MetadataItem updated

