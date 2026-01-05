'use client'

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { createQualityCheck } from "@/app/actions/quality"
import { toast } from "sonner"
import { Loader2, Plus } from "lucide-react"
import { useRouter } from "next/navigation"

interface CreateQualityCheckDialogProps {
    projectId: string
    assemblyOptions?: { id: string, name: string, assemblyNumber: string }[]
}

const PROCESS_STAGES = [
    'FABRICATION',
    'WELDING',
    'PAINTING',
    'FINAL'
]

const CHECK_TYPES = [
    'VISUAL',
    'DIMENSIONAL',
    'NDT',
    'COATING'
]

export function CreateQualityCheckDialog({ projectId, assemblyOptions = [] }: CreateQualityCheckDialogProps) {
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const router = useRouter()

    const [formData, setFormData] = useState({
        assemblyId: 'PROJECT_LEVEL',
        processStage: '',
        type: '',
        dueDate: '',
        notes: ''
    })

    const handleSubmit = async () => {
        if (!formData.processStage || !formData.type) {
            toast.error("Please fill in required fields")
            return
        }

        setLoading(true)
        try {
            const result = await createQualityCheck({
                projectId,
                assemblyId: formData.assemblyId === 'PROJECT_LEVEL' ? undefined : formData.assemblyId,
                processStage: formData.processStage,
                type: formData.type,
                dueDate: formData.dueDate ? new Date(formData.dueDate) : undefined,
                notes: formData.notes
            })

            if (result.success) {
                toast.success("Quality check created")
                setOpen(false)
                setFormData({
                    assemblyId: 'PROJECT_LEVEL',
                    processStage: '',
                    type: '',
                    dueDate: '',
                    notes: ''
                })
                router.refresh()
            } else {
                toast.error(result.error || "Failed to create quality check")
            }
        } catch (error) {
            toast.error("An unexpected error occurred")
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    New Inspection
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Create Quality Inspection</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">

                    {/* Assembly Selection */}
                    <div className="grid gap-2">
                        <Label>Assembly (Optional)</Label>
                        <Select
                            value={formData.assemblyId}
                            onValueChange={(val) => setFormData({ ...formData, assemblyId: val })}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Select assembly or Project Level" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="PROJECT_LEVEL">Project Level (General)</SelectItem>
                                {assemblyOptions.map(a => (
                                    <SelectItem key={a.id} value={a.id}>
                                        {a.assemblyNumber} - {a.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Process Stage */}
                    <div className="grid gap-2">
                        <Label>Process Stage</Label>
                        <Select
                            value={formData.processStage}
                            onValueChange={(val) => setFormData({ ...formData, processStage: val })}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Select stage" />
                            </SelectTrigger>
                            <SelectContent>
                                {PROCESS_STAGES.map(s => (
                                    <SelectItem key={s} value={s}>{s}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Type */}
                    <div className="grid gap-2">
                        <Label>Inspection Type</Label>
                        <Select
                            value={formData.type}
                            onValueChange={(val) => setFormData({ ...formData, type: val })}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                            <SelectContent>
                                {CHECK_TYPES.map(t => (
                                    <SelectItem key={t} value={t}>{t}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Due Date */}
                    <div className="grid gap-2">
                        <Label>Due Date</Label>
                        <Input
                            type="date"
                            value={formData.dueDate}
                            onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                        />
                    </div>

                    {/* Notes */}
                    <div className="grid gap-2">
                        <Label>Notes / Instructions</Label>
                        <Textarea
                            placeholder="Specific instructions for inspector..."
                            value={formData.notes}
                            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                    <Button onClick={handleSubmit} disabled={loading}>
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Create Inspection
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
