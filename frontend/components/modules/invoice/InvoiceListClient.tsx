"use client";
import { Accounting, Body, Box, Button, Flex, ListPageTemplate, SearchBar, SmallText, StandardLabel, StandardValue, Caption1, type Column, type SummaryCardProps, ActionConfirmationModal, useToast, Mini, Tiny } from "@/components/common";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
    Receipt,
    Plus,
    TrendingUp,
    Clock,
    Activity,
    CheckCircle,
    Boxes,
    FileCheck,
    FileDown,
    IndianRupee,
    AlertTriangle,
    Trash2,
    FileText
} from "lucide-react";
import { api, API_BASE_URL, InvoiceListItem, InvoiceStats, downloadFile, PaginatedResponse } from "@/lib/api";
import { formatDate, formatIndianCurrency, cn } from "@/lib/utils";
import { useTableState } from "@/hooks/useTableState";

interface InvoiceListClientProps {
    initialInvoices: PaginatedResponse<InvoiceListItem>;
    initialStats: InvoiceStats | null;
}

export function InvoiceListClient({ initialInvoices, initialStats }: InvoiceListClientProps) {
    const router = useRouter();
    const table = useTableState({
        defaultLimit: 10,
        defaultSortBy: "invoice_date",
        defaultSortOrder: "desc"
    });

    const [data, setData] = useState<PaginatedResponse<InvoiceListItem>>(initialInvoices);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isExporting, setIsExporting] = useState(false);
    const [selectedRows, setSelectedRows] = useState<string[]>([]);

    // Delete state
    const [deleteItem, setDeleteItem] = useState<InvoiceListItem | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const { toast } = useToast();

    const queryParams = useMemo(() => ({
        limit: table.limit,
        offset: table.offset,
        sort_by: table.sortBy,
        order: table.sortOrder,
        search: table.search
    }), [table.limit, table.offset, table.sortBy, table.sortOrder, table.search]);

    const isFirstLoad = useRef(true);

    // Fetch data whenever table state changes
    useEffect(() => {
        // Skip first fetch since we have initialPOs (Wait for initialLoading to resolve first)
        if (table.isInitialLoading) return;

        if (isFirstLoad.current) {
            isFirstLoad.current = false;
            return;
        }

        const controller = new AbortController();
        const fetchData = async () => {
            try {
                setLoading(true);
                const result = await api.listInvoices({
                    ...queryParams,
                    signal: controller.signal
                });
                setData(result);
                setError(null);
            } catch (err: any) {
                if (err.name === 'AbortError') return;
                console.error("Failed to fetch Invoices:", err);
                setError("Failed to load invoices. Please try again.");
            } finally {
                setLoading(false);
            }
        };

        fetchData();
        return () => controller.abort();
    }, [queryParams, table.isInitialLoading]);

    const handleDelete = async () => {
        if (!deleteItem) return;
        setIsDeleting(true);
        try {
            await api.deleteInvoice(deleteItem.invoice_number);

            // OPTIMISTIC UPDATE: Remove from local state immediately
            setData(prev => ({
                ...prev,
                items: prev.items.filter(item => item.invoice_number !== deleteItem.invoice_number),
                metadata: {
                    ...prev.metadata,
                    total_count: prev.metadata.total_count - 1
                }
            }));

            toast("Invoice deleted", `Invoice ${deleteItem.invoice_number} has been deleted successfully.`, "success");
            setDeleteItem(null);
        } catch (error: any) {
            toast("Delete failed", error.message || "Failed to delete invoice", "error");
        } finally {
            setIsDeleting(false);
        }
    };

    const handleDownload = async (invoiceNumber: string) => {
        try {
            toast("Downloading...", "Starting download...", "info");
            const result = await downloadFile(`/api/invoice/${invoiceNumber}/download`, `Invoice_${invoiceNumber}.xlsx`);
            if (result.success && result.message) {
                toast("Download Complete", result.message, "success");
            } else if (!result.success) {
                toast("Download Failed", result.message || "Unknown error", "error");
            }
        } catch (e: any) {
            toast("Error", e.message, "error");
        }
    };

    const columns = useMemo((): Column<InvoiceListItem>[] => [
        {
            key: "invoice_number",
            label: "INVOICE #",
            sortable: true,
            width: "140px",
            align: "left",
            render: (_value, inv) => (
                <Link href={`/invoice/${encodeURIComponent(inv.invoice_number)}`} className="block group">
                    <Flex align="center" gap={3} className="py-1">
                        <div className="text-text-tertiary opacity-50">
                            <FileText size={14} />
                        </div>
                        <div className="text-text-primary text-sm tracking-tight font-normal">
                            {inv.invoice_number}
                        </div>
                    </Flex>
                </Link>
            ),
        },
        {
            key: "invoice_date",
            label: "DATE",
            sortable: true,
            width: "100px",
            render: (v) => (
                <span className="font-mono text-sm text-text-tertiary whitespace-nowrap tracking-tight font-normal">
                    {formatDate(String(v))}
                </span>
            ),
        },
        {
            key: "dc_number",
            label: "LINKED DCS",
            width: "130px",
            render: (v) => (
                <Flex wrap gap={1}>
                    {String(v) && String(v) !== "null" && String(v) !== "undefined" ? (
                        String(v)
                            .split(",")
                            .map((dc: string, i: number) => (
                                <Link
                                    key={i}
                                    href={`/dc/${dc.trim()}`}
                                    className="text-action-primary hover:underline font-normal text-sm"
                                >
                                    {dc.trim()}
                                </Link>
                            ))
                    ) : (
                        <span className="text-text-quaternary text-sm font-normal">Direct</span>
                    )}
                </Flex>
            ),
        },
        {
            key: "po_numbers",
            label: "LINKED POs",
            width: "130px",
            render: (v) => (
                <Flex wrap gap={1}>
                    {String(v) && String(v) !== "null" ? (
                        String(v)
                            .split(",")
                            .map((po: string, i: number) => (
                                <Link
                                    key={i}
                                    href={`/po/${po.trim()}`}
                                    className="text-action-primary hover:underline font-normal text-sm"
                                >
                                    {po.trim()}
                                </Link>
                            ))
                    ) : (
                        <span className="text-text-quaternary text-sm font-normal">Direct</span>
                    )}
                </Flex>
            ),
        },
        {
            key: "total_items",
            label: "ITEMS",
            width: "60px",
            align: "center",
            render: (v) => (
                <span className="text-sm text-text-tertiary transition-colors font-normal">
                    {v || 0}
                </span>
            ),
        },
        {
            key: "total_dsp_qty",
            label: "DISPATCHED",
            sortable: true,
            width: "100px",
            align: "right",
            isNumeric: true,
            render: (v) => (
                <Accounting className="text-status-warning text-sm pr-2">{v || 0}</Accounting>
            ),
        },
        {
            key: "total_invoice_value",
            label: "VALUE",
            sortable: true,
            align: "right",
            width: "120px",
            render: (v) => (
                <div className="pr-2 text-right">
                    <Accounting isCurrency className="text-text-primary text-sm">{Number(v)}</Accounting>
                </div>
            ),
        },
        {
            key: "actions" as any,
            label: " ",
            width: "120px",
            align: "right",
            render: (_: any, inv: InvoiceListItem) => (
                <Flex justify="end" gap={2} className="pr-2">
                    <Button
                        onClick={() => handleDownload(inv.invoice_number)}
                        className="p-2 rounded-xl bg-surface-primary border border-border-default shadow-sm text-text-tertiary hover:text-action-primary hover:border-action-primary/30 transition-all h-9 w-9 bg-transparent"
                        title="Download Invoice"
                    >
                        <FileDown size={14} />
                    </Button>
                    <Button
                        onClick={() => setDeleteItem(inv)}
                        disabled={Number(inv.total_rcd_qty) > 0}
                        className={cn(
                            "p-2 rounded-xl border shadow-sm transition-all h-9 w-9 bg-transparent",
                            "bg-surface-primary border-border-default text-text-tertiary hover:text-status-error hover:border-status-error/30 hover:bg-status-error-container/20 disabled:opacity-30 disabled:cursor-not-allowed"
                        )}
                        title="Delete Invoice"
                    >
                        <Trash2 size={14} />
                    </Button>
                </Flex>
            ),
        },
    ], []);


    const handleExportExcel = useCallback(async () => {
        setIsExporting(true);
        try {
            api.exportListInvoices();
        } catch (e) {
            console.error(e);
        } finally {
            setIsExporting(false);
        }
    }, []);

    const summaryCards = useMemo(
        (): SummaryCardProps[] => [
            {
                title: "Total Invoices",
                value: data.metadata.total_count,
                icon: <Boxes size={18} />,
                variant: "primary",
            },
            {
                title: "Outstanding",
                value: formatIndianCurrency(initialStats?.pending_payments || 0),
                icon: <Clock size={18} />,
                variant: "warning",
            },
            {
                title: "Tax Liability (GST)",
                value: formatIndianCurrency((initialStats?.total_invoiced || 0) * 0.18),
                icon: <Activity size={18} />,
                variant: "error",
            },
            {
                title: "Revenue Confirmed",
                value: formatIndianCurrency(initialStats?.total_invoiced || 0),
                icon: <IndianRupee size={18} />,
                variant: "success",
            },
        ],
        [data.metadata.total_count, initialStats]
    );

    const toolbar = useMemo(() => (
        <Flex align="center" justify="between" className="w-full mb-6" gap={4}>
            <SearchBar
                value={table.search}
                onChange={table.setSearch}
                placeholder="Search invoices or GSTIN..."
                className="w-full max-w-sm"
            />

            <Flex align="center" gap={3}>
                <Button
                    variant="success"
                    size="md"
                    onClick={handleExportExcel}
                    disabled={isExporting}
                >
                    <FileDown size={16} />
                    {selectedRows.length > 0 ? `Download Invoices (${selectedRows.length})` : "Download Invoice"}
                </Button>

                <Button
                    variant="primary"
                    onClick={() => router.push("/invoice/create")}
                    className="shadow-md hover:shadow-lg transition-all"
                >
                    <Plus size={16} />
                    Create Invoice
                </Button>
            </Flex>
        </Flex>
    ), [table.search, table.setSearch, router, handleExportExcel, isExporting, selectedRows.length]);

    return (
        <>
            <ListPageTemplate
                title="GST Invoices"
                subtitle="Manage billing documentation and tax compliance."
                icon={<Receipt size={22} />}
                iconLayoutId="invoice-icon"
                toolbar={toolbar}
                summaryCards={summaryCards}
                columns={columns}
                data={data.items}
                keyField="invoice_number"
                page={table.page}
                pageSize={table.limit}
                totalItems={data.metadata.total_count}
                onPageChange={table.setPage}
                onPageSizeChange={table.setLimit}
                sortKey={table.sortBy}
                sortDirection={table.sortOrder}
                onSort={table.setSort}
                selectable={true}
                selectedRows={selectedRows}
                onSelectionChange={setSelectedRows}
                loading={loading || table.isTransitioning}
                error={error || undefined}
                emptyMessage="No invoices found"
                density="compact"
                className="h-full"
            />
            <ActionConfirmationModal
                isOpen={!!deleteItem}
                onClose={() => setDeleteItem(null)}
                onConfirm={handleDelete}
                title="Delete Invoice?"
                warningText={`Are you sure you want to delete Invoice #${deleteItem?.invoice_number}? This action cannot be undone.`}
                confirmLabel="Delete Invoice"
                variant="danger"
                isLoading={isDeleting}
            />
        </>
    );
}
