'use client'

import { useState } from "react"
import { Button, Spinner } from "@fluentui/react-components"
import { toast } from "sonner"
import { ArrowDownloadRegular } from "@fluentui/react-icons"

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
        <Button
            onClick={handleDownload}
            disabled={disabled || isLoading}
            icon={isLoading ? <Spinner size="tiny" /> : <ArrowDownloadRegular />}
        >
            {isLoading ? "Preparing..." : "Download Certs (ZIP)"}
        </Button>
    )
}
