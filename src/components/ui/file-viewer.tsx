'use client'

import { useState } from 'react'
import { Button } from "@/components/ui/button"
import { supabase } from "@/lib/supabase"
import { Loader2, FileText } from "lucide-react"

interface FileViewerProps {
    bucketName: string
    path: string
    fileName?: string
}

export function FileViewer({ bucketName, path, fileName = "View Certificate" }: FileViewerProps) {
    const [loading, setLoading] = useState(false)

    const handleOpen = async () => {
        try {
            setLoading(true)

            // Clean path - remove any leading slash
            const cleanPath = path.startsWith('/') ? path.slice(1) : path

            console.log(`[FileViewer] Requesting signed URL for: bucket=${bucketName}, path=${cleanPath}`)

            // Create a Signed URL valid for 60 seconds
            const { data, error } = await supabase.storage
                .from(bucketName)
                .createSignedUrl(cleanPath, 60)

            if (error) {
                console.error('[FileViewer] Supabase error:', error)
                throw error
            }

            if (data?.signedUrl) {
                console.log('[FileViewer] Got signed URL:', data.signedUrl)
                window.open(data.signedUrl, '_blank')
            } else {
                console.error('[FileViewer] No signed URL returned')
                alert("Could not generate download link")
            }
        } catch (error: any) {
            console.error('[FileViewer] Error:', error)
            alert(`Could not open file: ${error?.message || 'Access Denied or Missing'}`)
        } finally {
            setLoading(false)
        }
    }

    if (!path) return null

    return (
        <Button
            variant="outline"
            size="sm"
            onClick={handleOpen}
            disabled={loading}
            className="flex items-center gap-2"
        >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
            {fileName}
        </Button>
    )
}

