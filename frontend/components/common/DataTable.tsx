"use client";

import React from "react";
import * as ReactWindow from "react-window";
// Bulletproof resolution for FixedSizeList
const List: any = (ReactWindow as any).FixedSizeList ||
    (ReactWindow as any).default?.FixedSizeList ||
    (ReactWindow as any).default ||
    ((ReactWindow as any).default && (ReactWindow as any).default.FixedSizeList);
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { useState, useMemo } from "react";
import { Pagination } from "./Pagination";
import { Accounting, Mono, Caption1, Tiny } from "./Typography";
import { Input } from "./Input";

/**
 * DataTable Component - Information Dense & High Performance
 * 
 * Design Principles:
 * - 4px base usage: cell padding strictly px-3 (12px) py-2 (8px)
 * - Headers: Tahoe Label / Surface Variant
 * - Supports Standard Table for Small Datasets (SEO/Accessibility)
 * - Supports Virtualized Table for Large Datasets (Performance)
 * */

export interface Column<T> {
    key: keyof T;
    label: string;
    width?: string;
    align?: 'left' | 'center' | 'right';
    render?: (value: any, record: T, index: number) => React.ReactNode;
    sortable?: boolean;
    isNumeric?: boolean;
    icon?: React.ReactNode; // Optional icon to display next to the value
}

export interface DataTableProps<T> {
    data: T[];
    columns: Column<T>[];
    keyField: keyof T;
    className?: string;
    onRowClick?: (record: T) => void;
    rowClassName?: (record: T) => string;
    loading?: boolean;
    emptyMessage?: string;
    virtualized?: boolean;
    maxHeight?: number | string;
    rowHeight?: number;
    density?: 'normal' | 'compact';
    // Pagination
    page?: number;
    pageSize?: number;
    totalItems?: number;
    onPageChange?: (page: number) => void;
    // Sorting
    sortKey?: string;
    sortDirection?: "asc" | "desc";
    onSort?: (key: string) => void;
    // Selection
    selectable?: boolean;
    selectedRows?: string[];
    onSelectionChange?: (selected: string[]) => void;
    // Extra
    exportable?: boolean;
    onExport?: () => void;
    onPageSizeChange?: (size: number) => void;
    error?: string;
    emptyIcon?: React.ReactNode;
    renderSubRow?: (row: T) => React.ReactNode;
    onRowExpand?: (row: T, isExpanded: boolean) => void;
    no_subrow_padding?: boolean;
    hideHeader?: boolean;
}

// Helper component for virtualization - Defined outside to prevent re-creation
const VirtualizedRow = React.memo(({ index, style, data }: { index: number; style: React.CSSProperties; data: any }) => {
    const { items, columns, onRowClick } = data;
    const row = items[index];

    return (
        <div
            style={style}
            onClick={() => onRowClick?.(row)}
            className={cn(
                "flex items-center group relative transition-all duration-300 ease-out",
                "cursor-pointer hover:bg-muted/30",
                index % 2 === 1 && "bg-black/[0.01]"
            )}
        >
            {columns.map((column: Column<any>) => (
                <div
                    key={column.key as string}
                    className={cn(
                        "px-[var(--table-padding-x)] py-[var(--table-padding-y)]", // Enforce token padding
                        column.isNumeric ? "table-cell-numeric text-right" : "table-cell-primary",
                        column.align === 'center' && 'justify-center',
                        column.align === 'right' && 'justify-end'
                    )}
                    style={{
                        width: column.width || `${100 / columns.length}%`
                    }}
                >
                    {column.icon && <span className="opacity-60">{column.icon}</span>}
                    {column.render ? column.render(row[column.key], row, index) : (
                        column.isNumeric ? (
                            <Accounting autoColor>{row[column.key]}</Accounting>
                        ) : (row[column.key] as any)
                    )}
                </div>
            ))}
        </div>
    );
});
VirtualizedRow.displayName = 'VirtualizedRow';

export const DataTable = React.memo(<T extends Record<string, any>>({
    columns,
    data,
    className,
    keyField = "id",
    onRowClick,
    loading = false,
    emptyMessage = "No data available",
    rowHeight: propRowHeight = 40,
    virtualized = false,
    maxHeight = 800,
    density = "compact",
    page,
    pageSize,
    totalItems,
    onPageChange,
    sortKey,
    sortDirection,
    onSort,
    selectable,
    selectedRows,
    onSelectionChange,
    exportable,
    onExport,
    error,
    emptyIcon,
    renderSubRow,
    onRowExpand,
    no_subrow_padding,
    onPageSizeChange,
    hideHeader,
}: DataTableProps<T>) => {
    const actualRowHeight = density === 'compact' ? 40 : 52;
    const headerHeight = density === 'compact' ? 40 : 44;
    const [expandedRows, setExpandedRows] = useState<Set<string | number>>(new Set());

    // Auto-Virtualization Logic - Disabled by default as per user request for only pagination
    const shouldVirtualize = !!virtualized;

    // Sort Logic - Only perform local sorting if onSort (server-side sort) is NOT provided
    const sortedData = React.useMemo(() => {
        if (!sortKey || onSort) return data;

        const sorted = [...data].sort((a, b) => {
            const aValue = a[sortKey];
            const bValue = b[sortKey];

            if (typeof aValue === 'string' && typeof bValue === 'string') {
                return sortDirection === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
            }
            if (typeof aValue === 'number' && typeof bValue === 'number') {
                return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
            }
            // Fallback for other types or mixed types
            if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
            if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
            return 0;
        });
        return sorted;
    }, [data, sortKey, sortDirection, onSort]);

    // Local Pagination Logic - Slice data only if it's NOT already server-paginated
    const paginatedData = useMemo(() => {
        // If onPageChange exists, we ASSUME server-side pagination. Just return data.
        if (onPageChange || !page || !pageSize || !sortedData) return sortedData || [];

        // Extra check: If totalItems is provided and is more than current data length, 
        // we definitely have server-side pagination.
        const isServerPaginated = totalItems !== undefined && totalItems > sortedData.length;
        if (isServerPaginated) return sortedData;

        // Otherwise perform client-side slicing
        const start = (page - 1) * pageSize;
        return sortedData.slice(start, start + pageSize);
    }, [sortedData, page, pageSize, totalItems, onPageChange]);

    // --- Selection Logic ---
    const effectiveColumns = useMemo(() => {
        if (!selectable) return columns;

        const selectionColumn: Column<T> = {
            key: "__selection__" as keyof T,
            label: "SELECT",
            width: "50px",
            align: "center",
            render: (_v, row) => {
                const isSelected = selectedRows?.includes(String(row[keyField] ?? ""));
                return (
                    <Input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => {
                            e.stopPropagation();
                            if (!onSelectionChange || !selectedRows) return;
                            const id = String(row[keyField] ?? "");
                            if (e.target.checked) {
                                onSelectionChange([...selectedRows, id]);
                            } else {
                                onSelectionChange(selectedRows.filter(r => r !== id));
                            }
                        }}
                        className="w-4 h-4 rounded border-border text-primary focus:ring-ring cursor-pointer"
                    />
                );
            }
        };
        // Add as FIRST column for visibility and better UX
        return [selectionColumn, ...columns];
    }, [columns, selectable, selectedRows, onSelectionChange, keyField]);

    const handleSelectAll = React.useCallback(() => {
        if (!onSelectionChange || !data || !selectedRows) return;
        const allIds = data.map(d => String(d[keyField] ?? ""));
        // Check if all are selected (subset check)
        const areAllSelected = allIds.every(id => selectedRows.includes(id));

        if (areAllSelected) {
            // Deselect all (that are in current view/data)
            const newSelection = selectedRows.filter(id => !allIds.includes(id));
            onSelectionChange(newSelection);
        } else {
            // Select all (merge)
            const newSelection = [...new Set([...selectedRows, ...allIds])];
            onSelectionChange(newSelection);
        }
    }, [data, keyField, onSelectionChange, selectedRows]);

    const isVirtualizationAvailable = shouldVirtualize && typeof List === 'function';

    // Memoize item data for virtualization to avoid unnecessary re-renders
    const itemData = useMemo(() => ({
        items: paginatedData || [],
        columns: effectiveColumns,
        onRowClick
    }), [paginatedData, effectiveColumns, onRowClick]);

    // --- Render Logic ---
    const showEmptyState = (!data || data.length === 0) && !loading;
    const showInitialLoading = loading && (!data || data.length === 0);

    if (showInitialLoading) {
        return (
            <div className={cn("flex flex-col w-full bg-transparent relative", className)}>
                {!hideHeader && (
                    <div className="sticky top-0 z-30 bg-surface shadow-none border-none">
                        <div className="flex border-none">
                            {effectiveColumns.map((column, idx) => (
                                <div
                                    key={idx}
                                    className={cn(
                                        "px-3 first:pl-8 last:pr-8 flex items-center h-10 bg-surface",
                                        column.align === 'center' && 'justify-center',
                                        column.align === 'right' && 'justify-end'
                                    )}
                                    style={{ width: column.width || `${100 / effectiveColumns.length}%` }}
                                >
                                    <div className="h-3 w-20 bg-surface-secondary/50 rounded animate-pulse" />
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                <div className="w-full">
                    {Array.from({ length: 5 }).map((_, rowIndex) => (
                        <div
                            key={rowIndex}
                            className="flex items-center border-b border-border-subtle/30 last:border-none"
                            style={{ height: actualRowHeight }}
                        >
                            {effectiveColumns.map((column, colIndex) => (
                                <div
                                    key={colIndex}
                                    className={cn(
                                        "px-3 first:pl-8 last:pr-8",
                                        column.align === 'center' && 'flex justify-center',
                                        column.align === 'right' && 'flex justify-end'
                                    )}
                                    style={{ width: column.width || `${100 / effectiveColumns.length}%` }}
                                >
                                    <div
                                        className={cn(
                                            "h-4 rounded bg-surface-secondary/40 animate-pulse",
                                            column.key === "__selection__" ? "w-4 rounded-md" : "w-full max-w-[80%]"
                                        )}
                                    />
                                </div>
                            ))}
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    if (showEmptyState) {
        return (
            <div className="p-8 text-center bg-surface-variant/10 rounded-lg border border-dashed border-border-subtle/30">
                <Tiny className="text-text-tertiary">{emptyMessage}</Tiny>
            </div>
        );
    }

    if (isVirtualizationAvailable) {
        const vHeight = typeof maxHeight === 'number' ? Math.min(maxHeight, paginatedData.length * actualRowHeight) : 800; // Fallback for virtualization if string passed
        return (
            <div className={cn("flex flex-col w-full bg-surface-primary overflow-hidden", className)}>
                {!hideHeader && (
                    <div className="overflow-x-auto no-scrollbar scroll-sync-header" style={{ width: '100%' }}>
                        <div className="flex bg-surface sticky top-0 z-30 shadow-none border-none" style={{ width: 'max-content', minWidth: '100%' }}>
                            {effectiveColumns.map((column) => {
                                const isSorted = sortKey === (column.key as string);
                                return (
                                    <div
                                        key={column.key as string}
                                        onClick={() => column.sortable && onSort?.(column.key as string)}
                                        className={cn(
                                            "px-4 flex items-center flex-shrink-0 select-none transition-colors",
                                            "table-header",
                                            column.sortable && "cursor-pointer hover:bg-black/5 hover:text-text-primary",
                                            column.align === 'center' && 'justify-center',
                                            column.align === 'right' && 'justify-end'
                                        )}
                                        style={{
                                            width: column.width || '150px', // Default width for virtualization
                                            height: headerHeight
                                        }}
                                    >
                                        <div className="flex items-center gap-2">
                                            {column.key === "__selection__" ? (
                                                <Input
                                                    type="checkbox"
                                                    checked={data.length > 0 && data.every(d => selectedRows?.includes((d[keyField] as any)?.toString()))}
                                                    onChange={(e) => { e.stopPropagation(); handleSelectAll(); }}
                                                    className="w-4 h-4 rounded border-border text-primary focus:ring-ring cursor-pointer"
                                                />
                                            ) : (
                                                <span className="truncate">{column.label}</span>
                                            )}
                                            {column.sortable && (
                                                <div className={cn("transition-colors flex-shrink-0", isSorted ? "text-action-primary" : "text-text-quaternary")}>
                                                    {isSorted ? (
                                                        sortDirection === "asc" ? <ArrowUp size={12} strokeWidth={2} /> : <ArrowDown size={12} strokeWidth={2} />
                                                    ) : (
                                                        <ArrowUpDown size={12} />
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
                <div className="overflow-x-auto custom-scrollbar flex-1 relative">
                    <List
                        height={vHeight}
                        itemCount={paginatedData.length}
                        itemSize={actualRowHeight}
                        itemData={itemData}
                        className="custom-scrollbar"
                        width="100%"
                    >
                        {VirtualizedRow}
                    </List>
                </div>
                {page && pageSize && totalItems && onPageChange && (
                    <Pagination
                        currentPage={page}
                        totalPages={Math.ceil(totalItems / pageSize)}
                        pageSize={pageSize}
                        totalItems={totalItems}
                        onPageChange={onPageChange}
                        onPageSizeChange={onPageSizeChange || (() => { })}
                        className="border-t border-border-subtle/10"
                    />
                )}
            </div>
        );
    }

    return (
        <div
            className={cn("flex flex-col w-full bg-transparent relative", className)}
            style={{ maxHeight }}
        >
            {/* Soft Loading Overlay for Refetching (Smother transition) */}
            {loading && (
                <div className="absolute inset-0 z-50 bg-surface/30 backdrop-blur-[1px] flex items-center justify-center transition-all duration-300 pointer-events-none animate-in fade-in">
                    <div className="flex items-center gap-2 px-4 py-2 bg-surface shadow-lg rounded-full border border-border-default/30 scale-90 animate-in zoom-in slide-in-from-bottom-2">
                        <div className="animate-spin h-4 w-4 border-2 border-action-primary border-t-transparent rounded-full" />
                        <Tiny className="text-action-primary uppercase tracking-widest">Refreshing...</Tiny>
                    </div>
                </div>
            )}
            <div className="flex-1 relative w-full overflow-auto custom-scrollbar">
                <table className={cn("w-full border-collapse text-left table-fixed", density === 'compact' && "table-dense")}>
                    {!hideHeader && (
                        <thead className="sticky top-0 z-30 bg-surface shadow-none border-none">
                            <tr className="border-none">
                                {effectiveColumns.map((column) => {
                                    const isSorted = sortKey === (column.key as string);
                                    return (
                                        <th
                                            key={column.key as string}
                                            onClick={() => column.sortable && onSort?.(column.key as string)}
                                            className={cn(
                                                "select-none transition-colors table-header px-3 first:pl-8 last:pr-8",
                                                column.sortable && "cursor-pointer hover:bg-surface-secondary hover:text-text-primary",
                                                column.align === 'center' && 'text-center',
                                                column.align === 'right' && 'text-right'
                                            )}
                                            style={{
                                                width: column.width,
                                                height: headerHeight
                                            }}
                                        >
                                            <div className={cn(
                                                "flex items-center gap-2",
                                                column.align === 'center' && 'justify-center',
                                                column.align === 'right' && 'flex-row-reverse justify-start'
                                            )}>
                                                <div className="min-w-0 overflow-hidden">
                                                    {column.key === "__selection__" ? (
                                                        <Input
                                                            type="checkbox"
                                                            checked={data.length > 0 && data.every(d => selectedRows?.includes(String(d[keyField] ?? "")))}
                                                            onChange={(e) => { e.stopPropagation(); handleSelectAll(); }}
                                                            className="w-4 h-4 rounded border-border text-primary focus:ring-ring cursor-pointer"
                                                        />
                                                    ) : (
                                                        <Caption1 className="text-inherit truncate">
                                                            {column.label}
                                                        </Caption1>
                                                    )}
                                                </div>

                                                {column.sortable && (
                                                    <div className={cn("transition-colors shrink-0", isSorted ? "text-action-primary" : "text-text-primary/20", column.align === 'right' && "ml-0 mr-1")}>
                                                        {isSorted ? (
                                                            sortDirection === "asc" ? <ArrowUp size={10} strokeWidth={2} /> : <ArrowDown size={10} strokeWidth={2} />
                                                        ) : (
                                                            <ArrowUpDown size={10} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </th>
                                    );
                                })}
                            </tr>
                        </thead>
                    )}
                    <tbody className="bg-transparent">
                        {paginatedData.map((row, rowIndex) => {
                            const rowId = row[keyField] || rowIndex;
                            const isExpanded = renderSubRow && expandedRows.has(rowId);

                            return (
                                <React.Fragment key={rowId}>
                                    <tr
                                        onClick={() => {
                                            if (renderSubRow) {
                                                const newExpanded = new Set(expandedRows);
                                                if (newExpanded.has(rowId)) {
                                                    newExpanded.delete(rowId);
                                                    onRowExpand?.(row, false);
                                                } else {
                                                    newExpanded.add(rowId);
                                                    onRowExpand?.(row, true);
                                                }
                                                setExpandedRows(newExpanded);
                                            }
                                            onRowClick?.(row);
                                        }}
                                        className={cn(
                                            "transition-all duration-300 ease-out group relative",
                                            "cursor-pointer hover:bg-muted/30",
                                            selectedRows?.includes(String(row[keyField] ?? "")) && "bg-action-primary/5"
                                        )}
                                    >
                                        {effectiveColumns.map((column) => (
                                            <td
                                                key={`${column.key as string}-${rowIndex}`}
                                                className={cn(
                                                    "transition-colors px-3 first:pl-8 last:pr-8",
                                                    /* Use Semantic Text Classes or default to CSS inheritance */
                                                    column.isNumeric ? "table-cell-numeric text-right" : "table-cell-primary",
                                                    column.align === 'center' && 'text-center',
                                                    column.align === 'right' && 'text-right'
                                                )}
                                                style={{
                                                    width: column.width,
                                                    height: actualRowHeight
                                                }}
                                            >
                                                <div className={cn(
                                                    "flex items-center gap-2",
                                                    column.align === 'right' && 'justify-end',
                                                    column.align === 'center' && 'justify-center'
                                                )}>
                                                    {column.key === columns[0].key && renderSubRow && (
                                                        <div className="mr-1 text-text-quaternary">
                                                            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                                        </div>
                                                    )}
                                                    {column.icon && (
                                                        <div className="flex h-5 w-5 items-center justify-center rounded text-action-primary/60">
                                                            {column.icon}
                                                        </div>
                                                    )}
                                                    {column.render
                                                        ? column.render(row[column.key], row, rowIndex)
                                                        : (column.isNumeric ? <Accounting autoColor>{row[column.key]}</Accounting> : (row[column.key] ?? "-"))
                                                    }
                                                </div>
                                            </td>
                                        ))}
                                    </tr>
                                    {isExpanded && renderSubRow && (
                                        <tr className="bg-surface-sunken/40 border-none">
                                            <td colSpan={effectiveColumns.length} className={cn("p-0 border-none", no_subrow_padding ? "" : "px-12 py-4")}>
                                                <div className="animate-in fade-in slide-in-from-top-2 duration-200">
                                                    {renderSubRow(row)}
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            );
                        })}
                    </tbody>
                </table>
            </div>
            {page && pageSize && totalItems !== undefined && onPageChange && (totalItems > pageSize || pageSize > 10) && (
                <Pagination
                    currentPage={page}
                    totalPages={Math.ceil(totalItems / pageSize)}
                    pageSize={pageSize}
                    totalItems={totalItems}
                    onPageChange={onPageChange}
                    onPageSizeChange={onPageSizeChange || (() => { })}
                    className="border-none"
                />
            )}
        </div>
    );
});

DataTable.displayName = "DataTable";
