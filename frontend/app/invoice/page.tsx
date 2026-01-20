import { Suspense } from "react";
import { api } from "@/lib/api";
import { InvoiceListClient } from "@/components/modules/invoice/InvoiceListClient";

export const dynamic = "force-dynamic";

async function InvoiceListContent() {
    const [invoices, stats] = await Promise.all([
        api.listInvoices({ limit: 10, sort_by: "invoice_date", order: "desc" }),
        api.getInvoiceStats()
    ]);
    return <InvoiceListClient initialInvoices={invoices} initialStats={stats} />;
}

export default function InvoiceListPage() {
    return (
        <Suspense fallback={<div className="h-screen w-full bg-background animate-pulse" />}>
            <InvoiceListContent />
        </Suspense>
    );
}
