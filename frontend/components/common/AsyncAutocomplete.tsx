"use client";

import React, { useState, useEffect, useRef } from "react";
import { Loader2, Search, X } from "lucide-react";
import { Input } from "./Input";
import { Button } from "./Button";
import { cn } from "@/lib/utils";
import { useDebounce } from "@/hooks/useDebounce";

interface AsyncAutocompleteProps<T> {
    fetcher: (query: string) => Promise<T[]>;
    renderOption: (item: T) => React.ReactNode;
    getLabel: (item: T) => string;
    onSelect: (item: T) => void;
    placeholder?: string;
    className?: string;
    value?: string;
    onChange?: (val: string) => void;
}

export function AsyncAutocomplete<T>({
    fetcher,
    renderOption,
    getLabel,
    onSelect,
    placeholder = "Search...",
    className,
    value: controlledValue,
    onChange: controlledOnChange,
}: AsyncAutocompleteProps<T>) {
    const [localValue, setLocalValue] = useState(controlledValue || "");
    const [results, setResults] = useState<T[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);

    const query = controlledValue !== undefined ? controlledValue : localValue;
    const debouncedQuery = useDebounce(query, 300);

    useEffect(() => {
        if (controlledValue !== undefined) {
            setLocalValue(controlledValue);
        }
    }, [controlledValue]);

    useEffect(() => {
        if (!debouncedQuery || debouncedQuery.length < 2) {
            setResults([]);
            setIsOpen(false);
            return;
        }

        let active = true;
        const fetchResults = async () => {
            setIsLoading(true);
            try {
                const data = await fetcher(debouncedQuery);
                if (active) {
                    setResults(data);
                    setIsOpen(data.length > 0);
                }
            } catch (err) {
                console.error("Autocomplete fetch error", err);
            } finally {
                if (active) setIsLoading(false);
            }
        };

        fetchResults();
        return () => { active = false; };
    }, [debouncedQuery, fetcher]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setLocalValue(val);
        controlledOnChange?.(val);
        if (val.length === 0) {
            setIsOpen(false);
            setResults([]);
        }
    };

    const handleSelect = (item: T) => {
        const label = getLabel(item);
        setLocalValue(label);
        controlledOnChange?.(label);
        onSelect(item);
        setIsOpen(false);
    };

    const handleClear = () => {
        setLocalValue("");
        controlledOnChange?.("");
        setResults([]);
        setIsOpen(false);
    };

    return (
        <div ref={wrapperRef} className={cn("relative z-50", className)}>
            <div className="relative group">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-text-tertiary group-focus-within:text-action-primary transition-colors" />
                <Input
                    value={query}
                    onChange={handleChange}
                    placeholder={placeholder}
                    className="pl-9 pr-8"
                    onFocus={() => {
                        if (results.length > 0) setIsOpen(true);
                    }}
                />
                {isLoading && (
                    <div className="absolute right-3 top-2.5">
                        <Loader2 className="h-4 w-4 animate-spin text-action-primary" />
                    </div>
                )}
                {!isLoading && query && (
                    <Button
                        onClick={handleClear}
                        className="absolute right-3 top-2.5 text-text-tertiary hover:text-text-secondary h-auto p-0 min-h-0 bg-transparent border-none shadow-none hover:bg-transparent"
                    >
                        <X size={16} />
                    </Button>
                )}
            </div>

            {isOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-surface border border-border-default rounded-lg shadow-lg max-h-[300px] overflow-auto animate-in fade-in zoom-in-95 duration-100 p-1">
                    {results.map((item, idx) => (
                        <div
                            key={idx}
                            className="px-3 py-2 text-[13px] hover:bg-surface-sunken cursor-pointer rounded-md transition-colors"
                            onClick={() => handleSelect(item)}
                        >
                            {renderOption(item)}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
