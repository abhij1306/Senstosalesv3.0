"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Search, FileText, Truck, ShoppingCart, ArrowRight, Loader2, Package, AlertCircle } from "lucide-react";
import * as Dialog from "@radix-ui/react-dialog";

import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { SearchResult } from "@/types";
import { Badge, Label, Accounting, Button, MonoCode, Input } from "./index";

export function GlobalSearch() {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<SearchResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const router = useRouter();
    const inputRef = useRef<HTMLInputElement>(null);

    // Toggle with Ctrl+K
    useEffect(() => {
        const down = (e: KeyboardEvent) => {
            if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                setOpen((open) => !open);
            }
        };
        document.addEventListener("keydown", down);
        return () => document.removeEventListener("keydown", down);
    }, []);

    // Reset selection when results change
    useEffect(() => {
        setSelectedIndex(0);
    }, [results]);

    // Handle Keyboard Navigation
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "ArrowDown") {
            e.preventDefault();
            setSelectedIndex((prev) => (prev + 1) % results.length);
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setSelectedIndex((prev) => (prev - 1 + results.length) % results.length);
        } else if (e.key === "Enter" && results[selectedIndex]) {
            handleSelect(results[selectedIndex]);
        }
    };

    // Debounced Search
    useEffect(() => {
        if (!query) {
            setResults([]);
            return;
        }

        const timer = setTimeout(async () => {
            setLoading(true);
            try {
                const res = await api.searchGlobal(query);
                setResults(res || []);
            } catch (error) {
                setResults([]);
            } finally {
                setLoading(false);
            }
        }, 150); // Faster debounce for snappier feel

        return () => clearTimeout(timer);
    }, [query]);

    const handleSelect = (result: SearchResult) => {
        setOpen(false);
        setQuery("");

        const type = result.type.toLowerCase();
        switch (type) {
            case "po":
                router.push(`/po/${result.id}`);
                break;
            case "dc":
                router.push(`/dc/${result.id}`);
                break;
            case "invoice":
                router.push(`/invoice/view/${result.id}`);
                break;
            case "srv":
                router.push(`/srv/${result.id}`);
                break;
            default:
                break;
        }
    };

    const selectedResult = results[selectedIndex];

    return (
        <>
            {/* Trigger Button */}
            <Button
                variant="outline"
                onClick={() => setOpen(true)}
                className="flex items-center w-full max-w-sm h-10 px-4 rounded-xl bg-surface shadow-sm text-text-tertiary hover:shadow-md hover:text-text-primary transition-all group justify-between border-none"
            >
                <div className="flex items-center">
                    <Search size={16} className="mr-3 text-text-tertiary group-hover:text-action-primary transition-colors" />
                    <span className="text-[11px] font-[500] uppercase tracking-wider">Fast Find...</span>
                </div>
                <kbd className="hidden sm:inline-flex h-6 items-center gap-1 rounded bg-surface-sunken px-2 font-mono text-[11px] font-[600] text-text-tertiary border border-border-default">
                    <span className="text-[11px]">⌘</span>K
                </kbd>
            </Button>

            <Dialog.Root open={open} onOpenChange={setOpen}>
                <Dialog.Portal>
                    <Dialog.Overlay className="fixed inset-0 bg-surface-overlay/20 backdrop-blur-sm z-50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
                    <Dialog.Content
                        onKeyDown={handleKeyDown}
                        className="fixed left-[50%] top-[15%] z-50 w-full max-w-4xl translate-x-[-50%] rounded-[2rem] bg-surface p-0 shadow-elevated border-none outline-none overflow-hidden ring-0"
                    >
                        <Dialog.Title className="sr-only">Quick Search</Dialog.Title>

                        {/* Search Input Bar */}
                        <div className="flex items-center border-b border-border-subtle px-6 py-4 bg-surface-sunken/50">
                            <Search className="mr-4 h-5 w-5 text-primary shrink-0" />
                            <Input
                                ref={inputRef}
                                autoFocus
                                className="flex h-10 w-full rounded-md bg-transparent py-4 text-[14px] font-[600] text-text-primary outline-none placeholder:text-text-tertiary/40 border-none shadow-none focus:ring-0 focus:bg-transparent hover:bg-transparent"
                                placeholder="Search POs, Challans, Invoices or SRVs..."
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                            />
                            {loading && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                            <div className="ml-4 flex items-center gap-1">
                                <kbd className="hidden sm:inline-flex h-6 items-center gap-1 rounded bg-surface/50 px-2 font-mono text-[11px] font-[500] text-text-tertiary">
                                    ESC
                                </kbd>
                            </div>
                        </div>

                        {/* Two Column Layout */}
                        <div className="flex h-[450px] divide-x divide-border-subtle">
                            {/* Left Column: Results List */}
                            <div className="w-1/3 overflow-y-auto p-2 space-y-1">
                                {!query && (
                                    <div className="py-20 px-6 text-center">
                                        <div className="w-12 h-12 rounded-2xl bg-surface-sunken flex items-center justify-center mx-auto mb-4">
                                            <Search className="text-text-quaternary" size={24} />
                                        </div>
                                        <p className="text-[11px] font-[500] text-text-quaternary uppercase tracking-widest">Type to search</p>
                                    </div>
                                )}

                                {query && results.length === 0 && !loading && (
                                    <div className="py-20 px-6 text-center">
                                        <p className="text-[11px] font-[500] text-text-quaternary uppercase tracking-widest">No entries found</p>
                                    </div>
                                )}

                                {results.map((result, idx) => (
                                    <Button
                                        key={`${result.type}-${result.id}-${idx}`}
                                        onMouseEnter={() => setSelectedIndex(idx)}
                                        onClick={() => handleSelect(result)}
                                        className={cn(
                                            "flex items-center gap-3 w-full p-3 rounded-xl transition-all text-left outline-none group h-auto",
                                            selectedIndex === idx ? "bg-action-primary text-white shadow-lg shadow-action-primary/20" : "hover:bg-surface-sunken text-text-secondary bg-transparent border-none shadow-none"
                                        )}
                                    >
                                        <div className={cn(
                                            "size-8 rounded-lg flex items-center justify-center shrink-0 border transition-colors",
                                            selectedIndex === idx ? "bg-white/20 border-white/10" : "bg-surface border-border-subtle"
                                        )}>
                                            <ResultIcon type={result.type} className={selectedIndex === idx ? "text-white" : "text-primary"} size={16} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className={cn("text-[11px] font-[500] truncate uppercase tracking-tight flex items-center gap-1.5", selectedIndex === idx ? "text-white" : "text-text-primary")}>
                                                {result.match_context ? (
                                                    <span>{result.match_context} <span className="opacity-70 font-[400] ml-1">• {result.title}</span></span>
                                                ) : (
                                                    result.title
                                                )}
                                                {result.has_deviations && (
                                                    <AlertCircle size={12} className={selectedIndex === idx ? "text-white" : "text-status-warning"} />
                                                )}
                                            </div>
                                            {/* Subtitle removed for all numbers as per user request */}
                                        </div>
                                    </Button>
                                ))}
                            </div>

                            {/* Right Column: Preview Pane */}
                            <div className="flex-1 bg-surface-sunken/30 overflow-hidden">
                                {selectedResult ? (
                                    <div className="p-8 h-full flex flex-col">
                                        <div className="flex items-start justify-between mb-8">
                                            <div>
                                                <Badge className="mb-3 px-2 py-0.5 rounded bg-primary/10 text-primary border-none text-[11px] font-[500] uppercase tracking-widest">
                                                    {selectedResult.type} Entity
                                                </Badge>
                                                <h2 className="text-2xl font-medium text-text-primary tracking-tight leading-none mb-2">
                                                    {selectedResult.title}
                                                </h2>
                                                <p className="text-sm font-medium text-text-tertiary">
                                                    {selectedResult.subtitle}
                                                </p>
                                                {selectedResult.has_deviations && (
                                                    <div className="mt-4 p-3 rounded-xl bg-status-warning/10 border border-status-warning/20 flex items-start gap-3">
                                                        <AlertCircle className="text-status-warning shrink-0" size={16} />
                                                        <div>
                                                            <p className="text-[11px] font-[600] text-status-warning uppercase tracking-wider leading-none mb-1">Discrepancy Detected</p>
                                                            <p className="text-[11px] text-text-tertiary font-[500] leading-tight">This document has unresolved quantity or linking deviations. Please review details on the document page.</p>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex flex-col items-end gap-2">
                                                <div className={cn(
                                                    "px-3 py-1 rounded-full text-[11px] font-[600] uppercase tracking-tight border",
                                                    selectedResult.status === "COMPLETED" ? "bg-status-success/10 text-status-success border-status-success/20" :
                                                        selectedResult.status === "PENDING" ? "bg-status-warning/10 text-status-warning border-status-warning/20" :
                                                            "bg-action-primary/10 text-action-primary border-action-primary/20"
                                                )}>
                                                    {selectedResult.status}
                                                </div>
                                                {selectedResult.type === "DC" && (
                                                    <div className="flex items-center gap-2 w-32">
                                                        <div className="flex-1 h-1.5 bg-surface-secondary rounded-full overflow-hidden">
                                                            <div className="h-full bg-primary transition-all duration-500" style={{ width: `${Math.min(100, ((selectedResult.total_qty || 0) / (selectedResult.total_ordered || 1)) * 100)}%` }} />
                                                        </div>
                                                        <span className="text-[11px] font-[500] text-text-tertiary">{Math.round(((selectedResult.total_qty || 0) / (selectedResult.total_ordered || 1)) * 100)}%</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Entity Specific Details */}
                                        {selectedResult.type === "PO" && (
                                            <div className="space-y-4 mb-8">
                                                <div className="grid grid-cols-3 gap-4">
                                                    <div className="bg-surface p-4 rounded-2xl border border-border-subtle shadow-sm">
                                                        <Label className="text-[11px] font-[600] text-text-tertiary uppercase tracking-wide mb-1 block">Line Items</Label>
                                                        <span className="text-[18px] font-[500] text-text-primary">{selectedResult.total_items || 0}</span>
                                                    </div>
                                                    <div className="bg-surface p-4 rounded-2xl border border-border-subtle shadow-sm">
                                                        <Label className="text-[11px] font-[600] text-text-tertiary uppercase tracking-wide mb-1 block">Total Qty</Label>
                                                        <span className="text-[18px] font-[500] text-text-primary">{selectedResult.total_qty || 0}</span>
                                                    </div>
                                                    <div className="bg-surface p-4 rounded-2xl border border-border-subtle shadow-sm">
                                                        <Label className="text-[11px] font-[600] text-text-tertiary uppercase tracking-wide mb-1 block">Total Value</Label>
                                                        <Accounting isCurrency className="text-[18px] font-[500] text-text-primary">{selectedResult.total_qty && (selectedResult as any).amount ? (selectedResult as any).amount : 0}</Accounting>
                                                    </div>
                                                </div>
                                                <div className="bg-surface p-4 rounded-2xl border border-border-subtle shadow-sm">
                                                    <Label className="text-[11px] font-[600] text-text-tertiary uppercase tracking-wide mb-2 block">Linked Documents</Label>
                                                    <div className="flex flex-wrap gap-2">
                                                        {((selectedResult as any).dc_numbers || []).slice(0, 3).map((dc: string) => (
                                                            <Button size="compact" variant="ghost" key={dc} onClick={() => { setOpen(false); router.push(`/dc/${dc}`); }} className="bg-status-warning/10 text-status-warning hover:bg-status-warning/20 border border-status-warning/20">DC #{dc}</Button>
                                                        ))}
                                                        {((selectedResult as any).invoice_numbers || []).slice(0, 3).map((inv: string) => (
                                                            <Button size="compact" variant="ghost" key={inv} onClick={() => { setOpen(false); router.push(`/invoice/${encodeURIComponent(inv)}`); }} className="bg-status-success/10 text-status-success hover:bg-status-success/20 border border-status-success/20">Invoice #{inv}</Button>
                                                        ))}
                                                        {((selectedResult as any).srv_numbers || []).slice(0, 3).map((srv: string) => (
                                                            <Button size="compact" variant="ghost" key={srv} onClick={() => { setOpen(false); router.push(`/srv/${encodeURIComponent(srv)}`); }} className="bg-action-primary/10 text-action-primary hover:bg-action-primary/20 border border-action-primary/20">SRV #{srv}</Button>
                                                        ))}
                                                        {!((selectedResult as any).dc_numbers?.length || (selectedResult as any).invoice_numbers?.length || (selectedResult as any).srv_numbers?.length) && (
                                                            <span className="text-[11px] text-text-quaternary">No linked documents</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {selectedResult.type === "DC" && (
                                            <div className="space-y-4 mb-8">
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="bg-surface p-4 rounded-2xl border border-border-subtle shadow-sm">
                                                        <Label className="text-[11px] font-[600] text-text-tertiary uppercase tracking-wide mb-1 block">Total Qty</Label>
                                                        <span className="text-[18px] font-[500] text-text-primary">{selectedResult.total_qty || 0}</span>
                                                    </div>
                                                    <div className="bg-surface p-4 rounded-2xl border border-border-subtle shadow-sm">
                                                        <Label className="text-[11px] font-[600] text-text-tertiary uppercase tracking-wide mb-1 block">Total Value</Label>
                                                        <Accounting isCurrency className="text-[18px] font-[500] text-text-primary">{(selectedResult as any).total_value || 0}</Accounting>
                                                    </div>
                                                </div>
                                                <div className="bg-surface p-4 rounded-2xl border border-border-subtle shadow-sm">
                                                    <Label className="text-[11px] font-[600] text-text-tertiary uppercase tracking-wide mb-2 block">Linked Documents</Label>
                                                    <div className="flex flex-wrap gap-2">
                                                        {(selectedResult as any).invoice_number && (
                                                            <Button size="compact" variant="ghost" onClick={() => { setOpen(false); router.push(`/invoice/${encodeURIComponent((selectedResult as any).invoice_number)}`); }} className="bg-status-success/10 text-status-success hover:bg-status-success/20 border border-status-success/20">Invoice #{(selectedResult as any).invoice_number}</Button>
                                                        )}
                                                        {((selectedResult as any).srv_numbers || []).slice(0, 3).map((srv: string) => (
                                                            <Button size="compact" variant="ghost" key={srv} onClick={() => { setOpen(false); router.push(`/srv/${encodeURIComponent(srv)}`); }} className="bg-action-primary/10 text-action-primary hover:bg-action-primary/20 border border-action-primary/20">SRV #{srv}</Button>
                                                        ))}
                                                        {selectedResult.po_number && (
                                                            <Button size="compact" variant="ghost" onClick={() => { setOpen(false); router.push(`/po/${selectedResult.po_number}`); }} className="bg-action-primary/10 text-action-primary hover:bg-action-primary/20 border border-action-primary/20">PO #{selectedResult.po_number}</Button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Invoice Preview */}
                                        {selectedResult.type === "Invoice" && (
                                            <div className="space-y-4 mb-8">
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="bg-surface p-4 rounded-2xl border border-border-subtle shadow-sm">
                                                        <Label className="text-[11px] font-[600] text-text-tertiary uppercase tracking-wide mb-1 block">Total Qty</Label>
                                                        <span className="text-[18px] font-[500] text-text-primary">{selectedResult.total_qty || 0}</span>
                                                    </div>
                                                    <div className="bg-surface p-4 rounded-2xl border border-border-subtle shadow-sm">
                                                        <Label className="text-[11px] font-[600] text-text-tertiary uppercase tracking-wide mb-1 block">Invoice Value</Label>
                                                        <Accounting isCurrency className="text-[18px] font-[500] text-text-primary">{(selectedResult as any).total_value || 0}</Accounting>
                                                    </div>
                                                </div>
                                                <div className="bg-surface p-4 rounded-2xl border border-border-subtle shadow-sm">
                                                    <Label className="text-[11px] font-[600] text-text-tertiary uppercase tracking-wide mb-2 block">Linked Documents</Label>
                                                    <div className="flex flex-wrap gap-2">
                                                        {(selectedResult as any).dc_number && (
                                                            <Button size="compact" variant="ghost" onClick={() => { setOpen(false); router.push(`/dc/${(selectedResult as any).dc_number}`); }} className="bg-status-warning/10 text-status-warning hover:bg-status-warning/20 border border-status-warning/20">DC #{(selectedResult as any).dc_number}</Button>
                                                        )}
                                                        {(selectedResult as any).po_number && (
                                                            <Button size="compact" variant="ghost" onClick={() => { setOpen(false); router.push(`/po/${(selectedResult as any).po_number}`); }} className="bg-action-primary/10 text-action-primary hover:bg-action-primary/20 border border-action-primary/20">PO #{(selectedResult as any).po_number}</Button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* SRV Preview */}
                                        {selectedResult.type === "SRV" && (
                                            <div className="space-y-4 mb-8">
                                                <div className="grid grid-cols-3 gap-3">
                                                    <div className="bg-surface p-4 rounded-2xl border border-border-subtle shadow-sm">
                                                        <Label className="text-[11px] font-[600] text-text-tertiary uppercase tracking-wide mb-1 block">Ordered</Label>
                                                        <span className="text-[18px] font-[500] text-text-primary">{(selectedResult as any).ordered_qty || 0}</span>
                                                    </div>
                                                    <div className="bg-surface p-4 rounded-2xl border border-border-subtle shadow-sm">
                                                        <Label className="text-[11px] font-[600] text-status-success uppercase tracking-wide mb-1 block">Accepted</Label>
                                                        <span className="text-[18px] font-[500] text-status-success">{(selectedResult as any).accepted_qty || 0}</span>
                                                    </div>
                                                    <div className="bg-surface p-4 rounded-2xl border border-border-subtle shadow-sm">
                                                        <Label className="text-[11px] font-[600] text-status-error uppercase tracking-wide mb-1 block">Rejected</Label>
                                                        <span className="text-[18px] font-[500] text-status-error">{(selectedResult as any).rejected_qty || 0}</span>
                                                    </div>
                                                </div>
                                                <div className="bg-surface p-4 rounded-2xl border border-border-subtle shadow-sm">
                                                    <Label className="text-[11px] font-[600] text-text-tertiary uppercase tracking-wide mb-2 block">Linked Documents</Label>
                                                    <div className="flex flex-wrap gap-2">
                                                        {(selectedResult as any).invoice_number && (
                                                            (selectedResult as any).invoice_exists ? (
                                                                <Button size="compact" variant="ghost" onClick={() => { setOpen(false); router.push(`/invoice/${encodeURIComponent((selectedResult as any).invoice_number)}`); }} className="bg-status-success/10 text-status-success hover:bg-status-success/20 border border-status-success/20">Invoice #{(selectedResult as any).invoice_number}</Button>
                                                            ) : (
                                                                <span className="px-2 py-1 rounded-lg bg-surface-sunken text-text-tertiary text-[11px] font-[600] border border-border-default">Invoice #{(selectedResult as any).invoice_number}</span>
                                                            )
                                                        )}
                                                        {(selectedResult as any).dc_number && (
                                                            (selectedResult as any).dc_exists ? (
                                                                <Button size="compact" variant="ghost" onClick={() => { setOpen(false); router.push(`/dc/${(selectedResult as any).dc_number}`); }} className="bg-status-warning/10 text-status-warning hover:bg-status-warning/20 border border-status-warning/20">DC #{(selectedResult as any).dc_number}</Button>
                                                            ) : (
                                                                <span className="px-2 py-1 rounded-lg bg-surface-sunken text-text-tertiary text-[11px] font-[600] border border-border-default">DC #{(selectedResult as any).dc_number}</span>
                                                            )
                                                        )}
                                                        {(selectedResult as any).po_number && (
                                                            (selectedResult as any).po_exists ? (
                                                                <Button size="compact" variant="ghost" onClick={() => { setOpen(false); router.push(`/po/${(selectedResult as any).po_number}`); }} className="bg-action-primary/10 text-action-primary hover:bg-action-primary/20 border border-action-primary/20">PO #{(selectedResult as any).po_number}</Button>
                                                            ) : (
                                                                <span className="px-2 py-1 rounded-lg bg-surface-sunken text-text-tertiary text-[11px] font-[600] border border-border-default">PO #{(selectedResult as any).po_number}</span>
                                                            )
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        <div className="mt-auto flex items-center justify-between pt-6 border-t border-border-subtle">
                                            <p className="text-[11px] font-[500] text-text-tertiary">
                                                Press Enter to jump to this record
                                            </p>
                                            <Button
                                                size="sm"
                                                onClick={() => handleSelect(selectedResult)}
                                                className="rounded-xl px-4 font-[500] text-[11px] border-none"
                                                variant="primary"
                                            >
                                                View Details <ArrowRight size={14} className="ml-2" />
                                            </Button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="h-full flex flex-col items-center justify-center p-12 text-center opacity-30">
                                        <div className="w-20 h-20 rounded-full bg-surface-secondary flex items-center justify-center mb-6">
                                            <FileText size={40} className="text-text-quaternary" />
                                        </div>
                                        <h3 className="text-[16px] font-[500] text-text-tertiary uppercase tracking-tight mb-2">Detailed Context</h3>
                                        <p className="text-[11px] font-[500] text-text-tertiary max-w-[200px]">
                                            Review entity metadata before jumping into the records.
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Keyboard Shortcuts Help */}
                        <div className="border-t border-border-subtle bg-surface px-6 py-3 text-[11px] text-text-tertiary flex justify-between font-[500]">
                            <div className="flex items-center gap-4">
                                <span><kbd className="bg-surface-secondary px-1 rounded mr-1">↑↓</kbd> Navigate</span>
                                <span><kbd className="bg-surface-secondary px-1 rounded mr-1">↵</kbd> Select</span>
                                <span><kbd className="bg-surface-secondary px-1 rounded mr-1">ESC</kbd> Close</span>
                            </div>
                            <span className="uppercase tracking-widest opacity-60">SenstoSales Intelligence</span>
                        </div>
                    </Dialog.Content>
                </Dialog.Portal>
            </Dialog.Root >
        </>
    );
}

function ResultIcon({ type, className, size = 16 }: { type: string, className?: string, size?: number }) {
    switch (type.toLowerCase()) {
        case "po": return <ShoppingCart className={className} size={size} />;
        case "dc": return <Truck className={className} size={size} />;
        case "invoice": return <FileText className={className} size={size} />;
        case "srv": return <Package className={className} size={size} />;
        default: return <FileText className={className} size={size} />;
    }
}
