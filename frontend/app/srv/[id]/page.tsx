"use client";

import { useEffect, useState } from "react";
import { useParams, notFound } from "next/navigation";
import { api } from "@/lib/api";
import { SRVDetailClient } from "@/components/modules/srv/SRVDetailClient";

export default function SRVDetailPage() {
    const params = useParams();
    const id = params?.id as string;

    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    useEffect(() => {
        if (!id) return;

        api.getSRV(id)
            .then((srv) => {
                if (!srv) setError(true);
                else setData(srv);
            })
            .catch(() => setError(true))
            .finally(() => setLoading(false));
    }, [id]);

    if (loading) return <div className="p-8 text-center text-text-secondary">Loading SRV...</div>;
    if (error || !data) return notFound();

    return <SRVDetailClient initialSRV={data} />;
}
