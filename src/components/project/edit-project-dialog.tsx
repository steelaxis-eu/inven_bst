'use client'

import { useState } from 'react'
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useRouter } from 'next/navigation'
import { updateProject } from '@/app/actions/projects'
import { Settings } from 'lucide-react'

// Coating type options
const COATING_TYPES = [
    { value: 'NONE', label: 'None' },
    { value: 'HDG', label: 'Hot-Dip Galvanized' },
    { value: 'PAINTED', label: 'Painted' },
    { value: 'POWDER_COATED', label: 'Powder Coated' },
    { value: 'EPOXY', label: 'Epoxy Coated' },
    { value: 'ZINC_PRIMER', label: 'Zinc Primer' },
    { value: 'INTUMESCENT', label: 'Intumescent (Fire)' },
]

interface EditProjectDialogProps {
    project: {
        id: string
        name: string
        client: string | null
        description: string | null
        priority: string
        coatingType: string | null
        coatingSpec: string | null
    }
}

export function EditProjectDialog({ project }: EditProjectDialogProps) {
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const [name, setName] = useState(project.name)
    const [client, setClient] = useState(project.client || '')
    const [description, setDescription] = useState(project.description || '')
    const [priority, setPriority] = useState(project.priority)
    const [coatingType, setCoatingType] = useState(project.coatingType || 'NONE')
    const [coatingSpec, setCoatingSpec] = useState(project.coatingSpec || '')
    const router = useRouter()

    const handleSubmit = async () => {
        setLoading(true)
        try {
            const res = await updateProject(project.id, {
                name,
                client: client || undefined,
                description: description || undefined,
                priority,
                coatingType: coatingType === 'NONE' ? undefined : coatingType,
                coatingSpec: coatingSpec || undefined
            })
            if (res.success) {
                setOpen(false)
                router.refresh()
            } else {
                alert(`Error: ${res.error}`)
            }
        } catch (e: any) {
            alert("Failed to update project")
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1">
                    <Settings className="h-4 w-4" /> Settings
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-xl">
                <DialogHeader>
                    <DialogTitle>Project Settings</DialogTitle>
                    <DialogDescription>Edit project details including coating specification.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <Label>Project Name</Label>
                        <Input
                            value={name}
                            onChange={e => setName(e.target.value)}
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label>Client</Label>
                            <Input
                                value={client}
                                onChange={e => setClient(e.target.value)}
                                placeholder="Customer name"
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label>Priority</Label>
                            <Select value={priority} onValueChange={setPriority}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="LOW">Low</SelectItem>
                                    <SelectItem value="MEDIUM">Medium</SelectItem>
                                    <SelectItem value="HIGH">High</SelectItem>
                                    <SelectItem value="CRITICAL">Critical</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <div className="grid gap-2">
                        <Label>Description</Label>
                        <Input
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            placeholder="Project description"
                        />
                    </div>

                    <div className="border-t pt-4 mt-2">
                        <h3 className="font-medium mb-3">Coating Specification</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label>Coating Type</Label>
                                <Select value={coatingType} onValueChange={setCoatingType}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {COATING_TYPES.map(ct => (
                                            <SelectItem key={ct.value} value={ct.value}>
                                                {ct.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="grid gap-2">
                                <Label>Coating Specification</Label>
                                <Input
                                    value={coatingSpec}
                                    onChange={e => setCoatingSpec(e.target.value)}
                                    placeholder="e.g. RAL 7016, 60μm"
                                    disabled={coatingType === 'NONE'}
                                />
                            </div>
                        </div>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                    <Button onClick={handleSubmit} disabled={loading || !name}>
                        {loading ? 'Saving...' : 'Save Changes'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
