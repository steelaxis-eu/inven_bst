'use client'

import { Button } from "@/components/ui/button"
import { archiveProject } from "@/app/actions/projects"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { Trash2 } from "lucide-react"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

export function ProjectCardActions({ id, name }: { id: string, name: string }) {
    const [loading, setLoading] = useState(false)
    const router = useRouter()

    const handleArchive = async () => {
        setLoading(true)
        try {
            await archiveProject(id)
            router.refresh()
        } catch (e) {
            alert("Failed to archive project")
        } finally {
            setLoading(false)
        }
    }

    return (
        <AlertDialog>
            <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-700 hover:bg-red-50">
                    <Trash2 className="h-4 w-4" />
                </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Archive Project?</AlertDialogTitle>
                    <AlertDialogDescription>
                        Are you sure you want to archive <strong>{name}</strong>?
                        This will hide it from the main list. You can restore it from the database if needed.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleArchive} className="bg-red-600 hover:bg-red-700">
                        {loading ? 'Archiving...' : 'Archive'}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    )
}
