'use client'

import { useState, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ensureProfile, createInventoryBatch } from "@/app/actions/inventory"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { FileUploader } from "@/components/ui/file-uploader"
import { FileViewer } from "@/components/ui/file-viewer"
import { toast } from "sonner"
import { Check, ChevronsUpDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"

import { calculateProfileWeight } from "@/app/actions/calculator"

interface CreateInventoryProps {
    profiles: any[]
    standardProfiles: any[]
    grades: any[]
    shapes: any[]
}

export function CreateInventoryDialog({ profiles: initialProfiles, standardProfiles, grades, shapes }: CreateInventoryProps) {
    const [open, setOpen] = useState(false)
    const [profileOpen, setProfileOpen] = useState(false)
    const [profiles, setProfiles] = useState(initialProfiles)
    const [loading, setLoading] = useState(false)

    // Items List State
    const [items, setItems] = useState<any[]>([])

    // Current Form State
    const [current, setCurrent] = useState({
        lotId: '',
        length: '',
        quantity: '1',
        certificate: '',
        totalCost: ''
    })

    // New Profile Selection State
    const [selectedType, setSelectedType] = useState('')
    const [selectedDim, setSelectedDim] = useState('')
    const [customDim, setCustomDim] = useState('') // For custom dimensions input
    const [selectedGrade, setSelectedGrade] = useState('')
    const [manualWeight, setManualWeight] = useState('')

    // Custom Shape Logic
    const [shapeParams, setShapeParams] = useState<Record<string, string>>({})
    const [calcedWeight, setCalcedWeight] = useState(0)

    // Combobox states
    const [openTypeCombo, setOpenTypeCombo] = useState(false)
    const [openDimCombo, setOpenDimCombo] = useState(false)
    const [dimSearch, setDimSearch] = useState("")

    // Derived
    const uniqueTypes = Array.from(new Set(standardProfiles.map(p => p.type)))
    // Add custom types if not present
    const allTypes = Array.from(new Set([...uniqueTypes, ...shapes.map(s => s.id)]))

    // Helper to determine if selected type is Standard or Custom
    const isStandardType = uniqueTypes.includes(selectedType)
    const activeShape = shapes.find(s => s.id === selectedType)

    // Dimensions Logic
    // 1. Active: Profiles already in 'profiles' (SteelProfile table)
    const activeDims = profiles
        .filter(p => p.type === selectedType)
        .map(p => p.dimensions)
        .sort()

    // 2. Catalog: From 'standardProfiles', excluding active ones to avoid duplicates
    const catalogDims = standardProfiles
        .filter(p => p.type === selectedType)
        .map(p => p.dimensions)
        .filter(d => !activeDims.includes(d))
        .sort((a: string, b: string) => {
            // Numeric sort for dimensions if possible (e.g. "100x100" vs "120x120")
            const getVal = (s: string) => parseFloat(s.split(/[xX]/)[0]) || 0
            return getVal(a) - getVal(b)
        })

    // Auto-parse parameters from selectedDim string (e.g. "100x50x5")
    const hasAnyDims = activeDims.length > 0 || catalogDims.length > 0

    useEffect(() => {
        if (!selectedDim || !activeShape) return

        // Regex to split by 'x', '*', or spaces
        const parts = selectedDim.toLowerCase().split(/[x* ]+/).map(s => parseFloat(s)).filter(n => !isNaN(n))
        const params = activeShape.params as string[]

        if (parts.length > 0 && params.length > 0) {
            const newParams: Record<string, string> = {}

            // Map valid numbers to params in order
            // Special mappings for specific shapes if needed, but sequential is standard
            // RHS (b, h, t) <- 100x50x5
            // SHS (b, t) <- 100x5
            params.forEach((param, i) => {
                if (parts[i] !== undefined) {
                    newParams[param] = parts[i].toString()
                }
            })

            // Only update if meaningfully different to avoid loops
            const isDiff = Object.entries(newParams).some(([k, v]) => shapeParams[k] !== v)
            if (isDiff) {
                setShapeParams(prev => ({ ...prev, ...newParams }))
            }
        }
    }, [selectedDim, activeShape])

    // Handlers
    const handleTypeSelect = (t: string) => {
        const val = t === selectedType ? "" : t
        setSelectedType(val)
        setSelectedDim('')
        setCustomDim('')
        setManualWeight('')
        setShapeParams({})
        setOpenTypeCombo(false)
    }

    const handleDimSelect = (d: string) => {
        const val = d === selectedDim ? "" : d
        setSelectedDim(val)
        setCustomDim('')
        setOpenDimCombo(false)
    }

    const updateShapeParam = (param: string, val: string) => {
        const newParams = { ...shapeParams, [param]: val }
        setShapeParams(newParams)

        // Auto-construct customDim string
        if (activeShape) {
            const dimStr = (activeShape.params as string[]).map(p => newParams[p] || '?').join('x')
            setCustomDim(dimStr)
        }
    }

    // Calculation Effect
    useEffect(() => {
        if (!activeShape || !selectedGrade || !activeShape.formula) return

        const gradeObj = grades.find(g => g.name === selectedGrade)
        if (!gradeObj) return

        // Check valid params
        const numeric: Record<string, number> = {}
        const neededParams = activeShape.params as string[]

        let allValid = true
        for (const p of neededParams) {
            const val = parseFloat(shapeParams[p])
            if (isNaN(val)) {
                allValid = false
                break
            }
            numeric[p] = val
        }

        if (allValid) {
            import('@/lib/formula').then(({ evaluateFormula }) => {
                const areaMm2 = evaluateFormula(activeShape.formula!, numeric)
                // areaMm2 / 1000 * density => weight/m
                const weight = (areaMm2 / 1000) * gradeObj.density
                setManualWeight(weight.toFixed(2))
            })
        }
    }, [activeShape, shapeParams, selectedGrade, grades])

    // Auto-fill weight logic
    // When Type/Dim matches standard, use it. Else empty.
    const standardMatch = standardProfiles.find(p => p.type === selectedType && p.dimensions === (customDim || selectedDim))

    // Calculation Handler
    const handleCalculateWeight = async () => {
        if (!selectedType) return

        // If Standard
        if (isStandardType) {
            // ... actually we just use standardMatch
            if (standardMatch) {
                setManualWeight(standardMatch.weightPerMeter.toString())
                return
            }
        }

        // If Custom
        // Prepare params
        // Convert string params to numbers
        const numericParams: any = {}
        for (const [k, v] of Object.entries(shapeParams)) {
            numericParams[k] = parseFloat(v)
        }

        // Find Grade ID to pass for density lookup
        const gradeObj = grades.find(g => g.name === selectedGrade)
        if (gradeObj) {
            numericParams.gradeId = gradeObj.id
        }

        try {
            const w = await calculateProfileWeight(selectedType, numericParams)
            setCalcedWeight(w)
            // Auto-set the manual weight input so user sees it
            setManualWeight(w.toFixed(2))
        } catch (e) {
            toast.error("Calculation failed")
        }
    }

    const handleAddItem = async () => {
        if (!current.lotId || !selectedType || !(selectedDim || customDim) || !selectedGrade || !current.length || !current.quantity) {
            toast.warning("Please fill required fields (Lot ID, Type, Dim, Grade, Length, Qty)")
            return
        }

        setLoading(true)
        try {
            // 1. Resolve Profile (Shape)
            const finalDim = customDim || selectedDim
            const weight = manualWeight ? parseFloat(manualWeight) : (standardMatch?.weightPerMeter || 0)

            const profile = await ensureProfile({
                type: selectedType,
                dimensions: finalDim,
                weight: weight
            })

            setItems([...items, {
                ...current,
                profileId: profile.id,
                gradeName: selectedGrade, // Pass name to batch creator to resolve ID
                profileName: `${profile.type} ${profile.dimensions} (${selectedGrade})`,
                _id: Math.random().toString()
            }])

            // Reset fields
            setCurrent({
                lotId: '',
                length: current.length,
                quantity: '1',
                certificate: current.certificate,
                totalCost: ''
            })
        } catch (e) {
            toast.error("Failed to resolve profile")
        } finally {
            setLoading(false)
        }
    }

    const handleSaveAll = async () => {
        if (items.length === 0) return
        setLoading(true)

        try {
            const res = await createInventoryBatch(items.map(i => ({
                lotId: i.lotId,
                profileId: i.profileId,
                gradeName: i.gradeName, // Pass grade name
                length: parseFloat(i.length),
                quantity: parseInt(i.quantity),
                certificate: i.certificate,
                totalCost: parseFloat(i.totalCost || '0')
            })))

            if (res.success) {
                setOpen(false)
                setItems([])
                toast.success("Inventory batch saved")
            } else {
                toast.error(`Error: ${res.error}`)
            }
        } catch (err) {
            toast.error("Unexpected error occurred.")
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button>Add Inventory</Button>
            </DialogTrigger>
            <DialogContent className="max-w-[95vw] w-auto min-w-[600px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Add Inventory Batch</DialogTitle>
                    <DialogDescription>Add multiple items to your stock. You can calculate profile weights if needed.</DialogDescription>
                </DialogHeader>

                <div className="space-y-6">
                    {/* Form Section */}
                    <div className="grid gap-4 border p-4 rounded bg-muted/50">
                        <div className="grid gap-6 py-4">
                            {/* Section: Identification */}
                            <div className="space-y-4">
                                <h4 className="text-sm font-medium leading-none text-muted-foreground border-b pb-2">Identification</h4>
                                <div className="grid gap-4">
                                    <div className="grid gap-2">
                                        <Label htmlFor="lotId" className="text-xs uppercase text-muted-foreground tracking-wide font-semibold">Lot ID</Label>
                                        <Input
                                            id="lotId"
                                            placeholder="e.g. L-500"
                                            value={current.lotId}
                                            onChange={e => setCurrent({ ...current, lotId: e.target.value })}
                                            className="font-mono uppercase transition-all bg-card/50 focus:ring-2 focus:ring-primary/20 h-10"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Section: Profile Definition */}
                            <div className="space-y-4">
                                <h4 className="text-sm font-medium leading-none text-muted-foreground border-b pb-2">Profile Definition</h4>
                                <div className="grid gap-4 md:grid-cols-4 items-end">
                                    {/* Type Selector */}
                                    <div className="md:col-span-1 space-y-2">
                                        <Label className="text-xs uppercase text-muted-foreground tracking-wide font-semibold">Type</Label>
                                        <Popover open={openTypeCombo} onOpenChange={setOpenTypeCombo}>
                                            <PopoverTrigger asChild>
                                                <Button variant="outline" role="combobox" aria-expanded={openTypeCombo} className="w-full justify-between px-3 font-normal bg-card/50 h-10">
                                                    {selectedType || <span className="text-muted-foreground">Select...</span>}
                                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-[220px] p-0" align="start">
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
                                                        <CommandGroup heading="Custom Shapes (Formulas)">
                                                            {shapes.map(s => (
                                                                <CommandItem key={s.id} value={s.id} onSelect={() => handleTypeSelect(s.id)}>
                                                                    <Check className={cn("mr-2 h-4 w-4", selectedType === s.id ? "opacity-100" : "opacity-0")} />
                                                                    {s.id} <span className="text-muted-foreground ml-1 text-xs">({s.name})</span>
                                                                </CommandItem>
                                                            ))}
                                                        </CommandGroup>
                                                    </CommandList>
                                                </Command>
                                            </PopoverContent>
                                        </Popover>
                                    </div>

                                    {/* Dimensions Selector */}
                                    <div className="md:col-span-1 space-y-2">
                                        <Label className="text-xs uppercase text-muted-foreground tracking-wide font-semibold">Dimensions</Label>
                                        {isStandardType ? (
                                            hasAnyDims || activeDims.length > 0 ? (
                                                <Popover open={openDimCombo} onOpenChange={setOpenDimCombo}>
                                                    <PopoverTrigger asChild>
                                                        <Button variant="outline" role="combobox" aria-expanded={openDimCombo} className="w-full justify-between px-3 font-normal bg-card/50 h-10">
                                                            {selectedDim || <span className="text-muted-foreground">Size...</span>}
                                                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                        </Button>
                                                    </PopoverTrigger>
                                                    <PopoverContent className="w-[240px] p-0" align="start">
                                                        <Command>
                                                            <CommandInput
                                                                placeholder="Search or '100x100x5'..."
                                                                value={dimSearch}
                                                                onValueChange={setDimSearch}
                                                            />
                                                            <CommandList>
                                                                <CommandEmpty>
                                                                    <div className="flex flex-col gap-2 p-2">
                                                                        <p className="text-xs text-muted-foreground text-center">No match.</p>
                                                                        <Button
                                                                            variant="secondary"
                                                                            size="sm"
                                                                            className="w-full text-xs h-7"
                                                                            onClick={() => {
                                                                                setSelectedDim(dimSearch); setCustomDim(dimSearch); setOpenDimCombo(false)
                                                                            }}
                                                                        >
                                                                            Use "{dimSearch}"
                                                                        </Button>
                                                                    </div>
                                                                </CommandEmpty>
                                                                <CommandGroup heading="Active Profiles">
                                                                    {activeDims.map(d => (
                                                                        <CommandItem key={d} value={d} onSelect={() => handleDimSelect(d)}>
                                                                            <Check className={cn("mr-2 h-4 w-4", selectedDim === d ? "opacity-100" : "opacity-0")} />
                                                                            {d}
                                                                        </CommandItem>
                                                                    ))}
                                                                </CommandGroup>
                                                                <CommandGroup heading="Standard Catalog">
                                                                    {catalogDims.map(d => (
                                                                        <CommandItem key={d} value={d} onSelect={() => handleDimSelect(d)}>
                                                                            <Check className={cn("mr-2 h-4 w-4", selectedDim === d ? "opacity-100" : "opacity-0")} />
                                                                            {d}
                                                                        </CommandItem>
                                                                    ))}
                                                                </CommandGroup>
                                                            </CommandList>
                                                        </Command>
                                                    </PopoverContent>
                                                </Popover>
                                            ) : <Input disabled placeholder="None available" className="bg-muted/20 h-10" />
                                        ) : (
                                            activeShape ? (
                                                <div className="flex flex-col gap-2">
                                                    <div className="flex gap-1">
                                                        {(activeShape.params as string[]).map(param => (
                                                            <div key={param} className="relative flex-1">
                                                                <Input
                                                                    placeholder={param}
                                                                    className="h-10 px-2 text-center font-mono text-sm bg-card/50 focus:ring-2 focus:ring-primary/20"
                                                                    value={shapeParams[param] || ''}
                                                                    onChange={e => updateShapeParam(param, e.target.value)}
                                                                />
                                                                <span className="absolute -bottom-3 left-0 w-full text-[9px] text-center text-muted-foreground uppercase tracking-tighter">{param}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            ) : <Input placeholder="Dims" value={customDim} onChange={e => setCustomDim(e.target.value)} className="h-10 bg-card/50" />
                                        )}
                                    </div>

                                    {/* Grade */}
                                    <div className="md:col-span-1 space-y-2">
                                        <Label className="text-xs uppercase text-muted-foreground tracking-wide font-semibold">Grade</Label>
                                        <Select value={selectedGrade} onValueChange={setSelectedGrade}>
                                            <SelectTrigger className="bg-card/50 h-10"><SelectValue placeholder="Grade" /></SelectTrigger>
                                            <SelectContent>
                                                {grades.map(g => <SelectItem key={g.id} value={g.name}>{g.name}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    {/* Weight Display */}
                                    <div className="md:col-span-1 space-y-2">
                                        <Label className="text-xs uppercase text-muted-foreground tracking-wide font-semibold">Weight (kg/m)</Label>
                                        <div className="flex items-center gap-2">
                                            <div className="relative w-full">
                                                <Input
                                                    type="number"
                                                    className={cn("pr-8 bg-secondary/30 border-secondary h-10 font-mono transition-colors", calcedWeight > 0 ? "text-primary font-bold bg-secondary/50" : "text-muted-foreground")}
                                                    value={manualWeight || (calcedWeight > 0 ? calcedWeight.toFixed(2) : '')}
                                                    placeholder="0.00"
                                                    onChange={e => setManualWeight(e.target.value)}
                                                />
                                                {calcedWeight > 0 && !manualWeight && (
                                                    <div className="absolute right-2 top-3">
                                                        <Badge variant="secondary" className="h-4 w-4 p-0 flex items-center justify-center rounded-full text-[8px] hover:bg-secondary">A</Badge>
                                                    </div>
                                                )}
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-10 w-10 text-muted-foreground hover:text-foreground"
                                                onClick={() => handleCalculateWeight()}
                                                disabled={!selectedType}
                                                title="Recalculate"
                                            >
                                                <span className="text-lg">🧮</span>
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Section: Inventory Details */}
                            <div className="space-y-4">
                                <h4 className="text-sm font-medium leading-none text-muted-foreground border-b pb-2">Batch Details</h4>
                                <div className="grid gap-4 md:grid-cols-3">
                                    <div className="space-y-2">
                                        <Label className="text-xs uppercase text-muted-foreground tracking-wide font-semibold">Length (mm)</Label>
                                        <Input
                                            type="number"
                                            placeholder="e.g. 6000"
                                            value={current.length}
                                            onChange={e => setCurrent({ ...current, length: e.target.value })}
                                            className="bg-card/50 h-10"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs uppercase text-muted-foreground tracking-wide font-semibold">Quantity</Label>
                                        <Input
                                            type="number"
                                            min="1"
                                            value={current.quantity}
                                            onChange={e => setCurrent({ ...current, quantity: e.target.value })}
                                            className="bg-card/50 h-10"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs uppercase text-muted-foreground tracking-wide font-semibold">Total Cost (€)</Label>
                                        <Input
                                            type="number"
                                            placeholder="0.00"
                                            step="0.01"
                                            value={current.totalCost}
                                            onChange={e => setCurrent({ ...current, totalCost: e.target.value })}
                                            className="text-right font-mono bg-card/50 h-10"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Section: Documents */}
                            <div className="space-y-4">
                                <h4 className="text-sm font-medium leading-none text-muted-foreground border-b pb-2">Documents</h4>
                                <div className="space-y-2">
                                    <Label className="text-xs uppercase text-muted-foreground tracking-wide font-semibold">Certificate (PDF)</Label>
                                    <FileUploader
                                        bucketName="certificates"
                                        currentValue={current.certificate}
                                        onUploadComplete={(path) => setCurrent({ ...current, certificate: path })}
                                    />
                                    {current.certificate && (
                                        <div className="mt-1">
                                            <FileViewer bucketName="certificates" path={current.certificate} fileName="Verify Upload" />
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Footer Actions */}
                            <div className="flex justify-between items-center pt-4 border-t mt-2">
                                <div className="text-xs text-muted-foreground">
                                    {items.length > 0 && <span>{items.length} items ready to add</span>}
                                </div>
                                <div className="flex gap-2">
                                    <Button
                                        type="button"
                                        onClick={handleAddItem}
                                        size="lg"
                                        className="w-full md:w-auto font-semibold shadow-md active:scale-95 transition-transform"
                                    >
                                        Add to Batch
                                    </Button>
                                </div>
                            </div>
                        </div>

                        {/* Pending Items List */}
                        {items.length > 0 && (
                            <div className="mt-6">
                                <h4 className="font-semibold mb-2">Pending Items ({items.length})</h4>
                                <div className="border rounded max-h-40 overflow-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Lot</TableHead>
                                                <TableHead>Profile</TableHead>
                                                <TableHead>Len</TableHead>
                                                <TableHead>Qty</TableHead>
                                                <TableHead>Cost</TableHead>
                                                <TableHead></TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {items.map((item, idx) => (
                                                <TableRow key={item._id}>
                                                    <TableCell>{item.lotId}</TableCell>
                                                    <TableCell>{item.profileName}</TableCell>
                                                    <TableCell>{item.length}</TableCell>
                                                    <TableCell>{item.quantity}</TableCell>
                                                    <TableCell>{item.totalCost}</TableCell>
                                                    <TableCell>
                                                        <Button size="sm" variant="ghost" onClick={() => setItems(items.filter((_, i) => i !== idx))}>x</Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            </div>
                        )}

                        <Button onClick={handleSaveAll} className="w-full" disabled={loading || items.length === 0}>
                            {loading ? 'Saving...' : `Save ${items.length} Items`}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog >
    )
}
