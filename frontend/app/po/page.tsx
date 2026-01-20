import { Suspense } from "react";
import { api } from "@/lib/api";
import { POListClient } from "@/components/modules/po/POListClient";

export const dynamic = "force-dynamic";

async function POListContent() {
    const [pos, stats] = await Promise.all([
        api.listPOs({ limit: 10, sort_by: "po_date", order: "desc" }),
        api.getPOStats()
    ]);

    return <POListClient initialPOs={pos} initialStats={stats} />;
}

export default function POListPage() {
    return (
        <Suspense fallback={<div className="h-screen w-full bg-background animate-pulse" />}>
            <POListContent />
        </Suspense>
    );
}

