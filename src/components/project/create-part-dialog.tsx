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
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Add New Part</DialogTitle>
                    <DialogDescription>
                        Add a profile part (standard or custom) or a plate part for outsourced cutting.
                    </DialogDescription>
                </DialogHeader>

                <Tabs value={tab} onValueChange={(v) => setTab(v as 'profile' | 'plate')}>
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="profile" className="gap-2">
                            <Package className="h-4 w-4" /> Profile Part
                        </TabsTrigger>
                        <TabsTrigger value="plate" className="gap-2">
                            <Scissors className="h-4 w-4" /> Plate Part
                        </TabsTrigger>
                    </TabsList>

                    {/* Common Fields */}
                    <div className="grid gap-4 py-4 border-b mb-4">
                        <div className="grid grid-cols-3 gap-4">
                            <div className="grid gap-2">
                                <Label className="text-xs uppercase text-muted-foreground">Part Number *</Label>
                                <Input
                                    value={partNumber}
                                    onChange={e => setPartNumber(e.target.value)}
                                    placeholder={tab === 'profile' ? 'B-101' : 'PL-001'}
                                    className="font-mono uppercase"
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label className="text-xs uppercase text-muted-foreground">Quantity *</Label>
                                <Input
                                    type="number"
                                    min="1"
                                    value={quantity}
                                    onChange={e => setQuantity(e.target.value)}
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label className="text-xs uppercase text-muted-foreground">Grade</Label>
                                <Select value={gradeId} onValueChange={setGradeId}>
                                    <SelectTrigger>
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
                        <div className="grid gap-2">
                            <Label className="text-xs uppercase text-muted-foreground">Description</Label>
                            <Input
                                value={description}
                                onChange={e => setDescription(e.target.value)}
                                placeholder="e.g. Main beam section"
                            />
                        </div>
                    </div>

                    {/* Profile Part Tab */}
                    <TabsContent value="profile" className="space-y-4 mt-0">
                        {/* Type Selection */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label className="text-xs uppercase text-muted-foreground">Type</Label>
                                <Popover open={openTypeCombo} onOpenChange={setOpenTypeCombo}>
                                    <PopoverTrigger asChild>
                                        <Button variant="outline" role="combobox" className="w-full justify-between">
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
                            <div className="grid gap-2">
                                <Label className="text-xs uppercase text-muted-foreground">Dimensions</Label>
                                <Popover open={openDimCombo} onOpenChange={setOpenDimCombo}>
                                    <PopoverTrigger asChild>
                                        <Button variant="outline" role="combobox" className="w-full justify-between" disabled={!selectedType}>
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

                        {/* Shape Parameter Inputs (for custom shapes like RHS, SHS, CHS) */}
                        {!isStandardType && activeShape && (
                            <div className="grid gap-2">
                                <Label className="text-xs uppercase text-muted-foreground">Parameters</Label>
                                <div className="flex gap-2">
                                    {(activeShape.params as string[]).map(param => (
                                        <div key={param} className="relative flex-1 min-w-[50px]">
                                            <Input
                                                placeholder={param}
                                                className="text-center font-mono"
                                                value={shapeParams[param] || ''}
                                                onChange={e => updateShapeParam(param, e.target.value)}
                                            />
                                            <span className="absolute -bottom-4 left-0 w-full text-[9px] text-center text-muted-foreground uppercase">{param}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Length & Weight */}
                        <div className="grid grid-cols-3 gap-4 pt-2">
                            <div className="grid gap-2">
                                <Label className="text-xs uppercase text-muted-foreground">Length (mm)</Label>
                                <Input
                                    type="number"
                                    value={length}
                                    onChange={e => setLength(e.target.value)}
                                    placeholder="e.g. 6000"
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label className="text-xs uppercase text-muted-foreground">Weight (kg/m)</Label>
                                <div className="relative">
                                    <Input
                                        value={manualWeight}
                                        onChange={e => setManualWeight(e.target.value)}
                                        className={cn("pr-8", manualWeight ? "font-medium" : "")}
                                        placeholder="Auto"
                                    />
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="absolute right-0 top-0 h-9 w-9"
                                        onClick={handleCalculateWeight}
                                        disabled={!selectedType}
                                        title="Calculate weight"
                                    >
                                        <span className="text-sm">🧮</span>
                                    </Button>
                                </div>
                            </div>
                            <div className="grid gap-2">
                                <Label className="text-xs uppercase text-muted-foreground">Requires Welding</Label>
                                <Select value={requiresWelding ? 'yes' : 'no'} onValueChange={v => setRequiresWelding(v === 'yes')}>
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

                        {/* Inventory Status */}
                        {inventoryStatus !== 'unknown' && (
                            <div className={cn("flex items-center gap-2 text-sm p-2 rounded",
                                inventoryStatus === 'available' ? 'bg-green-50 text-green-700' :
                                    inventoryStatus === 'insufficient' ? 'bg-orange-50 text-orange-700' : 'bg-red-50 text-red-700'
                            )}>
                                {inventoryStatus === 'available' ? (
                                    <><Check className="h-4 w-4" /> {available} in stock</>
                                ) : inventoryStatus === 'insufficient' ? (
                                    <><AlertTriangle className="h-4 w-4" /> Only {available} in stock (need {needed})</>
                                ) : (
                                    <><AlertTriangle className="h-4 w-4" /> Not in stock - will need RFQ</>
                                )}
                            </div>
                        )}

                        {/* Outsourced Cutting */}
                        <div className="p-4 border rounded-lg bg-muted/30 space-y-3">
                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    id="outsourcedCut"
                                    checked={isOutsourcedCut}
                                    onChange={e => setIsOutsourcedCut(e.target.checked)}
                                    className="rounded"
                                />
                                <Label htmlFor="outsourcedCut" className="cursor-pointer">
                                    Outsourced Cutting (Laser/Plasma)
                                </Label>
                            </div>
                            {isOutsourcedCut && (
                                <div className="grid gap-2">
                                    <Label className="text-xs uppercase text-muted-foreground">Cutting Vendor</Label>
                                    <Input
                                        value={cutVendor}
                                        onChange={e => setCutVendor(e.target.value)}
                                        placeholder="e.g. LaserCut Ltd"
                                    />
                                </div>
                            )}
                        </div>
                    </TabsContent>

                    {/* Plate Part Tab */}
                    <TabsContent value="plate" className="space-y-4 mt-0">
                        <div className="p-3 bg-blue-50 text-blue-800 rounded-lg text-sm flex items-center gap-2">
                            <Scissors className="h-4 w-4" />
                            Plate parts are typically outsourced for laser/plasma cutting.
                        </div>

                        <div className="grid grid-cols-4 gap-4">
                            <div className="grid gap-2">
                                <Label className="text-xs uppercase text-muted-foreground">Material</Label>
                                <Input
                                    value={material}
                                    onChange={e => setMaterial(e.target.value)}
                                    placeholder="S355"
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label className="text-xs uppercase text-muted-foreground">Thickness (mm)</Label>
                                <Input
                                    type="number"
                                    value={thickness}
                                    onChange={e => setThickness(e.target.value)}
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
                        {thickness && plateWidth && plateLength && (
                            <div className="flex items-center gap-2 p-3 bg-green-50 text-green-800 rounded text-sm">
                                <span className="font-medium">Calculated Weight:</span>
                                <span className="font-mono">
                                    {((parseFloat(thickness) / 1000) * (parseFloat(plateWidth) / 1000) * (parseFloat(plateLength) / 1000) * 7850).toFixed(2)} kg
                                </span>
                                <span className="text-xs text-green-600">(per piece @ 7850 kg/m³)</span>
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label className="text-xs uppercase text-muted-foreground">Weight Override (kg)</Label>
                                <Input
                                    type="number"
                                    value={unitWeight}
                                    onChange={e => setUnitWeight(e.target.value)}
                                    placeholder="Auto-calculated if blank"
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label className="text-xs uppercase text-muted-foreground">Supplier</Label>
                                <Input
                                    value={supplier}
                                    onChange={e => setSupplier(e.target.value)}
                                    placeholder="LaserParts Co"
                                />
                            </div>
                        </div>

                        {/* Outsourced option */}
                        <div className="p-4 border rounded-lg bg-muted/30">
                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    id="plateOutsourced"
                                    checked={isPlateOutsourced}
                                    onChange={e => setIsPlateOutsourced(e.target.checked)}
                                    className="rounded"
                                />
                                <Label htmlFor="plateOutsourced" className="cursor-pointer">
                                    Outsourced (Laser/Plasma Cutting)
                                </Label>
                            </div>
                            {!isPlateOutsourced && (
                                <p className="text-xs text-muted-foreground mt-2">
                                    Cutting will be done in-house.
                                </p>
                            )}
                        </div>
                    </TabsContent>
                </Tabs>

                <DialogFooter className="mt-4">
                    <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                    <Button onClick={handleSubmit} disabled={loading || !partNumber || !quantity}>
                        {loading ? 'Creating...' : tab === 'profile' ? 'Create Profile Part' : 'Create Plate Part'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
