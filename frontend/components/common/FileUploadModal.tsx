"use client";

import { useState, useRef, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    Button,
} from "@/components/common";
import { Upload, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";


export interface UploadResult {
    filename: string;
    success: boolean;
    message?: string;
    po_number?: string;
    status_type?: string;
    item_count?: number;
}

interface FileUploadModalProps {
    isOpen: boolean;
    onClose: () => void;
    files: File[];
    onUpload: (file: File) => Promise<UploadResult>;
    title?: string;
}

export function FileUploadModal({
    isOpen,
    onClose,
    files,
    onUpload,
    title = "Upload Files",
}: FileUploadModalProps) {
    const [progress, setProgress] = useState(0);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [stats, setStats] = useState({ success: 0, failed: 0 });
    const [isComplete, setIsComplete] = useState(false);
    const [isUploading, setIsUploading] = useState(false);

    const cancelRef = useRef(false);

    // Reset state when modal opens with new files
    useEffect(() => {
        if (isOpen && files?.length > 0 && !isUploading && !isComplete) {
            startUpload();
        }
    }, [isOpen, files]);

    const startUpload = async () => {
        setIsUploading(true);
        setProgress(0);
        setStats({ success: 0, failed: 0 });
        setCurrentIndex(0);
        cancelRef.current = false;

        let successCount = 0;
        let failedCount = 0;

        for (let i = 0; i < files.length; i++) {
            if (cancelRef.current) {
                break;
            }

            setCurrentIndex(i + 1); // 1-based index for UI
            const file = files[i];

            try {
                const result = await onUpload(file);
                if (result.success) {
                    successCount++;
                } else {
                    failedCount++;
                }
            } catch (error) {
                console.error(`Failed to upload ${file.name}`, error);
                failedCount++;
            }

            setStats({ success: successCount, failed: failedCount });
            // Calculate progress: ((i + 1) / total) * 100
            setProgress(Math.round(((i + 1) / files.length) * 100));
        }

        setIsComplete(true);
        setIsUploading(false);
    };

    const handleCancel = () => {
        cancelRef.current = true;
        setIsUploading(false);
    };

    const handleClose = () => {
        if (isUploading) return; // Prevent closing while running (unless cancelled)
        onClose();
        // Reset state after close is handled by parent unmounting or resetting files
        setTimeout(() => {
            setIsComplete(false);
            setProgress(0);
            setStats({ success: 0, failed: 0 });
        }, 300);
    };

    return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-[400px] p-0 overflow-hidden border-none shadow-2xl bg-surface rounded-2xl">
                <DialogHeader className="px-6 py-5 border-b border-border-default bg-surface-primary">
                    <DialogTitle className="text-lg font-bold flex items-center gap-2">
                        <Upload size={20} className="text-action-primary" />
                        {title}
                    </DialogTitle>
                </DialogHeader>

                <div className="p-6 space-y-6">
                    {/* Progress Bar */}
                    <div className="space-y-3">
                        <div className="flex justify-between text-xs text-text-secondary mb-1">
                            <span>Progress</span>
                            <span>{currentIndex} / {files?.length || 0}</span>
                        </div>
                        <div className="w-full h-3 bg-surface-sunken rounded-full overflow-hidden">
                            <div
                                className={cn(
                                    "h-full bg-action-primary transition-all duration-300 ease-out rounded-full",
                                    isUploading && "animate-pulse",
                                    cancelRef.current && "bg-status-warning"
                                )}
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                        <div className="text-center text-sm font-medium text-text-secondary">
                            {isUploading ? (
                                <span className="flex items-center justify-center gap-2">
                                    <Loader2 size={14} className="animate-spin" />
                                    Processing... {progress}%
                                </span>
                            ) : cancelRef.current ? (
                                <span className="text-status-warning">Cancelled</span>
                            ) : isComplete ? (
                                "Upload Complete"
                            ) : (
                                "Ready to upload"
                            )}
                        </div>
                    </div>

                    {/* Stats */}
                    <div className="flex items-center gap-4 p-4 rounded-xl bg-surface-sunken/50 border border-border-default">
                        <div className="flex-1 text-center">
                            <div className="text-3xl font-bold text-status-success">{stats.success}</div>
                            <div className="text-xs font-bold text-text-tertiary uppercase tracking-wider">Accepted</div>
                        </div>
                        <div className="w-[1px] h-10 bg-border-subtle" />
                        <div className="flex-1 text-center">
                            <div className={cn("text-3xl font-bold", stats.failed > 0 ? "text-status-error" : "text-text-quaternary")}>
                                {stats.failed}
                            </div>
                            <div className="text-xs font-bold text-text-tertiary uppercase tracking-wider">Rejected</div>
                        </div>
                    </div>

                    {/* Footer Buttons */}
                    <div className="flex justify-end gap-3 pt-2">
                        {isUploading ? (
                            <Button
                                variant="outline"
                                onClick={handleCancel}
                                className="w-full text-status-error border-status-error/20 hover:bg-status-error/5"
                            >
                                Cancel
                            </Button>
                        ) : (
                            <Button
                                variant="primary"
                                onClick={handleClose}
                                className="w-full"
                            >
                                Done
                            </Button>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

