import React from "react";
import { DashboardSummary } from "@/lib/api";
import { Title3, Caption1, MetricValue, Tiny } from "./Typography";
import { Badge } from "./Badge";
import { SummaryCard } from "./SummaryCard";
import { Card, Box, Flex } from "./index";
import { Activity, CheckCircle2, Package, Truck } from "lucide-react";

export const ReconciliationChart = React.memo(function ReconciliationChart({ summary }: { summary: DashboardSummary | null }) {
    if (!summary) return null;

    // Handle empty database state properly
    const total = summary.total_ord_qty || 0;
    const received = summary.total_rcd_qty || 0;
    const dispatched = summary.total_dsp_qty || 0;
    const rejected = summary.total_rej_qty || 0;

    // Schema-aligned metrics
    const accepted = received; // Success
    const inTransit = Math.max(0, dispatched - received - rejected); // Warning
    const openOrders = Math.max(0, total - dispatched); // Info/Primary

    // Percentage calculations for the Pie Chart
    const fulfilledPct = total > 0 ? Math.min(100, Math.round((accepted / total) * 100)) : 0;
    const inTransitPct = total > 0 ? Math.round((inTransit / total) * 100) : 0;

    // Visual Gradient using Standard Palette
    const conicGradient = React.useMemo(() => `conic-gradient(
        var(--color-status-success) 0% ${fulfilledPct}%, 
        var(--color-status-warning) ${fulfilledPct}% ${fulfilledPct + inTransitPct}%, 
        var(--color-border-default) ${fulfilledPct + inTransitPct}% 100%
    )`, [fulfilledPct, inTransitPct]);

    return (
        <div className="h-full flex flex-col justify-start gap-6 p-6 relative overflow-hidden group/main">
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover/main:opacity-10 transition-opacity">
                <Activity size={80} className="text-text-primary" />
            </div>

            <div className="flex items-center justify-between relative z-10">
                <div className="flex flex-col gap-0.5">
                    <Caption1>Material Flow Analysis</Caption1>
                    <Tiny className="text-text-tertiary opacity-60 tracking-wider">
                        Real-time supply chain reconciliation
                    </Tiny>
                </div>
            </div>

            <div className="flex flex-col lg:flex-row gap-6 items-center relative z-10">
                <div className="relative size-32 shrink-0 flex items-center justify-center">
                    <div className="size-full rounded-full shadow-elevated transition-transform duration-700 group-hover/main:rotate-12" style={{ background: conicGradient }}></div>
                    <div className="absolute inset-3 glass rounded-full flex flex-col items-center justify-center shadow-inner border border-border-default/20">
                        <MetricValue className="text-xl">{fulfilledPct}%</MetricValue>
                        <Badge variant="outline" className="text-status-success border-status-success/40 mt-1 h-auto py-0 text-[10px]">Accepted</Badge>
                    </div>
                </div>

                <div className="flex-1 w-full grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <SummaryCard
                        title="Accepted Items"
                        value={Math.round(accepted).toLocaleString('en-IN')}
                        subtitle="Received"
                        variant="success"
                        icon={<CheckCircle2 />}
                        helpText="Total quantity received and accepted at stores for POs of this period."
                        className="bg-action-primary/5 border-none shadow-sm h-full"
                    />
                    <SummaryCard
                        title="In-Transit"
                        value={Math.round(inTransit).toLocaleString('en-IN')}
                        subtitle="Active"
                        variant="warning"
                        icon={<Truck />}
                        helpText="Quantity currently on its way (Dispatched - Received - Rejected) for POs of this period."
                        className="bg-action-primary/5 border-none shadow-sm h-full"
                    />
                    <SummaryCard
                        title="Open Orders"
                        value={Math.round(openOrders).toLocaleString('en-IN')}
                        subtitle="Balance"
                        variant="info"
                        icon={<Package />}
                        helpText="Balance quantity not yet dispatched (Ordered - Dispatched) for POs of this period."
                        className="bg-action-primary/5 border-none shadow-sm h-full"
                    />
                </div>
            </div>
        </div>
    );
});
