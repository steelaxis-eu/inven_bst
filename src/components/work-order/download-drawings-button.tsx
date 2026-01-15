'use client'

import { useState } from 'react'
import { Button, Spinner } from '@fluentui/react-components'
import { ArrowDownloadRegular } from '@fluentui/react-icons'
import { toast } from 'sonner'

interface DownloadDrawingsButtonProps {
    workOrderId: string
    workOrderNumber: string
    className?: string
    showText?: boolean
    iconOnly?: boolean
}

export function DownloadDrawingsButton({
    workOrderId,
    workOrderNumber,
    className, // Keeping className for potential layout utility passing
    showText = true,
    iconOnly = false
}: DownloadDrawingsButtonProps) {
    const [loading, setLoading] = useState(false)

    const handleDownload = async () => {
        try {
            setLoading(true)
            toast.loading('Preparing drawings bundle...', { id: 'download-drawings' })

            const response = await fetch(`/api/workorders/${workOrderId}/drawings`)

            if (!response.ok) {
                if (response.status === 404) {
                    throw new Error('No drawings found for this Work Order')
                }
                throw new Error('Failed to generate drawings bundle')
            }

            const blob = await response.blob()
            const url = window.URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `WO_${workOrderNumber}_Drawings.zip`
            document.body.appendChild(a)
            a.click()
            window.URL.revokeObjectURL(url)
            document.body.removeChild(a)

            toast.success('Drawings downloaded successfully', { id: 'download-drawings' })
        } catch (error: any) {
            console.error('Download error:', error)
            toast.error(error.message || 'Failed to download drawings', { id: 'download-drawings' })
        } finally {
            setLoading(false)
        }
    }

    // Determine final visibility of text
    const shouldShowText = showText && !iconOnly

    return (
        <Button
            appearance="outline"
            size="small"
            className={className}
            onClick={handleDownload}
            disabled={loading}
            title={shouldShowText ? undefined : "Download Drawings"}
            icon={loading ? <Spinner size="tiny" /> : <ArrowDownloadRegular />}
        >
            {shouldShowText && "Download Drawings"}
        </Button>
    )
}
