'use client'

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { FileUploader } from "@/components/ui/file-uploader"
import { FileViewer } from "@/components/ui/file-viewer"
import { updateInventoryCertificate } from "@/app/actions/inventory"
import { useRouter } from "next/navigation"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Upload, FileText } from "lucide-react"

export function InventoryCertActions({ id, certificate }: { id: string, certificate: string | null }) {
    const [path, setPath] = useState(certificate)
    const [openP, setOpenP] = useState(false)
    const router = useRouter()

    const handleUpload = async (newPath: string) => {
        setPath(newPath)
        await updateInventoryCertificate(id, newPath)
        router.refresh()
        setOpenP(false)
    }

    if (path) {
        return (
            <div className="flex items-center gap-2">
                <FileViewer bucketName="certificates" path={path} fileName="View Cert" />
                <Popover open={openP} onOpenChange={setOpenP}>
                    <PopoverTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-gray-400 hover:text-black">
                            <Upload className="h-3 w-3" />
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80">
                        <div className="space-y-2">
                            <h4 className="font-medium leading-none">Replace Certificate</h4>
                            <p className="text-sm text-muted-foreground">Upload a new file to replace the current one.</p>
                            <FileUploader bucketName="certificates" onUploadComplete={handleUpload} />
                        </div>
                    </PopoverContent>
                </Popover>
            </div>

        )
    }

    return (
        <Popover open={openP} onOpenChange={setOpenP}>
            <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-7 text-xs">
                    <Upload className="mr-1 h-3 w-3" /> Add Cert
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80">
                <div className="space-y-2">
                    <h4 className="font-medium leading-none">Upload Certificate</h4>
                    <FileUploader bucketName="certificates" onUploadComplete={handleUpload} />
                </div>
            </PopoverContent>
        </Popover>
    )
}
