"use client";
import { Accounting, Body, Button, Flex, SmallText, ListPageTemplate, SearchBar, StatusBadge, StandardLabel, StandardValue, type Column, type SummaryCardProps, FileUploadModal, Input } from "@/components/common";

import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { POListItem, POStats, PaginatedResponse } from "@/lib/api";
import {
    FileText,
    Clock,
    Plus,
    IndianRupee,
    Upload,
    Package,
    ShoppingCart,
    Monitor,
    CheckCircle2,
    AlertCircle,
    Truck
} from "lucide-react";
import { formatDate, formatIndianCurrency, cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { useTableState } from "@/hooks/useTableState";

// Column definitions outside component to prevent recreation
const columns: Column<POListItem>[] = [
    {
        key: "po_number",
        label: "REFERENCE",
        sortable: true,
        width: "140px",
        align: "left",
        render: (_value, po) => (
            <Link href={`/po/${po.po_number}`} className="block group">
                <Flex align="center" gap={3} className="py-1">
                    <div className="text-text-tertiary text-xs opacity-50">
                        <FileText size={14} />
                    </div>
                    <div className="text-text-primary text-sm tracking-tight font-normal">
                        {po.po_number}
                    </div>
                </Flex>
            </Link>
        ),
    },
    {
        key: "po_date",
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
        key: "total_items_count",
        label: "ITEMS",
        sortable: true,
        width: "60px",
        align: "center",
        render: (v) => (
            <span className="text-sm text-text-tertiary font-normal">{v || 1}</span>
        )
    },
    {
        key: "total_ord_qty",
        label: "ORDERED",
        sortable: true,
        width: "90px",
        align: "right",
        isNumeric: true,
        render: (v) => (
            <Accounting className="text-action-primary text-sm">{v}</Accounting>
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
            <Accounting className="text-status-warning text-sm">{v}</Accounting>
        ),
    },
    {
        key: "total_rcd_qty",
        label: "RECEIVED",
        sortable: true,
        width: "90px",
        align: "right",
        isNumeric: true,
        render: (v) => (
            <Accounting className="text-status-success text-sm">{v}</Accounting>
        ),
    },
    {
        key: "total_rej_qty",
        label: "REJECTED",
        sortable: true,
        width: "90px",
        align: "right",
        isNumeric: true,
        render: (v) => (
            <span className={cn("font-mono text-sm font-normal", (Number(v) || 0) > 0 ? "text-status-error" : "text-text-tertiary/40")}>
                {String(Number(v) || 0)}
            </span>
        ),
    },
    {
        key: "po_value",
        label: "VALUE",
        sortable: true,
        width: "120px",
        align: "right",
        render: (_v, item) => (
            <div className="text-right">
                <Accounting isCurrency className="text-text-primary text-sm">{item.po_value || 0}</Accounting>
            </div>
        )
    },
    {
        key: "po_status",
        label: "STATUS",
        sortable: true,
        width: "100px",
        align: "center",
        render: (v) => (
            <div className="flex justify-center scale-90">
                <StatusBadge
                    status={String(v || "Pending").toLowerCase() as any}
                    className="text-sm uppercase tracking-[0.1em] font-normal"
                />
            </div>
        ),
    },
    {
        key: "actions" as any,
        label: " ",
        width: "10%",
        align: "right",
        render: (_: any, po: POListItem) => {
            const isFullyDispatched = (po.total_dsp_qty || 0) >= (po.total_ord_qty || 1);
            return (
                <Flex justify="end" gap={2}>
                    <Link
                        href={isFullyDispatched ? "#" : `/dc/create?po=${encodeURIComponent(po.po_number)}`}
                        className={cn(
                            "p-1.5 rounded-lg border shadow-sm transition-all flex items-center gap-1",
                            isFullyDispatched
                                ? "bg-surface-secondary border-border-default text-text-quaternary cursor-not-allowed"
                                : "bg-surface-primary border-border-default text-action-primary hover:bg-surface-secondary hover:border-action-primary/30"
                        )}
                        onClick={(e) => isFullyDispatched && e.preventDefault()}
                        title={isFullyDispatched ? "Fully Dispatched" : "Create Delivery Challan"}
                    >
                        <Plus size={12} />
                        <span className="text-xs">DC</span>
                    </Link>
                </Flex>
            );
        },
    },
];

interface POListClientProps {
    initialPOs: PaginatedResponse<POListItem>;
    initialStats: POStats;
}

export function POListClient({ initialPOs, initialStats }: POListClientProps) {
    const router = useRouter();
    const table = useTableState({
        defaultLimit: 10,
        defaultSortBy: "po_date",
        defaultSortOrder: "desc"
    });

    const [data, setData] = useState<PaginatedResponse<POListItem>>(initialPOs);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const isFirstLoad = useRef(true);

    const queryParams = useMemo(() => ({
        limit: table.limit,
        offset: table.offset,
        sort_by: table.sortBy,
        order: table.sortOrder,
        search: table.search
    }), [table.limit, table.offset, table.sortBy, table.sortOrder, table.search]);

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
                const result = await api.listPOs({
                    ...queryParams,
                    signal: controller.signal
                });
                setData(result);
                setError(null);
            } catch (err: any) {
                if (err.name === 'AbortError') return;
                console.error("Failed to fetch POs:", err);
                setError("Failed to load purchase orders. Please try again.");
            } finally {
                setLoading(false);
            }
        };

        fetchData();
        return () => controller.abort();
    }, [queryParams, table.isInitialLoading]);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            setSelectedFiles(Array.from(e.target.files));
            setIsUploadModalOpen(true);
        }
        e.target.value = "";
    };

    const handleSingleUpload = async (file: File) => {
        const response = await api.syncPO(file);
        return {
            filename: file.name,
            success: true,
            ...response
        };
    };

    const handleModalClose = () => {
        setIsUploadModalOpen(false);
        setSelectedFiles([]);
        router.refresh();
    };

    const summaryCards = useMemo(
        (): SummaryCardProps[] => [
            {
                title: "Active Orders",
                value: data.metadata.total_count,
                icon: <Package size={18} />,
                variant: "primary",
            },
            {
                title: "Total Committed",
                value: formatIndianCurrency(initialStats?.total_value_ytd || 0),
                icon: <IndianRupee size={18} />,
                variant: "success",
            },
            {
                title: "Total Shipped",
                value: Math.round(initialStats?.total_shipped_qty || 0),
                icon: <Truck size={18} />,
                variant: "warning",
            },
            {
                title: "Total Rejected",
                value: Math.round(initialStats?.total_rejected_qty || 0),
                icon: <AlertCircle size={18} />,
                variant: "error",
            },
        ],
        [data.metadata.total_count, initialStats]
    );

    const toolbar = useMemo(() => (
        <Flex align="center" justify="between" className="w-full mb-6" gap={4}>
            <SearchBar
                value={table.search}
                onChange={table.setSearch}
                placeholder="Search orders, items, or status..."
                className="w-full max-w-sm"
            />
            <Flex align="center" gap={3}>

                <Button
                    variant="info"
                    onClick={() => fileInputRef.current?.click()}
                >
                    <Upload size={16} />
                    Upload PO
                </Button>

                <Button
                    variant="primary"
                    onClick={() => router.push("/po/create")}
                    className="shadow-md hover:shadow-lg transition-all"
                >
                    <Plus size={16} />
                    New Order
                </Button>
            </Flex>
        </Flex>
    ), [table.search, table.setSearch, router]);


    return (
        <>
            <ListPageTemplate
                title="Purchase Orders"
                subtitle="Manage procurement contracts and track materials."
                icon={<ShoppingCart size={22} />}
                iconLayoutId="po-icon"
                toolbar={toolbar}
                summaryCards={summaryCards}
                columns={columns}
                data={data.items}
                keyField="po_number"
                page={table.page}
                pageSize={table.limit}
                totalItems={data.metadata.total_count}
                onPageChange={table.setPage}
                onPageSizeChange={table.setLimit}
                sortKey={table.sortBy}
                sortDirection={table.sortOrder}
                onSort={table.setSort}
                loading={loading || table.isTransitioning}
                error={error || undefined}
                emptyMessage="No purchase orders found"
                density="compact"
                className="h-full"
            />
            <Input
                type="file"
                multiple
                accept=".html"
                ref={fileInputRef}
                className="hidden"
                onChange={handleFileSelect}
            />
            <FileUploadModal
                isOpen={isUploadModalOpen}
                onClose={handleModalClose}
                files={selectedFiles}
                onUpload={handleSingleUpload}
                title="Upload Purchase Orders"
            />
        </>
    );
}