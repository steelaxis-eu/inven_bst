'use client'

import { useImport } from "@/context/import-context"
import { Button, ProgressBar, Spinner } from "@fluentui/react-components"
import { CheckmarkCircleRegular, DismissCircleRegular, OpenRegular } from "@fluentui/react-icons"
import { tokens } from "@fluentui/react-components"

export function ImportStatus() {
    const { isProcessing, progress, status, fileName, setReviewing, dismiss } = useImport()

    if (status === 'idle') return null

    return (
        <div className="fixed top-0 left-0 right-0 z-50 pointer-events-none">
            {/* Progress Bar Line */}
            {(status === 'uploading' || status === 'processing') && (
                <div style={{ width: '100%', height: '4px' }}>
                    <ProgressBar value={progress} max={100} thickness="medium" shape="square" color="brand" />
                </div>
            )}

            {/* Status Card (Centered or top-right) */}
            <div className="container mx-auto relative">
                <div className="absolute top-4 right-4 pointer-events-auto">
                    <div style={{
                        backgroundColor: tokens.colorNeutralBackground1,
                        border: `1px solid ${tokens.colorNeutralStroke1}`,
                        borderRadius: tokens.borderRadiusMedium,
                        boxShadow: tokens.shadow16,
                        padding: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '16px',
                        minWidth: '280px'
                    }} className="animate-in slide-in-from-top-2">
                        {status === 'processing' || status === 'uploading' ? (
                            <>
                                <Spinner size="tiny" />
                                <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                                    <span style={{ fontSize: '14px', fontWeight: 600 }}>Processing {fileName}...</span>
                                    <span style={{ fontSize: '12px', color: tokens.colorNeutralForeground2 }}>{Math.round(progress)}%</span>
                                </div>
                            </>
                        ) : status === 'reviewing' ? (
                            <>
                                <CheckmarkCircleRegular style={{ color: tokens.colorPaletteGreenForeground1, fontSize: '20px' }} />
                                <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                                    <span style={{ fontSize: '14px', fontWeight: 600 }}>Ready for Review</span>
                                    <span style={{ fontSize: '12px', color: tokens.colorNeutralForeground2 }}>{fileName}</span>
                                </div>
                                <Button size="small" appearance="primary" onClick={setReviewing} icon={<OpenRegular />}>
                                    Open
                                </Button>
                            </>
                        ) : status === 'error' ? (
                            <>
                                <DismissCircleRegular style={{ color: tokens.colorPaletteRedForeground1, fontSize: '20px' }} />
                                <span style={{ fontSize: '14px', fontWeight: 600, color: tokens.colorPaletteRedForeground1, flex: 1 }}>Import Failed</span>
                                <Button size="small" appearance="subtle" onClick={dismiss}>
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
