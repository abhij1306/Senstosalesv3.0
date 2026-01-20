import { HTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils';
import React from 'react';

// Utility Components
export const Title1 = forwardRef<HTMLHeadingElement, HTMLAttributes<HTMLHeadingElement>>(
    ({ className, ...props }, ref) => (
        <h1 ref={ref} className={cn('font-sans text-[21px] font-bold tracking-tight text-text-primary antialiased', className)} {...props} />
    )
);
Title1.displayName = 'Title1';

export const Title2 = forwardRef<HTMLHeadingElement, HTMLAttributes<HTMLHeadingElement>>(
    ({ className, ...props }, ref) => (
        <h2 ref={ref} className={cn('font-sans text-[19px] font-semibold tracking-tight text-text-primary antialiased', className)} {...props} />
    )
);
Title2.displayName = 'Title2';

export const Title3 = forwardRef<HTMLHeadingElement, HTMLAttributes<HTMLHeadingElement>>(
    ({ className, ...props }, ref) => (
        <h3 ref={ref} className={cn('font-sans text-[17px] font-bold text-text-primary tracking-tight antialiased', className)} {...props} />
    )
);
Title3.displayName = 'Title3';

export const Body = forwardRef<HTMLParagraphElement, HTMLAttributes<HTMLParagraphElement>>(
    ({ className, ...props }, ref) => (
        <p ref={ref} className={cn('font-sans text-sm text-text-secondary leading-relaxed antialiased', className)} {...props} />
    )
);
Body.displayName = 'Body';

export const Subhead = forwardRef<HTMLParagraphElement, HTMLAttributes<HTMLParagraphElement>>(
    ({ className, ...props }, ref) => (
        <p ref={ref} className={cn('font-sans text-xs uppercase tracking-widest text-text-tertiary font-medium antialiased', className)} {...props} />
    )
);
Subhead.displayName = 'Subhead';

/**
 * Caption1 - High importance utility (10px, Semibold, Moderate Tracking)
 * Primary use: Table Headers
 */
export const Caption1 = forwardRef<HTMLParagraphElement, HTMLAttributes<HTMLParagraphElement>>(
    ({ className, ...props }, ref) => (
        <p ref={ref} className={cn('font-sans text-xs uppercase tracking-[0.1em] text-text-tertiary font-normal antialiased', className)} {...props} />
    )
);
Caption1.displayName = 'Caption1';

/**
 * Caption2 - Low importance fine print (11px, Normal tracking)
 * Primary use: Small descriptions, timestamps
 */
export const Caption2 = forwardRef<HTMLParagraphElement, HTMLAttributes<HTMLParagraphElement>>(
    ({ className, ...props }, ref) => (
        <p ref={ref} className={cn('font-sans text-xs text-text-tertiary leading-normal antialiased', className)} {...props} />
    )
);
Caption2.displayName = 'Caption2';

/**
 * Micro - Smallest table labels/headers (9px, Semibold)
 */
export const Micro = forwardRef<HTMLSpanElement, HTMLAttributes<HTMLSpanElement>>(
    ({ className, ...props }, ref) => (
        <span ref={ref} className={cn('font-sans text-3xs font-normal uppercase tracking-wider text-text-tertiary/60 antialiased', className)} {...props} />
    )
);
Micro.displayName = 'Micro';

/**
 * Mini - Smallest technical data (9px, Medium)
 * Primary use: CAT/DRG badges, secondary technical indicators
 */
export const Mini = forwardRef<HTMLSpanElement, HTMLAttributes<HTMLSpanElement>>(
    ({ className, ...props }, ref) => (
        <span ref={ref} className={cn('font-sans text-3xs text-text-tertiary font-medium antialiased', className)} {...props} />
    )
);
Mini.displayName = 'Mini';

/**
 * Tiny - Compact indicators (9px, Bold)
 * Primary use: Smallest status badges or badges inside components
 */
export const Tiny = forwardRef<HTMLSpanElement, HTMLAttributes<HTMLSpanElement>>(
    ({ className, ...props }, ref) => (
        <span ref={ref} className={cn('font-sans text-3xs font-normal uppercase tracking-wider antialiased', className)} {...props} />
    )
);
Tiny.displayName = 'Tiny';

/**
 * Mono - Monospace technical data (13px)
 * Primary use: Reference numbers, item codes
 */
export const Mono = forwardRef<HTMLSpanElement, HTMLAttributes<HTMLSpanElement>>(
    ({ className, ...props }, ref) => (
        <span ref={ref} className={cn('font-mono text-sm tracking-tight text-text-primary antialiased', className)} {...props} />
    )
);
Mono.displayName = 'Mono';

/**
 * Accounting - Formatted numeric data with auto-coloring
 * Primary use: Currency, Quantities
 */
export interface AccountingProps extends React.HTMLAttributes<HTMLSpanElement> {
    isCurrency?: boolean;
    isNumeric?: boolean;
    autoColor?: boolean;
    currency?: string;
    locale?: string;
    value?: number;
}
export const Accounting = forwardRef<HTMLSpanElement, AccountingProps>(
    ({ className, isCurrency, isNumeric, autoColor, currency = 'INR', locale = 'en-IN', value, children, ...props }, ref) => {
        const content = children?.toString() || "";
        const isCode = content.startsWith('#') || content.includes('-') || (typeof children === 'string' && isNaN(parseFloat(content)));

        if (isCode && value === undefined) {
            return (
                <span ref={ref} className={cn('font-mono text-sm tracking-tight tabular-nums text-text-primary antialiased', className)} {...props}>
                    {children}
                </span>
            );
        }

        const numValue = value ?? (typeof children === 'number' ? children : parseFloat(content.replace(/[^0-9.-]+/g, "")));

        const colorClass = autoColor && !isNaN(numValue as number)
            ? (numValue as number) > 0
                ? 'text-status-success'
                : (numValue as number) < 0
                    ? 'text-status-error'
                    : 'text-text-tertiary'
            : 'text-text-primary';

        let displayValue: React.ReactNode = children;

        if (typeof children === 'number' && isNaN(children)) {
            displayValue = '-';
        } else if (numValue !== undefined && !isNaN(numValue as number)) {
            if (isCurrency || isNumeric || typeof children === 'number' || value !== undefined) {
                displayValue = new Intl.NumberFormat(locale, {
                    style: isCurrency ? 'currency' : 'decimal',
                    currency: isCurrency ? currency : undefined,
                    minimumFractionDigits: isCurrency ? 2 : 0,
                    maximumFractionDigits: 2,
                }).format(numValue as number);
            }
        }

        if (typeof displayValue === 'number' && isNaN(displayValue)) {
            displayValue = '-';
        }

        return (
            <span ref={ref} key={displayValue?.toString()} className={cn('font-mono text-sm tracking-tight tabular-nums antialiased', colorClass, className)} {...props}>
                {displayValue}
            </span>
        );
    }
);
Accounting.displayName = 'Accounting';

// Semantic ERP Components

/**
 * StandardLabel - Tonal ERP labels (11px, Medium)
 * Primary use: Metadata keys, Form labels
 */
export const StandardLabel = forwardRef<HTMLSpanElement, HTMLAttributes<HTMLSpanElement>>(
    ({ className, ...props }, ref) => (
        <span ref={ref} className={cn('font-sans text-xs font-medium uppercase tracking-[0.05em] text-text-tertiary antialiased', className)} {...props} />
    )
);
StandardLabel.displayName = 'StandardLabel';

/**
 * StandardValue - High contrast ERP values (13px, Semibold)
 * Primary use: Metadata values, Card body text
 */
export const StandardValue = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
    ({ className, ...props }, ref) => (
        <div ref={ref} className={cn('font-sans text-sm text-text-primary antialiased', className)} {...props} />
    )
);
StandardValue.displayName = 'StandardValue';

/**
 * MetricValue - Large display numbers for KPIs (22px)
 * Primary use: SummaryCard values
 */
export const MetricValue = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
    ({ className, ...props }, ref) => (
        <div ref={ref} className={cn('font-mono text-2xl font-bold tracking-tighter text-text-primary tabular-nums antialiased', className)} {...props} />
    )
);
MetricValue.displayName = 'MetricValue';

/**
 * TabLabel - Navigation and structural markers (11px)
 * Primary use: Tabs, Sidebar navigation, primary action labels
 */
export const TabLabel = forwardRef<HTMLSpanElement, HTMLAttributes<HTMLSpanElement>>(
    ({ className, ...props }, ref) => (
        <span ref={ref} className={cn('font-sans text-xs font-normal uppercase tracking-[0.15em] antialiased', className)} {...props} />
    )
);
TabLabel.displayName = 'TabLabel';

/**
 * TableTotal - Strong financial summary text (13px)
 * Primary use: Table footer totals, primary metric blocks
 */
export const TableTotal = forwardRef<HTMLSpanElement, HTMLAttributes<HTMLSpanElement>>(
    ({ className, ...props }, ref) => (
        <span ref={ref} className={cn('font-sans text-sm font-normal text-text-primary tracking-tight antialiased', className)} {...props} />
    )
);
TableTotal.displayName = 'TableTotal';

// Aliases for compatibility
export const MonoCode = Mono;
export const SmallText = Caption2;
export const Caption = Caption2;
