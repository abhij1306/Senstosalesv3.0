"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import {
    FileDown,
    Receipt,
    Trash2
} from "lucide-react";
import { DocumentTemplate, Button, Badge, ActionConfirmationModal, useToast, StandardValue, StandardLabel, DeviationsSection } from "@/components/common";
import { api, API_BASE_URL, downloadFile } from "@/lib/api";
import { InvoiceSheet } from "./InvoiceSheet";
import { useInvoiceStore } from "@/store/invoiceStore";
import { InvoiceDetail } from "@/types";

interface InvoiceDetailClientProps {
    data: InvoiceDetail;
}

export function InvoiceDetailClient({ data: initialData }: InvoiceDetailClientProps) {
    const router = useRouter();
    const { data, setInvoice } = useInvoiceStore();
    const { toast } = useToast();
    const [settings, setSettings] = React.useState<any>(null);
    const [showDeleteModal, setShowDeleteModal] = React.useState(false);
    const [isDeleting, setIsDeleting] = React.useState(false);
    const [isDownloading, setIsDownloading] = React.useState(false);

    const handleDownload = async () => {
        setIsDownloading(true);
        try {
            const result = await downloadFile(`/api/invoice/${h.invoice_number}/download`, `Invoice_${h.invoice_number}.xlsx`);
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
        if (initialData) setInvoice(initialData);
        api.getSettings().then(setSettings).catch(() => { });
    }, [initialData, setInvoice]);

    if (!data?.header) return null;

    const h = data.header;

    const handleDelete = async () => {
        setIsDeleting(true);
        try {
            await api.deleteInvoice(h.invoice_number);
            toast("Invoice deleted", `Invoice ${h.invoice_number} has been deleted successfully.`, "success");
            router.push("/invoice");
            router.refresh();
        } catch (error: any) {
            toast("Delete failed", error.message || "Failed to delete invoice", "error");
            setShowDeleteModal(false);
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <>
            <DocumentTemplate
                title="Tax Invoice"
                description={null}
                icon={<Receipt size={24} />}
                onBack={() => router.push("/invoice")}
                actions={
                    <div className="flex gap-3">
                        <Button
                            variant="success"
                            size="md"
                            onClick={handleDownload}
                            disabled={isDownloading}
                        >
                            <FileDown size={16} className="mr-2" />
                            {isDownloading ? "Saving..." : "Download Invoice"}
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
                <div className="max-w-[1600px] mx-auto py-8">
                    <DeviationsSection poNumber={h.po_numbers} />
                    <InvoiceSheet
                        header={h}
                        items={data.items || []}
                        companySettings={settings}
                    />
                </div>
            </DocumentTemplate>
            <ActionConfirmationModal
                isOpen={showDeleteModal}
                onClose={() => setShowDeleteModal(false)}
                onConfirm={handleDelete}
                title="Delete Invoice?"
                warningText={`Are you sure you want to delete Invoice #${h.invoice_number}? This action cannot be undone.`}
                confirmLabel="Delete Invoice"
                variant="danger"
                isLoading={isDeleting}
            />
        </>
    );
}
