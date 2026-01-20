import { api } from "@/lib/api";
import { DashboardClient } from "@/components/modules/dashboard/DashboardClient";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
    try {
        const summary = await api.getDashboardSummary();
        return (
            <DashboardClient
                summary={summary}
            />
        );
    } catch (error: any) {
        console.error("[DASHBOARD] Initial fetch failed:", error);
        // Pass null or empty object to client component to handle it gracefully
        // This avoids the scary Next.js "Runtime Exception" digest page
        return (
            <DashboardClient
                summary={null as any}
                error="SYSTEM_BOOT_DELAY"
            />
        );
    }
}
