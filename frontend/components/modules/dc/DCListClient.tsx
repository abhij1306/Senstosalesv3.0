"use client";
import { Accounting, Body, Box, Button, Flex, ListPageTemplate, SearchBar, SmallText, StandardLabel, StandardValue, type Column, type SummaryCardProps, ActionConfirmationModal, useToast, Mini, Tiny } from "@/components/common";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Activity, FileStack, PackageCheck, Ship, Truck, FileDown, FileText, Trash2, Boxes, PlusSquare } from "lucide-react";
import { api, API_BASE_URL, DCListItem, DCStats, downloadFile, PaginatedResponse } from "@/lib/api";
import { formatDate, formatIndianCurrency, cn } from "@/lib/utils";
import { useTableState } from "@/hooks/useTableState";

interface DCListClientProps {
    initialDCs: PaginatedResponse<DCListItem>;
    initialStats: DCStats | null;
}

export function DCListClient({ initialDCs, initialStats }: DCListClientProps) {
    const router = useRouter();
    const table = useTableState({
        defaultLimit: 10,
        defaultSortBy: "dc_date",
        defaultSortOrder: "desc"
    });

    const [data, setData] = useState<PaginatedResponse<DCListItem>>(initialDCs);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isExporting, setIsExporting] = useState(false);
    const [selectedRows, setSelectedRows] = useState<string[]>([]);

    // Delete state
    const [deleteItem, setDeleteItem] = useState<DCListItem | null>(null);
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
                const result = await api.listDCs({
                    ...queryParams,
                    signal: controller.signal
                });
                setData(result);
                setError(null);
            } catch (err: any) {
                if (err.name === 'AbortError') return;
                console.error("Failed to fetch DCs:", err);
                setError("Failed to load delivery challans. Please try again.");
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
            await api.deleteDC(deleteItem.dc_number);
            toast("Challan deleted", `DC ${deleteItem.dc_number} has been deleted successfully.`, "success");
            setDeleteItem(null);
            router.refresh();
        } catch (error: any) {
            toast("Delete failed", error.message || "Failed to delete challan", "error");
        } finally {
            setIsDeleting(false);
        }
    };

    const handleDownload = async (dcNumber: string) => {
        try {
            toast("Downloading...", "Starting download...", "info");
            const result = await downloadFile(`/api/dc/${dcNumber}/download`, `DC_${dcNumber}.xlsx`);
            if (result.success && result.message) {
                toast("Download Complete", result.message, "success");
            } else if (!result.success) {
                toast("Download Failed", result.message || "Unknown error", "error");
            }
        } catch (e: any) {
            toast("Error", e.message, "error");
        }
    };

    const columns = useMemo((): Column<DCListItem>[] => [
        {
            key: "dc_number",
            label: "CHALLAN #",
            sortable: true,
            width: "140px",
            align: "left",
            render: (_value, dc) => (
                <Link href={`/dc/${encodeURIComponent(dc.dc_number)}`} className="block group">
                    <Flex align="center" gap={3} className="py-1">
                        <div className="text-text-tertiary opacity-50">
                            <FileText size={14} />
                        </div>
                        <div className="text-text-primary text-sm tracking-tight font-normal">
                            {dc.dc_number}
                        </div>
                    </Flex>
                </Link>
            ),
        },
        {
            key: "dc_date",
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
            key: "po_number",
            label: "LINKED PO",
            sortable: true,
            width: "120px",
            align: "right",
            render: (v) => (
                v ? (
                    <Link href={`/po/${v}`} className="text-action-primary hover:underline font-normal text-sm">
                        {String(v)}
                    </Link>
                ) : (
                    <span className="text-text-quaternary font-normal text-sm">--</span>
                )
            ),
        },
        {
            key: "total_ord_qty",
            label: "ORDERED",
            align: "right",
            sortable: true,
            width: "90px",
            isNumeric: true,
            render: (v) => (
                <Accounting className="font-normal text-action-primary text-sm">{v}</Accounting>
            ),
        },
        {
            key: "total_dsp_qty",
            label: "DISPATCHED",
            align: "right",
            sortable: true,
            width: "100px",
            isNumeric: true,
            render: (v) => (
                <Accounting className="font-normal text-status-warning text-sm">{v}</Accounting>
            ),
        },
        {
            key: "total_rcd_qty",
            label: "RECEIVED",
            align: "right",
            sortable: true,
            width: "90px",
            isNumeric: true,
            render: (v) => (
                <Accounting className="font-normal text-status-success text-sm">{v}</Accounting>
            ),
        },
        {
            key: "total_value",
            label: "VALUE",
            align: "right",
            sortable: true,
            width: "120px",
            isNumeric: true,
            render: (v) => (
                <div className="pr-2 text-right">
                    <Accounting isCurrency className="text-text-primary text-sm">{Number(v)}</Accounting>
                </div>
            ),
        },
        {
            key: "actions" as any,
            label: " ",
            width: "150px",
            align: "right",
            render: (_: any, dc: DCListItem) => (
                <div className="flex justify-end pr-2">
                    <div className="grid grid-cols-3 gap-2 w-[124px]">
                        {/* Slot 1: Always Download */}
                        <div className="flex justify-center">
                            <Button
                                onClick={() => handleDownload(dc.dc_number)}
                                className="p-2 rounded-xl bg-surface-primary border border-border-default shadow-sm text-text-tertiary hover:text-action-primary hover:border-action-primary/30 transition-all h-9 w-9 bg-transparent"
                                title="Download Challan"
                            >
                                <FileDown size={14} />
                            </Button>
                        </div>

                        {/* Slot 2: Delete (Conditional) */}
                        <div className="flex justify-center">
                            {!dc.invoice_number && (
                                <Button
                                    onClick={() => setDeleteItem(dc)}
                                    disabled={Number(dc.total_rcd_qty) > 0}
                                    className={cn(
                                        "p-2 h-9 w-9 rounded-xl border shadow-sm transition-all bg-transparent",
                                        "bg-surface-primary border-border-default text-text-tertiary hover:text-status-error hover:border-status-error/30 hover:bg-status-error-container/20 disabled:opacity-30 disabled:cursor-not-allowed"
                                    )}
                                    title="Delete Challan"
                                >
                                    <Trash2 size={14} />
                                </Button>
                            )}
                        </div>

                        {/* Slot 3: Generate (Conditional) */}
                        <div className="flex justify-center">
                            {!dc.invoice_number && (
                                <Link
                                    href={`/invoice/create?dc=${encodeURIComponent(dc.dc_number)}`}
                                    className="p-2 h-9 w-9 rounded-xl bg-surface-primary border border-border-default shadow-sm text-action-primary hover:bg-surface-secondary hover:border-action-primary/30 transition-all flex items-center justify-center"
                                    title="Generate Invoice"
                                >
                                    <PlusSquare size={16} />
                                </Link>
                            )}
                        </div>
                    </div>
                </div>
            ),
        },
    ], []);



    const handleExportExcel = useCallback(async () => {
        setIsExporting(true);
        try {
            api.exportListDCs();
        } catch (e) {
            console.error(e);
        } finally {
            setIsExporting(false);
        }
    }, []);

    const summaryCards = useMemo(
        (): SummaryCardProps[] => [
            {
                title: "Active Shipments",
                value: data.metadata.total_count,
                icon: <Ship size={18} />,
                variant: "primary",
            },
            {
                title: "Awaiting Receipt",
                value: Math.round(initialStats?.pending_delivery || 0),
                icon: <Activity size={18} />,
                variant: "warning",
            },
            {
                title: "Contract Capacity",
                value: formatIndianCurrency(initialStats?.total_value || 0),
                icon: <FileStack size={18} />,
                variant: "error",
            },
            {
                title: "Fully Dispatched",
                value: Math.round(initialStats?.completed_delivery || 0),
                icon: <PackageCheck size={18} />,
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
                placeholder="Search DCs, Suppliers or PO Ref..."
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
                    {selectedRows.length > 0 ? `Download DCs (${selectedRows.length})` : "Download DC"}
                </Button>

                <Button
                    variant="primary"
                    onClick={() => router.push("/dc/create")}
                    className="shadow-md hover:shadow-lg transition-all"
                >
                    <Plus size={16} />
                    Create Challan
                </Button>
            </Flex>
        </Flex>
    ), [table.search, table.setSearch, router, handleExportExcel, isExporting, selectedRows.length]);

    return (
        <>
            <ListPageTemplate
                title="Delivery Challans"
                subtitle="Manage and track all delivery documentation"
                icon={<Truck size={22} />}
                iconLayoutId="dc-icon"
                toolbar={toolbar}
                summaryCards={summaryCards}
                columns={columns}
                data={data.items}
                keyField="dc_number"
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
                emptyMessage="No delivery challans found"
                density="compact"
                className="h-full"
            />
            <ActionConfirmationModal
                isOpen={!!deleteItem}
                onClose={() => setDeleteItem(null)}
                onConfirm={handleDelete}
                title="Delete Delivery Challan?"
                warningText={`Are you sure you want to delete DC #${deleteItem?.dc_number}? This action cannot be undone.`}
                confirmLabel="Delete Challan"
                variant="danger"
                isLoading={isDeleting}
            />
        </>
    );
}