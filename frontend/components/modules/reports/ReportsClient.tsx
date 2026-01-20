"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
    Truck,
    Receipt,
    TrendingUp,
    Calendar,
    AlertTriangle,
    Activity,
    BarChart3,
    FileDown,
    CheckCircle2,
    XCircle
} from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";

import {
    Accounting,
    Body,
    type Column,
    Flex,
    Box,
    DataTable,
    Card,
    StandardValue,
    SummaryCards,
    DocumentTemplate,
    Button,
    useToast,
    Tabs,
    TabsList,
    TabsTrigger,
    SearchBar,
    Input
} from "@/components/common";


import { api, PaginatedResponse } from "@/lib/api";
import { formatDate, formatIndianCurrency, cn } from "@/lib/utils";
import { useTableState } from "@/hooks/useTableState";



// Helper for Date Input (Gold Standard)
const DateInput = ({ value, onChange, className, icon: Icon }: any) => {
    const inputRef = useRef<HTMLInputElement>(null);

    // Format YYYY-MM-DD to DD - MM - YYYY
    const displayValue = useMemo(() => {
        if (!value) return "";
        try {
            const [y, m, d] = value.split("-");
            return `${d} - ${m} - ${y}`;
        } catch { return value; }
    }, [value]);

    const handleClick = () => {
        try {
            inputRef.current?.showPicker();
        } catch (error) {
            console.error(error);
        }
    };

    return (
        <div
            className={cn("relative h-9 flex items-center gap-2 px-3 min-w-[130px] group cursor-pointer hover:bg-surface-secondary/40 transition-all duration-300 rounded-xl border border-border-default/20", className)}
            onClick={handleClick}
        >
            {Icon && <Icon size={14} className="text-action-primary opacity-60 group-hover:opacity-100 transition-opacity pointer-events-none" />}
            <span className="text-xs font-semibold uppercase tracking-wider text-text-tertiary tabular-nums pointer-events-none">
                {displayValue}
            </span>
            <Input
                ref={inputRef}
                type="date"
                value={value}
                onChange={onChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
            />
        </div>
    );
};

type ReportType = "pending" | "reconciliation";

interface ReportsClientProps {
    initialData?: PaginatedResponse<any> | null;
}

export function ReportsClient({ initialData }: ReportsClientProps) {
    const { success, error } = useToast();
    const [activeTab, setActiveTab] = useState<ReportType>("pending");

    const table = useTableState({
        defaultLimit: 10,
        defaultSortBy: activeTab === "pending" ? "description" : "po_number",
        defaultSortOrder: "desc"
    });

    const [data, setData] = useState<PaginatedResponse<any>>(initialData || {
        items: [],
        metadata: { total_count: 0, page: 1, limit: 10 }
    });
    const [loading, setLoading] = useState(false);
    const [selectedItems, setSelectedItems] = useState<string[]>([]);

    // Date Management
    const [startDate, setStartDate] = useState<string>(() => {
        const d = new Date();
        d.setDate(d.getDate() - 30);
        return d.toISOString().split("T")[0];
    });
    const [endDate, setEndDate] = useState<string>(new Date().toISOString().split("T")[0]);

    const queryParams = useMemo(() => ({
        type: activeTab,
        limit: table.limit,
        offset: table.offset,
        sort_by: table.sortBy,
        order: table.sortOrder,
        search: table.search,
        startDate,
        endDate
    }), [activeTab, table.limit, table.offset, table.sortBy, table.sortOrder, table.search, startDate, endDate]);

    const isFirstLoad = useRef(!!initialData);

    // Fetch data whenever table state or dates change
    useEffect(() => {
        // Wait for table state to stabilize
        if (table.isInitialLoading) return;

        // Prevent double fetch on initial load if SSR data provided
        if (isFirstLoad.current) {
            isFirstLoad.current = false;
            return;
        }

        const controller = new AbortController();
        const fetchData = async () => {
            try {
                setLoading(true);
                const dateParams = `start_date=${queryParams.startDate}&end_date=${queryParams.endDate}`;

                const result = await api.getReports(queryParams.type as any, dateParams, {
                    limit: queryParams.limit,
                    offset: queryParams.offset,
                    sort_by: queryParams.sort_by,
                    order: queryParams.order,
                    search: queryParams.search,
                    signal: controller.signal
                });

                // Handle both PaginatedResponse and raw array (fallback for legacy endpoints)
                let items = [];
                let total_count = 0;

                if (Array.isArray(result)) {
                    // Client-Side Pagination for Legacy Endpoints (Reconciliation) that return ALL rows
                    total_count = result.length;

                    // Slice the large array to match pagination request prevents DOM overload
                    const start = queryParams.offset;
                    const end = start + queryParams.limit;
                    items = result.slice(start, end);
                } else {
                    items = result.items || [];
                    total_count = result.metadata?.total_count || items.length;
                }

                // Add unique_id for DataTable selection/keys
                const enrichedItems = items.map((item: any, index: number) => ({
                    ...item,
                    unique_id: `${queryParams.type}-${index}-${item.id || item.number || item.po_number || item.dc_number || item.invoice_number || item.month || ""}`,
                }));

                setData({
                    items: enrichedItems,
                    metadata: {
                        total_count,
                        page: (queryParams.offset / queryParams.limit) + 1,
                        limit: queryParams.limit
                    }
                });
            } catch (err: any) {
                if (err.name === 'AbortError') return;
                console.error(`Failed to fetch ${queryParams.type} report:`, err);
                setData({ items: [], metadata: { total_count: 0, page: 1, limit: 10 } });
            } finally {
                setLoading(false);
            }
        };

        fetchData();
        return () => controller.abort();
    }, [queryParams, table.isInitialLoading]);

    // Reset selection and table state on tab change
    useEffect(() => {
        setSelectedItems([]);
        table.setPage(1);
        table.setLimit(10);
        table.setSearch("");
    }, [activeTab]);

    const handleRowClick = useCallback((row: any) => {
        const id = row.unique_id;
        setSelectedItems(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    }, []);

    const pendingColumns: Column<any>[] = useMemo(() => [
        {
            key: "description",
            label: "DESCRIPTION",
            width: "240px",
            sortable: true,
            render: (_v, row) => (
                <div className="max-w-[240px]">
                    <StandardValue className="truncate block" title={row.description}>
                        {row.description}
                    </StandardValue>
                </div>
            ),
        },
        {
            key: "ord_qty",
            label: "QTY",
            width: "80px",
            align: "right",
            sortable: true,
            render: (_v, row) => (
                <Accounting className="font-mono font-normal text-action-primary">{row.ord_qty || 0}</Accounting>
            ),
        },
        {
            key: "no_of_packets",
            label: "PACKETS",
            width: "80px",
            align: "right",
            sortable: true,
            render: (_v, row) => <Accounting className="font-mono font-normal text-text-tertiary">{row.no_of_packets || 0}</Accounting>,
        },
        {
            key: "po_number",
            label: "PO #",
            width: "120px",
            sortable: true,
            render: (_v, row) => (
                <Link href={`/po/${row.po_number}`} className="font-normal text-text-primary text-sm tracking-tight hover:text-action-primary transition-colors">
                    {row.po_number}
                </Link>
            ),
        },
        {
            key: "gemc_number",
            label: "GEMC #",
            width: "120px",
            sortable: true,
            render: (_v, row) => <Body className="text-text-tertiary font-normal font-mono bg-surface-secondary px-1 rounded">{row.gemc_number}</Body>,
        },
        {
            key: "invoice_number",
            label: "INVOICE #",
            width: "120px",
            sortable: true,
            render: (_v, row) => (
                row.invoice_number ? (
                    <Link href={`/invoice/${row.invoice_number}`} className="font-normal text-action-primary hover:text-action-primary-hover transition-colors">
                        {row.invoice_number}
                    </Link>
                ) : "-"
            ),
        },
        {
            key: "dc_number",
            label: "CHALLAN #",
            width: "120px",
            sortable: true,
            render: (_v, row) => (
                row.dc_number ? (
                    <Link href={`/dc/${row.dc_number}`} className="font-normal text-action-primary hover:text-action-primary-hover transition-colors">
                        {row.dc_number}
                    </Link>
                ) : "-"
            ),
        },
        {
            key: "dispatch_delivered",
            label: "RECEIVED",
            width: "100px",
            align: "right",
            sortable: true,
            render: (_v, row) => (
                <Accounting className="font-mono text-status-success font-normal">{row.dispatch_delivered || 0}</Accounting>
            ),
        },
    ], []);



    const reconciliationColumns: Column<any>[] = useMemo(() => [
        {
            key: "po_number",
            label: "PO NUMBER",
            width: "140px",
            sortable: true,
            render: (_v, row) => (
                <Link href={`/po/${row.po_number}`} className="font-normal text-text-primary text-sm tracking-tight hover:text-action-primary transition-colors">
                    {row.po_number}
                </Link>
            ),
        },
        {
            key: "item_description",
            label: "ITEM",
            width: "280px",
            sortable: true,
            render: (_v, row) => (
                <Box className="w-[200px] lg:w-[320px] truncate" title={row.item_description}>
                    <Body className="text-text-secondary font-normal truncate block">{row.item_description}</Body>
                </Box>
            ),
        },
        {
            key: "ordered_qty",
            label: "ORDERED",
            width: "90px",
            align: "right",
            sortable: true,
            render: (_v, row) => (
                <Accounting className="font-normal text-action-primary font-mono text-right block">{row.ordered_qty || 0}</Accounting>
            ),
        },
        {
            key: "total_dispatched",
            label: "DELIVERED",
            width: "90px",
            align: "right",
            sortable: true,
            render: (_v, row) => (
                <Accounting className="font-normal text-status-warning font-mono text-right block">
                    {row.total_dispatched || 0}
                </Accounting>
            ),
        },
        {
            key: "total_accepted",
            label: "RECEIVED",
            width: "90px",
            align: "right",
            sortable: true,
            render: (_v, row) => (
                <Accounting className="font-normal text-status-success font-mono text-right block">
                    {row.total_accepted || 0}
                </Accounting>
            ),
        },
        {
            key: "total_rejected",
            label: "REJECTED",
            width: "90px",
            align: "right",
            sortable: true,
            render: (_v, row) => (
                <span className={cn("font-normal font-mono text-right block", row.total_rejected > 0 ? "text-status-error" : "text-text-tertiary")}>
                    {row.total_rejected || 0}
                </span>
            ),
        },
    ], []);

    const activeColumns = useMemo(() => {
        if (activeTab === "pending") return pendingColumns;
        if (activeTab === "reconciliation") return reconciliationColumns;
        return [];
    }, [activeTab, pendingColumns, reconciliationColumns]);

    const handleExport = useCallback(async () => {
        setLoading(true);
        try {
            let res;
            if (activeTab === "pending") {
                if (selectedItems.length > 0) {
                    res = await api.exportSelectedReport(selectedItems, "pending");
                } else {
                    const dateParams = `start_date=${startDate}&end_date=${endDate}`;
                    res = await api.exportReport("pending", dateParams);
                }
            } else {
                const dateParams = `start_date=${startDate}&end_date=${endDate}`;
                res = await api.exportReport(activeTab, dateParams);
            }

            if (res?.success) {
                success("Export successful", res.message);
                setSelectedItems([]);
            } else if (res) {
                error("Export failed", res?.message || "Unknown error");
            }
        } catch (e) {
            console.error("Export failed", e);
            error("Export failed");
        } finally {
            setLoading(false);
        }
    }, [activeTab, startDate, endDate, selectedItems, success, error]);

    const toolbarContent = (
        <Flex align="center" gap={4}>
            <SearchBar
                value={table.search}
                onChange={table.setSearch}
                placeholder="Search report..."
                className="w-48 lg:w-64"
            />
            <div className="bg-surface border border-border-default/20 rounded-xl p-1 flex items-center shadow-sm h-9">
                <DateInput
                    value={startDate}
                    onChange={(e: any) => setStartDate(e.target.value)}
                    icon={Calendar}
                    className="hover:bg-surface-secondary/40 border-none bg-transparent"
                />
                <div className="w-px h-5 bg-border-subtle/20 mx-2" />
                <DateInput
                    value={endDate}
                    onChange={(e: any) => setEndDate(e.target.value)}
                    icon={Calendar}
                    className="hover:bg-surface-secondary/40 border-none bg-transparent"
                />
            </div>
            <Button variant="success" size="md" onClick={handleExport} className="shadow-lg shadow-status-success/20">
                <FileDown size={16} />
                {selectedItems.length > 0 ? `Download (${selectedItems.length})` : "Download Excel"}
            </Button>
        </Flex>
    );

    return (
        <DocumentTemplate
            icon={<BarChart3 size={22} />}
            iconLayoutId="reports-icon"
            title="Operations Insights"
            description="Historical analysis and reconciliation registers"
            actions={toolbarContent}
        >
            <div className="flex flex-col h-[calc(100vh-8rem)] gap-4 pb-2">
                {/* Tabs Outside Table */}
                <div className="px-1">
                    <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v as ReportType)}>
                        <TabsList className="bg-surface-sunken/50 p-1 border border-border-default/10">
                            <TabsTrigger value="pending">
                                <AlertTriangle size={14} className="mr-2" />
                                Shortages
                            </TabsTrigger>
                            <TabsTrigger value="reconciliation">
                                <Activity size={14} className="mr-2" />
                                Audit Ledger
                            </TabsTrigger>
                        </TabsList>
                    </Tabs>
                </div>


                {/* Main Content Area (Table) - Wrapped in ListPageTemplate-style Card */}
                <Card variant="glass" padding="none" className="flex-1 w-full overflow-hidden min-h-[500px] rounded-2xl">
                    <DataTable
                        columns={activeColumns as any[]}
                        data={data.items}
                        keyField="unique_id"
                        page={table.page}
                        pageSize={table.limit}
                        totalItems={data.metadata.total_count}
                        onPageChange={table.setPage}
                        onPageSizeChange={table.setLimit}
                        sortKey={table.sortBy}
                        sortDirection={table.sortOrder}
                        onSort={table.setSort}
                        loading={loading || table.isTransitioning}
                        selectable={activeTab === "pending"}
                        selectedRows={selectedItems}
                        onSelectionChange={setSelectedItems}
                        onRowClick={activeTab === "pending" ? handleRowClick : undefined}
                        density="compact"
                        emptyMessage={loading ? "Generating report..." : "No data found for this period"}
                        className="h-full border-0 shadow-none rounded-none bg-transparent"
                        maxHeight="100%"
                    />
                </Card>
            </div>
        </DocumentTemplate>
    );
}
