'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Download, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface DownloadDrawingsButtonProps {
    workOrderId: string
    workOrderNumber: string
    className?: string
    showText?: boolean
}

export function DownloadDrawingsButton({
    workOrderId,
    workOrderNumber,
    className,
    showText = true
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

            // Create blob and simple download link
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

    return (
        <Button
            variant="outline"
            size="sm"
            className={className}
            onClick={handleDownload}
            disabled={loading}
            title={showText ? undefined : "Download Drawings"}
        >
            {loading ? (
                <Loader2 className={cn("h-4 w-4 animate-spin", showText && "mr-2")} />
            ) : (
                <Download className={cn("h-4 w-4", showText && "mr-2")} />
            )}
            {showText && "Download Drawings"}
        </Button>
    )
}
