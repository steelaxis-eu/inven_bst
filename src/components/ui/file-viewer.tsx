'use client'

import { Button } from "@/components/ui/button"
import { FileText } from "lucide-react"

interface FileViewerProps {
    bucketName: string
    path: string
    fileName?: string
}

export function FileViewer({ bucketName, path, fileName = "View Certificate" }: FileViewerProps) {
    if (!path) return null

    // Clean path - remove any leading slash
    const cleanPath = path.startsWith('/') ? path.slice(1) : path

    // Use proxy route to hide Supabase URL from users
    const proxyUrl = `/api/certificates/view?path=${encodeURIComponent(cleanPath)}`

    return (
        <a href={proxyUrl} target="_blank" rel="noopener noreferrer">
            <Button
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
            >
                <FileText className="h-4 w-4" />
                {fileName}
            </Button>
        </a>
    )
}
