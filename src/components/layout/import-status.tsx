'use client'

import { useImport } from "@/context/import-context"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { Loader2, CheckCircle, XCircle } from "lucide-react"

export function ImportStatus() {
    const { isProcessing, progress, status, fileName, setReviewing, dismiss } = useImport()

    if (status === 'idle') return null

    return (
        <div className="fixed top-0 left-0 right-0 z-50 pointer-events-none">
            {/* Progress Bar Line */}
            {(status === 'uploading' || status === 'processing') && (
                <div className="h-1 w-full bg-primary/10">
                    <div
                        className="h-full bg-primary transition-all duration-500 ease-out"
                        style={{ width: `${progress}%` }}
                    />
                </div>
            )}

            {/* Status Card (Centered or top-right) */}
            <div className="container mx-auto relative">
                <div className="absolute top-4 right-4 pointer-events-auto">
                    <div className="bg-background/80 backdrop-blur-md border border-border shadow-lg rounded-lg p-3 flex items-center gap-4 animate-in slide-in-from-top-2">
                        {status === 'processing' || status === 'uploading' ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                                <div className="flex flex-col">
                                    <span className="text-sm font-medium">Processing {fileName}...</span>
                                    <span className="text-xs text-muted-foreground">{Math.round(progress)}%</span>
                                </div>
                            </>
                        ) : status === 'reviewing' ? (
                            <>
                                <CheckCircle className="h-4 w-4 text-green-500" />
                                <div className="flex flex-col">
                                    <span className="text-sm font-medium">Ready for Review</span>
                                    <span className="text-xs text-muted-foreground">{fileName}</span>
                                </div>
                                <Button size="sm" variant="default" onClick={setReviewing}>
                                    Open
                                </Button>
                            </>
                        ) : status === 'error' ? (
                            <>
                                <XCircle className="h-4 w-4 text-red-500" />
                                <span className="text-sm font-medium text-red-500">Import Failed</span>
                                <Button size="sm" variant="ghost" onClick={dismiss}>
                                    Close
                                </Button>
                            </>
                        ) : null}
                    </div>
                </div>
            </div>
        </div>
    )
}
