"use client";

import { cn } from '@/lib/utils';
import React from 'react';

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
    variant?: 'success' | 'warning' | 'error' | 'info' | 'outline' | 'primary';
    size?: 'sm' | 'md' | 'lg';
    className?: string;
    children: React.ReactNode;
}

export const Badge = React.memo(({
    variant = 'primary',
    size = 'md',
    className,
    children,
    ...props
}: BadgeProps) => {
    return (
        <div
            className={cn(
                // Base styles
                'inline-flex items-center justify-center',
                'rounded-lg font-medium uppercase tracking-wider',
                'transition-all duration-150',

                // Size variants
                size === 'sm' && 'px-1.5 py-0.5 text-3xs',
                size === 'md' && 'px-2.5 py-0.5 text-2xs',
                size === 'lg' && 'px-3 py-1 text-xs',

                // Semantic variants - Enterprise Tonal containers
                variant === 'success' && [
                    'bg-status-success-container text-on-status-success',
                ],
                variant === 'warning' && [
                    'bg-status-warning-container text-on-status-warning',
                ],
                variant === 'error' && [
                    'bg-status-error-container text-on-status-error',
                ],
                variant === 'info' && [
                    'bg-status-info-container text-on-status-info',
                ],
                variant === 'primary' && [
                    'bg-action-primary-container text-action-primary',
                ],
                variant === 'outline' && [
                    'bg-transparent text-text-tertiary border border-border-default/20 font-semibold',
                ],

                className
            )}
            {...props}
        >
            {children}
        </div>
    );
});

Badge.displayName = 'Badge';
