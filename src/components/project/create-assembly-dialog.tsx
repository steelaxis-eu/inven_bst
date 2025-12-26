'use client'

import { useState, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { useRouter } from 'next/navigation'
import { createAssembly, addPartToAssembly } from '@/app/actions/assemblies'
import { createPart } from '@/app/actions/parts'
import { createPlatePart } from '@/app/actions/plateparts'
import { ensureProfile } from '@/app/actions/inventory'
import { toast } from 'sonner'
import { Plus, Layers, Trash2, Package, Scissors, ChevronsUpDown, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PartItem {
    id?: string
    partNumber: string
    description: string
    type: 'profile' | 'plate'
    profileType: string
    profileDimensions: string
    gradeId: string
    gradeName: string
    length: number
    quantity: number
    quantityInAssembly: number
    isOutsourcedCut: boolean
    cutVendor: string
    // Plate specific
    material: string
    thickness: number
    width: number
    plateLength: number
    unitWeight: number
    supplier: string
    isNew: boolean
}

interface CreateAssemblyDialogProps {
    projectId: string
    existingParts: { id: string; partNumber: string; description: string | null; profile?: { type: string; dimensions: string } | null }[]
    existingAssemblies: { id: string; assemblyNumber: string; name: string }[]
    profiles: { id: string; type: string; dimensions: string; weightPerMeter: number }[]
    standardProfiles: { type: string; dimensions: string; weightPerMeter: number }[]
    grades: { id: string; name: string }[]
    shapes: { id: string; params: string[]; formula: string | null }[]
}

export function CreateAssemblyDialog({
    projectId,
    existingParts,
    existingAssemblies,
    profiles,
    standardProfiles,
    grades,
    shapes
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

    // Parts to add
    const [partItems, setPartItems] = useState<PartItem[]>([])

    // Part creation mode
    const [partMode, setPartMode] = useState<'existing' | 'new'>('existing')
    const [selectedPartId, setSelectedPartId] = useState('')
    const [qtyInAssembly, setQtyInAssembly] = useState('1')

    // New part type (profile or plate)
    const [newPartType, setNewPartType] = useState<'profile' | 'plate'>('profile')

    // New part common fields
    const [newPartNumber, setNewPartNumber] = useState('')
    const [newDescription, setNewDescription] = useState('')
    const [newGradeId, setNewGradeId] = useState('')
    const [newQuantity, setNewQuantity] = useState('1')

    // Profile fields
    const [selectedType, setSelectedType] = useState('')
    const [selectedDim, setSelectedDim] = useState('')
    const [customDim, setCustomDim] = useState('')
    const [newLength, setNewLength] = useState('')
    const [isOutsourcedCut, setIsOutsourcedCut] = useState(false)
    const [cutVendor, setCutVendor] = useState('')

    // Plate fields
    const [plateMaterial, setPlateMaterial] = useState('')
    const [plateThickness, setPlateThickness] = useState('')
    const [plateWidth, setPlateWidth] = useState('')
    const [plateLength, setPlateLength] = useState('')
    const [plateWeight, setPlateWeight] = useState('')
    const [plateSupplier, setPlateSupplier] = useState('')
    const [isPlateOutsourced, setIsPlateOutsourced] = useState(true) // Default outsourced

    // Combobox states
    const [openTypeCombo, setOpenTypeCombo] = useState(false)
    const [openDimCombo, setOpenDimCombo] = useState(false)
    const [dimSearch, setDimSearch] = useState('')

    // Derived values
    const uniqueTypes = Array.from(new Set(standardProfiles.map(p => p.type)))
    const isStandardType = uniqueTypes.includes(selectedType)

    const activeDims = profiles
        .filter(p => p.type === selectedType)
        .map(p => p.dimensions)
        .sort()

    const catalogDims = standardProfiles
        .filter(p => p.type === selectedType)
        .map(p => p.dimensions)
        .filter(d => !activeDims.includes(d))
        .sort((a, b) => {
            const getVal = (s: string) => parseFloat(s.split(/[xX]/)[0]) || 0
            return getVal(a) - getVal(b)
        })

    const handleTypeSelect = (t: string) => {
        setSelectedType(t === selectedType ? '' : t)
        setSelectedDim('')
        setCustomDim('')
        setOpenTypeCombo(false)
    }

    const handleDimSelect = (d: string) => {
        setSelectedDim(d)
        setCustomDim('')
        setOpenDimCombo(false)
    }

    const handleAddExistingPart = () => {
        if (!selectedPartId || !qtyInAssembly) return

        const part = existingParts.find(p => p.id === selectedPartId)
        if (!part) return

        if (partItems.some(p => p.id === selectedPartId)) {
            toast.warning('Part already added')
            return
        }

        setPartItems([...partItems, {
            id: part.id,
            partNumber: part.partNumber,
            description: part.description || '',
            type: 'profile',
            profileType: part.profile?.type || '',
            profileDimensions: part.profile?.dimensions || '',
            gradeId: '',
            gradeName: '',
            length: 0,
            quantity: 0,
            quantityInAssembly: parseInt(qtyInAssembly),
            isOutsourcedCut: false,
            cutVendor: '',
            material: '',
            thickness: 0,
            width: 0,
            plateLength: 0,
            unitWeight: 0,
            supplier: '',
            isNew: false
        }])

        setSelectedPartId('')
        setQtyInAssembly('1')
    }

    const handleAddNewPart = () => {
        if (!newPartNumber || !newQuantity) {
            toast.warning('Part number and quantity required')
            return
        }

        if (newPartType === 'profile' && (!selectedType || !(selectedDim || customDim))) {
            toast.warning('Profile type and dimensions required')
            return
        }

        if (newPartType === 'plate' && (!plateMaterial || !plateThickness)) {
            toast.warning('Material and thickness required for plate')
            return
        }

        if (existingParts.some(p => p.partNumber === newPartNumber) ||
            partItems.some(p => p.partNumber === newPartNumber)) {
            toast.warning('Part number already exists')
            return
        }

        const grade = grades.find(g => g.id === newGradeId)

        setPartItems([...partItems, {
            partNumber: newPartNumber,
            description: newDescription,
            type: newPartType,
            profileType: selectedType,
            profileDimensions: customDim || selectedDim,
            gradeId: newGradeId,
            gradeName: grade?.name || '',
            length: parseFloat(newLength) || 0,
            quantity: parseInt(newQuantity),
            quantityInAssembly: parseInt(newQuantity),
            isOutsourcedCut: newPartType === 'profile' ? isOutsourcedCut : isPlateOutsourced,
            cutVendor: newPartType === 'profile' ? cutVendor : plateSupplier,
            material: plateMaterial,
            thickness: parseFloat(plateThickness) || 0,
            width: parseFloat(plateWidth) || 0,
            plateLength: parseFloat(plateLength) || 0,
            unitWeight: parseFloat(plateWeight) || 0,
            supplier: plateSupplier,
            isNew: true
        }])

        resetNewPartFields()
    }

    const resetNewPartFields = () => {
        setNewPartNumber('')
        setNewDescription('')
        setNewGradeId('')
        setNewQuantity('1')
        setSelectedType('')
        setSelectedDim('')
        setCustomDim('')
        setNewLength('')
        setIsOutsourcedCut(false)
        setCutVendor('')
        setPlateMaterial('')
        setPlateThickness('')
        setPlateWidth('')
        setPlateLength('')
        setPlateWeight('')
        setPlateSupplier('')
        setIsPlateOutsourced(true)
    }

    const removePart = (index: number) => {
        setPartItems(partItems.filter((_, i) => i !== index))
    }

    const handleSubmit = async () => {
        if (!assemblyNumber || !name) {
            toast.warning('Assembly number and name required')
            return
        }

        setLoading(true)
        try {
            const assemblyRes = await createAssembly({
                projectId,
                assemblyNumber,
                name,
                description: description || undefined,
                parentId: parentId || undefined,
                scheduledDate: scheduledDate ? new Date(scheduledDate) : undefined
            })

            if (!assemblyRes.success || !assemblyRes.data) {
                toast.error(`Failed: ${assemblyRes.error}`)
                setLoading(false)
                return
            }

            const assemblyId = assemblyRes.data.id

            for (const item of partItems) {
                let partId = item.id

                if (item.isNew) {
                    if (item.type === 'profile') {
                        const profile = await ensureProfile({
                            type: item.profileType,
                            dimensions: item.profileDimensions,
                            weight: 0
                        })

                        const partRes = await createPart({
                            projectId,
                            partNumber: item.partNumber,
                            description: item.description || undefined,
                            profileId: profile.id,
                            gradeId: item.gradeId || undefined,
                            length: item.length || undefined,
                            quantity: item.quantity,
                            isOutsourcedCut: item.isOutsourcedCut,
                            cutVendor: item.cutVendor || undefined
                        })

                        if (!partRes.success || !partRes.data) {
                            toast.error(`Failed to create ${item.partNumber}`)
                            continue
                        }
                        partId = partRes.data.id
                    } else {
                        const plateRes = await createPlatePart({
                            projectId,
                            partNumber: item.partNumber,
                            description: item.description || undefined,
                            gradeId: item.gradeId || undefined,
                            material: item.material || undefined,
                            thickness: item.thickness || undefined,
                            width: item.width || undefined,
                            length: item.plateLength || undefined,
                            quantity: item.quantity,
                            unitWeight: item.unitWeight || undefined,
                            supplier: item.supplier || undefined,
                            isOutsourced: item.isOutsourcedCut
                        })

                        if (!plateRes.success) {
                            toast.error(`Failed to create plate ${item.partNumber}`)
                            continue
                        }
                        // Plate parts don't go to assembly parts junction (tracked separately)
                        continue
                    }
                }

                if (partId) {
                    await addPartToAssembly(assemblyId, partId, item.quantityInAssembly)
                }
            }

            toast.success('Assembly created')
            setOpen(false)
            resetForm()
            router.refresh()

        } catch (e) {
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
        setPartItems([])
        setSelectedPartId('')
        setQtyInAssembly('1')
        resetNewPartFields()
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button size="sm" className="gap-1">
                    <Plus className="h-4 w-4" /> Add Assembly
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Layers className="h-5 w-5" /> Create Assembly
                    </DialogTitle>
                    <DialogDescription>
                        Create assembly with profile and plate parts. Plates default to outsourced.
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
                                placeholder="Main structural frame"
                            />
                        </div>
                    </div>

                    {/* Parts Section */}
                    <div className="border rounded-lg p-4 space-y-4">
                        <div className="flex justify-between items-center">
                            <h3 className="font-medium flex items-center gap-2">
                                <Package className="h-4 w-4" /> Parts
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

                        {/* Select Existing */}
                        {partMode === 'existing' && (
                            <div className="flex gap-3 items-end bg-muted/50 p-3 rounded">
                                <div className="flex-1 grid gap-2">
                                    <Label className="text-xs uppercase text-muted-foreground">Select Part</Label>
                                    <Select value={selectedPartId} onValueChange={setSelectedPartId}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Choose..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {existingParts.map(p => (
                                                <SelectItem key={p.id} value={p.id}>
                                                    {p.partNumber} - {p.description || `${p.profile?.type} ${p.profile?.dimensions}`}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="w-20 grid gap-2">
                                    <Label className="text-xs uppercase text-muted-foreground">Qty</Label>
                                    <Input
                                        type="number"
                                        min="1"
                                        value={qtyInAssembly}
                                        onChange={e => setQtyInAssembly(e.target.value)}
                                    />
                                </div>
                                <Button onClick={handleAddExistingPart} disabled={!selectedPartId}>Add</Button>
                            </div>
                        )}

                        {/* Create New */}
                        {partMode === 'new' && (
                            <div className="bg-muted/50 p-3 rounded space-y-4">
                                <Tabs value={newPartType} onValueChange={(v) => setNewPartType(v as 'profile' | 'plate')}>
                                    <TabsList className="grid w-full grid-cols-2">
                                        <TabsTrigger value="profile" className="gap-2">
                                            <Package className="h-4 w-4" /> Profile
                                        </TabsTrigger>
                                        <TabsTrigger value="plate" className="gap-2">
                                            <Scissors className="h-4 w-4" /> Plate
                                        </TabsTrigger>
                                    </TabsList>

                                    {/* Common fields */}
                                    <div className="grid grid-cols-4 gap-3 pt-3">
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
                                            <Label className="text-xs uppercase text-muted-foreground">Qty *</Label>
                                            <Input
                                                type="number"
                                                min="1"
                                                value={newQuantity}
                                                onChange={e => setNewQuantity(e.target.value)}
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
                                        <div className="grid gap-2">
                                            <Label className="text-xs uppercase text-muted-foreground">Description</Label>
                                            <Input
                                                value={newDescription}
                                                onChange={e => setNewDescription(e.target.value)}
                                                placeholder="Main beam"
                                            />
                                        </div>
                                    </div>

                                    {/* Profile Tab */}
                                    <TabsContent value="profile" className="space-y-3 mt-3">
                                        <div className="grid grid-cols-3 gap-3">
                                            <div className="grid gap-2">
                                                <Label className="text-xs uppercase text-muted-foreground">Type</Label>
                                                <Popover open={openTypeCombo} onOpenChange={setOpenTypeCombo}>
                                                    <PopoverTrigger asChild>
                                                        <Button variant="outline" className="w-full justify-between">
                                                            {selectedType || <span className="text-muted-foreground">Select...</span>}
                                                            <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                                                        </Button>
                                                    </PopoverTrigger>
                                                    <PopoverContent className="w-[200px] p-0" align="start">
                                                        <Command>
                                                            <CommandInput placeholder="Search..." />
                                                            <CommandList>
                                                                <CommandEmpty>Not found</CommandEmpty>
                                                                <CommandGroup heading="Standard">
                                                                    {uniqueTypes.map(t => (
                                                                        <CommandItem key={t} value={t} onSelect={() => handleTypeSelect(t)}>
                                                                            <Check className={cn("mr-2 h-4 w-4", selectedType === t ? "opacity-100" : "opacity-0")} />
                                                                            {t}
                                                                        </CommandItem>
                                                                    ))}
                                                                </CommandGroup>
                                                                {shapes.length > 0 && (
                                                                    <CommandGroup heading="Custom">
                                                                        {shapes.map(s => (
                                                                            <CommandItem key={s.id} value={s.id} onSelect={() => handleTypeSelect(s.id)}>
                                                                                <Check className={cn("mr-2 h-4 w-4", selectedType === s.id ? "opacity-100" : "opacity-0")} />
                                                                                {s.id}
                                                                            </CommandItem>
                                                                        ))}
                                                                    </CommandGroup>
                                                                )}
                                                            </CommandList>
                                                        </Command>
                                                    </PopoverContent>
                                                </Popover>
                                            </div>
                                            <div className="grid gap-2">
                                                <Label className="text-xs uppercase text-muted-foreground">Dimensions</Label>
                                                <Popover open={openDimCombo} onOpenChange={setOpenDimCombo}>
                                                    <PopoverTrigger asChild>
                                                        <Button variant="outline" className="w-full justify-between" disabled={!selectedType}>
                                                            {customDim || selectedDim || <span className="text-muted-foreground">Select...</span>}
                                                            <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                                                        </Button>
                                                    </PopoverTrigger>
                                                    <PopoverContent className="w-[220px] p-0" align="start">
                                                        <Command>
                                                            <CommandInput value={dimSearch} onValueChange={setDimSearch} placeholder="Search/custom..." />
                                                            <CommandList>
                                                                <CommandEmpty>
                                                                    <Button onClick={() => {
                                                                        setSelectedDim(dimSearch)
                                                                        setCustomDim(dimSearch)
                                                                        setOpenDimCombo(false)
                                                                    }} variant="ghost" className="w-full text-xs">
                                                                        Use "{dimSearch}"
                                                                    </Button>
                                                                </CommandEmpty>
                                                                {activeDims.length > 0 && (
                                                                    <CommandGroup heading="Active">
                                                                        {activeDims.map(d => (
                                                                            <CommandItem key={d} value={d} onSelect={() => handleDimSelect(d)}>
                                                                                <Check className={cn("mr-2 h-4 w-4", selectedDim === d ? "opacity-100" : "opacity-0")} />
                                                                                {d}
                                                                            </CommandItem>
                                                                        ))}
                                                                    </CommandGroup>
                                                                )}
                                                                {isStandardType && catalogDims.length > 0 && (
                                                                    <CommandGroup heading="Catalog">
                                                                        {catalogDims.map(d => (
                                                                            <CommandItem key={d} value={d} onSelect={() => handleDimSelect(d)}>
                                                                                <Check className={cn("mr-2 h-4 w-4", selectedDim === d ? "opacity-100" : "opacity-0")} />
                                                                                {d}
                                                                            </CommandItem>
                                                                        ))}
                                                                    </CommandGroup>
                                                                )}
                                                            </CommandList>
                                                        </Command>
                                                    </PopoverContent>
                                                </Popover>
                                            </div>
                                            <div className="grid gap-2">
                                                <Label className="text-xs uppercase text-muted-foreground">Length (mm)</Label>
                                                <Input
                                                    type="number"
                                                    value={newLength}
                                                    onChange={e => setNewLength(e.target.value)}
                                                    placeholder="6000"
                                                />
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4 p-3 border rounded bg-background">
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="checkbox"
                                                    id="profileOutsource"
                                                    checked={isOutsourcedCut}
                                                    onChange={e => setIsOutsourcedCut(e.target.checked)}
                                                    className="rounded"
                                                />
                                                <Label htmlFor="profileOutsource" className="cursor-pointer text-sm">
                                                    Outsourced Cutting
                                                </Label>
                                            </div>
                                            {isOutsourcedCut && (
                                                <Input
                                                    value={cutVendor}
                                                    onChange={e => setCutVendor(e.target.value)}
                                                    placeholder="Vendor"
                                                    className="flex-1"
                                                />
                                            )}
                                        </div>
                                    </TabsContent>

                                    {/* Plate Tab */}
                                    <TabsContent value="plate" className="space-y-3 mt-3">
                                        <div className="grid grid-cols-4 gap-3">
                                            <div className="grid gap-2">
                                                <Label className="text-xs uppercase text-muted-foreground">Material *</Label>
                                                <Input
                                                    value={plateMaterial}
                                                    onChange={e => setPlateMaterial(e.target.value)}
                                                    placeholder="S355"
                                                />
                                            </div>
                                            <div className="grid gap-2">
                                                <Label className="text-xs uppercase text-muted-foreground">Thickness *</Label>
                                                <Input
                                                    type="number"
                                                    value={plateThickness}
                                                    onChange={e => setPlateThickness(e.target.value)}
                                                    placeholder="10"
                                                />
                                            </div>
                                            <div className="grid gap-2">
                                                <Label className="text-xs uppercase text-muted-foreground">Width (mm)</Label>
                                                <Input
                                                    type="number"
                                                    value={plateWidth}
                                                    onChange={e => setPlateWidth(e.target.value)}
                                                    placeholder="200"
                                                />
                                            </div>
                                            <div className="grid gap-2">
                                                <Label className="text-xs uppercase text-muted-foreground">Length (mm)</Label>
                                                <Input
                                                    type="number"
                                                    value={plateLength}
                                                    onChange={e => setPlateLength(e.target.value)}
                                                    placeholder="400"
                                                />
                                            </div>
                                        </div>
                                        {/* Auto-calculated weight preview */}
                                        {plateThickness && plateWidth && plateLength && (
                                            <div className="flex items-center gap-2 p-2 bg-green-50 text-green-800 rounded text-xs">
                                                <span className="font-medium">Calculated:</span>
                                                <span className="font-mono">
                                                    {((parseFloat(plateThickness) / 1000) * (parseFloat(plateWidth) / 1000) * (parseFloat(plateLength) / 1000) * 7850).toFixed(2)} kg
                                                </span>
                                            </div>
                                        )}
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="grid gap-2">
                                                <Label className="text-xs uppercase text-muted-foreground">Weight Override</Label>
                                                <Input
                                                    type="number"
                                                    value={plateWeight}
                                                    onChange={e => setPlateWeight(e.target.value)}
                                                    placeholder="Auto-calc if blank"
                                                />
                                            </div>
                                            <div className="grid gap-2">
                                                <Label className="text-xs uppercase text-muted-foreground">Supplier</Label>
                                                <Input
                                                    value={plateSupplier}
                                                    onChange={e => setPlateSupplier(e.target.value)}
                                                    placeholder="LaserCut Co"
                                                />
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4 p-3 border rounded bg-background">
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="checkbox"
                                                    id="plateOutsource"
                                                    checked={isPlateOutsourced}
                                                    onChange={e => setIsPlateOutsourced(e.target.checked)}
                                                    className="rounded"
                                                />
                                                <Label htmlFor="plateOutsource" className="cursor-pointer text-sm">
                                                    Outsourced (Laser/Plasma)
                                                </Label>
                                            </div>
                                            {!isPlateOutsourced && (
                                                <Badge variant="outline">In-house cutting</Badge>
                                            )}
                                        </div>
                                    </TabsContent>
                                </Tabs>

                                <Button onClick={handleAddNewPart} className="w-full">
                                    Add {newPartType === 'profile' ? 'Profile' : 'Plate'} Part
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
                                            <TableHead>Type</TableHead>
                                            <TableHead>Profile/Material</TableHead>
                                            <TableHead>Cut</TableHead>
                                            <TableHead className="text-center">Qty</TableHead>
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
                                                    <Badge variant={item.type === 'plate' ? 'secondary' : 'default'}>
                                                        {item.type === 'plate' ? 'Plate' : 'Profile'}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    {item.type === 'profile'
                                                        ? `${item.profileType} ${item.profileDimensions}`
                                                        : `${item.material} ${item.thickness}mm`
                                                    }
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant={item.isOutsourcedCut ? 'outline' : 'default'} className="text-xs">
                                                        {item.isOutsourcedCut ? 'Outsource' : 'In-house'}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-center">{item.quantityInAssembly}</TableCell>
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
                                No parts added. Add parts or create without.
                            </p>
                        )}
                    </div>
                </div>

                <DialogFooter className="mt-4">
                    <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                    <Button onClick={handleSubmit} disabled={loading || !assemblyNumber || !name}>
                        {loading ? 'Creating...' : `Create Assembly${partItems.length > 0 ? ` (${partItems.length})` : ''}`}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
