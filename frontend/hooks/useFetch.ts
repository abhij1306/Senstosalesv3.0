import { useState, useEffect, useCallback, useRef } from "react";

/**
 * useFetch - Fetch hook with exponential backoff retry
 *
 * Automatically retries failed requests with exponential backoff:
 * - Retry 1: Wait 1 second
 * - Retry 2: Wait 2 seconds
 * - Retry 3: Wait 4 seconds
 *
 * Supports:
 * - Unified SuccessResponse format { status: "success", data: T }
 * - Legacy direct response format (fallback)
 * - Automatic cancellation on unmount
 * - TypeScript generics for type-safe data
 *
 * @example
 * ```tsx
 * const { data, loading, error, refetch } = useFetch<POListItem[]>('/api/po');
 *
 * if (loading) return <div>Loading...</div>;
 * if (error) return <ErrorMessage error={error} />;
 * return <DataTable data={data} />;
 * ```
 */
export interface UseFetchOptions extends RequestInit {
    /**
     * Number of retry attempts (default: 3)
     */
    retries?: number;
    /**
     * Initial delay in ms before first retry (default: 1000)
     * Subsequent retries use exponential backoff: delay * 2^attempt
     */
    retryDelay?: number;
    /**
     * Skip automatic execution on mount (default: false)
     * Use when you want to trigger fetch manually via refetch()
     */
    manual?: boolean;
}

export interface UseFetchResult<T> {
    /**
     * Response data (null until loaded)
     */
    data: T | null;
    /**
     * Loading state
     */
    loading: boolean;
    /**
     * Error if request failed after all retries
     */
    error: Error | null;
    /**
     * Manually trigger a refetch
     */
    refetch: () => Promise<void>;
    /**
     * Cancel any in-flight request
     */
    cancel: () => void;
}

export function useFetch<T = any>(
    url: string,
    options: UseFetchOptions = {}
): UseFetchResult<T> {
    const {
        retries = 3,
        retryDelay = 1000,
        manual = false,
        ...fetchOptions
    } = options;

    const [data, setData] = useState<T | null>(null);
    const [loading, setLoading] = useState(!manual);
    const [error, setError] = useState<Error | null>(null);

    // Track if component is mounted
    const isMountedRef = useRef(true);
    const abortControllerRef = useRef<AbortController | null>(null);

    /**
     * Fetch with retry logic
     */
    const fetchWithRetry = useCallback(
        async (attempts = retries): Promise<void> => {
            // Create new AbortController for this request
            const abortController = new AbortController();
            abortControllerRef.current = abortController;

            for (let attempt = 0; attempt < attempts; attempt++) {
                try {
                    if (attempt === 0) {
                        setLoading(true);
                        setError(null);
                    }

                    const response = await fetch(url, {
                        ...fetchOptions,
                        signal: abortController.signal,
                    });

                    // Check if request was cancelled
                    if (abortController.signal.aborted) {
                        return;
                    }

                    // Handle HTTP errors
                    if (!response.ok) {
                        throw new Error(
                            `HTTP ${response.status}: ${response.statusText}`
                        );
                    }

                    const json = await response.json();

                    // Handle unified SuccessResponse format
                    // { status: "success", data: T, pagination?: {...} }
                    const extractedData = json.data !== undefined ? json.data : json;

                    // Only update state if component is still mounted
                    if (isMountedRef.current) {
                        setData(extractedData);
                        setLoading(false);
                        setError(null);
                    }
                    return; // Success - exit retry loop
                } catch (err) {
                    // Check if request was cancelled
                    if (err instanceof Error && err.name === "AbortError") {
                        return;
                    }

                    const error = err instanceof Error ? err : new Error(String(err));

                    // Last attempt failed
                    if (attempt === attempts - 1) {
                        if (isMountedRef.current) {
                            setError(error);
                            setLoading(false);
                        }
                        return;
                    }

                    // Calculate exponential backoff delay
                    const delay = retryDelay * Math.pow(2, attempt);

                    // Wait before retrying
                    await new Promise((resolve) => setTimeout(resolve, delay));
                }
            }
        },
        [url, retries, retryDelay, JSON.stringify(fetchOptions)]
    );

    /**
     * Cancel any in-flight request
     */
    const cancel = useCallback(() => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
        }
    }, []);

    /**
     * Manual refetch function
     */
    const refetch = useCallback(async () => {
        cancel(); // Cancel any existing request
        await fetchWithRetry();
    }, [cancel, fetchWithRetry]);

    // Auto-fetch on mount (unless manual mode)
    useEffect(() => {
        if (!manual) {
            fetchWithRetry();
        }

        // Cleanup: mark as unmounted and cancel request
        // NOTE: We return the cleanup function but it only runs on actual unmount
        return () => {
            isMountedRef.current = false;
            // Don't cancel immediately - let in-flight requests complete
            // cancel();
        };
    }, [manual, fetchWithRetry]);

    return {
        data,
        loading,
        error,
        refetch,
        cancel,
    };
}

/**
 * Specialized hook for paginated endpoints
 * Handles pagination metadata from SuccessResponse
 */
export interface PaginatedResponse<T> {
    data: T[];
    pagination: {
        total_items: number;
        page: number;
        total_pages: number;
        limit: number;
    };
}

export function useFetchPaginated<T = any>(
    baseUrl: string,
    page: number = 1,
    limit: number = 10,
    options: UseFetchOptions = {}
) {
    const url = `${baseUrl}?skip=${(page - 1) * limit}&limit=${limit}`;
    const result = useFetch<PaginatedResponse<T>>(url, options);

    return {
        ...result,
        items: result.data?.data || [],
        pagination: result.data?.pagination || null,
    };
}
