"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import {
    Button,
    SummaryCards,
    DocumentTemplate,
    Tabs,
    TabsList,
    TabsTrigger,
    TabsContent,
    DataTable,
    type Column,
    Badge,
    Flex,
    Box,
    Card,
    StandardLabel,
    StandardValue,
    Accounting,
    Tiny,
    Mini,
    Body,
    Title1,
    Title2,
    Title3,
    Caption1,
    StatusBadge
} from "@/components/common";
// Recharts dependencies removed (unused)

// Dynamically import heavy components
const ReconciliationChart = dynamic(() => import("@/components/common/ReconciliationChart").then(mod => mod.ReconciliationChart), {
    loading: () => <div className="h-[300px] w-full bg-surface-primary/50 animate-pulse rounded-2xl" />,
    ssr: false
});



import { DashboardSummary, api } from "@/lib/api";
import { formatIndianCurrency, cn } from "@/lib/utils";
import {
    AlertTriangle,
    Clock,
    LayoutDashboard,
    CheckCircle2,
    Wallet,
    TrendingUp,
    Activity,
    RefreshCcw,
    Sparkles
} from "lucide-react";

// --- MAIN COMPONENT ---


// --- Helper Component ---
const DateRangeToggle = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <Tabs value={value} onValueChange={onChange}>
        <TabsList className="bg-surface-sunken/50 border-border-default/20 px-1 py-1 h-9">
            {[
                { id: "month", label: "Month" },
                { id: "30d", label: "30 Days" },
                { id: "all", label: "All Time" },
            ].map((opt) => (
                <TabsTrigger
                    key={opt.id}
                    value={opt.id}
                    className="h-7 px-4"
                >
                    {opt.label}
                </TabsTrigger>
            ))}
        </TabsList>
    </Tabs>
);


interface DashboardClientProps {
    summary: DashboardSummary | null;
    error?: string;
}

export function DashboardClient({ summary: initialSummary, error }: DashboardClientProps) {
    const [activeTab, setActiveTab] = useState("overview");
    // State to hold live summary data, initialized from server prop
    const [summary, setSummary] = useState<DashboardSummary | null>(initialSummary);
    const [timeRange, setTimeRange] = useState("month");
    const [isRefreshing, setIsRefreshing] = useState(false);

    // Fetch data when range changes
    useEffect(() => {
        let isMounted = true;

        async function refreshData() {
            if (!timeRange) return;
            setIsRefreshing(true);
            try {
                const newData = await api.getDashboardSummary(timeRange);
                if (isMounted) setSummary(newData);
            } catch (err) {
                console.error("Failed to refresh dashboard:", err);
            } finally {
                if (isMounted) setIsRefreshing(false);
            }
        }

        // Skip initial fetch if we already have data for "month" (default)
        // But if user switches back to month, we should refetch or cache.
        // For simplicity, we just fetch on change, except maybe first render? 
        // Actually, initial render has "month" data. Ideally we avoid double fetch.
        // But since we don't know if initialSummary corresponds exactly to "month" logic (it does), 
        // we can skip if it's the very first render. 
        // However, a simple way is just to fetch. "month" is default.
        if (timeRange !== "month" || summary !== initialSummary) {
            refreshData();
        }

        return () => { isMounted = false; };
    }, [timeRange]);


    const performanceData = summary?.performance_data || [];
    const recentActivity = summary?.recent_activity || [];
    const loading = isRefreshing;

    // Dynamic Labels for Summary Cards
    const timeLabel = timeRange === "all" ? "All Time" : timeRange === "30d" ? "30 Days" : "This Month";

    const performanceColumns: Column<any>[] = useMemo(() => [
        {
            key: "month",
            label: "MONTH",
            width: "90px",
            render: (v) => <StandardValue className="text-action-primary uppercase whitespace-nowrap font-bold tracking-tight">{v}</StandardValue>
        },
        {
            key: "ordered_qty",
            label: "ORDERED",
            align: "right",
            width: "80px",
            render: (v) => <StandardValue className="whitespace-nowrap">{Math.round(v || 0).toLocaleString()}</StandardValue>
        },
        {
            key: "accepted_qty",
            label: "ACCEPTED",
            align: "right",
            width: "80px",
            render: (v) => <Accounting value={v || 0} isNumeric className="text-status-success font-bold" />
        },
        {
            key: "fulfillment",
            label: "FULFILLED %",
            align: "right",
            width: "110px",
            render: (_v, row) => {
                const perc = row.ordered_qty ? Math.round((row.accepted_qty / row.ordered_qty) * 100) : 0;
                return (
                    <Badge variant={perc > 90 ? "success" : perc > 50 ? "info" : "warning"} size="sm">
                        {perc}%
                    </Badge>
                );
            }
        }
    ], []);

    const rejectionColumns: Column<any>[] = useMemo(() => [
        {
            key: "material",
            label: "MATERIAL DESCRIPTION",
            width: "60%",
            render: (v, row) => {
                const content = <StandardValue className="truncate uppercase font-medium max-w-[300px]">{v}</StandardValue>;
                if (row.example_po_number) {
                    return (
                        <Link href={`/po/${row.example_po_number}`} className="hover:text-action-primary hover:underline block truncate" title={`View PO ${row.example_po_number}: ${v}`}>
                            {content}
                        </Link>
                    );
                }
                return <div title={v} className="truncate">{content}</div>;
            }
        },
        {
            key: "total_received",
            label: "RECD",
            align: "right",
            render: (v) => <StandardValue className="font-mono">{Math.round(v).toLocaleString()}</StandardValue>
        },
        {
            key: "total_rejected",
            label: "REJ",
            align: "right",
            className: "text-status-error",
            render: (v) => <Accounting value={v} isNumeric className="text-status-error font-bold" />
        },
        {
            key: "rejection_rate",
            label: "RATE %",
            align: "right",
            render: (v) => (
                <Badge variant={v > 10 ? "error" : v > 5 ? "warning" : "success"} size="sm">
                    {v.toFixed(1)}%
                </Badge>
            )
        }
    ], []);

    const activityColumns: Column<any>[] = useMemo(() => [
        {
            key: "type",
            label: "TYPE",
            width: "70px",
            render: (v) => (
                <span className={cn(
                    "text-[10px] font-bold tracking-widest uppercase",
                    v === 'PO' ? 'text-action-primary' : v === 'DC' ? 'text-status-warning' : 'text-status-info'
                )}>
                    {v}
                </span>
            )
        },
        {
            key: "number",
            label: "REFERENCE",
            width: "160px",
            render: (v, row) => {
                let href = "#";
                if (row.type === 'PO' || row.type === 'DC' || row.type === 'Invoice') {
                    href = `/${row.type.toLowerCase()}/${v}`;
                }

                return (
                    <Link href={href} className="font-mono text-xs text-action-primary hover:underline hover:text-action-primary/80 transition-colors">
                        {v}
                    </Link>
                );
            }
        },
        {
            key: "status",
            label: "STATUS",
            align: "right",
            width: "120px",
            render: (v) => (
                <div className="flex justify-end">
                    <StatusBadge
                        status={String(v || "Pending").toLowerCase() as any}
                        className="font-table-meta uppercase font-semibold tracking-[0.1em]"
                    />
                </div>
            )
        }
    ], []);

    if (error === "SYSTEM_BOOT_DELAY") {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center animate-in fade-in duration-700 bg-surface-primary rounded-2xl border border-border-default m-4">
                <Box className="p-6 bg-action-primary/10 rounded-2xl border-2 border-action-primary/20 text-action-primary mb-6 animate-pulse">
                    <Clock className="w-12 h-12" />
                </Box>
                <Title1 className="text-action-primary mb-2">System Initializing</Title1>
                <Body className="text-text-tertiary max-w-sm mx-auto mb-8">
                    The standalone backend services are booting up for the first time. This may take a few moments.
                </Body>
                <Button
                    variant="primary"
                    onClick={() => window.location.reload()}
                    className="shadow-xl shadow-action-primary/20 px-8 h-12 rounded-2xl"
                >
                    <RefreshCcw className="w-4 h-4 mr-2" />
                    RETRY CONNECTION
                </Button>
            </div>
        );
    }

    return (
        <DocumentTemplate
            title="Business Overview"
            description="Live Material Flow Analysis & Growth Trends"
            icon={<LayoutDashboard size={22} />}
            headerAction={<DateRangeToggle value={timeRange} onChange={setTimeRange} />}
        >
            <div className="flex flex-col gap-6 pb-8">
                <div className="flex justify-between items-center">
                    <Tabs value={activeTab} onValueChange={setActiveTab}>
                        <TabsList className="bg-surface-sunken/50 p-1 border border-border-default/10">
                            <TabsTrigger value="overview">
                                <Activity size={14} className="mr-2" />
                                Overview
                            </TabsTrigger>
                            <TabsTrigger value="performance">
                                <TrendingUp size={14} className="mr-2" />
                                Performance
                            </TabsTrigger>
                        </TabsList>
                    </Tabs>
                </div>


                <Tabs value={activeTab} className="w-full">
                    <TabsContent value="overview" className="mt-0 space-y-6 animate-in fade-in slide-in-from-bottom-2">
                        {/* Summary Cards Row */}
                        <div className={cn("transition-opacity duration-300", isRefreshing ? "opacity-60" : "opacity-100")}>
                            <SummaryCards
                                cards={[
                                    {
                                        title: `Total Order Value (${timeLabel})`,
                                        value: formatIndianCurrency(summary?.total_po_value || 0),
                                        icon: <Wallet />,
                                        variant: "primary",
                                        helpText: "Sum of PO Item Values for all Purchase Orders placed within the selected time range.",
                                        trend: {
                                            value: summary?.po_value_growth ? `${summary.po_value_growth}%` : "Stable",
                                            direction: "neutral"
                                        }
                                    },
                                    {
                                        title: "Reconciliation Score",
                                        value: `${summary?.supply_health_score || 0}%`,
                                        icon: <TrendingUp />,
                                        variant: "info",
                                        helpText: "Calculated as 100 - (Rejection Rate * 5). Measures the quality performance of items received against POs from this period.",
                                        trend: {
                                            value: (summary?.supply_health_score || 0) > 90 ? "Excellent" : "Needs Review",
                                            direction: (summary?.supply_health_score || 0) > 90 ? "up" : "down",
                                            showSign: false
                                        }
                                    },
                                    {
                                        title: "Avg Lead Time",
                                        value: `${summary?.avg_lead_time || 0} Days`,
                                        icon: <Activity />,
                                        variant: "warning",
                                        helpText: "Average number of days between the PO Date and the first Store Receipt (SRV) for all POs in this period.",
                                        trend: {
                                            value: (summary?.avg_lead_time || 0) < 15 ? "Fast" : "Average",
                                            direction: (summary?.avg_lead_time || 0) < 15 ? "up" : "neutral",
                                            showSign: false
                                        }
                                    },
                                    {
                                        title: "Total Dispatched",
                                        value: Math.round(summary?.total_dsp_qty ?? 0).toLocaleString('en-IN'),
                                        icon: <CheckCircle2 />,
                                        variant: "success",
                                        helpText: "Total quantity of dispatch across all Delivery Challans linked to the Purchase Orders of this period.",
                                        trend: {
                                            value: summary?.total_ord_qty
                                                ? `${Math.round(((summary.total_dsp_qty || 0) / summary.total_ord_qty) * 100)}% Dispatched`
                                                : "On Track",
                                            direction: "up",
                                            showSign: false
                                        }
                                    }
                                ]}
                            />
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
                            <div className="border border-border-default/30 bg-surface/50 rounded-3xl p-4 h-full flex flex-col">
                                <Flex justify="between" align="center" className="mb-4">
                                    <StandardLabel>Recent Activity</StandardLabel>
                                    <Activity size={14} className="text-action-primary opacity-60" />
                                </Flex>
                                <div className="flex-1 overflow-hidden">
                                    <DataTable
                                        columns={activityColumns}
                                        data={recentActivity}
                                        keyField="number"
                                        pageSize={5}
                                        loading={loading}
                                        density="compact"
                                        className="h-full border-none"
                                    />
                                </div>
                            </div>
                            <div className="lg:col-span-2">
                                <ReconciliationChart summary={summary} />
                            </div>
                        </div>
                    </TabsContent>

                    <TabsContent value="performance" className="mt-0 space-y-6 animate-in fade-in slide-in-from-bottom-2">
                        <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
                            {/* Fulfillment Chart - 2/5 width */}
                            <div className="xl:col-span-2">
                                <Card variant="elevated" padding="lg" className="h-full">
                                    <Flex align="center" gap={3} className="mb-6">
                                        <Box className="p-2 rounded-xl bg-action-primary/10 text-action-primary">
                                            <TrendingUp size={18} />
                                        </Box>
                                        <div>
                                            <Title3 className="uppercase tracking-tighter leading-none">Fulfillment Velocity</Title3>
                                            <Tiny className="text-text-tertiary uppercase mt-1">Ordered vs Accepted across months</Tiny>
                                        </div>
                                    </Flex>
                                    <DataTable
                                        columns={performanceColumns}
                                        data={summary?.fulfillment_trends || []}
                                        keyField="month"
                                        loading={loading}
                                        density="compact"
                                    />
                                </Card>
                            </div>

                            {/* Rejection Profile - 3/5 width (Wider) */}
                            <div className="xl:col-span-3">
                                <Card variant="elevated" padding="lg" className="h-full">
                                    <Flex align="center" gap={3} className="mb-6">
                                        <Box className="p-2 rounded-xl bg-status-error-container/30 text-status-error">
                                            <AlertTriangle size={18} />
                                        </Box>
                                        <div>
                                            <Title3 className="uppercase tracking-tighter leading-none">Rejection Profile</Title3>
                                            <Tiny className="text-text-tertiary uppercase mt-1">Top materials by rejection rate</Tiny>
                                        </div>
                                    </Flex>
                                    <DataTable
                                        columns={rejectionColumns}
                                        data={summary?.rejection_profile || []}
                                        keyField="material"
                                        loading={loading}
                                        density="compact"
                                    />
                                </Card>
                            </div>
                        </div>

                        {/* Business Momentum Removed per User Request */}
                    </TabsContent>
                </Tabs>
            </div>
        </DocumentTemplate>
    );
}
