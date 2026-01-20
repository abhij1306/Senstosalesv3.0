"use client";

import React from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription
} from "./Dialog";
import { Button } from "./Button";
import { AlertTriangle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ActionConfirmationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    subtitle?: string;
    warningText?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: "danger" | "warning" | "info";
    isLoading?: boolean;
}

export function ActionConfirmationModal({
    isOpen,
    onClose,
    onConfirm,
    title,
    subtitle,
    warningText,
    confirmLabel = "Confirm",
    cancelLabel = "Cancel",
    variant = "warning",
    isLoading = false,
}: ActionConfirmationModalProps) {
    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-[480px] p-8 !rounded-[32px] border-0 bg-surface shadow-2xl ring-0 focus:ring-0 outline-none">
                <DialogHeader className="items-center text-center space-y-4">
                    <div className={cn(
                        "w-20 h-20 rounded-[24px] flex items-center justify-center mb-2 shadow-inner",
                        variant === "danger" ? "bg-status-error/5 text-status-error ring-1 ring-status-error/10" :
                            variant === "warning" ? "bg-status-warning/5 text-status-warning ring-1 ring-status-warning/10" :
                                "bg-action-primary/5 text-action-primary ring-1 ring-action-primary/10"
                    )}>
                        <AlertTriangle size={36} strokeWidth={2} />
                    </div>
                    <div className="space-y-2">
                        <DialogTitle className="text-[22px] font-[600] tracking-tight text-text-primary uppercase">
                            {title}
                        </DialogTitle>
                        {subtitle && (
                            <DialogDescription className="text-text-tertiary font-[500] uppercase tracking-widest text-[11px]">
                                {subtitle}
                            </DialogDescription>
                        )}
                    </div>
                </DialogHeader>

                <div className="py-6 text-center">
                    <p className="text-[15px] text-text-secondary leading-relaxed font-[500]">
                        {warningText}
                    </p>
                </div>

                <DialogFooter className="grid grid-cols-2 gap-3 mt-2 sm:space-x-0">
                    <Button
                        variant="outline"
                        onClick={onClose}
                        disabled={isLoading}
                        className="w-full h-10 rounded-xl font-[500] border-border-default text-text-secondary hover:bg-surface-sunken hover:text-text-primary transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {cancelLabel}
                    </Button>
                    <Button
                        variant={variant === "danger" ? "destructive" : variant === "warning" ? "warning" : "primary"}
                        onClick={onConfirm}
                        disabled={isLoading}
                        className={cn(
                            "w-full h-10 rounded-xl font-[500] shadow-lg transition-all duration-200 disabled:opacity-70 disabled:cursor-not-allowed",
                            variant === "danger" && "shadow-status-error/20 hover:shadow-status-error/30",
                            variant === "warning" && "shadow-status-warning/20 hover:shadow-status-warning/30",
                            variant === "info" && "shadow-action-primary/20 hover:shadow-action-primary/30"
                        )}
                    >
                        {isLoading ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Please wait...
                            </>
                        ) : (
                            confirmLabel
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog >
    );
}
