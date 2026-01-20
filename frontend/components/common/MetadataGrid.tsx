import React from "react";
import { Card } from "./Card";
import { MetadataItem, type MetadataItemProps } from "./MetadataItem";
import { cn } from "@/lib/utils";

export interface MetadataGridProps {
    items: MetadataItemProps[];
    className?: string;
    columns?: 2 | 3 | 4 | 5 | 6;
    variant?: "elevated" | "glass" | "glass-elevated" | "muted" | "flat" | "outlined";
}

export const MetadataGrid = React.memo(function MetadataGrid({ items, className, columns = 5, variant = "flat", padding = "lg" }: MetadataGridProps & { padding?: 'none' | 'sm' | 'md' | 'lg' | 'xl' }) {
    // Dynamic grid cols based on prop (Tailwind requires full class names usually, but we can map)
    const gridCols = {
        2: "md:grid-cols-2",
        3: "md:grid-cols-3",
        4: "md:grid-cols-4",
        5: "md:grid-cols-4 lg:grid-cols-5",
        6: "md:grid-cols-4 lg:grid-cols-6",
    };

    return (
        <Card variant={variant} padding={padding} className={cn("w-full transition-all duration-300", className)}>
            <div className={cn("grid grid-cols-2 gap-y-4 gap-x-12", gridCols[columns])}>
                {items.map((item, index) => (
                    <MetadataItem key={index} {...item} />
                ))}
            </div>
        </Card>
    );
});
