"use client";
import React, { useState, useEffect, useRef, useCallback } from "react";
import { Search, Loader2, ChevronsUpDown, Check, X } from "lucide-react";
import { Caption2 } from "./Typography";
import { cn } from "@/lib/utils";
import { Input } from "./Input";
import { Button } from "./Button";

interface Option {
    value: string;
    label: string;
    subLabel?: string;
    metadata?: any;
}

interface AutocompleteProps {
    options: Option[];
    value?: string;
    onChange: (value: string, option?: Option) => void;
    placeholder?: string;
    loading?: boolean;
    onSearch?: (query: string) => void;
    className?: string;
    disabled?: boolean;
    defaultValue?: string;
}

export const Autocomplete = React.memo(({
    options,
    value,
    onChange,
    placeholder = "Select...",
    loading = false,
    onSearch,
    className,
    disabled = false,
}: AutocompleteProps) => {
    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState("");
    const wrapperRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Track if we should update query from value
    // We only update query from value if the user isn't actively typing (isOpen check helps)
    // or if the value changed externally.
    useEffect(() => {
        if (value) {
            const selected = options.find((opt) => opt.value === value);
            if (selected) {
                setQuery(selected.label);
            } else if (!isOpen) {
                // Only fallback to value if not open (prevent overwriting user typing if they are searching)
                // But wait, if user types "A", value is still old value until they select.
                // So this logic is tricky.
                // Better: Only reset query if value changes. 
                // But value relies on selection.
                // Let's stick to: if value is present, find match.
                // If no match found but value exists, show value? Or empty?
                // If filtered, match might not be in options.
            }
        } else {
            if (!isOpen) setQuery("");
        }
    }, [value, options, isOpen]);

    // Click outside handler
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
                // On blur without selection, should we reset query?
                // If value is set, reset to value label.
                if (value) {
                    const selected = options.find((opt) => opt.value === value);
                    if (selected) setQuery(selected.label);
                } else {
                    setQuery("");
                }
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [options, value]);

    const handleSelect = useCallback((option: Option) => {
        onChange(option.value, option);
        setQuery(option.label);
        setIsOpen(false);
    }, [onChange]);

    const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setQuery(val);
        setIsOpen(true);
        if (onSearch) {
            onSearch(val);
        }
    }, [onSearch]);

    const handleClear = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        setQuery("");
        onChange("");
        inputRef.current?.focus();
    }, [onChange]);

    return (
        <div ref={wrapperRef} className={cn("relative w-full", className)}>
            <div className="relative">
                <Input
                    ref={inputRef}
                    disabled={disabled}
                    value={query}
                    onChange={handleInputChange}
                    onFocus={() => setIsOpen(true)}
                    placeholder={placeholder}
                    className={cn(
                        "flex h-11 w-full rounded-2xl border border-transparent bg-surface-variant/30 px-3 pl-10 py-2 text-sm text-text-primary outline-none ring-offset-background placeholder:text-text-tertiary focus:bg-surface focus:ring-2 focus:ring-action-primary/20 disabled:cursor-not-allowed disabled:opacity-50 transition-all shadow-sm font-sans",
                        isOpen && "bg-surface ring-2 ring-action-primary/20"
                    )}
                />
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-text-tertiary pointer-events-none" />
                {loading && (
                    <div className="absolute right-3 top-2.5">
                        <Loader2 className="h-4 w-4 animate-spin text-action-primary" />
                    </div>
                )}
                {!loading && query && (
                    <Button
                        onClick={handleClear}
                        className="absolute right-3 top-2.5 hover:bg-surface-variant/50 rounded-full p-0.5 transition-colors h-auto min-h-0 bg-transparent border-none shadow-none"
                        type="button"
                    >
                        <X className="h-3 w-3 text-text-tertiary" />
                    </Button>
                )}
            </div>

            {isOpen && (
                <div className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-2xl border border-border bg-popover p-1 shadow-lg animate-in fade-in zoom-in-95 duration-100">
                    {options.length === 0 && !loading && (
                        <div className="py-6 text-center text-[11px] text-text-tertiary">
                            {query ? "No results found." : "Type to search..."}
                        </div>
                    )}
                    {options.map((option) => (
                        <div
                            key={option.value}
                            onClick={() => handleSelect(option)}
                            className={cn(
                                "relative flex cursor-pointer select-none items-center rounded-lg px-3 py-2 text-sm outline-none transition-colors hover:bg-action-primary/10 hover:text-action-primary",
                                value === option.value && "bg-action-primary/5 text-action-primary"
                            )}
                        >
                            <div className="flex flex-col gap-0.5">
                                <span className="font-medium text-text-primary">{option.label}</span>
                                {option.subLabel && (
                                    <Caption2 className="text-text-tertiary uppercase tracking-wider">{option.subLabel}</Caption2>
                                )}
                            </div>
                            {value === option.value && (
                                <Check className="ml-auto h-4 w-4" />
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
});

Autocomplete.displayName = 'Autocomplete';
