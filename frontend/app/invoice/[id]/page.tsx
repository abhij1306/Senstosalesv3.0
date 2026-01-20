"use client";

import { useEffect, useState } from "react";
import { useParams, notFound } from "next/navigation";
import { api } from "@/lib/api";
import { InvoiceDetailClient } from "@/components/modules/invoice/InvoiceDetailClient";

export default function InvoiceDetailPage() {
    const params = useParams();
    const id = params?.id as string;

    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    useEffect(() => {
        if (!id) return;

        api.getInvoiceDetail(id)
            .then((invoice) => {
                if (!invoice) setError(true);
                else setData(invoice);
            })
            .catch(() => setError(true))
            .finally(() => setLoading(false));
    }, [id]);

    if (loading) return <div className="p-8 text-center text-text-secondary">Loading Invoice...</div>;
    if (error || !data) return notFound();

    return <InvoiceDetailClient data={data} />;
}
