import React from 'react';
import { cn } from '@/lib/utils';
import { Caption1, Input } from '@/components/common';
import { Flex } from '@/components/common';

interface FieldGroupProps {
    label: string;
    value: string;
    onChange?: (val: string) => void;
    disabled?: boolean;
    isTextArea?: boolean;
    icon?: React.ReactNode;
    placeholder?: string;
    type?: string;
    tooltip?: string;
    error?: boolean;
    className?: string;
}

export const FieldGroup = React.memo(({
    label,
    value,
    onChange,
    disabled,
    isTextArea,
    icon,
    placeholder,
    type = "text",
    tooltip,
    error,
    className
}: FieldGroupProps) => {
    return (
        <div className={cn("space-y-1.5 min-w-0 group", className)}>
            <Flex align="center" justify="between" className="px-1">
                <div className="flex items-center gap-2">
                    <Caption1 className={cn(error && "text-status-error font-medium transition-colors")}>
                        {label}
                    </Caption1>
                    {tooltip && (
                        <div className="text-text-quaternary hover:text-text-tertiary cursor-help transition-colors" title={tooltip}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="12" cy="12" r="10" />
                                <path d="M12 16v-4M12 8h.01" />
                            </svg>
                        </div>
                    )}
                </div>
            </Flex>
            <div className="relative">
                {icon && (
                    <div className={cn(
                        "absolute left-3 top-[11px] transition-colors z-10 pointer-events-none",
                        error ? "text-status-error" : "text-text-quaternary group-focus-within:text-action-primary"
                    )}>
                        {React.isValidElement(icon)
                            ? React.cloneElement(icon as React.ReactElement<any>, { size: 18 })
                            : icon}
                    </div>
                )}
                {isTextArea ? (
                    <textarea
                        value={value}
                        onChange={(e) => onChange?.(e.target.value)}
                        disabled={disabled}
                        placeholder={placeholder}
                        className={cn(
                            "w-full px-4 py-3 min-h-[100px] rounded-xl border border-border-default bg-surface-sunken/60 font-medium text-text-primary focus:ring-2 focus:ring-action-primary/10 focus:border-action-primary outline-none transition-all resize-none placeholder:text-text-quaternary text-sm",
                            icon && "pl-11",
                            error && "border-status-error/50 ring-status-error/10",
                            disabled && "opacity-60 cursor-not-allowed bg-surface-sunken"
                        )}
                    />
                ) : (
                    <Input
                        value={value}
                        type={type}
                        onChange={(e) => onChange?.(e.target.value)}
                        disabled={disabled}
                        placeholder={placeholder}
                        error={error}
                        className={cn(
                            "h-11 font-medium bg-surface-sunken/60 border border-border-default transition-all rounded-xl focus:ring-2 focus:ring-action-primary/10 focus:border-action-primary placeholder:text-text-quaternary text-sm",
                            icon && "pl-11"
                        )}
                    />
                )}
            </div>
        </div>
    );
});

FieldGroup.displayName = 'FieldGroup';
