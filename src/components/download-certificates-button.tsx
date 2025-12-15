'use client'

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { Loader2, Download } from "lucide-react"

interface DownloadCertificatesButtonProps {
    projectId: string
    projectNumber: string
    disabled?: boolean
}

export function DownloadCertificatesButton({ projectId, projectNumber, disabled }: DownloadCertificatesButtonProps) {
    const [isLoading, setIsLoading] = useState(false)

    const handleDownload = async () => {
        setIsLoading(true)
        const toastId = toast.loading("Preparing certificate archive...")

        try {
            const res = await fetch(`/api/projects/${projectId}/certificates/zip`)

            if (!res.ok) {
                const data = await res.json()
                throw new Error(data.error || 'Failed to download certificates')
            }

            const blob = await res.blob()
            const url = window.URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.style.display = 'none'
            a.href = url
            a.download = `${projectNumber}.zip`
            document.body.appendChild(a)
            a.click()
            window.URL.revokeObjectURL(url)
            document.body.removeChild(a)

            toast.success("Download started", { id: toastId })
        } catch (error: any) {
            console.error(error)
            toast.error(error.message || "Something went wrong", { id: toastId })
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <Button onClick={handleDownload} disabled={disabled || isLoading}>
            {isLoading ? (
                <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Preparing...
                </>
            ) : (
                <>
                    <Download className="mr-2 h-4 w-4" />
                    Download Certs (ZIP)
                </>
            )}
        </Button>
    )
}
