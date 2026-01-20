import { Suspense } from "react";
import { api } from "@/lib/api";
import { DCListClient } from "@/components/modules/dc/DCListClient";

export const dynamic = "force-dynamic";

async function DCListContent() {
    const [dcs, stats] = await Promise.all([
        api.listDCs({ limit: 10, sort_by: "dc_date", order: "desc" }),
        api.getDCStats()
    ]);
    return <DCListClient initialDCs={dcs} initialStats={stats} />;
}

export default function DCListPage() {
    return (
        <Suspense fallback={<div className="h-screen w-full bg-background animate-pulse" />}>
            <DCListContent />
        </Suspense>
    );
}
