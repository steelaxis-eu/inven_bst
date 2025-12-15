'use client'

import { useState } from 'react'
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useRouter } from 'next/navigation'
import { createProject } from '@/app/actions/projects'

export function CreateProjectDialog() {
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const [projectNumber, setProjectNumber] = useState('')
    const [name, setName] = useState('')
    const router = useRouter()

    const handleSubmit = async () => {
        if (!projectNumber || !name) return
        setLoading(true)
        try {
            const res = await createProject({ number: projectNumber, name })
            if (res.success) {
                setOpen(false)
                setProjectNumber('')
                setName('')
                router.refresh()
            } else {
                alert(`Error: ${res.error}`)
            }
        } catch (e: any) {
            alert("Failed to create project")
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button>+ New Project</Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Create New Project</DialogTitle>
                    <DialogDescription>Start a new project to track inventory usage.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <Label>Project Number</Label>
                        <Input
                            value={projectNumber}
                            onChange={e => setProjectNumber(e.target.value)}
                            placeholder="e.g. P-1002"
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label>Project Name</Label>
                        <Input
                            value={name}
                            onChange={e => setName(e.target.value)}
                            placeholder="e.g. Seaside Complex"
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button onClick={handleSubmit} disabled={loading}>
                        {loading ? 'Creating...' : 'Create Project'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
