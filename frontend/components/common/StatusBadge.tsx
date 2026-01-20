"use client";
import React from "react";
import { Badge } from "./Badge";
import { cn } from "@/lib/utils";
import {
    FileEdit,
    Clock,
    Activity,
    CheckCircle2,
    Check,
    XCircle,
    AlertCircle,
    Minus
} from "lucide-react";

import { Mini } from "./Typography";

// Icon Map for tree-shaking
const iconMap = {
    FileEdit,
    Clock,
    Activity,
    CheckCircle2,
    Check,
    XCircle,
    AlertCircle,
    Minus
};

export type StatusBadgeStatus =
    | 'draft'
    | 'pending'
    | 'active'
    | 'delivered'
    | 'closed'
    | 'cancelled'
    | 'completed'
    | 'error'
    | 'inactive'
    | 'open'
    | 'partially_covered'
    | 'partially_received'
    | 'received'
    | 'paid'
    | 'overdue';

export interface StatusBadgeProps {
    status: StatusBadgeStatus;
    label?: string;
    icon?: keyof typeof iconMap;
    className?: string;
    showIcon?: boolean;
}

// Semantic mapping - M3 Tonal Palettes (Container/On-Container)
const statusConfig: Record<StatusBadgeStatus, {
    variant: 'success' | 'warning' | 'error' | 'info' | 'outline';
    defaultLabel: string;
    defaultIcon: keyof typeof iconMap;
}> = {
    // Purchase Order statuses
    draft: {
        variant: 'info', // Maps to bg-status-info-container text-on-status-info (Requires class update in Badge.tsx or here)
        defaultLabel: 'Draft',
        defaultIcon: 'FileEdit',
    },
    pending: {
        variant: 'warning',
        defaultLabel: 'Pending',
        defaultIcon: 'Clock',
    },
    active: {
        variant: 'info',
        defaultLabel: 'Active',
        defaultIcon: 'Activity',
    },
    delivered: {
        variant: 'success',
        defaultLabel: 'Dispatched',
        defaultIcon: 'CheckCircle2',
    },
    closed: {
        variant: 'success',
        defaultLabel: 'Closed',
        defaultIcon: 'Check',
    },
    cancelled: {
        variant: 'error',
        defaultLabel: 'Cancelled',
        defaultIcon: 'XCircle',
    },

    // Generic statuses
    completed: {
        variant: 'success',
        defaultLabel: 'Completed',
        defaultIcon: 'Check',
    },
    error: {
        variant: 'error',
        defaultLabel: 'Error',
        defaultIcon: 'AlertCircle',
    },
    inactive: {
        variant: 'outline',
        defaultLabel: 'Inactive',
        defaultIcon: 'Minus',
    },
    open: {
        variant: 'info',
        defaultLabel: 'Open',
        defaultIcon: 'Activity',
    },
    partially_covered: {
        variant: 'warning',
        defaultLabel: 'Partially Covered',
        defaultIcon: 'Clock',
    },
    partially_received: {
        variant: 'warning',
        defaultLabel: 'Partially Received',
        defaultIcon: 'Clock',
    },
    received: {
        variant: 'success',
        defaultLabel: 'Received',
        defaultIcon: 'CheckCircle2',
    },
    paid: {
        variant: 'success',
        defaultLabel: 'Paid',
        defaultIcon: 'CheckCircle2',
    },
    overdue: {
        variant: 'error',
        defaultLabel: 'Overdue',
        defaultIcon: 'AlertCircle',
    },
};

export const StatusBadge = React.memo(({
    status,
    label,
    icon,
    className,
    showIcon = true,
}: StatusBadgeProps) => {
    const config = statusConfig[status] || statusConfig.pending;
    const displayLabel = label || config.defaultLabel;
    const iconName = icon || config.defaultIcon;

    const IconComponent = showIcon ? iconMap[iconName] : null;

    return (
        <Badge variant={config.variant} className={cn("gap-1.5 h-6 px-1.5", className)}>
            {IconComponent && <IconComponent size={12} className="shrink-0 opacity-80" />}
            <Mini className="font-bold uppercase tracking-[0.05em] text-inherit">
                {displayLabel}
            </Mini>
        </Badge>
    );
});

StatusBadge.displayName = 'StatusBadge';
