"use client";

import { useEffect, useState } from "react";
import { useParams, notFound } from "next/navigation";
import { api } from "@/lib/api";
import { PODetailClient } from "@/components/modules/po/PODetailClient";
import { PODetail, SRVListItem } from "@/types";

export default function PODetailPage() {
    const params = useParams();
    const id = params?.id as string;

    const [data, setData] = useState<{ po: PODetail, srvs: SRVListItem[], dc: any } | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    useEffect(() => {
        if (!id) return;

        Promise.all([
            api.getPODetail(id),
            api.listSRVs(id).catch(() => []),
            api.checkPOHasDC(id).catch(() => null)
        ]).then(([po, srvRes, dc]) => {
            if (!po) {
                setError(true);
            } else {
                const srvs = srvRes && 'items' in srvRes ? srvRes.items : (Array.isArray(srvRes) ? srvRes : []);
                setData({ po, srvs, dc });
            }
        }).catch((err) => {
            console.error("Failed to fetch PO details:", err);
            setError(true);
        }).finally(() => {
            setLoading(false);
        });
    }, [id]);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <div className="bg-white p-4 rounded-lg shadow-sm border border-border-default">
                    <span className="text-text-secondary animate-pulse">Loading Purchase Order...</span>
                </div>
            </div>
        );
    }

    if (error || !data) return notFound();

    return <PODetailClient initialPO={data.po} initialSrvs={data.srvs} initialDC={data.dc} />;
}
