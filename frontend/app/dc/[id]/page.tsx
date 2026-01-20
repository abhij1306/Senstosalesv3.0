"use client";

import { useEffect, useState } from "react";
import { useParams, notFound } from "next/navigation";
import { api } from "@/lib/api";
import { DCDetailClient } from "@/components/modules/dc/DCDetailClient";

export default function DCDetailPage() {
    const params = useParams();
    const id = params?.id as string;

    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    useEffect(() => {
        if (!id) return;

        api.getDCDetail(id)
            .then((dc) => {
                if (!dc) setError(true);
                else setData(dc);
            })
            .catch(() => setError(true))
            .finally(() => setLoading(false));
    }, [id]);

    if (loading) return <div className="p-8 text-center text-text-secondary">Loading Delivery Challan...</div>;
    if (error || !data) return notFound();

    return <DCDetailClient initialData={data} initialInvoiceData={null} />;
}
