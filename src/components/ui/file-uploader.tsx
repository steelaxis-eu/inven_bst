'use client'

import { useState } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Loader2, UploadCloud } from "lucide-react"
import { supabase } from "@/lib/supabase"

interface FileUploaderProps {
    bucketName: string
    onUploadComplete: (url: string) => void
    currentValue?: string
    className?: string
    minimal?: boolean
}

export function FileUploader({ bucketName, onUploadComplete, currentValue, className, minimal }: FileUploaderProps) {
    const [uploading, setUploading] = useState(false)
    const [fileName, setFileName] = useState<string | null>(currentValue ? currentValue.split('/').pop() || 'File' : null)

    const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        try {
            setUploading(true)
            if (!event.target.files || event.target.files.length === 0) {
                return
            }
            const file = event.target.files[0]
            const fileExt = file.name.split('.').pop()
            const date = new Date()
            const year = date.getFullYear()
            const month = String(date.getMonth() + 1).padStart(2, '0')
            // Path: YYYY/MM/random-id.ext
            const filePath = `${year}/${month}/${Math.random().toString(36).substring(7)}.${fileExt}`

            const { error: uploadError } = await supabase.storage.from(bucketName).upload(filePath, file)

            if (uploadError) {
                throw uploadError
            }

            // Private Bucket Strategy: Return the path, not the URL
            // The file is private, so getPublicUrl would break or return unusable link.
            setFileName(file.name)
            onUploadComplete(filePath) // Return internal path (e.g., "123.pdf")
        } catch (error) {
            alert('Error uploading file!')
            console.error(error)
        } finally {
            setUploading(false)
        }
    }

    if (minimal) {
        return (
            <div className={className}>
                <div className="flex items-center gap-2">
                    <label className="cursor-pointer inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 w-9">
                        <UploadCloud className="h-4 w-4" />
                        <span className="sr-only">Upload</span>
                        <input type="file" className="hidden" onChange={handleUpload} disabled={uploading} />
                    </label>
                    {uploading && <Loader2 className="animate-spin h-4 w-4 text-muted-foreground" />}
                    {currentValue && !uploading && (
                        <span className="text-xs text-green-600 truncate max-w-[100px]" title={fileName || ''}>
                            {fileName || "✓"}
                        </span>
                    )}
                </div>
            </div>
        )
    }

    return (
        <div className={className}>
            {currentValue && (
                <div className="text-sm text-green-600 mb-2 flex items-center gap-2">
                    <span className="truncate max-w-[200px] block">✓ {fileName || "Attached"}</span>
                    <a href={currentValue} target="_blank" rel="noreferrer" className="underline text-xs">View</a>
                </div>
            )}
            <div className="flex gap-2 items-center">
                <Input
                    type="file"
                    disabled={uploading}
                    onChange={handleUpload}
                    className="cursor-pointer file:cursor-pointer bg-background"
                />
                {uploading && <Loader2 className="animate-spin h-4 w-4" />}
            </div>
        </div>
    )
}
