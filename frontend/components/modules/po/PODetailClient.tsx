"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formatIndianCurrency, formatDate, cn } from "@/lib/utils";
import { PODetail, SRVListItem } from "@/types";
import { usePOStore, usePOActions, usePOHeader, usePOItems } from "@/store/poStore";

import {
    CheckCircle2,
    Save,
    X,
    Edit,
    Printer,
    ShoppingCart,
    PlusCircle
} from "lucide-react";

import {
    Button,
    Badge,
    Accounting,
    DocumentTemplate,
    Caption1,
    Card,
    DeviationsSection
} from "@/components/common";
import { PODetailInfo } from "./PODetailInfo";
import { PODetailItems } from "./PODetailItems";

const TOLERANCE = 0.001;

interface PODetailClientProps {
    initialPO: PODetail | null;
    initialSrvs: SRVListItem[];
    initialDC: { has_dc: boolean; dc_id?: string } | null;
}

export function PODetailClient({
    initialPO,
    initialSrvs,
    initialDC,
}: PODetailClientProps) {
    const router = useRouter();

    // Use granular selectors to prevent unnecessary re-renders of the Layout when items change
    const storeHeader = usePOHeader();
    const storeItems = usePOItems();
    const { setPO } = usePOActions();

    // Combined PO object for initial logic compatibility
    // Prioritize store if it matches. Note: We reconstruct 'po' from pieces if needed.
    const isStoreMatch = storeHeader?.po_number === initialPO?.header?.po_number;

    // Derived state for rendering
    const header = isStoreMatch ? storeHeader : initialPO?.header;
    const items = isStoreMatch ? storeItems : initialPO?.items || [];

    // Safety check - if we switched pages but store is stale? 
    // The useEffect below handles sync, but render might happen before effect.

    useEffect(() => {
        if (initialPO) {
            setPO(initialPO);
        }
    }, [initialPO, setPO]);

    const [activeTab, setActiveTab] = useState("basic");
    const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());
    const [editMode, setEditMode] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    const { savePO } = usePOActions();

    useEffect(() => {
        if (items) {
            setExpandedItems(new Set(items.map(i => i.po_item_no)));
        }
    }, [items]);

    const toggleItem = (id: number) => {
        const next = new Set(expandedItems);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setExpandedItems(next);
    };

    if (!header) return null;
    const h = header;
    const poItems = items; // Alias for usage below

    return (
        <DocumentTemplate
            title="Purchase Order Details"
            description={
                <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-3">
                        <div className="flex items-center text-sm">
                            <span className="text-text-tertiary mr-2">SRVs Raised:</span>
                            {initialSrvs && initialSrvs.length > 0 ? (
                                <div className="flex gap-1.5 flex-wrap items-center">
                                    {initialSrvs.map((srv, index) => (
                                        <React.Fragment key={srv.srv_number}>
                                            <Link
                                                href={`/srv/${srv.srv_number}`}
                                                className="font-bold text-action-primary hover:text-action-primary-hover transition-colors"
                                            >
                                                {srv.srv_number}
                                            </Link>
                                            {index < initialSrvs.length - 1 && (
                                                <span className="text-text-quaternary">,</span>
                                            )}
                                        </React.Fragment>
                                    ))}
                                </div>
                            ) : (
                                <span className="font-medium text-text-quaternary">None</span>
                            )}
                        </div>
                    </div>
                </div>
            }
            icon={<ShoppingCart size={24} />}
            onBack={() => router.push("/po")}
            actions={
                <div className="flex gap-3">
                    {editMode ? (
                        <>
                            <Button
                                variant="outline"
                                onClick={() => setEditMode(false)}
                                disabled={isSaving}
                            >
                                <X size={16} />
                                Cancel
                            </Button>
                            <Button
                                variant="primary"
                                onClick={async () => {
                                    setIsSaving(true);
                                    try {
                                        await savePO();
                                        setEditMode(false);
                                    } catch (e) {
                                        alert("Failed to save PO updates");
                                    } finally {
                                        setIsSaving(false);
                                    }
                                }}
                                disabled={isSaving}
                            >
                                <Save size={16} />
                                {isSaving ? "Saving..." : "Save Changes"}
                            </Button>
                        </>
                    ) : (
                        <>
                            <Button
                                variant="elevated"
                                onClick={() => setEditMode(true)}
                            >
                                <Edit size={16} />
                                EDIT
                            </Button>
                            <Button
                                variant="outline"
                                onClick={() => window.print()}
                            >
                                <Printer size={16} />
                                Print
                            </Button>
                        </>
                    )}
                    {(() => {
                        const isClosed = ["Dispatch", "Closed", "Completed"].includes(h.po_status || "");
                        const hasDC = initialDC?.has_dc;

                        // Calculate if there are any items with remaining balance to dispatch
                        const hasDispatchableItems = poItems.some((item: any) => {
                            // Check each delivery lot for remaining balance
                            if (item.deliveries && item.deliveries.length > 0) {
                                return item.deliveries.some((del: any) => {
                                    const ordered = del.ord_qty || 0;
                                    const dispatched = del.dsp_qty || 0;
                                    return (ordered - dispatched) > TOLERANCE;
                                });
                            }
                            // Fallback to item-level check
                            const ordered = item.ord_qty || 0;
                            const dispatched = item.dsp_qty || 0;
                            return (ordered - dispatched) > TOLERANCE;
                        }) ?? false;

                        // Disable if: (no DC exists AND status is closed) OR no items to dispatch
                        const shouldDisable = (!hasDC && isClosed) || (!hasDC && !hasDispatchableItems);

                        return (
                            <Button
                                variant="primary"
                                disabled={shouldDisable}
                                onClick={() => hasDC ? router.push(`/dc/${initialDC.dc_id}`) : router.push(`/dc/create?po=${h.po_number}`)}
                            >
                                <PlusCircle size={18} />
                                {hasDC ? "View DC" : "Generate DC"}
                            </Button>
                        );
                    })()}
                </div>
            }
        >
            <div className="space-y-6">
                <DeviationsSection poNumber={h.po_number} />
                <PODetailInfo
                    srvs={initialSrvs}
                    editMode={editMode}
                    onSRVClick={(id) => router.push(`/srv/${id}`)}
                    activeTab={activeTab}
                    setActiveTab={setActiveTab}
                />

                <PODetailItems
                    editMode={editMode}
                    expandedItems={expandedItems}
                    toggleItem={toggleItem}
                />
            </div>
        </DocumentTemplate >
    );
}


