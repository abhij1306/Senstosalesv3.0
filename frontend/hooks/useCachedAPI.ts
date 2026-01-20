"use client";

import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api";

/**
 * useCachedAPI Hook
 * Simple SWR-like revalidation hook for client-side data fetching
 */
export function useCachedAPI<T>(endpoint: string, interval = 30000) {
    const [data, setData] = useState<T | null>(null);
    const [error, setError] = useState<Error | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let active = true;

        const fetchData = async () => {
            // Only fetch if document is visible
            if (document.hidden) return;

            try {
                const result = await apiFetch<T>(endpoint);
                if (active) {
                    setData(result);
                    setLoading(false);
                }
            } catch (err) {
                if (active) {
                    setError(err as Error);
                    setLoading(false);
                }
            }
        };

        fetchData();
        const timer = setInterval(fetchData, interval);

        // Pause when tab hidden
        const handleVisibilityChange = () => {
            if (!document.hidden) fetchData();
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            active = false;
            clearInterval(timer);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [endpoint, interval]);

    return { data, error, loading };
}
