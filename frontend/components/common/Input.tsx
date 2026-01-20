import React, { InputHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
    error?: boolean;
    variant?: 'default' | 'sunken';
}

export const Input = React.memo(forwardRef<HTMLInputElement, InputProps>(
    ({ error, variant = 'default', className, ...props }, ref) => {
        return React.createElement("input", {
            ref,
            className: cn(
                'h-12 w-full text-[14px] transition-all duration-300 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed',
                'rounded-xl px-4 py-2',

                variant === 'default' && [
                    'bg-surface-sunken/60',
                    'border border-border-default/40',
                    'placeholder:text-text-tertiary/60',
                    'hover:bg-surface-sunken/60 hover:shadow-sm',
                    'focus:bg-surface focus:shadow-md focus:border-action-primary/30 focus:ring-4 focus:ring-action-primary/5',
                    'text-text-primary',
                ],

                variant === 'sunken' && [
                    'bg-surface-sunken/80',
                    'border-transparent shadow-inner',
                    'placeholder:text-text-tertiary/40',
                    'focus:bg-surface-sunken focus:ring-2 focus:ring-action-primary/10',
                    'text-text-primary',
                ],

                // Error state
                error && [
                    'border-status-error ring-2 ring-status-error/10',
                    'focus:ring-status-error/30',
                    'text-status-error',
                ],

                className
            ),
            ...props
        });
    }
));

Input.displayName = 'Input';
