"use client";

import { DocumentTemplate, Title1, Body, Button } from "@/components/common";
import { CheckCircle2, LayoutDashboard } from "lucide-react";
import { useRouter } from "next/navigation";

export default function PingPage() {
    const router = useRouter();

    return (
        <DocumentTemplate
            title="System Status"
            description="UI Reliability Check"
            icon={<CheckCircle2 className="text-status-success" size={24} />}
        >
            <div className="flex flex-col items-center justify-center py-20 text-center space-y-6">
                <div className="size-20 rounded-full bg-status-success/10 flex items-center justify-center animate-bounce">
                    <CheckCircle2 size={40} className="text-status-success" />
                </div>
                <div className="space-y-2">
                    <Title1>UI is Healthy</Title1>
                    <Body className="text-text-tertiary">All core component systems are initialized and responding.</Body>
                </div>
                <div className="flex gap-4">
                    <Button variant="primary" onClick={() => router.push("/")}>
                        <LayoutDashboard size={18} />
                        Back to Dashboard
                    </Button>
                </div>
            </div>
        </DocumentTemplate>
    );
}
