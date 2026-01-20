import React, { ButtonHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils';
import { Slot } from "@radix-ui/react-slot";
import { motion, HTMLMotionProps } from "framer-motion";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'tonal' | 'ghost' | 'destructive' | 'success' | 'warning' | 'info' | 'outline' | 'elevated' | 'clay';
    size?: 'sm' | 'md' | 'lg' | 'compact';
    asChild?: boolean;
    loading?: boolean;
    className?: string;
    children?: React.ReactNode;
}

// Map variants to specific premium light styles with WHITE font as per user request
// Map variants with Bootstrap-like gradients and reduced sizing
const variantStyles = {
    // Primary (Blue)
    primary: "bg-gradient-to-b from-[var(--btn-primary-from)] to-[var(--btn-primary-to)] text-white border border-[var(--btn-primary-border)] shadow-sm hover:bg-gradient-to-t",

    // Secondary/Default (Theme-Aware)
    secondary: "bg-surface text-text-primary border border-border-default/50 shadow-sm hover:bg-surface-secondary",

    // Tonal (Muted Container)
    tonal: "bg-surface-sunken/40 text-text-secondary border border-border-subtle shadow-none hover:bg-surface-sunken/60",

    // Success (Green)
    success: "bg-gradient-to-b from-[var(--btn-success-from)] to-[var(--btn-success-to)] text-white border border-[var(--btn-success-border)] shadow-sm hover:bg-gradient-to-t",

    // Destructive/Danger (Red)
    destructive: "bg-gradient-to-b from-[var(--btn-danger-from)] to-[var(--btn-danger-to)] text-white border border-[var(--btn-danger-border)] shadow-sm hover:bg-gradient-to-t",

    // Warning (Orange)
    warning: "bg-gradient-to-b from-[var(--btn-warning-from)] to-[var(--btn-warning-to)] text-white border border-[var(--btn-warning-border)] shadow-sm hover:bg-gradient-to-t",

    // Info (Cyan)
    info: "bg-gradient-to-b from-[var(--btn-info-from)] to-[var(--btn-info-to)] text-white border border-[var(--btn-info-border)] shadow-sm hover:bg-gradient-to-t",

    outline: "bg-transparent border border-action-primary/20 text-action-primary hover:bg-action-primary/5",
    elevated: "bg-surface text-text-primary shadow-sm border border-border-default hover:bg-surface/80",
    ghost: "bg-transparent text-text-tertiary hover:text-text-primary hover:bg-surface-secondary border-none shadow-none",
    clay: "clay text-action-primary font-bold border-none shadow-clay",
};

const sizeStyles = {
    // Reduced sizes across the board
    sm: "h-7 px-2 text-xs rounded-[4px]",
    md: "h-8 px-3 text-xs rounded-[4px]", // Standard reduced to h-8
    lg: "h-10 px-4 text-sm rounded-[4px]",
    compact: "h-6 px-2 text-[10px] font-bold rounded-[3px]",
};

export const Button = React.memo(forwardRef<HTMLButtonElement, ButtonProps>(
    ({ variant = 'primary', size = 'md', className, asChild = false, loading = false, children, ...props }, ref) => {

        const content = (
            <>
                {loading && (
                    <motion.span
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="mr-2"
                    >
                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                    </motion.span>
                )}
                <span className={cn(
                    "relative z-10 flex items-center gap-0.5 w-full h-full",
                    className?.includes('justify-between') ? 'justify-between' :
                        className?.includes('justify-start') ? 'justify-start' :
                            className?.includes('justify-end') ? 'justify-end' : 'justify-center'
                )}>
                    {children}
                </span>

                {/* Visual Depth/Gloss Overlay - Muted for dark mode fidelity */}
                {!loading && variant !== 'ghost' && variant !== 'outline' && (
                    <div className="absolute inset-0 bg-gradient-to-t from-black/5 to-black/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                )}
            </>
        );

        if (asChild) {
            return (
                <Slot
                    ref={ref}
                    className={cn(
                        "inline-flex items-center justify-center whitespace-nowrap transition-all group relative overflow-hidden font-[600]",
                        variantStyles[variant],
                        sizeStyles[size],
                        className
                    )}
                    {...props}
                >
                    {children}
                </Slot>
            );
        }

        return (
            <motion.button
                ref={ref}
                whileHover={{ scale: 1.02, y: -1 }}
                whileTap={{ scale: 0.97, y: 0 }}
                transition={{ type: "spring", stiffness: 400, damping: 15 }}
                className={cn(
                    "inline-flex items-center justify-center whitespace-nowrap transition-all group relative overflow-hidden font-semibold",
                    "disabled:opacity-40 disabled:pointer-events-none",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action-primary/30",
                    variantStyles[variant],
                    sizeStyles[size],
                    className
                )}
                {...props as any}
            >
                {content}
            </motion.button>
        );
    }
));

Button.displayName = 'Button';

