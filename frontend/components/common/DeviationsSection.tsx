"use client";

import React, { useEffect, useState } from "react";
import { AlertCircle, CheckCircle, Info } from "lucide-react";
import { api } from "@/lib/api";
import { Deviation } from "@/types";
import { Badge, Button } from "@/components/common";
import { cn, formatDate } from "@/lib/utils";

interface DeviationsSectionProps {
    poNumber?: string;
    entityType?: "srv_item" | "srv" | "dc_item";
    entityId?: string;
    className?: string;
}

export function DeviationsSection({ poNumber, entityType, entityId, className }: DeviationsSectionProps) {
    const [deviations, setDeviations] = useState<Deviation[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchDeviations = async () => {
        setLoading(true);
        try {
            // If poNumber is provided, we fetch by PO
            // Otherwise we might need more specific filters if we added them to API
            const res = await api.listDeviations({
                po_number: poNumber,
                include_resolved: false
            });

            let filtered = res.items;

            // Further filter by entity if needed
            if (entityType && entityId) {
                filtered = filtered.filter(d => d.entity_type === entityType && d.entity_id === entityId);
            }

            setDeviations(filtered);
        } catch (error) {
            console.error("Failed to fetch deviations", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDeviations();
    }, [poNumber, entityType, entityId]);

    const handleResolve = async (id: number) => {
        try {
            const res = await api.resolveDeviation(id);
            if (res.success) {
                setDeviations(prev => prev.filter(d => d.id !== id));
            }
        } catch (error) {
            console.error("Failed to resolve deviation", error);
        }
    };

    if (loading) return null;
    if (deviations.length === 0) return null;

    return (
        <div className={cn("bg-status-warning/5 border border-status-warning/20 rounded-3xl p-6 mb-8", className)}>
            <div className="flex items-center gap-3 mb-4">
                <div className="size-10 rounded-2xl bg-status-warning/10 flex items-center justify-center">
                    <AlertCircle className="text-status-warning" size={20} />
                </div>
                <div>
                    <h3 className="text-sm font-semibold text-text-primary uppercase tracking-wider">Discrepancies Detected</h3>
                    <p className="text-[11px] text-text-tertiary">The following issues were identified during data ingestion and require review.</p>
                </div>
            </div>

            <div className="space-y-3">
                {deviations.map((dev) => (
                    <div key={dev.id} className="bg-white border border-border-default/50 rounded-2xl p-4 flex items-center justify-between group hover:shadow-md transition-all">
                        <div className="flex items-start gap-4">
                            <div className="mt-1">
                                {dev.deviation_type === "QTY_MISMATCH" ? (
                                    <Badge variant="outline" className="bg-status-error/10 text-status-error border-none text-[10px]">QTY MISMATCH</Badge>
                                ) : (
                                    <Badge variant="outline" className="bg-status-warning/10 text-status-warning border-none text-[10px]">{dev.deviation_type}</Badge>
                                )}
                            </div>
                            <div>
                                <p className="text-sm font-medium text-text-primary leading-tight mb-1">
                                    {dev.field_name || "Discrepancy"} Mismatch: {dev.actual_value} vs {dev.expected_value} (Expected)
                                </p>
                                <div className="flex items-center gap-2">
                                    <p className="text-[11px] text-text-tertiary">
                                        Entity: <span className="font-semibold text-text-secondary uppercase">{dev.entity_type} {dev.entity_id}</span>
                                    </p>
                                    <span className="size-1 rounded-full bg-border-default"></span>
                                    <p className="text-[11px] text-text-tertiary">
                                        Detected: {formatDate(dev.created_at)}
                                    </p>
                                </div>
                                {dev.details && Object.keys(dev.details).length > 0 && (
                                    <p className="mt-2 text-[10px] text-text-tertiary bg-surface-sunken/50 p-2 rounded-lg border border-border-subtle/30 italic">
                                        Note: {JSON.stringify(dev.details)}
                                    </p>
                                )}
                            </div>
                        </div>
                        <Button
                            size="compact"
                            variant="secondary"
                            onClick={() => handleResolve(dev.id)}
                            className="bg-status-success/10 text-status-success hover:bg-status-success hover:text-white border-none opacity-0 group-hover:opacity-100 transition-all font-[600] text-[10px]"
                        >
                            <CheckCircle size={14} className="mr-2" />
                            MARK RESOLVED
                        </Button>
                    </div>
                ))}
            </div>
        </div>
    );
}
