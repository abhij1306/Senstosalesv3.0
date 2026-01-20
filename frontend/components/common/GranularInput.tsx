"use client";

import React, { useEffect, useState } from "react";
import { Input, type InputProps } from "./Input";
import { cn } from "@/lib/utils";

interface GranularInputProps extends Omit<InputProps, "value" | "onChange"> {
    value: string | number;
    onUpdate: (val: any) => void;
    max?: number;
    min?: number;
    realTime?: boolean;
}

/**
 * GranularInput - A performant input that only commits changes to the store on blur or Enter key.
 * Prevents expensive re-renders on every keystroke in large forms or tables.
 */
export const GranularInput = React.memo(function GranularInput({
    value,
    onUpdate,
    className,
    type = "text",
    max,
    min,
    realTime = false,
    ...props
}: GranularInputProps) {
    const [localValue, setLocalValue] = useState(String(value ?? ""));

    useEffect(() => {
        setLocalValue(String(value ?? ""));
    }, [value]);

    const handleCommit = () => {
        let finalValue = type === "number" ? parseFloat(localValue) || 0 : localValue;

        if (type === "number") {
            // 1. Clamp to min (0) if usually implied, or standard logic
            // (User asked for no -1, so let's enforce min 0 if it's a number, or rely on min prop?)
            // Let's assume standard number input behavior or just min/max props
            // Actually, the user specifically hated -1, so let's enforce non-negative if it's a number type implies quantity.
            // But for generic usage, let's look for min/max.

            if (max !== undefined && (finalValue as number) > max) {
                finalValue = max;
            }
            // Implicit min 0 for our use case, or respect min prop? Props has ...props
            // inspecting props for min might be tricky if it's in ...props
            // But let's just do the max clamping here as requested.
        }

        if (String(localValue) !== String(value ?? "") || (type === "number" && max !== undefined && (parseFloat(localValue) > max))) {
            onUpdate(finalValue);
            setLocalValue(String(finalValue)); // Update local display to clamped value
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let val = e.target.value;

        // For number type, immediately enforce min/max constraints
        if (type === "number" && val !== "") {
            let numVal = parseFloat(val);
            if (!isNaN(numVal)) {
                // Clamp to max immediately
                if (max !== undefined && numVal > max) {
                    numVal = max;
                    val = String(max);
                }
                // Clamp to min immediately
                if (min !== undefined && numVal < min) {
                    numVal = min;
                    val = String(min);
                }

                // Update display with clamped value
                setLocalValue(val);

                if (realTime && onUpdate) {
                    onUpdate(numVal);
                }
            } else {
                // If not a valid number, still update local but don't propagate
                setLocalValue(val);
            }
        } else {
            setLocalValue(val);
            if (realTime && onUpdate) {
                onUpdate(val);
            }
        }
    };

    return (
        <Input
            {...props}
            type={type}
            value={type === "number" && localValue === "0" ? "" : localValue}
            onChange={handleChange}
            onFocus={(e) => e.target.select()}
            onBlur={handleCommit}
            onKeyDown={(e) => {
                if (e.key === "Enter") handleCommit();
            }}
            className={cn("h-8 px-2 text-sm transition-all", className)}
        />
    );
});

GranularInput.displayName = "GranularInput";
