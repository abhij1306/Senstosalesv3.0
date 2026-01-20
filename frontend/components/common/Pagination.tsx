"use client";

import { Button, StandardLabel } from "@/components/common";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/common";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PaginationProps {
    currentPage: number;
    totalPages: number;
    pageSize: number;
    totalItems: number;
    onPageChange: (page: number) => void;
    onPageSizeChange: (size: number) => void;
    className?: string;
}

export function Pagination({
    currentPage,
    totalPages,
    pageSize,
    totalItems,
    onPageChange,
    onPageSizeChange,
    className,
}: PaginationProps) {
    const startItem = (currentPage - 1) * pageSize + 1;
    const endItem = Math.min(currentPage * pageSize, totalItems);

    return (
        <div className={cn('flex items-center justify-between px-4 py-3 bg-transparent transition-all duration-300 z-30', className)}>
            {/* Items count */}
            <StandardLabel className="font-[600] uppercase tracking-wider">
                Showing <span className="text-text-primary">{startItem}-{endItem}</span> of <span className="text-text-primary">{totalItems}</span>
            </StandardLabel>

            {/* Controls */}
            <div className="flex items-center gap-6">
                {/* Page size selector */}
                <div className="flex items-center gap-2">
                    <StandardLabel className="font-[600] uppercase tracking-wider">Rows per page</StandardLabel>
                    <Select
                        value={String(pageSize)}
                        onValueChange={(value) => onPageSizeChange(Number(value))}
                    >
                        <SelectTrigger className="w-[70px] h-8 bg-surface-secondary/50 border-border-default hover:border-action-primary/30 shadow-none min-h-0 text-text-primary">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-surface border-border">
                            <SelectItem value="10">10</SelectItem>
                            <SelectItem value="25">25</SelectItem>
                            <SelectItem value="50">50</SelectItem>
                            <SelectItem value="100">100</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {/* Page navigation */}
                <div className="flex items-center gap-2">
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-text-tertiary hover:text-text-primary hover:bg-surface-secondary/50"
                        onClick={() => onPageChange(1)}
                        disabled={currentPage === 1}
                    >
                        <ChevronsLeft size={14} />
                    </Button>

                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-text-tertiary hover:text-text-primary hover:bg-surface-secondary/50"
                        onClick={() => onPageChange(currentPage - 1)}
                        disabled={currentPage === 1}
                    >
                        <ChevronLeft size={14} />
                    </Button>

                    <StandardLabel className="font-[600] uppercase tracking-wider px-2 min-w-[80px] text-center text-[10px] text-text-tertiary">
                        Page <span className="text-text-primary">{currentPage}</span> / {totalPages}
                    </StandardLabel>

                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-text-tertiary hover:text-text-primary hover:bg-surface-secondary/50"
                        onClick={() => onPageChange(currentPage + 1)}
                        disabled={currentPage === totalPages}
                    >
                        <ChevronRight size={14} />
                    </Button>

                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-text-tertiary hover:text-text-primary hover:bg-surface-secondary/50"
                        onClick={() => onPageChange(totalPages)}
                        disabled={currentPage === totalPages}
                    >
                        <ChevronsRight size={14} />
                    </Button>
                </div>
            </div>
        </div>
    );
}
