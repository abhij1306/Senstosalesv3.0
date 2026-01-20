"use client";
import { Accounting, Body, Box, Button, Flex, ListPageTemplate, SearchBar, useToast, SummaryCards, Badge, StatusBadge, StandardLabel, StandardValue, type Column, type SummaryCardProps, FileUploadModal, Input } from "@/components/common";
import { api, SRVListItem, SRVStats, PaginatedResponse } from "@/lib/api";
import { cn, formatDate } from "@/lib/utils";
import {
    AlertCircle,
    CheckCircle2,
    Clock,
    FileUp,
    FileDown,
    Package,
    TrendingUp,
    FileText,
    ChevronRight,
    Loader2
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useRef, useState, useEffect } from "react";
import { useTableState } from "@/hooks/useTableState";

interface SRVListClientProps {
    initialSRVs: PaginatedResponse<SRVListItem>;
    initialStats: SRVStats | null;
}

export function SRVListClient({ initialSRVs, initialStats }: SRVListClientProps) {
    const router = useRouter();
    const { toast } = useToast();
    const table = useTableState({
        defaultLimit: 10,
        defaultSortBy: "srv_date",
        defaultSortOrder: "desc"
    });

    const [data, setData] = useState<PaginatedResponse<SRVListItem>>(initialSRVs);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [refreshKey, setRefreshKey] = useState(0);

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

    // Fetch data whenever table state changes or refresh is triggered
    useEffect(() => {
        if (table.isInitialLoading) return;

        if (isFirstLoad.current) {
            isFirstLoad.current = false;
            return;
        }

        const controller = new AbortController();
        const fetchData = async () => {
            try {
                setLoading(true);
                const result = await api.listSRVs(undefined, {
                    ...queryParams,
                    signal: controller.signal
                });
                setData(result);
                setError(null);
            } catch (err: any) {
                if (err.name === 'AbortError') return;
                console.error("Failed to fetch SRVs:", err);
                setError("Failed to load SRVs. Please try again.");
            } finally {
                setLoading(false);
            }
        };

        fetchData();
        return () => controller.abort();
    }, [queryParams, table.isInitialLoading, refreshKey]);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            setSelectedFiles(Array.from(e.target.files));
            setIsUploadModalOpen(true);
        }
        e.target.value = "";
    };

    const handleSingleUpload = async (file: File) => {
        const response = await api.uploadSRVBatch([file]);
        const detail = response.results?.[0];
        const isSuccess = detail?.success === true;

        return {
            filename: file.name,
            success: isSuccess,
            message: detail?.message || (isSuccess ? "Uploaded successfully" : "Upload failed"),
            po_number: detail?.po_number,
        };
    };

    const onModalClose = () => {
        setIsUploadModalOpen(false);
        setSelectedFiles([]);
        setRefreshKey(prev => prev + 1);
        router.refresh();
    };

    const summaryCards: SummaryCardProps[] = useMemo(() => [
        {
            title: "Total SRVs",
            value: data.metadata.total_count,
            icon: <Package size={18} />,
            variant: "primary",
        },
        {
            title: "Total Rejected",
            value: initialStats?.total_rej_qty || 0,
            icon: <AlertCircle size={18} />,
            variant: "error",
        },
        {
            title: "Rejection Rate",
            value: `${initialStats?.rejection_rate || 0}%`,
            icon: <TrendingUp size={18} />,
            variant: "warning",
        },
        {
            title: "Match accuracy",
            value: initialStats?.total_srvs ? `${((initialStats.total_srvs - initialStats.missing_po_count) / initialStats.total_srvs * 100).toFixed(0)}%` : "0%",
            icon: <CheckCircle2 size={18} />,
            variant: "success",
        }
    ], [data.metadata.total_count, initialStats]);

    const columns: Column<SRVListItem>[] = [
        {
            key: "srv_number",
            label: "SRV ID",
            sortable: true,
            width: "140px",
            align: "left",
            render: (_value, srv) => (
                <Link href={`/srv/${encodeURIComponent(srv.srv_number)}`} className="block group">
                    <Flex align="center" gap={3} className="py-1">
                        <div className="text-text-tertiary opacity-50">
                            <FileText size={14} />
                        </div>
                        <div className="text-text-primary text-sm tracking-tight font-normal">
                            {srv.srv_number}
                        </div>
                    </Flex>
                </Link>
            ),
        },
        {
            key: "srv_date",
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
            label: "PURCHASE ORDER",
            sortable: true,
            width: "140px",
            render: (v) => (
                <Link href={`/po/${v}`} className="text-action-primary hover:underline font-normal text-sm">
                    {String(v)}
                </Link>
            )
        },
        {
            key: "total_rcd_qty",
            label: "RECEIVED",
            sortable: true,
            width: "90px",
            align: "right",
            isNumeric: true,
            render: (v) => (
                <Accounting className="font-normal text-status-success text-sm">{(v === null || v === undefined) ? "-" : Number(v)}</Accounting>
            )
        },
        {
            key: "total_accepted_qty",
            label: "ACCEPTED",
            sortable: true,
            width: "90px",
            align: "right",
            isNumeric: true,
            render: (v) => (
                <Accounting className="font-normal text-action-primary text-sm">{(v === null || v === undefined) ? "-" : Number(v)}</Accounting>
            )
        },
        {
            key: "total_rej_qty",
            label: "REJECTED",
            sortable: true,
            width: "90px",
            align: "right",
            isNumeric: true,
            render: (v) => (
                <div className="flex justify-end pr-2">
                    <span className={cn("font-mono font-normal text-sm", ((v !== null && v !== undefined) && Number(v) > 0) ? "text-status-error" : "text-text-tertiary/40")}>
                        {(v === null || v === undefined) ? "-" : String(Number(v))}
                    </span>
                </div>
            )
        },
        {
            key: "actions" as any,
            label: " ",
            width: "80px",
            align: "right",
            render: (_: any, srv: SRVListItem) => (
                <Flex justify="end">
                    <Link href={`/srv/${encodeURIComponent(srv.srv_number)}`} className="p-2 rounded-xl bg-surface-primary border border-border-default shadow-sm text-text-tertiary hover:text-action-primary hover:border-action-primary/30 transition-all">
                        <ChevronRight size={14} />
                    </Link>
                </Flex>
            ),
        },
    ];

    const toolbar = useMemo(() => (
        <Flex align="center" justify="between" className="w-full mb-6" gap={4}>
            <SearchBar
                value={table.search}
                onChange={table.setSearch}
                placeholder="Search by PO or SRV..."
                className="w-full max-w-sm"
            />
            <Flex align="center" gap={3}>
                <Input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    multiple
                    accept=".html"
                    onChange={handleFileSelect}
                />
                <Button
                    variant="info"
                    onClick={() => fileInputRef.current?.click()}
                >
                    <FileUp size={16} />
                    Upload SRV
                </Button>
                <Button
                    variant="success"
                    size="md"
                    className="shadow-lg shadow-status-success/20"
                >
                    <FileDown size={16} />
                    Download SRV
                </Button>
            </Flex>
        </Flex>
    ), [table.search, table.setSearch]);

    return (
        <>
            <ListPageTemplate
                title="Store Receipt Vouchers"
                subtitle="Track material receipts and inspection reports."
                icon={<Package size={22} />}
                iconLayoutId="srv-icon"
                summaryCards={summaryCards}
                toolbar={toolbar}
                columns={columns}
                data={data.items}
                keyField="srv_number"
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
                emptyMessage="No SRV records found."
                density="compact"
                className="h-full"
            />
            <FileUploadModal
                isOpen={isUploadModalOpen}
                onClose={onModalClose}
                files={selectedFiles}
                onUpload={handleSingleUpload}
                title="Import SRV Data"
            />
        </>
    );
}
