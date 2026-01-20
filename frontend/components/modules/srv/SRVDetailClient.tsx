"use client";

import React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Printer, Package } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { DocumentTemplate, Button, Badge, DeviationsSection } from "@/components/common";
import { SRVHeaderInfo } from "./SRVHeaderInfo";
import { SRVTable } from "./SRVTable";
import { SRVDetail, SRVItem } from "@/types";

interface SRVDetailClientProps {
    initialSRV: SRVDetail;
}

export function SRVDetailClient({ initialSRV }: SRVDetailClientProps) {
    const router = useRouter();
    const { header, items } = initialSRV;


    // Extract metadata from the first item (assuming homogeneity for document-level fields)
    const metaItem = items[0] || {} as SRVItem;

    return (
        <DocumentTemplate
            title="Material Receipt (SRV)"
            description={
                <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-3">
                        <div className="flex items-center text-sm">
                            <span className="text-text-tertiary mr-2">PO:</span>
                            <Link
                                href={`/po/${header.po_number}`}
                                className="font-medium text-action-primary hover:text-action-primary-hover transition-colors"
                            >
                                #{header.po_number}
                            </Link>
                        </div>
                    </div>
                </div>
            }
            icon={<Package size={24} />}
            onBack={() => router.push("/srv")}
            actions={
                <div className="flex gap-3">
                    <Button
                        variant="secondary"
                        onClick={() => window.print()}
                        className="bg-surface-primary border-border-default shadow-sm text-text-secondary"
                    >
                        <Printer size={16} className="mr-2" />
                        Print
                    </Button>
                </div>
            }
        >
            <div className="space-y-8">
                <DeviationsSection poNumber={header.po_number} />
                <SRVHeaderInfo header={header} metaItem={metaItem} />
                <SRVTable items={items} />
            </div>
        </DocumentTemplate>
    );
}


