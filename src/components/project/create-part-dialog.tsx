'use client'

import { useState } from 'react'
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useRouter } from 'next/navigation'
import { createPart } from '@/app/actions/parts'
import { Plus } from 'lucide-react'

interface CreatePartDialogProps {
    projectId: string
    profiles: { id: string; type: string; dimensions: string }[]
    grades: { id: string; name: string }[]
}

export function CreatePartDialog({ projectId, profiles, grades }: CreatePartDialogProps) {
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const [partNumber, setPartNumber] = useState('')
    const [description, setDescription] = useState('')
    const [profileId, setProfileId] = useState('')
    const [gradeId, setGradeId] = useState('')
    const [length, setLength] = useState('')
    const [quantity, setQuantity] = useState('1')
    const [requiresWelding, setRequiresWelding] = useState(false)
    const router = useRouter()

    const handleSubmit = async () => {
        if (!partNumber || !quantity) return
        setLoading(true)
        try {
            const res = await createPart({
                projectId,
                partNumber,
                description: description || undefined,
                profileId: profileId || undefined,
                gradeId: gradeId || undefined,
                length: length ? parseFloat(length) : undefined,
                quantity: parseInt(quantity),
                requiresWelding
            })
            if (res.success) {
                setOpen(false)
                resetForm()
                router.refresh()
            } else {
                alert(`Error: ${res.error}`)
            }
        } catch (e: any) {
            alert("Failed to create part")
        } finally {
            setLoading(false)
        }
    }

    const resetForm = () => {
        setPartNumber('')
        setDescription('')
        setProfileId('')
        setGradeId('')
        setLength('')
        setQuantity('1')
        setRequiresWelding(false)
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button size="sm" className="gap-1">
                    <Plus className="h-4 w-4" /> Add Part
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>Add New Part</DialogTitle>
                    <DialogDescription>Create a new BOM part. Pieces will be auto-generated based on quantity.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label>Part Number *</Label>
                            <Input
                                value={partNumber}
                                onChange={e => setPartNumber(e.target.value)}
                                placeholder="e.g. B-101"
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label>Quantity *</Label>
                            <Input
                                type="number"
                                min="1"
                                value={quantity}
                                onChange={e => setQuantity(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="grid gap-2">
                        <Label>Description</Label>
                        <Input
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            placeholder="e.g. Main beam section"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label>Profile</Label>
                            <Select value={profileId} onValueChange={setProfileId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select profile" />
                                </SelectTrigger>
                                <SelectContent>
                                    {profiles.map(p => (
                                        <SelectItem key={p.id} value={p.id}>
                                            {p.type} {p.dimensions}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid gap-2">
                            <Label>Grade</Label>
                            <Select value={gradeId} onValueChange={setGradeId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select grade" />
                                </SelectTrigger>
                                <SelectContent>
                                    {grades.map(g => (
                                        <SelectItem key={g.id} value={g.id}>
                                            {g.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label>Length (mm)</Label>
                            <Input
                                type="number"
                                value={length}
                                onChange={e => setLength(e.target.value)}
                                placeholder="e.g. 6000"
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label>Requires Welding</Label>
                            <Select
                                value={requiresWelding ? 'yes' : 'no'}
                                onValueChange={v => setRequiresWelding(v === 'yes')}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="no">No</SelectItem>
                                    <SelectItem value="yes">Yes</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                    <Button onClick={handleSubmit} disabled={loading || !partNumber || !quantity}>
                        {loading ? 'Creating...' : 'Create Part'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
