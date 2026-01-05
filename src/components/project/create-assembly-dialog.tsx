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
import { createAssembly, addPartToAssembly, addPlatePartToAssembly } from '@/app/actions/assemblies'


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
    const [assemblyQuantity, setAssemblyQuantity] = useState('1')

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

        if (newPartType === 'plate' && (!newGradeId || !plateThickness)) {
            toast.warning('Grade and thickness required for plate')
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
            cutVendor: newPartType === 'profile' ? cutVendor : (isPlateOutsourced ? plateSupplier : ''),
            material: grade?.name || '',
            thickness: parseFloat(plateThickness) || 0,
            width: parseFloat(plateWidth) || 0,
            plateLength: parseFloat(plateLength) || 0,
            unitWeight: parseFloat(plateWeight) || 0,
            supplier: isPlateOutsourced ? plateSupplier : '',
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
        if (!assemblyNumber || !name || !assemblyQuantity) {
            toast.warning('Assembly number, name, and quantity required')
            return
        }

        setLoading(true)
        try {
            const assemblyRes = await createAssembly({
                projectId,
                assemblyNumber,
                name,
                quantity: parseInt(assemblyQuantity) || 1,
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
                        if (plateRes.data) {
                            await addPlatePartToAssembly(assemblyId, plateRes.data.id, item.quantityInAssembly)
                        }
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
        setParentId('')
        setScheduledDate('')
        setAssemblyQuantity('1')
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
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col p-0 border-none shadow-2xl">
                <div className="p-6 pb-4 bg-card/30 backdrop-blur-sm border-b border-border/50">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shadow-inner">
                            <Layers className="h-6 w-6" />
                        </div>
                        <div>
                            <DialogTitle className="text-2xl font-bold tracking-tight">Create New Assembly</DialogTitle>
                            <DialogDescription className="mt-1">
                                Define structural modules and assign components for production.
                            </DialogDescription>
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-8">

                    <div className="space-y-6">
                        {/* Assembly Details Section */}
                        <div className="glass p-6 rounded-2xl space-y-6">
                            <div className="flex items-center gap-3 pb-2 border-b border-border/30">
                                <div className="h-4 w-1 bg-primary rounded-full" />
                                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground/80">Assembly Metadata</h3>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <Label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Assembly Number *</Label>
                                    <Input
                                        value={assemblyNumber}
                                        onChange={e => setAssemblyNumber(e.target.value)}
                                        placeholder="A-001"
                                        className="h-11 font-mono uppercase bg-background/50 border-border/50 focus:ring-primary/20"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Name *</Label>
                                    <Input
                                        value={name}
                                        onChange={e => setName(e.target.value)}
                                        placeholder="Main Frame"
                                        className="h-11 bg-background/50 border-border/50"
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <Label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Quantity *</Label>
                                    <Input
                                        type="number"
                                        min="1"
                                        value={assemblyQuantity}
                                        onChange={e => setAssemblyQuantity(e.target.value)}
                                        placeholder="1"
                                        className="h-11 bg-background/50 border-border/50 font-bold text-lg"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Parent Assembly</Label>
                                    <Select value={parentId || '_none'} onValueChange={(v) => setParentId(v === '_none' ? '' : v)}>
                                        <SelectTrigger className="h-11 bg-background/50 border-border/50">
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
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <Label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Scheduled Production Date</Label>
                                    <Input
                                        type="date"
                                        value={scheduledDate}
                                        onChange={e => setScheduledDate(e.target.value)}
                                        className="h-11 bg-background/50 border-border/50 font-mono"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Technical Description</Label>
                                <Input
                                    value={description}
                                    onChange={e => setDescription(e.target.value)}
                                    placeholder="Main structural frame"
                                    className="h-11 bg-background/50 border-border/50"
                                />
                            </div>
                        </div>

                        {/* Component Assignment Section */}
                        <div className="glass p-6 rounded-2xl space-y-6">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-border/30">
                                <div className="flex items-center gap-3">
                                    <div className="h-4 w-1 bg-primary rounded-full" />
                                    <h3 className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground/80">Component Assignment</h3>
                                </div>
                                <div className="flex bg-muted/30 p-1 rounded-xl border border-border/50">
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        className={cn("h-8 rounded-lg text-xs font-bold transition-premium", partMode === 'existing' ? "bg-background shadow-sm text-primary" : "text-muted-foreground")}
                                        onClick={() => setPartMode('existing')}
                                    >
                                        Select Existing
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        className={cn("h-8 rounded-lg text-xs font-bold transition-premium", partMode === 'new' ? "bg-background shadow-sm text-primary" : "text-muted-foreground")}
                                        onClick={() => setPartMode('new')}
                                    >
                                        Create New Part
                                    </Button>
                                </div>
                            </div>

                            {/* Select Existing Component Flow */}
                            {partMode === 'existing' && (
                                <div className="bg-muted/10 border border-border/50 p-5 rounded-xl space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                                    <div className="flex flex-col md:flex-row gap-4 items-end">
                                        <div className="flex-1 space-y-2">
                                            <Label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Select Component from Project</Label>
                                            <Select value={selectedPartId} onValueChange={setSelectedPartId}>
                                                <SelectTrigger className="h-11 bg-background/80 border-border/50">
                                                    <SelectValue placeholder="Choose part..." />
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
                                        <div className="w-full md:w-32 space-y-2">
                                            <Label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Quantity</Label>
                                            <Input
                                                type="number"
                                                min="1"
                                                value={qtyInAssembly}
                                                onChange={e => setQtyInAssembly(e.target.value)}
                                                className="h-11 bg-background/80 border-border/50 text-center font-bold"
                                            />
                                        </div>
                                        <Button onClick={handleAddExistingPart} disabled={!selectedPartId} className="h-11 px-8 transition-premium font-bold shadow-lg shadow-primary/10">
                                            Assign
                                        </Button>
                                    </div>
                                </div>
                            )}

                            {/* Create New Component Flow */}
                            {partMode === 'new' && (
                                <div className="bg-muted/10 border border-border/50 p-5 rounded-xl space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                    <Tabs value={newPartType} onValueChange={(v) => setNewPartType(v as 'profile' | 'plate')} className="w-full">
                                        <TabsList className="grid w-full grid-cols-2 h-10 bg-muted/50 p-1 rounded-lg">
                                            <TabsTrigger value="profile" className="gap-2 rounded-md transition-premium">
                                                <Package className="h-4 w-4" /> Profile Part
                                            </TabsTrigger>
                                            <TabsTrigger value="plate" className="gap-2 rounded-md transition-premium">
                                                <Scissors className="h-4 w-4" /> Plate Part
                                            </TabsTrigger>
                                        </TabsList>

                                        {/* Sub-component Common Fields */}
                                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-4 border-t border-border/20 mt-4">
                                            <div className="space-y-2">
                                                <Label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Part # *</Label>
                                                <Input
                                                    value={newPartNumber}
                                                    onChange={e => setNewPartNumber(e.target.value)}
                                                    placeholder="B-101"
                                                    className="h-10 font-mono uppercase bg-background/50"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Quantity *</Label>
                                                <Input
                                                    type="number"
                                                    min="1"
                                                    value={newQuantity}
                                                    onChange={e => setNewQuantity(e.target.value)}
                                                    className="h-10 bg-background/50 font-bold"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Grade</Label>
                                                <Select value={newGradeId} onValueChange={setNewGradeId}>
                                                    <SelectTrigger className="h-10 bg-background/50">
                                                        <SelectValue placeholder="Grade" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {grades.map(g => (
                                                            <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Description</Label>
                                                <Input
                                                    value={newDescription}
                                                    onChange={e => setNewDescription(e.target.value)}
                                                    placeholder="Main beam"
                                                    className="h-10 bg-background/50"
                                                />
                                            </div>
                                        </div>

                                        {/* Profile Specification Tab */}
                                        <TabsContent value="profile" className="space-y-4 mt-6">
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                <div className="space-y-2">
                                                    <Label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Type</Label>
                                                    <Popover open={openTypeCombo} onOpenChange={setOpenTypeCombo}>
                                                        <PopoverTrigger asChild>
                                                            <Button variant="outline" className="w-full justify-between h-10 bg-background/50 font-bold">
                                                                {selectedType || <span className="text-muted-foreground">Select Type...</span>}
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
                                                <div className="space-y-2">
                                                    <Label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Dimensions</Label>
                                                    <Popover open={openDimCombo} onOpenChange={setOpenDimCombo}>
                                                        <PopoverTrigger asChild>
                                                            <Button variant="outline" className="w-full justify-between h-10 bg-background/50 font-bold" disabled={!selectedType}>
                                                                {customDim || selectedDim || <span className="text-muted-foreground">Dimensions...</span>}
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
                                                                        }} variant="ghost" className="w-full text-xs font-bold">
                                                                            Use Custom "{dimSearch}"
                                                                        </Button>
                                                                    </CommandEmpty>
                                                                    {activeDims.length > 0 && (
                                                                        <CommandGroup heading="Active Project Profiles">
                                                                            {activeDims.map(d => (
                                                                                <CommandItem key={d} value={d} onSelect={() => handleDimSelect(d)}>
                                                                                    <Check className={cn("mr-2 h-4 w-4", selectedDim === d ? "opacity-100" : "opacity-0")} />
                                                                                    {d}
                                                                                </CommandItem>
                                                                            ))}
                                                                        </CommandGroup>
                                                                    )}
                                                                    {isStandardType && catalogDims.length > 0 && (
                                                                        <CommandGroup heading="Standard Catalog">
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
                                                <div className="space-y-2">
                                                    <Label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Length (mm)</Label>
                                                    <Input
                                                        type="number"
                                                        value={newLength}
                                                        onChange={e => setNewLength(e.target.value)}
                                                        placeholder="6000"
                                                        className="h-10 bg-background/50 font-mono"
                                                    />
                                                </div>
                                            </div>
                                            <div className="flex flex-col md:flex-row md:items-center gap-4 p-4 border border-border/50 rounded-xl bg-background/40">
                                                <div className="flex items-center gap-3">
                                                    <input
                                                        type="checkbox"
                                                        id="profileOutsource"
                                                        checked={isOutsourcedCut}
                                                        onChange={e => setIsOutsourcedCut(e.target.checked)}
                                                        className="h-4 w-4 rounded border-gray-300 text-primary transition-premium cursor-pointer"
                                                    />
                                                    <Label htmlFor="profileOutsource" className="cursor-pointer text-sm font-bold">
                                                        Outsourced Cutting Process
                                                    </Label>
                                                </div>
                                                {isOutsourcedCut && (
                                                    <div className="flex-1 animate-in slide-in-from-left-2 duration-300">
                                                        <Input
                                                            value={cutVendor}
                                                            onChange={e => setCutVendor(e.target.value)}
                                                            placeholder="Vendor Name"
                                                            className="h-10 bg-background/80"
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        </TabsContent>

                                        {/* Plate Specification Tab */}
                                        <TabsContent value="plate" className="space-y-6 mt-6">
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                                <div className="space-y-2">
                                                    <Label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Thickness (mm) *</Label>
                                                    <Input
                                                        type="number"
                                                        value={plateThickness}
                                                        onChange={e => setPlateThickness(e.target.value)}
                                                        placeholder="10"
                                                        className="h-10 bg-background/50 font-mono"
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Width (mm)</Label>
                                                    <Input
                                                        type="number"
                                                        value={plateWidth}
                                                        onChange={e => setPlateWidth(e.target.value)}
                                                        placeholder="200"
                                                        className="h-10 bg-background/50 font-mono"
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Length (mm)</Label>
                                                    <Input
                                                        type="number"
                                                        value={plateLength}
                                                        onChange={e => setPlateLength(e.target.value)}
                                                        placeholder="400"
                                                        className="h-10 bg-background/50 font-mono"
                                                    />
                                                </div>
                                            </div>
                                            {/* Auto-calculated weight preview */}
                                            {plateThickness && plateWidth && plateLength && (
                                                <div className="flex items-center justify-between p-4 bg-green-500/5 border border-green-500/20 rounded-xl animate-in zoom-in-95 duration-300">
                                                    <div className="flex items-center gap-2">
                                                        <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                                                        <span className="text-xs font-black uppercase tracking-widest text-green-700">Theoretical Weight</span>
                                                    </div>
                                                    <div className="text-xl font-mono font-black text-green-600">
                                                        {((parseFloat(plateThickness) / 1000) * (parseFloat(plateWidth) / 1000) * (parseFloat(plateLength) / 1000) * 7850).toFixed(2)} <span className="text-xs font-normal">kg</span>
                                                    </div>
                                                </div>
                                            )}
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                <div className="space-y-2">
                                                    <Label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Weight Override (optional)</Label>
                                                    <Input
                                                        type="number"
                                                        value={plateWeight}
                                                        onChange={e => setPlateWeight(e.target.value)}
                                                        placeholder="Manual override in kg"
                                                        className="h-10 bg-background/50 font-mono"
                                                    />
                                                </div>
                                                {isPlateOutsourced && (
                                                    <div className="space-y-2 animate-in fade-in duration-300">
                                                        <Label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Preferred Vendor</Label>
                                                        <Input
                                                            value={plateSupplier}
                                                            onChange={e => setPlateSupplier(e.target.value)}
                                                            placeholder="LaserCut Co"
                                                            className="h-10 bg-background/80 font-bold"
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex items-center justify-between p-4 border border-border/50 rounded-xl bg-background/40">
                                                <div className="space-y-0.5">
                                                    <Label htmlFor="plateOutsource" className="text-sm font-bold cursor-pointer">Outsourced Process</Label>
                                                    <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-tight">External Laser/Plasma Cutting</p>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    {!isPlateOutsourced && (
                                                        <Badge className="bg-primary/10 text-primary border-primary/20 hover:bg-primary/20 transition-colors uppercase text-[10px] font-black">In-House</Badge>
                                                    )}
                                                    <input
                                                        type="checkbox"
                                                        id="plateOutsource"
                                                        checked={isPlateOutsourced}
                                                        onChange={e => setIsPlateOutsourced(e.target.checked)}
                                                        className="h-5 w-5 rounded border-gray-300 text-primary transition-premium cursor-pointer"
                                                    />
                                                </div>
                                            </div>
                                        </TabsContent>
                                    </Tabs>

                                    <Button onClick={handleAddNewPart} className="w-full h-11 transition-premium font-bold shadow-xl shadow-primary/10 active:scale-95">
                                        <Plus className="h-4 w-4 mr-2" /> Add Component to List
                                    </Button>
                                </div>
                            )}

                            {/* Added Components Table List */}
                            <div className="space-y-3">
                                <div className="flex items-center justify-between px-1">
                                    <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground/80">Assigned Components ({partItems.length})</h4>
                                </div>
                                {partItems.length > 0 ? (
                                    <div className="border border-border/50 rounded-2xl overflow-hidden bg-background/50 backdrop-blur-sm">
                                        <Table>
                                            <TableHeader>
                                                <TableRow className="bg-muted/30 hover:bg-muted/30 border-b border-border/50">
                                                    <TableHead className="text-[10px] font-bold uppercase tracking-widest h-10">Part #</TableHead>
                                                    <TableHead className="text-[10px] font-bold uppercase tracking-widest h-10">Type</TableHead>
                                                    <TableHead className="text-[10px] font-bold uppercase tracking-widest h-10">Specification</TableHead>
                                                    <TableHead className="text-[10px] font-bold uppercase tracking-widest h-10">Sourcing</TableHead>
                                                    <TableHead className="text-center text-[10px] font-bold uppercase tracking-widest h-10">Qty</TableHead>
                                                    <TableHead className="w-12 h-10"></TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {partItems.map((item, idx) => (
                                                    <TableRow key={idx} className="group hover:bg-primary/5 transition-colors border-b border-border/30">
                                                        <TableCell className="font-mono font-bold text-sm">
                                                            <div className="flex items-center gap-2">
                                                                {item.partNumber}
                                                                {item.isNew && <Badge className="bg-green-500/10 text-green-600 border-green-500/20 text-[9px] h-4 font-black">NEW</Badge>}
                                                            </div>
                                                        </TableCell>
                                                        <TableCell>
                                                            <div className="flex items-center gap-2">
                                                                {item.type === 'plate' ? <Scissors className="h-3 w-3 text-muted-foreground" /> : <Package className="h-3 w-3 text-muted-foreground" />}
                                                                <span className="text-xs font-medium">{item.type === 'plate' ? 'Plate' : 'Profile'}</span>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="text-xs text-muted-foreground font-medium">
                                                            {item.type === 'profile'
                                                                ? `${item.profileType} ${item.profileDimensions}`
                                                                : `${item.thickness}mm ${item.material || 'Steel'}`
                                                            }
                                                        </TableCell>
                                                        <TableCell>
                                                            <Badge variant="outline" className={cn("text-[10px] h-5 font-bold uppercase tracking-tight", item.isOutsourcedCut ? "border-amber-200 bg-amber-50 text-amber-700" : "border-blue-200 bg-blue-50 text-blue-700")}>
                                                                {item.isOutsourcedCut ? 'External' : 'Internal'}
                                                            </Badge>
                                                        </TableCell>
                                                        <TableCell className="text-center font-bold">{item.quantityInAssembly}</TableCell>
                                                        <TableCell>
                                                            <Button
                                                                size="icon"
                                                                variant="ghost"
                                                                className="h-8 w-8 text-muted-foreground hover:text-red-500 hover:bg-red-50 transition-premium opacity-0 group-hover:opacity-100"
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
                                ) : (
                                    <div className="flex flex-col items-center justify-center py-12 border border-dashed border-border/60 rounded-2xl bg-muted/5">
                                        <Package className="h-8 w-8 text-muted-foreground/30 mb-2" />
                                        <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">No components assigned</p>
                                        <p className="text-[10px] text-muted-foreground/60 mt-1">Select or create parts to include in this assembly</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-6 bg-card/30 backdrop-blur-md border-t border-border/50 flex justify-end gap-3">
                    <Button variant="ghost" onClick={() => setOpen(false)} disabled={loading} className="transition-premium px-6 font-bold">Cancel</Button>
                    <Button onClick={handleSubmit} disabled={loading || !assemblyNumber || !name} className="min-w-[180px] shadow-xl shadow-primary/20 transition-premium active:scale-95 font-black h-11 tracking-tight">
                        {loading ? 'Processing...' : `Build Assembly${partItems.length > 0 ? ` (${partItems.length})` : ''}`}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}
