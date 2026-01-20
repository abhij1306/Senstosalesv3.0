"use client";
import React from "react";
import { Title1, Body } from "./Typography";
import { cn } from "@/lib/utils";
import { ArrowLeft } from "lucide-react";
import { Button } from "./Button";


interface DocumentTemplateProps {
    title: string;
    description?: React.ReactNode;
    actions?: React.ReactNode;
    children: React.ReactNode;
    className?: string;
    onBack?: () => void;
    layoutId?: string;
    icon?: React.ReactNode;
    iconLayoutId?: string;
    headerAction?: React.ReactNode;
}

export const DocumentTemplate = ({
    title,
    description,
    actions,
    headerAction,
    children,
    className,
    onBack,
    layoutId,
    icon,
    iconLayoutId,
}: DocumentTemplateProps) => {
    return (
        <div className={cn("w-full px-8 pt-8 pb-10 bg-surface-sunken relative min-h-full", className)}>

            <div className="relative z-10 animate-fade-in">
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-4">
                        {onBack && (
                            <Button
                                variant="secondary"
                                onClick={onBack}
                                className="h-10 w-10 p-0 rounded-xl transition-all bg-surface shadow-sm border border-border-default text-text-secondary hover:bg-surface-secondary"
                            >
                                <ArrowLeft size={18} />
                            </Button>
                        )}
                        <div className="flex flex-col gap-1">
                            <Title1>
                                {title}
                            </Title1>
                            {description && (
                                <div className="text-text-tertiary text-sm font-medium flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 bg-action-primary rounded-full inline-block shrink-0 shadow-sm"></span>
                                    {description}
                                </div>
                            )}
                        </div>

                    </div>
                    <div className="flex items-center gap-4">
                        {headerAction && (
                            <div className="ml-6 pl-6 bg-border-default/10 w-px h-8 flex items-center self-center" />
                        )}
                        {headerAction && <div>{headerAction}</div>}
                        {actions && (
                            <div className="flex items-center gap-4">
                                {actions}
                            </div>
                        )}
                    </div>
                </div>

                {/* Content Area */}
                <div className="w-full h-full flex-1 flex flex-col">
                    {children}
                </div>
            </div>
        </div>
    );
};
