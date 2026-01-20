import React from "react";
import { cn } from "@/lib/utils";
import { SummaryCard, SummaryCardProps } from "./SummaryCard";

export interface SummaryCardsProps {
    cards: SummaryCardProps[];
    loading?: boolean;
    className?: string;
    isGlass?: boolean;
}

export const SummaryCards = React.memo(function SummaryCards({
    cards,
    loading,
    className,
    isGlass = true,
}: SummaryCardsProps) {
    return (
        <div className={cn("grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5", className)}>
            {cards.map((card, index) => (
                <SummaryCard key={index} {...card} isGlass={isGlass} />
            ))}
        </div>
    );
});
