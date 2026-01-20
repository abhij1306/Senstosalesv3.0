import React from "react";
import { StandardLabel, StandardValue, Accounting } from "./Typography";
import { FieldGroup } from "./FieldGroup";
import { cn } from "@/lib/utils";

export interface MetadataItemProps {
    label: string;
    value?: React.ReactNode | string | number | null;
    isCurrency?: boolean;
    editable?: boolean;
    onChange?: (v: any) => void;
    className?: string;
    type?: string;
    href?: string;
    disabled?: boolean;
}

export const MetadataItem = React.memo(function MetadataItem({
    label,
    value,
    isCurrency,
    editable,
    onChange,
    className,
    type = "text",
    href,
    disabled
}: MetadataItemProps) {
    if (editable || disabled) {
        return (
            <FieldGroup
                label={label}
                value={String(value || "")}
                onChange={onChange}
                placeholder={label}
                className={className}
                type={type}
                disabled={disabled}
            />
        );
    }

    const content = isCurrency ? (
        <Accounting isCurrency>{typeof value === 'number' ? value : parseFloat(String(value || 0))}</Accounting>
    ) : value;

    const displayElement = href && value ? (
        <a href={href} className="text-action-primary hover:underline transition-colors cursor-pointer decoration-action-primary/30">
            {content}
        </a>
    ) : content;

    return (
        <div className={cn("flex flex-col", className)}>
            <StandardLabel>{label}</StandardLabel>
            <StandardValue className="flex items-center gap-1">
                {displayElement}
            </StandardValue>
        </div>
    );
});
