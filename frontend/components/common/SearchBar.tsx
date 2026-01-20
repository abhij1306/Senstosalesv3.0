import React, { useCallback, useState, useEffect } from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "./Input";
import { Button } from "./Button";

export interface SearchBarProps extends React.InputHTMLAttributes<HTMLInputElement> {
    value: string;
    onChange: (value: any) => void;
    placeholder?: string;
    className?: string;
    debounceMs?: number;
}

export const SearchBar = React.memo(({
    value,
    onChange,
    placeholder = "Search...",
    className,
    debounceMs = 400,
    ...props
}: SearchBarProps) => {
    const [localValue, setLocalValue] = useState(value);

    // Sync local value with prop value (e.g. on clear or external reset)
    useEffect(() => {
        setLocalValue(value);
    }, [value]);

    // Debounce effect
    useEffect(() => {
        const timer = setTimeout(() => {
            if (localValue !== value) {
                onChange(localValue);
            }
        }, debounceMs);

        return () => clearTimeout(timer);
    }, [localValue, onChange, value, debounceMs]);

    const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setLocalValue(e.target.value);
    }, []);

    const handleClear = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        setLocalValue("");
        onChange("");
    }, [onChange]);

    return (
        <div className={cn("relative flex items-center w-full group", className)}>
            <div className="absolute left-4 text-text-tertiary group-focus-within:text-action-primary transition-colors pointer-events-none z-10">
                <Search size={18} strokeWidth={2.5} />
            </div>
            <Input
                value={value}
                onChange={handleChange}
                placeholder={placeholder}
                className="pl-11 pr-10 h-11 w-full text-sm font-medium border-none bg-surface shadow-sm focus:shadow-md hover:shadow-md transition-all font-sans rounded-xl"
                {...props}
            />
            {value && (
                <Button
                    onClick={handleClear}
                    className="absolute right-3 p-1 rounded-full hover:bg-surface-sunken text-text-tertiary hover:text-text-secondary transition-all h-auto min-h-0 bg-transparent border-none shadow-none"
                    type="button"
                >
                    <X size={14} />
                </Button>
            )}
        </div>
    );
});

SearchBar.displayName = 'SearchBar';
