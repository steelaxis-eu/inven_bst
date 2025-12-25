'use client'

import { useState } from 'react'
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { useRouter } from 'next/navigation'
import { createAssembly, addPartToAssembly } from '@/app/actions/assemblies'
import { createPart } from '@/app/actions/parts'
import { ensureProfile } from '@/app/actions/inventory'
import { toast } from 'sonner'
import { Plus, Layers, Trash2, Package } from 'lucide-react'

interface PartItem {
    id?: string           // Existing part ID (if selected)
    partNumber: string
    description: string
    profileType: string
    profileDimensions: string
    gradeId: string
    gradeName: string
    length: number
    quantity: number
    quantityInAssembly: number
    isNew: boolean        // True if creating new part
}

interface CreateAssemblyDialogProps {
    projectId: string
    existingParts: { id: string; partNumber: string; description: string | null; profile?: { type: string; dimensions: string } | null }[]
    existingAssemblies: { id: string; assemblyNumber: string; name: string }[]
    grades: { id: string; name: string }[]
}

export function CreateAssemblyDialog({
    projectId,
    existingParts,
    existingAssemblies,
    grades
}: CreateAssemblyDialogProps) {
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const router = useRouter()

    // Assembly fields
    const [assemblyNumber, setAssemblyNumber] = useState('')
    const [name, setName] = useState('')
    const [description, setDescription] = useState('')
    const [parentId, setParentId] = useState('')
    const [scheduledDate, setScheduledDate] = useState('')
    const [notes, setNotes] = useState('')

    // Parts to add to assembly
    const [partItems, setPartItems] = useState<PartItem[]>([])

    // Part selection/creation mode
    const [partMode, setPartMode] = useState<'existing' | 'new'>('existing')
    const [selectedPartId, setSelectedPartId] = useState('')
    const [qtyInAssembly, setQtyInAssembly] = useState('1')

    // New part fields
    const [newPartNumber, setNewPartNumber] = useState('')
    const [newDescription, setNewDescription] = useState('')
    const [newProfileType, setNewProfileType] = useState('')
    const [newProfileDim, setNewProfileDim] = useState('')
    const [newGradeId, setNewGradeId] = useState('')
    const [newLength, setNewLength] = useState('')
    const [newQuantity, setNewQuantity] = useState('1')

    const handleAddExistingPart = () => {
        if (!selectedPartId || !qtyInAssembly) return

        const part = existingParts.find(p => p.id === selectedPartId)
        if (!part) return

        // Check if already added
        if (partItems.some(p => p.id === selectedPartId)) {
            toast.warning('Part already added to assembly')
            return
        }

        setPartItems([...partItems, {
            id: part.id,
            partNumber: part.partNumber,
            description: part.description || '',
            profileType: part.profile?.type || '',
            profileDimensions: part.profile?.dimensions || '',
            gradeId: '',
            gradeName: '',
            length: 0,
            quantity: 0,
            quantityInAssembly: parseInt(qtyInAssembly),
            isNew: false
        }])

        setSelectedPartId('')
        setQtyInAssembly('1')
    }

    const handleAddNewPart = () => {
        if (!newPartNumber || !newProfileType || !newProfileDim || !newQuantity) {
            toast.warning('Please fill required fields for new part')
            return
        }

        // Check for duplicate part number
        if (existingParts.some(p => p.partNumber === newPartNumber) ||
            partItems.some(p => p.partNumber === newPartNumber)) {
            toast.warning('Part number already exists')
            return
        }

        const grade = grades.find(g => g.id === newGradeId)

        setPartItems([...partItems, {
            partNumber: newPartNumber,
            description: newDescription,
            profileType: newProfileType,
            profileDimensions: newProfileDim,
            gradeId: newGradeId,
            gradeName: grade?.name || '',
            length: parseFloat(newLength) || 0,
            quantity: parseInt(newQuantity),
            quantityInAssembly: parseInt(newQuantity), // Default same as total qty
            isNew: true
        }])

        // Reset new part fields
        setNewPartNumber('')
        setNewDescription('')
        setNewProfileType('')
        setNewProfileDim('')
        setNewGradeId('')
        setNewLength('')
        setNewQuantity('1')
    }

    const removePart = (index: number) => {
        setPartItems(partItems.filter((_, i) => i !== index))
    }

    const handleSubmit = async () => {
        if (!assemblyNumber || !name) {
            toast.warning('Please enter assembly number and name')
            return
        }

        setLoading(true)
        try {
            // 1. Create the assembly
            const assemblyRes = await createAssembly({
                projectId,
                assemblyNumber,
                name,
                description: description || undefined,
                parentId: parentId || undefined,
                scheduledDate: scheduledDate ? new Date(scheduledDate) : undefined,
                notes: notes || undefined
            })

            if (!assemblyRes.success || !assemblyRes.data) {
                toast.error(`Failed to create assembly: ${assemblyRes.error}`)
                setLoading(false)
                return
            }

            const assemblyId = assemblyRes.data.id

            // 2. Create new parts and add all parts to assembly
            for (const item of partItems) {
                let partId = item.id

                if (item.isNew) {
                    // Ensure profile exists
                    const profile = await ensureProfile({
                        type: item.profileType,
                        dimensions: item.profileDimensions,
                        weight: 0 // Will be calculated or updated later
                    })

                    // Create the part
                    const partRes = await createPart({
                        projectId,
                        partNumber: item.partNumber,
                        description: item.description || undefined,
                        profileId: profile.id,
                        gradeId: item.gradeId || undefined,
                        length: item.length || undefined,
                        quantity: item.quantity
                    })

                    if (!partRes.success || !partRes.data) {
                        toast.error(`Failed to create part ${item.partNumber}: ${partRes.error}`)
                        continue
                    }

                    partId = partRes.data.id
                }

                if (partId) {
                    await addPartToAssembly(assemblyId, partId, item.quantityInAssembly)
                }
            }

            toast.success('Assembly created successfully')
            setOpen(false)
            resetForm()
            router.refresh()

        } catch (e: any) {
            toast.error('Failed to create assembly')
        } finally {
            setLoading(false)
        }
    }

    const resetForm = () => {
        setAssemblyNumber('')
        setName('')
        setDescription('')
        setParentId('')
        setScheduledDate('')
        setNotes('')
        setPartItems([])
        setSelectedPartId('')
        setQtyInAssembly('1')
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button size="sm" className="gap-1">
                    <Plus className="h-4 w-4" /> Add Assembly
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Layers className="h-5 w-5" /> Create Assembly
                    </DialogTitle>
                    <DialogDescription>
                        Create an assembly and add parts to it. You can select existing parts or create new ones.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6">
                    {/* Assembly Details */}
                    <div className="border rounded-lg p-4 space-y-4">
                        <h3 className="font-medium">Assembly Details</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label className="text-xs uppercase text-muted-foreground">Assembly Number *</Label>
                                <Input
                                    value={assemblyNumber}
                                    onChange={e => setAssemblyNumber(e.target.value)}
                                    placeholder="A-001"
                                    className="font-mono uppercase"
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label className="text-xs uppercase text-muted-foreground">Name *</Label>
                                <Input
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    placeholder="Main Frame"
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label className="text-xs uppercase text-muted-foreground">Parent Assembly</Label>
                                <Select value={parentId || '_none'} onValueChange={(v) => setParentId(v === '_none' ? '' : v)}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="None (Top-level)" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="_none">None (Top-level)</SelectItem>
                                        {existingAssemblies.map(a => (
                                            <SelectItem key={a.id} value={a.id}>
                                                {a.assemblyNumber} - {a.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="grid gap-2">
                                <Label className="text-xs uppercase text-muted-foreground">Scheduled Date</Label>
                                <Input
                                    type="date"
                                    value={scheduledDate}
                                    onChange={e => setScheduledDate(e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="grid gap-2">
                            <Label className="text-xs uppercase text-muted-foreground">Description</Label>
                            <Input
                                value={description}
                                onChange={e => setDescription(e.target.value)}
                                placeholder="Main structural frame assembly"
                            />
                        </div>
                    </div>

                    {/* Parts Section */}
                    <div className="border rounded-lg p-4 space-y-4">
                        <div className="flex justify-between items-center">
                            <h3 className="font-medium flex items-center gap-2">
                                <Package className="h-4 w-4" /> Parts in Assembly
                            </h3>
                            <div className="flex gap-2">
                                <Button
                                    size="sm"
                                    variant={partMode === 'existing' ? 'default' : 'outline'}
                                    onClick={() => setPartMode('existing')}
                                >
                                    Select Existing
                                </Button>
                                <Button
                                    size="sm"
                                    variant={partMode === 'new' ? 'default' : 'outline'}
                                    onClick={() => setPartMode('new')}
                                >
                                    Create New
                                </Button>
                            </div>
                        </div>

                        {/* Add Existing Part */}
                        {partMode === 'existing' && (
                            <div className="flex gap-3 items-end bg-muted/50 p-3 rounded">
                                <div className="flex-1 grid gap-2">
                                    <Label className="text-xs uppercase text-muted-foreground">Select Part</Label>
                                    <Select value={selectedPartId} onValueChange={setSelectedPartId}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Choose a part..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {existingParts.map(p => (
                                                <SelectItem key={p.id} value={p.id}>
                                                    {p.partNumber} - {p.description || p.profile?.type + ' ' + p.profile?.dimensions}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="w-24 grid gap-2">
                                    <Label className="text-xs uppercase text-muted-foreground">Qty in Asm</Label>
                                    <Input
                                        type="number"
                                        min="1"
                                        value={qtyInAssembly}
                                        onChange={e => setQtyInAssembly(e.target.value)}
                                    />
                                </div>
                                <Button onClick={handleAddExistingPart} disabled={!selectedPartId}>
                                    Add
                                </Button>
                            </div>
                        )}

                        {/* Add New Part */}
                        {partMode === 'new' && (
                            <div className="space-y-3 bg-muted/50 p-3 rounded">
                                <div className="grid grid-cols-4 gap-3">
                                    <div className="grid gap-2">
                                        <Label className="text-xs uppercase text-muted-foreground">Part # *</Label>
                                        <Input
                                            value={newPartNumber}
                                            onChange={e => setNewPartNumber(e.target.value)}
                                            placeholder="B-101"
                                            className="font-mono uppercase"
                                        />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label className="text-xs uppercase text-muted-foreground">Type *</Label>
                                        <Input
                                            value={newProfileType}
                                            onChange={e => setNewProfileType(e.target.value)}
                                            placeholder="HEA, RHS..."
                                        />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label className="text-xs uppercase text-muted-foreground">Dimensions *</Label>
                                        <Input
                                            value={newProfileDim}
                                            onChange={e => setNewProfileDim(e.target.value)}
                                            placeholder="200, 100x50x4"
                                        />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label className="text-xs uppercase text-muted-foreground">Grade</Label>
                                        <Select value={newGradeId} onValueChange={setNewGradeId}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Grade" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {grades.map(g => (
                                                    <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                                <div className="grid grid-cols-4 gap-3">
                                    <div className="grid gap-2">
                                        <Label className="text-xs uppercase text-muted-foreground">Length (mm)</Label>
                                        <Input
                                            type="number"
                                            value={newLength}
                                            onChange={e => setNewLength(e.target.value)}
                                            placeholder="6000"
                                        />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label className="text-xs uppercase text-muted-foreground">Total Qty *</Label>
                                        <Input
                                            type="number"
                                            min="1"
                                            value={newQuantity}
                                            onChange={e => setNewQuantity(e.target.value)}
                                        />
                                    </div>
                                    <div className="col-span-2 grid gap-2">
                                        <Label className="text-xs uppercase text-muted-foreground">Description</Label>
                                        <Input
                                            value={newDescription}
                                            onChange={e => setNewDescription(e.target.value)}
                                            placeholder="Main beam"
                                        />
                                    </div>
                                </div>
                                <Button onClick={handleAddNewPart} className="w-full">
                                    Add New Part
                                </Button>
                            </div>
                        )}

                        {/* Parts List */}
                        {partItems.length > 0 && (
                            <div className="border rounded overflow-hidden">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-muted/50">
                                            <TableHead>Part #</TableHead>
                                            <TableHead>Profile</TableHead>
                                            <TableHead>Description</TableHead>
                                            <TableHead className="text-center">Qty in Assembly</TableHead>
                                            <TableHead className="w-10"></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {partItems.map((item, idx) => (
                                            <TableRow key={idx}>
                                                <TableCell className="font-mono">
                                                    {item.partNumber}
                                                    {item.isNew && <Badge variant="outline" className="ml-2 text-xs">NEW</Badge>}
                                                </TableCell>
                                                <TableCell>
                                                    {item.profileType} {item.profileDimensions}
                                                </TableCell>
                                                <TableCell className="text-muted-foreground">{item.description}</TableCell>
                                                <TableCell className="text-center font-medium">{item.quantityInAssembly}</TableCell>
                                                <TableCell>
                                                    <Button
                                                        size="icon"
                                                        variant="ghost"
                                                        className="h-7 w-7 text-red-500"
                                                        onClick={() => removePart(idx)}
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        )}

                        {partItems.length === 0 && (
                            <p className="text-center text-muted-foreground py-4">
                                No parts added yet. Add parts above or create without parts.
                            </p>
                        )}
                    </div>
                </div>

                <DialogFooter className="mt-4">
                    <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                    <Button onClick={handleSubmit} disabled={loading || !assemblyNumber || !name}>
                        {loading ? 'Creating...' : `Create Assembly${partItems.length > 0 ? ` (${partItems.length} parts)` : ''}`}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
