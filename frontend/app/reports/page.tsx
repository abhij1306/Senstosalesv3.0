import { Suspense } from "react";
import { ReportsClient } from "@/components/modules/reports/ReportsClient";
import { api } from "@/lib/api";

export const dynamic = "force-dynamic";

async function ReportsContent() {
    const endDate = new Date().toISOString().split("T")[0];
    const d = new Date();
    d.setDate(d.getDate() - 30);
    const startDate = d.toISOString().split("T")[0];
    const dateParams = `start_date=${startDate}&end_date=${endDate}`;

    const reportData = await api.getReports("pending", dateParams, { limit: 10, sort_by: "description", order: "desc" }).catch(() => null);

    return <ReportsClient initialData={reportData} />;
}

export default function ReportsPage() {
    return (
        <Suspense fallback={<div className="h-screen w-full bg-background animate-pulse" />}>
            <ReportsContent />
        </Suspense>
    );
}
