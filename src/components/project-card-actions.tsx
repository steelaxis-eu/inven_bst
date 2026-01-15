'use client'

import {
    Button,
    Dialog,
    DialogTrigger,
    DialogSurface,
    DialogTitle,
    DialogBody,
    DialogActions,
    DialogContent,
    Text,
    Spinner
} from "@fluentui/react-components"
import { archiveProject } from "@/app/actions/projects"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { DeleteRegular } from "@fluentui/react-icons"
import { toast } from "sonner"
import { tokens } from "@fluentui/react-components"

export function ProjectCardActions({ id, name }: { id: string, name: string }) {
    const [loading, setLoading] = useState(false)
    const [open, setOpen] = useState(false)
    const router = useRouter()

    const handleArchive = async () => {
        setLoading(true)
        try {
            await archiveProject(id)
            router.refresh()
            toast.success("Project archived")
            setOpen(false)
        } catch (e) {
            toast.error("Failed to archive project")
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={(e, data) => setOpen(data.open)}>
            <DialogTrigger disableButtonEnhancement>
                <Button
                    appearance="subtle"
                    icon={<DeleteRegular style={{ color: tokens.colorPaletteRedForeground1 }} />}
                    style={{ color: tokens.colorPaletteRedForeground1 }}
                    className="hover:bg-red-50" // Tailwind utility still works if needed, or use inline styles
                />
            </DialogTrigger>
            <DialogSurface>
                <DialogBody>
                    <DialogTitle>Archive Project?</DialogTitle>
                    <DialogContent>
                        <Text>
                            Are you sure you want to archive <strong>{name}</strong>?
                            This will hide it from the main list. You can restore it from the database if needed.
                        </Text>
                    </DialogContent>
                    <DialogActions>
                        <Button appearance="secondary" onClick={() => setOpen(false)}>Cancel</Button>
                        <Button
                            appearance="primary"
                            onClick={handleArchive}
                            disabled={loading}
                            icon={loading ? <Spinner size="tiny" /> : undefined}
                            style={{ backgroundColor: tokens.colorPaletteRedBackground3, border: 'none' }}
                        >
                            {loading ? 'Archiving...' : 'Archive'}
                        </Button>
                    </DialogActions>
                </DialogBody>
            </DialogSurface>
        </Dialog>
    )
}
