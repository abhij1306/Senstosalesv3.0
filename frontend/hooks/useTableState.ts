import { useCallback, useEffect, useState, useMemo } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';

interface TableState {
    page: number;
    limit: number;
    sortBy: string;
    sortOrder: 'asc' | 'desc';
    search: string;
}

interface UseTableStateOptions {
    defaultLimit?: number;
    defaultSortBy?: string;
    defaultSortOrder?: 'asc' | 'desc';
    syncUrl?: boolean;
}

export function useTableState(options: UseTableStateOptions = {}) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const {
        defaultLimit = 100,
        defaultSortBy = 'created_at',
        defaultSortOrder = 'desc',
        syncUrl = true,
    } = options;

    // Initialize state from URL or defaults
    const getInitialState = (): TableState => {
        if (!syncUrl) {
            return {
                page: 1,
                limit: defaultLimit,
                sortBy: defaultSortBy,
                sortOrder: defaultSortOrder,
                search: '',
            };
        }

        return {
            page: Number(searchParams.get('page')) || 1,
            limit: Number(searchParams.get('limit')) || defaultLimit,
            sortBy: searchParams.get('sortBy') || defaultSortBy,
            sortOrder: (searchParams.get('sortOrder') as 'asc' | 'desc') || defaultSortOrder,
            search: searchParams.get('search') || '',
        };
    };

    const [state, setState] = useState<TableState>(getInitialState);
    const [isInitialLoading, setIsInitialLoading] = useState(true);
    const [isTransitioning, setIsTransitioning] = useState(false);

    // Sync state with URL when it changes
    useEffect(() => {
        if (!syncUrl) {
            if (isInitialLoading) setIsInitialLoading(false);
            return;
        }

        const timeoutId = setTimeout(() => {
            const currentParams = new URLSearchParams(searchParams.toString());
            const nextParams = new URLSearchParams(searchParams.toString());

            const updateParam = (key: string, value: string | number) => {
                const next = String(value);
                const isDefault = !next ||
                    next === 'undefined' ||
                    (key === 'page' && next === '1') ||
                    (key === 'limit' && next === String(defaultLimit)) ||
                    (key === 'search' && next === '');

                if (isDefault) {
                    nextParams.delete(key);
                } else {
                    nextParams.set(key, next);
                }
            };

            updateParam('page', state.page);
            updateParam('limit', state.limit);
            updateParam('sortBy', state.sortBy);
            updateParam('sortOrder', state.sortOrder);
            updateParam('search', state.search);

            if (nextParams.toString() !== currentParams.toString()) {
                const query = nextParams.toString();
                router.replace(`${pathname}${query ? `?${query}` : ''}`, { scroll: false });
            }

            // Initialization and transition cleanup
            setIsInitialLoading(false);
            setIsTransitioning(false);
        }, 300);

        return () => clearTimeout(timeoutId);
    }, [state, pathname, router, searchParams, syncUrl, defaultLimit]);

    // Actions - with immediate transition state
    const setPage = useCallback((page: number) => {
        setState((prev) => {
            if (prev.page === page) return prev;
            setIsTransitioning(true);
            return { ...prev, page };
        });
    }, []);

    const setLimit = useCallback((newLimit: number) => {
        setState((prev) => {
            if (prev.limit === newLimit) return prev;
            setIsTransitioning(true);
            const itemIndex = (prev.page - 1) * prev.limit;
            const newPage = Math.floor(itemIndex / newLimit) + 1;

            return {
                ...prev,
                limit: newLimit,
                page: newPage || 1,
            };
        });
    }, []);

    const setSort = useCallback((sortBy: string, sortOrder?: 'asc' | 'desc') => {
        setState((prev) => {
            let nextOrder = sortOrder;
            if (!nextOrder) {
                if (prev.sortBy === sortBy) {
                    nextOrder = prev.sortOrder === 'asc' ? 'desc' : 'asc';
                } else {
                    nextOrder = 'desc';
                }
            }
            if (prev.sortBy === sortBy && prev.sortOrder === nextOrder) return prev;
            setIsTransitioning(true);
            return {
                ...prev,
                sortBy,
                sortOrder: nextOrder,
            };
        });
    }, []);

    const setSearch = useCallback((search: string) => {
        setState((prev) => {
            if (prev.search === search) return prev;
            setIsTransitioning(true);
            return {
                ...prev,
                search,
                page: 1,
            };
        });
    }, []);

    const reset = useCallback(() => {
        setState({
            page: 1,
            limit: defaultLimit,
            sortBy: defaultSortBy,
            sortOrder: defaultSortOrder,
            search: '',
        });
    }, [defaultLimit, defaultSortBy, defaultSortOrder]);

    // Memoize the entire hook return to prevent unnecessary re-renders in consumer components
    return useMemo(() => ({
        ...state,
        setPage,
        setLimit,
        setSort,
        setSearch,
        reset,
        isInitialLoading,
        isTransitioning,
        offset: (state.page - 1) * state.limit,
    }), [
        state,
        setPage,
        setLimit,
        setSort,
        setSearch,
        reset,
        isInitialLoading,
        isTransitioning
    ]);
}
