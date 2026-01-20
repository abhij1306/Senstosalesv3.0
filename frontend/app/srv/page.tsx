import { Suspense } from "react";
import { api } from "@/lib/api";
import { SRVListClient } from "@/components/modules/srv/SRVListClient";

export const dynamic = "force-dynamic";

async function SRVListContent({ searchParams }: { searchParams: any }) {
  const params = await searchParams;
  const srvs = await api.listSRVs(undefined, {
    sort_by: params.sort_by,
    order: params.order,
    limit: 10
  });
  const stats = await api.getSRVStats();

  return <SRVListClient initialSRVs={srvs} initialStats={stats} />;
}

export default function SRVListPage({ searchParams }: { searchParams: any }) {
  return (
    <Suspense fallback={<div className="h-screen w-full bg-background animate-pulse" />}>
      <SRVListContent searchParams={searchParams} />
    </Suspense>
  );
}
