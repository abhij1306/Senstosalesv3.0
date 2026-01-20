import { LucideIcon } from 'lucide-react';
import { Title3, Subhead } from "@/components/common";
import { cn } from '@/lib/utils';
import React from 'react';

interface EmptyStateProps {
    icon: LucideIcon;
    title: string;
    description: string;
    action?: React.ReactNode;
    className?: string;
}

export function EmptyState({
    icon: Icon,
    title,
    description,
    action,
    className
}: EmptyStateProps) {
    return (
        <div className={cn('flex flex-col items-center justify-center py-12', className)}>
            <div className={cn(
                'mb-4 p-3',
                'rounded-[var(--radius-md)]',
                'bg-muted/50'
            )}>
                <Icon size={32} className="text-tertiary" />
            </div>

            <Title3 className="mb-2">{title}</Title3>
            <Subhead className="text-secondary mb-4 text-center max-w-md">
                {description}
            </Subhead>

            {action}
        </div>
    );
}
