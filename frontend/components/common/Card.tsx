"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { Slot } from "@radix-ui/react-slot";

/**
 * Card Atom - Semantic Design System
 * Uses CSS utility classes from utilities.css
 */

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
    variant?: 'elevated' | 'glass' | 'glass-elevated' | 'muted' | 'flat' | 'outlined';
    padding?: 'none' | 'sm' | 'md' | 'lg' | 'xl';
    onClick?: () => void;
    asChild?: boolean;
}

const variantClasses = {
    elevated: 'bg-surface shadow-tahoe-elevated rounded-2xl',
    glass: 'glass rounded-2xl shadow-glass',
    'glass-elevated': 'glass-elevated rounded-[2.5rem] shadow-glass border-none',
    muted: 'bg-surface-sunken/40 rounded-2xl shadow-inner',
    flat: 'bg-surface-sunken/40 rounded-2xl',
    outlined: 'bg-surface rounded-2xl shadow-sm border border-border-default/10',
};

const paddingClasses = {
    none: '',
    sm: 'p-3',
    md: 'p-4',
    lg: 'p-6',
    xl: 'p-8',
};

const CardInternal = React.forwardRef<HTMLDivElement, CardProps>(
    ({ className, variant = 'elevated', padding = 'md', asChild = false, children, onClick, ...props }, ref) => {
        const Comp = asChild ? Slot : "div";
        return (
            <Comp
                ref={ref}
                className={cn(
                    variantClasses[variant],
                    paddingClasses[padding],
                    onClick && "cursor-pointer active:scale-[0.99]",
                    "transition-all duration-200",
                    className
                )}
                onClick={onClick}
                {...props}
            >
                {children}
            </Comp>
        );
    }
);

CardInternal.displayName = "Card";

export const Card = React.memo(CardInternal);

