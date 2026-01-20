"use client";

import { useState, useEffect } from "react";

/**
 * useDebounce Hook - Performance Optimization
 * Delays value updates by specified delay to prevent excessive re-renders
 * Use for search inputs, form fields, or any rapidly changing state
 *
 * @param value - The value to debounce
 * @param delay - Delay in milliseconds (default: 300ms for UX best practice)
 * @returns Debounced value
 */
export const useDebounce = <T>(value: T, delay: number = 300): T => {
    const [debouncedValue, setDebouncedValue] = useState<T>(value);

    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);

        return () => {
            clearTimeout(handler);
        };
    }, [value, delay]);

    return debouncedValue;
};

// Alias for backward compatibility
export const useDebouncedValue = useDebounce;
