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
import { useRouter } from 'next/navigation'
import { createPart } from '@/app/actions/parts'
import { createPlatePart } from '@/app/actions/plateparts'
import { ensureProfile } from '@/app/actions/inventory'
import { calculateProfileWeight } from '@/app/actions/calculator'
import { toast } from 'sonner'
import { Plus, Package, Scissors, AlertTriangle, Check, ChevronsUpDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CreatePartDialogProps {
    projectId: string
    profiles: { id: string; type: string; dimensions: string; weightPerMeter: number }[]
    standardProfiles?: { type: string; dimensions: string; weightPerMeter: number }[]
    grades: { id: string; name: string }[]
    shapes?: { id: string; params: string[]; formula: string | null }[]
    inventory?: { profileId: string; quantity: number }[]  // Available stock
}

export function CreatePartDialog({
    projectId,
    profiles,
    standardProfiles = [],
    grades,
    shapes = [],
    inventory = []
}: CreatePartDialogProps) {
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const [tab, setTab] = useState<'profile' | 'plate'>('profile')
    const router = useRouter()

    // Shared fields
    const [partNumber, setPartNumber] = useState('')
    const [description, setDescription] = useState('')
    const [gradeId, setGradeId] = useState('')
    const [quantity, setQuantity] = useState('1')

    // Profile selection state (matching inventory dialog pattern)
    const [selectedType, setSelectedType] = useState('')
    const [selectedDim, setSelectedDim] = useState('')
    const [customDim, setCustomDim] = useState('')
    const [shapeParams, setShapeParams] = useState<Record<string, string>>({})
    const [manualWeight, setManualWeight] = useState('')

    // Combobox open states
    const [openTypeCombo, setOpenTypeCombo] = useState(false)
    const [openDimCombo, setOpenDimCombo] = useState(false)
    const [dimSearch, setDimSearch] = useState('')

    // Other profile fields
    const [length, setLength] = useState('')
    const [requiresWelding, setRequiresWelding] = useState(false)
    const [isOutsourcedCut, setIsOutsourcedCut] = useState(false)
    const [cutVendor, setCutVendor] = useState('')

    // Plate part fields
    const [material, setMaterial] = useState('')
    const [thickness, setThickness] = useState('')
    const [plateWidth, setPlateWidth] = useState('')
    const [plateLength, setPlateLength] = useState('')
    const [unitWeight, setUnitWeight] = useState('')
    const [supplier, setSupplier] = useState('')
    const [isPlateOutsourced, setIsPlateOutsourced] = useState(true)

    // Derived values
    const uniqueTypes = Array.from(new Set(standardProfiles.map(p => p.type)))
    const allTypes = Array.from(new Set([...uniqueTypes, ...shapes.map(s => s.id)]))
    const isStandardType = uniqueTypes.includes(selectedType)
    const activeShape = shapes.find(s => s.id === selectedType)

    // Active dims (from profiles table)
    const activeDims = profiles
        .filter(p => p.type === selectedType)
        .map(p => p.dimensions)
        .sort()

    // Catalog dims (from standardProfiles, excluding active ones)
    const catalogDims = standardProfiles
        .filter(p => p.type === selectedType)
        .map(p => p.dimensions)
        .filter(d => !activeDims.includes(d))
        .sort((a, b) => {
            const getVal = (s: string) => parseFloat(s.split(/[xX]/)[0]) || 0
            return getVal(a) - getVal(b)
        })

    // Find matching standard profile for weight
    const standardMatch = standardProfiles.find(
        p => p.type === selectedType && p.dimensions === (customDim || selectedDim)
    )

    // Find active profile for inventory check
    const activeProfile = profiles.find(
        p => p.type === selectedType && p.dimensions === (customDim || selectedDim)
    )

    // Inventory check
    const stock = activeProfile ? inventory.find(i => i.profileId === activeProfile.id) : null
    const needed = parseInt(quantity) || 0
    const available = stock?.quantity || 0
    const inventoryStatus = activeProfile
        ? (available >= needed ? 'available' : available > 0 ? 'insufficient' : 'missing')
        : 'unknown'

    // Auto-parse dimension string for shape params
    useEffect(() => {
        if (!selectedDim || !activeShape) return

        const parts = selectedDim.toLowerCase().split(/[x* ]+/).map(s => parseFloat(s)).filter(n => !isNaN(n))
        const params = activeShape.params as string[]

        if (parts.length > 0 && params.length > 0) {
            const newParams: Record<string, string> = {}
            params.forEach((param, i) => {
                if (parts[i] !== undefined) {
                    newParams[param] = parts[i].toString()
                }
            })
            const isDiff = Object.entries(newParams).some(([k, v]) => shapeParams[k] !== v)
            if (isDiff) {
                setShapeParams(prev => ({ ...prev, ...newParams }))
            }
        }
    }, [selectedDim, activeShape])

    // Auto-set weight from standard profile
    useEffect(() => {
        if (standardMatch && !manualWeight) {
            setManualWeight(standardMatch.weightPerMeter.toFixed(2))
        } else if (activeProfile && !manualWeight) {
            setManualWeight(activeProfile.weightPerMeter.toFixed(2))
        }
    }, [standardMatch, activeProfile])

    // Handlers
    const handleTypeSelect = (t: string) => {
        const val = t === selectedType ? '' : t
        setSelectedType(val)
        setSelectedDim('')
        setCustomDim('')
        setManualWeight('')
        setShapeParams({})
        setOpenTypeCombo(false)
    }

    const handleDimSelect = (d: string) => {
        setSelectedDim(d)
        setCustomDim('')
        setOpenDimCombo(false)
    }

    const updateShapeParam = (param: string, val: string) => {
        const newParams = { ...shapeParams, [param]: val }
        setShapeParams(newParams)

        if (activeShape) {
            const dimStr = (activeShape.params as string[]).map(p => newParams[p] || '?').join('x')
            setCustomDim(dimStr)
        }
    }

    const handleCalculateWeight = async () => {
        if (!selectedType) return

        if (standardMatch) {
            setManualWeight(standardMatch.weightPerMeter.toFixed(2))
            return
        }

        if (activeShape) {
            const numericParams: Record<string, number> = {}
            for (const [k, v] of Object.entries(shapeParams)) {
                numericParams[k] = parseFloat(v)
            }

            const gradeObj = grades.find(g => g.id === gradeId)
            if (gradeObj) {
                (numericParams as any).gradeId = gradeObj.id
            }

            try {
                const w = await calculateProfileWeight(selectedType, numericParams)
                setManualWeight(w.toFixed(2))
            } catch (e) {
                toast.error('Weight calculation failed')
            }
        }
    }

    const handleSubmit = async () => {
        if (!partNumber || !quantity) return
        setLoading(true)

        try {
            if (tab === 'profile') {
                if (!selectedType || !(selectedDim || customDim)) {
                    toast.warning('Please select a profile type and dimensions')
                    setLoading(false)
                    return
                }

                // Ensure profile exists
                const finalDim = customDim || selectedDim
                const weight = manualWeight ? parseFloat(manualWeight) : (standardMatch?.weightPerMeter || 0)

                const profile = await ensureProfile({
                    type: selectedType,
                    dimensions: finalDim,
                    weight: weight
                })

                const res = await createPart({
                    projectId,
                    partNumber,
                    description: description || undefined,
                    profileId: profile.id,
                    gradeId: gradeId || undefined,
                    length: length ? parseFloat(length) : undefined,
                    quantity: parseInt(quantity),
                    requiresWelding,
                    isOutsourcedCut,
                    cutVendor: isOutsourcedCut ? cutVendor : undefined
                })

                if (!res.success) {
                    toast.error(`Error: ${res.error}`)
                    setLoading(false)
                    return
                }
            } else {
                const res = await createPlatePart({
                    projectId,
                    partNumber,
                    description: description || undefined,
                    gradeId: gradeId || undefined,
                    material: material || undefined,
                    thickness: thickness ? parseFloat(thickness) : undefined,
                    width: plateWidth ? parseFloat(plateWidth) : undefined,
                    length: plateLength ? parseFloat(plateLength) : undefined,
                    quantity: parseInt(quantity),
                    unitWeight: unitWeight ? parseFloat(unitWeight) : undefined,
                    isOutsourced: isPlateOutsourced,
                    supplier: supplier || undefined
                })

                if (!res.success) {
                    toast.error(`Error: ${res.error}`)
                    setLoading(false)
                    return
                }
            }

            setOpen(false)
            resetForm()
            router.refresh()
            toast.success('Part created successfully')

        } catch (e: any) {
            toast.error('Failed to create part')
        } finally {
            setLoading(false)
        }
    }

    const resetForm = () => {
        setPartNumber('')
        setDescription('')
        setGradeId('')
        setQuantity('1')
        setSelectedType('')
        setSelectedDim('')
        setCustomDim('')
        setShapeParams({})
        setManualWeight('')
        setLength('')
        setRequiresWelding(false)
        setIsOutsourcedCut(false)
        setCutVendor('')
        setMaterial('')
        setThickness('')
        setPlateWidth('')
        setPlateLength('')
        setUnitWeight('')
        setSupplier('')
        setIsPlateOutsourced(true)
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button size="sm" className="gap-1">
                    <Plus className="h-4 w-4" /> Add Part
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col p-0 border-none shadow-2xl">
                <div className="p-6 pb-4 bg-card/30 backdrop-blur-sm border-b border-border/50">
                    <DialogTitle className="text-2xl font-bold tracking-tight">Add New Part</DialogTitle>
                    <DialogDescription className="mt-1">
                        Define specifications for profile components or plate parts.
                    </DialogDescription>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    <Tabs value={tab} onValueChange={(v) => setTab(v as 'profile' | 'plate')} className="w-full">
                        <TabsList className="grid w-full grid-cols-2 h-11 bg-muted/50 p-1 rounded-xl">
                            <TabsTrigger value="profile" className="gap-2 rounded-lg transition-premium data-[state=active]:shadow-lg">
                                <Package className="h-4 w-4" /> Profile Part
                            </TabsTrigger>
                            <TabsTrigger value="plate" className="gap-2 rounded-lg transition-premium data-[state=active]:shadow-lg">
                                <Scissors className="h-4 w-4" /> Plate Part
                            </TabsTrigger>
                        </TabsList>

                        {/* Common Fields Section */}
                        <div className="glass p-5 rounded-xl space-y-5">
                            <div className="flex items-center gap-3 pb-2 border-b border-border/30">
                                <div className="h-4 w-1 bg-primary rounded-full" />
                                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">General Information</h3>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="space-y-2">
                                    <Label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Part Number *</Label>
                                    <Input
                                        value={partNumber}
                                        onChange={e => setPartNumber(e.target.value)}
                                        placeholder={tab === 'profile' ? 'B-101' : 'PL-001'}
                                        className="font-mono uppercase h-10 bg-background/50"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Quantity *</Label>
                                    <Input
                                        type="number"
                                        min="1"
                                        value={quantity}
                                        onChange={e => setQuantity(e.target.value)}
                                        className="h-10 bg-background/50 font-bold"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Grade</Label>
                                    <Select value={gradeId} onValueChange={setGradeId}>
                                        <SelectTrigger className="h-10 bg-background/50">
                                            <SelectValue placeholder="Select grade" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {grades.map(g => (
                                                <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Description</Label>
                                <Input
                                    value={description}
                                    onChange={e => setDescription(e.target.value)}
                                    placeholder="e.g. Main beam section"
                                    className="h-10 bg-background/50"
                                />
                            </div>
                        </div>

                        {/* Profile Part Tab */}
                        <TabsContent value="profile" className="space-y-4 mt-0">
                            {/* Profile Specs Section */}
                            <div className="glass p-5 rounded-xl space-y-6">
                                <div className="flex items-center gap-3 pb-2 border-b border-border/30">
                                    <div className="h-4 w-1 bg-primary rounded-full" />
                                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Profile Specification</h3>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Type</Label>
                                        <Popover open={openTypeCombo} onOpenChange={setOpenTypeCombo}>
                                            <PopoverTrigger asChild>
                                                <Button variant="outline" role="combobox" className="w-full justify-between h-10 bg-background/50">
                                                    {selectedType || <span className="text-muted-foreground">Select type...</span>}
                                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-[200px] p-0" align="start">
                                                <Command>
                                                    <CommandInput placeholder="Search type..." />
                                                    <CommandList>
                                                        <CommandEmpty>No type found.</CommandEmpty>
                                                        <CommandGroup heading="Standard Profiles">
                                                            {uniqueTypes.map(t => (
                                                                <CommandItem key={t} value={t} onSelect={() => handleTypeSelect(t)}>
                                                                    <Check className={cn("mr-2 h-4 w-4", selectedType === t ? "opacity-100" : "opacity-0")} />
                                                                    {t}
                                                                </CommandItem>
                                                            ))}
                                                        </CommandGroup>
                                                        {shapes.length > 0 && (
                                                            <CommandGroup heading="Custom Shapes">
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

                                    {/* Dimensions Selection */}
                                    <div className="space-y-2">
                                        <Label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Dimensions</Label>
                                        <Popover open={openDimCombo} onOpenChange={setOpenDimCombo}>
                                            <PopoverTrigger asChild>
                                                <Button variant="outline" role="combobox" className="w-full justify-between h-10 bg-background/50" disabled={!selectedType}>
                                                    {customDim || selectedDim || <span className="text-muted-foreground">Select / Custom...</span>}
                                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-[240px] p-0" align="start">
                                                <Command>
                                                    <CommandInput value={dimSearch} onValueChange={setDimSearch} placeholder="Search or type custom..." />
                                                    <CommandList>
                                                        <CommandEmpty>
                                                            <Button
                                                                onClick={() => {
                                                                    setSelectedDim(dimSearch)
                                                                    setCustomDim(dimSearch)
                                                                    setOpenDimCombo(false)
                                                                }}
                                                                variant="ghost"
                                                                className="w-full h-8 text-xs"
                                                            >
                                                                Use Custom "{dimSearch}"
                                                            </Button>
                                                        </CommandEmpty>

                                                        {activeDims.length > 0 && (
                                                            <CommandGroup heading="Active Profiles">
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
                                </div>

                                {/* Shape Parameter Inputs */}
                                {!isStandardType && activeShape && (
                                    <div className="space-y-3 p-4 bg-muted/40 rounded-lg border border-border/50">
                                        <Label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Parameters</Label>
                                        <div className="flex gap-4">
                                            {(activeShape.params as string[]).map(param => (
                                                <div key={param} className="relative flex-1">
                                                    <Input
                                                        placeholder={param}
                                                        className="h-10 bg-background/80 text-center font-mono focus-visible:ring-primary/30"
                                                        value={shapeParams[param] || ''}
                                                        onChange={e => updateShapeParam(param, e.target.value)}
                                                    />
                                                    <span className="absolute -bottom-4 left-0 w-full text-[9px] text-center text-muted-foreground/60 uppercase font-bold">{param}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Length & Weight Section */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
                                    <div className="space-y-2 text-center md:text-left">
                                        <Label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold block">Length (mm)</Label>
                                        <Input
                                            type="number"
                                            value={length}
                                            onChange={e => setLength(e.target.value)}
                                            placeholder="e.g. 6000"
                                            className="h-10 bg-background/50 text-center md:text-left font-mono"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold text-center md:text-left block">Weight (kg/m)</Label>
                                        <div className="relative">
                                            <Input
                                                value={manualWeight}
                                                onChange={e => setManualWeight(e.target.value)}
                                                className={cn("h-10 bg-background/50 pr-8 font-mono text-center md:text-left", manualWeight ? "font-bold text-primary" : "")}
                                                placeholder="Auto"
                                            />
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="absolute right-0 top-0 h-10 w-10 text-muted-foreground hover:text-primary transition-colors"
                                                onClick={handleCalculateWeight}
                                                disabled={!selectedType}
                                                title="Calculate weight"
                                            >
                                                <span className="text-sm">🧮</span>
                                            </Button>
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold text-center md:text-left block">Requires Welding</Label>
                                        <Select value={requiresWelding ? 'yes' : 'no'} onValueChange={v => setRequiresWelding(v === 'yes')}>
                                            <SelectTrigger className="h-10 bg-background/50">
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

                            {/* Inventory & Outsourcing Section */}
                            <div className="space-y-4">
                                {inventoryStatus !== 'unknown' && (
                                    <div className={cn("flex items-center gap-3 text-xs font-bold uppercase tracking-wider p-4 rounded-xl border animate-in fade-in slide-in-from-top-2 duration-300",
                                        inventoryStatus === 'available' ? 'bg-green-500/10 text-green-600 border-green-500/20' :
                                            inventoryStatus === 'insufficient' ? 'bg-orange-500/10 text-orange-600 border-orange-500/20' : 'bg-red-500/10 text-red-600 border-red-500/20'
                                    )}>
                                        <div className={cn("h-6 w-6 rounded-full flex items-center justify-center",
                                            inventoryStatus === 'available' ? 'bg-green-500 text-white' :
                                                inventoryStatus === 'insufficient' ? 'bg-orange-500 text-white' : 'bg-red-500 text-white'
                                        )}>
                                            {inventoryStatus === 'available' ? <Check className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
                                        </div>
                                        <div className="flex-1">
                                            {inventoryStatus === 'available' ? (
                                                <span>Full allocation possible: {available} in stock</span>
                                            ) : inventoryStatus === 'insufficient' ? (
                                                <span>Insufficient stock: {available} available (need {needed})</span>
                                            ) : (
                                                <span>Material not in stock – Procure via RFQ</span>
                                            )}
                                        </div>
                                    </div>
                                )}

                                <div className="glass p-5 rounded-xl space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary">
                                                <Scissors className="h-3.5 w-3.5" />
                                            </div>
                                            <Label htmlFor="outsourcedCut" className="text-sm font-bold cursor-pointer">Outsourced Cutting</Label>
                                        </div>
                                        <input
                                            type="checkbox"
                                            id="outsourcedCut"
                                            checked={isOutsourcedCut}
                                            onChange={e => setIsOutsourcedCut(e.target.checked)}
                                            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary transition-premium cursor-pointer"
                                        />
                                    </div>
                                    {isOutsourcedCut && (
                                        <div className="space-y-2 animate-in fade-in slide-in-from-right-2 duration-300">
                                            <Label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Cutting Vendor</Label>
                                            <Input
                                                value={cutVendor}
                                                onChange={e => setCutVendor(e.target.value)}
                                                placeholder="e.g. LaserCut Ltd"
                                                className="h-10 bg-background/50"
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>
                        </TabsContent>

                        {/* Plate Part Tab */}
                        <TabsContent value="plate" className="space-y-6 mt-0">
                            <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl text-[13px] flex items-center gap-3 text-primary font-medium">
                                <Scissors className="h-5 w-5 shrink-0" />
                                <span>Plate parts represent items to be cut from sheet material, typically outsourced.</span>
                            </div>

                            <div className="glass p-5 rounded-xl space-y-6">
                                <div className="flex items-center gap-3 pb-2 border-b border-border/30">
                                    <div className="h-4 w-1 bg-primary rounded-full" />
                                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Dimensions & Material</h3>
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <div className="space-y-2">
                                        <Label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Material</Label>
                                        <Input
                                            value={material}
                                            onChange={e => setMaterial(e.target.value)}
                                            placeholder="S355"
                                            className="h-10 bg-background/50 font-bold"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Thick (mm)</Label>
                                        <Input
                                            type="number"
                                            value={thickness}
                                            onChange={e => setThickness(e.target.value)}
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
                                {thickness && plateWidth && plateLength && (
                                    <div className="flex items-center justify-between p-4 bg-green-500/5 border border-green-500/20 rounded-xl animate-in zoom-in-95 duration-300">
                                        <div className="flex items-center gap-2">
                                            <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                                            <span className="text-xs font-bold uppercase tracking-wider text-green-700">Calculated Weight</span>
                                        </div>
                                        <div className="text-xl font-mono font-black text-green-600">
                                            {((parseFloat(thickness) / 1000) * (parseFloat(plateWidth) / 1000) * (parseFloat(plateLength) / 1000) * 7850).toFixed(3)} <span className="text-xs font-normal">kg</span>
                                        </div>
                                    </div>
                                )}

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold text-center md:text-left block">Weight Override (kg)</Label>
                                        <Input
                                            type="number"
                                            value={unitWeight}
                                            onChange={e => setUnitWeight(e.target.value)}
                                            placeholder="Auto-calculated if blank"
                                            className="h-10 bg-background/50 font-mono"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold text-center md:text-left block">Preferred Supplier</Label>
                                        <Input
                                            value={supplier}
                                            onChange={e => setSupplier(e.target.value)}
                                            placeholder="LaserParts Co"
                                            className="h-10 bg-background/50"
                                        />
                                    </div>
                                </div>

                                <div className="p-4 border border-border/50 rounded-xl bg-muted/20 flex items-center justify-between">
                                    <div className="space-y-0.5">
                                        <Label htmlFor="plateOutsourced" className="text-sm font-bold cursor-pointer">Outsourced Process</Label>
                                        <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-tighter">Toggle between External and Internal production</p>
                                    </div>
                                    <input
                                        type="checkbox"
                                        id="plateOutsourced"
                                        checked={isPlateOutsourced}
                                        onChange={e => setIsPlateOutsourced(e.target.checked)}
                                        className="h-5 w-5 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer transition-premium"
                                    />
                                </div>
                            </div>
                        </TabsContent>
                    </Tabs>
                </div>

                <div className="p-6 bg-card/30 backdrop-blur-md border-t border-border/50 flex justify-end gap-3">
                    <Button variant="ghost" onClick={() => setOpen(false)} disabled={loading} className="transition-premium px-6">Cancel</Button>
                    <Button onClick={handleSubmit} disabled={loading || !partNumber || !quantity} className="min-w-[160px] shadow-xl shadow-primary/20 transition-premium active:scale-95 font-bold h-11">
                        {loading ? 'Processing...' : tab === 'profile' ? 'Create Profile Part' : 'Create Plate Part'}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}
