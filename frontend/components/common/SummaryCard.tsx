import React from "react";
import { cn } from "@/lib/utils";
import { Mini, StandardLabel, MetricValue, Caption1 } from "@/components/common/Typography";
import { Card } from "@/components/common/Card";

export interface SummaryCardProps {
    title: string;
    value: React.ReactNode;
    subtitle?: React.ReactNode;
    icon?: React.ReactNode;
    trend?: {
        value: string;
        direction: "up" | "down" | "neutral";
        showSign?: boolean;
    };
    progress?: number; // 0 to 100
    variant?: "default" | "primary" | "success" | "warning" | "error" | "info";
    className?: string;
    isGlass?: boolean;
    index?: number;
    helpText?: string;
}

export const SummaryCard = React.memo(function SummaryCard({
    title,
    value,
    icon,
    trend,
    progress,
    variant = "default",
    className,
    subtitle,
    isGlass = true,
    helpText,
}: SummaryCardProps) {
    return (
        <Card
            variant={isGlass ? "glass" : "flat"}
            padding="sm"
            title={helpText}
            className={cn(
                "group relative overflow-hidden h-auto min-h-[70px] transition-all duration-500",
                isGlass && "hover:bg-surface-secondary/50",
                className
            )}
        >
            {/* Soft Glow Background Accent */}
            <div className={cn(
                "absolute -right-4 -top-4 size-16 blur-2xl opacity-0 group-hover:opacity-10 transition-opacity duration-700",
                variant === "success" ? "bg-status-success" :
                    variant === "warning" ? "bg-status-warning" :
                        variant === "error" ? "bg-status-error" :
                            "bg-action-primary"
            )} />

            <div className="flex flex-col justify-between h-full gap-1.5 relative z-10">
                <div className="flex items-start justify-between min-h-[14px]">
                    <Caption1 className="opacity-60 text-text-tertiary">
                        {title}
                    </Caption1>
                    {icon && (
                        <div className={cn(
                            "opacity-20 transition-all duration-300 group-hover:opacity-40 group-hover:scale-110",
                            variant === "success" ? "text-status-success" :
                                variant === "warning" ? "text-status-warning" :
                                    variant === "error" ? "text-status-error" :
                                        "text-action-primary"
                        )}>
                            {React.cloneElement(icon as React.ReactElement<any>, { size: 14 })}
                        </div>
                    )}
                </div>

                <div className="flex items-baseline gap-2">
                    <MetricValue className="tracking-tighter group-hover:scale-[1.02] transition-transform origin-left duration-300">
                        {value}
                    </MetricValue>
                </div>

                {(trend || subtitle) && (
                    <div className="flex items-center gap-1.5 mt-auto">
                        {trend && (
                            <Mini className={cn(
                                "font-bold px-1.5 py-0.5 rounded flex items-center gap-1 text-[9px] transition-colors",
                                trend.direction === "up" ? "text-on-status-success bg-status-success-container/50" :
                                    trend.direction === "down" ? "text-on-status-error bg-status-error-container/50" : "text-text-secondary bg-surface-sunken"
                            )}>
                                {(trend.showSign !== false) && (trend.direction === "up" ? "+" : trend.direction === "down" ? "-" : "")}{trend.value}
                            </Mini>
                        )}
                        {subtitle && <Mini className="text-text-tertiary truncate opacity-40 font-medium">{subtitle}</Mini>}
                    </div>
                )}
            </div>
        </Card>
    );
});
