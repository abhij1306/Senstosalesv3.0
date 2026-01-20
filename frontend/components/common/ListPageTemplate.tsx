"use client";

import React from "react";
import { Title1, SmallText, Body } from "./Typography";
import { SummaryCards } from "./SummaryCards";
import { type SummaryCardProps } from "./SummaryCard";
import { Card } from "./Card";
import { DataTable, type Column, type DataTableProps } from "./DataTable";
import { cn } from "@/lib/utils";
import { DocumentTemplate } from "./DocumentTemplate";


/**
 * ListPageTemplate - Atomic Design System v1.0
 * Standard layout for list pages (PO, DC, Invoice, SRV)
 * Layout: Heading → Toolbar → Summary Cards (optional) → DataTable
 */
export interface ListPageTemplateProps<T = any> {
    // Header
    title: string;
    subtitle?: string;
    toolbar?: React.ReactNode;
    // Summary Row (KPI Cards)
    summaryCards?: SummaryCardProps[];
    isGlassSummary?: boolean;
    // Table
    columns: Column<T>[];
    data: T[];
    keyField?: string;
    page?: number;
    pageSize?: number;
    totalItems?: number;
    onPageChange?: (page: number) => void;
    onPageSizeChange?: (size: number) => void;
    sortKey?: string;
    sortDirection?: "asc" | "desc";
    onSort?: (key: string) => void;
    selectable?: boolean;
    selectedRows?: string[];
    onSelectionChange?: (selected: string[]) => void;
    exportable?: boolean;
    onExport?: () => void;
    loading?: boolean;
    error?: string;
    emptyMessage?: string;
    density?: "compact" | "normal"; // Pass through to DataTable
    // Customization
    no_borders?: boolean;
    table_surface_solid?: boolean;
    renderSubRow?: (row: T) => React.ReactNode;
    onRowExpand?: (row: T, isExpanded: boolean) => void;
    no_subrow_padding?: boolean;
    className?: string;
    children?: React.ReactNode;
    icon?: React.ReactNode;
    iconLayoutId?: string;
    virtualized?: boolean;
}

export function ListPageTemplate<T extends Record<string, any>>({
    title,
    subtitle,
    toolbar,
    summaryCards,
    columns,
    data,
    keyField = "id",
    page,
    pageSize,
    totalItems,
    onPageChange,
    onPageSizeChange,
    sortKey,
    sortDirection,
    onSort,
    selectable,
    selectedRows,
    onSelectionChange,
    exportable,
    onExport,
    loading,
    error,
    emptyMessage,
    density = "compact",
    className,
    children,
    no_borders,
    table_surface_solid,
    renderSubRow,
    onRowExpand,
    no_subrow_padding,
    icon,
    iconLayoutId,
    virtualized,
    isGlassSummary = true,
}: ListPageTemplateProps<T>) {
    return (
        <DocumentTemplate
            title={title}
            description={subtitle}
            actions={toolbar}
            className={className}
            icon={icon}
            iconLayoutId={iconLayoutId}
        >
            <div className="flex flex-col h-[calc(100vh-8rem)] gap-4 pb-2">
                {/* Compact Summary Cards */}
                {summaryCards && summaryCards.length > 0 && (
                    <SummaryCards cards={summaryCards} loading={loading} isGlass={isGlassSummary} />
                )}

                {/* Main Content Area (Table) - Wrapped in Card for containment */}
                <Card variant="glass" padding="none" className="flex-1 w-full overflow-hidden min-h-[500px] rounded-2xl">
                    {children ? (
                        <div className="h-full">{children}</div>
                    ) : (
                        <DataTable
                            columns={columns as any}
                            data={data as any}
                            keyField={keyField as any}
                            page={page}
                            pageSize={pageSize}
                            totalItems={totalItems}
                            onPageChange={onPageChange}
                            onPageSizeChange={onPageSizeChange}
                            sortKey={sortKey}
                            sortDirection={sortDirection}
                            onSort={onSort}
                            selectable={selectable}
                            selectedRows={selectedRows}
                            onSelectionChange={onSelectionChange}
                            exportable={exportable}
                            onExport={onExport}
                            loading={loading}
                            error={error}
                            emptyMessage={emptyMessage}
                            emptyIcon={null}
                            renderSubRow={renderSubRow as any}
                            onRowExpand={onRowExpand as any}
                            no_subrow_padding={no_subrow_padding}
                            density={density}
                            virtualized={virtualized}
                            className="border-0 shadow-none rounded-none bg-transparent h-full" // Internal table stays flat and transparent
                            maxHeight="100%"
                        />
                    )}
                </Card>
            </div>
        </DocumentTemplate>
    );
}
