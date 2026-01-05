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
    suppliers: any[]
}

export function CreateInventoryDialog({ profiles: initialProfiles, standardProfiles, grades, shapes, suppliers }: CreateInventoryProps) {
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
        totalCost: '',
        invoiceNumber: ''
    })

    // Supplier State
    const [selectedSupplier, setSelectedSupplier] = useState('')

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
                supplierId: selectedSupplier || null,
                profileName: `${profile.type} ${profile.dimensions} (${selectedGrade})`,
                _id: Math.random().toString()
            }])

            // Reset fields
            setCurrent({
                lotId: '',
                length: current.length,
                quantity: '1',
                certificate: current.certificate,
                totalCost: '',
                invoiceNumber: current.invoiceNumber
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
                supplierId: i.supplierId || null,
                invoiceNumber: i.invoiceNumber || null,
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
            <DialogContent className="max-w-[95vw] sm:max-w-7xl w-full max-h-[90vh] overflow-hidden flex flex-col p-0 gap-0 border-none shadow-2xl">
                <div className="p-6 border-b border-border/50 bg-card/30 backdrop-blur-sm">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-bold tracking-tight">Add Inventory Batch</DialogTitle>
                        <DialogDescription className="text-base">Add multiple items to your stock. You can calculate profile weights if needed.</DialogDescription>
                    </DialogHeader>
                </div>

                <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-primary/10 hover:scrollbar-thumb-primary/20">
                    <div className="space-y-8">
                        {/* Inline Form for Desktop / Stacked for Mobile */}
                        <div className="glass p-6 rounded-xl shadow-inner-lg space-y-6">
                            <div className="flex items-center gap-3 pb-2 border-b border-border/30">
                                <div className="h-4 w-1 bg-primary rounded-full" />
                                <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">New Item Definition</h3>
                            </div>
                            <div className="space-y-6">
                                {/* Row 1: Identification & Profile */}
                                <div className="flex flex-col xl:flex-row gap-3 items-start xl:items-end w-full">
                                    {/* Lot ID */}
                                    <div className="space-y-2 w-full xl:w-36 shrink-0 xl:shrink">
                                        <Label className="text-xs uppercase text-muted-foreground tracking-wide font-semibold">Lot ID</Label>
                                        <Input
                                            placeholder="L-500"
                                            value={current.lotId}
                                            onChange={e => setCurrent({ ...current, lotId: e.target.value })}
                                            className="font-mono uppercase bg-card h-9"
                                        />
                                    </div>

                                    {/* Type */}
                                    <div className="space-y-2 w-full xl:w-40 shrink-0 xl:shrink">
                                        <Label className="text-xs uppercase text-muted-foreground tracking-wide font-semibold">Type</Label>
                                        <Popover open={openTypeCombo} onOpenChange={setOpenTypeCombo}>
                                            <PopoverTrigger asChild>
                                                <Button variant="outline" role="combobox" className="w-full justify-between px-2 font-normal bg-card h-9">
                                                    {selectedType || <span className="text-muted-foreground">Select...</span>}
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
                                                        <CommandGroup heading="Custom">
                                                            {shapes.map(s => (
                                                                <CommandItem key={s.id} value={s.id} onSelect={() => handleTypeSelect(s.id)}>
                                                                    <Check className={cn("mr-2 h-4 w-4", selectedType === s.id ? "opacity-100" : "opacity-0")} />
                                                                    {s.id}
                                                                </CommandItem>
                                                            ))}
                                                        </CommandGroup>
                                                    </CommandList>
                                                </Command>
                                            </PopoverContent>
                                        </Popover>
                                    </div>

                                    {/* Dimensions - Flexible Width */}
                                    <div className="space-y-2 w-full flex-1 min-w-[180px]">
                                        <Label className="text-xs uppercase text-muted-foreground tracking-wide font-semibold">Dimensions</Label>

                                        <div className="space-y-2">
                                            {/* Step 1: Always offer Active Profiles Combobox */}
                                            <Popover open={openDimCombo} onOpenChange={setOpenDimCombo}>
                                                <PopoverTrigger asChild>
                                                    <Button variant="outline" role="combobox" className="w-full justify-between px-2 font-normal bg-card h-9">
                                                        {selectedDim || <span className="text-muted-foreground">Select / Custom...</span>}
                                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                    </Button>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-[240px] p-0" align="start">
                                                    <Command>
                                                        <CommandInput value={dimSearch} onValueChange={setDimSearch} placeholder="Search or type custom..." />
                                                        <CommandList>
                                                            <CommandEmpty>
                                                                <Button onClick={() => {
                                                                    setSelectedDim(dimSearch);
                                                                    setCustomDim(dimSearch);
                                                                    // If it's a shape, try to auto-parse the custom input
                                                                    // e.g. "100x100x5" -> populate params
                                                                    setOpenDimCombo(false)
                                                                }} variant="ghost" className="w-full h-8 text-xs">
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

                                                            {/* Only show Standard Catalog for Standard Types (not generic shapes) to prevent noise */}
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

                                            {/* Step 2: If Shape (not standard type), show Param Inputs */}
                                            {/* Always show this for Shapes so user can see/edit the params derived from the selection */}
                                            {!isStandardType && activeShape && (
                                                <div className="flex gap-2">
                                                    {(activeShape.params as string[]).map(param => (
                                                        <div key={param} className="relative flex-1 min-w-[50px]">
                                                            <Input
                                                                placeholder={param}
                                                                className="h-9 px-1 text-center font-mono bg-card"
                                                                value={shapeParams[param] || ''}
                                                                onChange={e => updateShapeParam(param, e.target.value)}
                                                            />
                                                            <span className="absolute -bottom-3 left-0 w-full text-[9px] text-center text-muted-foreground uppercase">{param}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            {/* Fallback for "Custom" if no shape selected (shouldn't happen if logic correct) */}
                                            {!isStandardType && !activeShape && (
                                                <Input placeholder="Dims" value={customDim} onChange={e => setCustomDim(e.target.value)} className="h-9 bg-card" />
                                            )}
                                        </div>
                                    </div>

                                    {/* Grade */}
                                    <div className="space-y-2 w-full xl:w-28 shrink-0">
                                        <Label className="text-xs uppercase text-muted-foreground tracking-wide font-semibold">Grade</Label>
                                        <Select value={selectedGrade} onValueChange={setSelectedGrade}>
                                            <SelectTrigger className="bg-card h-9"><SelectValue placeholder="Grade" /></SelectTrigger>
                                            <SelectContent>
                                                {grades.map(g => <SelectItem key={g.id} value={g.name}>{g.name}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3 pt-6 pb-2 border-b border-border/30">
                                    <div className="h-4 w-1 bg-primary rounded-full" />
                                    <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Quantities & Logistics</h3>
                                </div>

                                {/* Row 2: Quantities, Cost, Weight, Action */}
                                <div className="flex flex-col xl:flex-row gap-3 items-start xl:items-end w-full">
                                    {/* Length */}
                                    <div className="space-y-2 w-full xl:w-32 shrink-0">
                                        <Label className="text-xs uppercase text-muted-foreground tracking-wide font-semibold">Length (mm)</Label>
                                        <Input type="number" value={current.length} onChange={e => setCurrent({ ...current, length: e.target.value })} className="bg-card h-9" />
                                    </div>

                                    {/* Qty */}
                                    <div className="space-y-2 w-full xl:w-20 shrink-0">
                                        <Label className="text-xs uppercase text-muted-foreground tracking-wide font-semibold">Qty</Label>
                                        <Input type="number" value={current.quantity} onChange={e => setCurrent({ ...current, quantity: e.target.value })} className="bg-card h-9" />
                                    </div>

                                    {/* Cost */}
                                    <div className="space-y-2 w-full xl:w-28 shrink-0 xl:shrink">
                                        <Label className="text-xs uppercase text-muted-foreground tracking-wide font-semibold">Cost (€)</Label>
                                        <Input type="number" step="0.01" value={current.totalCost} onChange={e => setCurrent({ ...current, totalCost: e.target.value })} className="bg-card h-9 text-right font-mono" />
                                    </div>

                                    {/* Weight (Manual/Calc) */}
                                    <div className="space-y-2 w-full xl:w-28 shrink-0 xl:shrink">
                                        <Label className="text-xs uppercase text-muted-foreground tracking-wide font-semibold">Weight (kg/m)</Label>
                                        <div className="relative">
                                            <Input
                                                value={manualWeight}
                                                onChange={e => setManualWeight(e.target.value)}
                                                className={cn("bg-card h-9 pr-7", calcedWeight > 0 ? "font-bold text-primary" : "")}
                                            />
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="absolute right-0 top-0 h-9 w-9 text-muted-foreground hover:text-foreground"
                                                onClick={() => handleCalculateWeight()}
                                                disabled={!selectedType}
                                                title="Recalculate"
                                            >
                                                <span className="text-sm">🧮</span>
                                            </Button>
                                        </div>
                                    </div>

                                    {/* Supplier */}
                                    <div className="space-y-2 w-full xl:w-36 shrink-0">
                                        <Label className="text-xs uppercase text-muted-foreground tracking-wide font-semibold">Supplier</Label>
                                        <Select value={selectedSupplier || 'none'} onValueChange={(v) => setSelectedSupplier(v === 'none' ? '' : v)}>
                                            <SelectTrigger className="bg-card h-9"><SelectValue placeholder="Optional" /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="none">None</SelectItem>
                                                {suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    {/* Invoice Number */}
                                    <div className="space-y-2 w-full xl:w-32 shrink-0">
                                        <Label className="text-xs uppercase text-muted-foreground tracking-wide font-semibold">Invoice #</Label>
                                        <Input placeholder="INV-001" value={current.invoiceNumber} onChange={e => setCurrent({ ...current, invoiceNumber: e.target.value })} className="bg-card h-9 font-mono" />
                                    </div>

                                    {/* File Upload (Condensed) */}
                                    <div className="space-y-2 w-full md:flex-1 min-w-[120px]">
                                        <Label className="text-xs uppercase text-muted-foreground tracking-wide font-semibold">Cert</Label>
                                        <div className="flex gap-2 items-center">
                                            <div className="flex-1">
                                                <FileUploader
                                                    bucketName="certificates"
                                                    currentValue={current.certificate}
                                                    onUploadComplete={(path) => setCurrent({ ...current, certificate: path })}
                                                    minimal={true}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Add Button */}
                                    <Button onClick={handleAddItem} className="w-full md:w-auto h-10 px-8 shrink-0 font-bold shadow-lg shadow-primary/20 transition-premium hover:-translate-y-0.5">Add Item</Button>
                                </div>
                            </div>
                        </div>

                        {/* Pending List */}
                        {items.length > 0 && (
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-lg font-bold tracking-tight">Pending Batch Items</h3>
                                    <Badge variant="secondary" className="px-3 py-1">{items.length} items</Badge>
                                </div>
                                <div className="border border-border/50 rounded-xl overflow-hidden shadow-lg bg-card/20 backdrop-blur-sm">
                                    <Table>
                                        <TableHeader><TableRow className="bg-muted/30 border-b border-border/50"><TableHead className="font-bold">Lot</TableHead><TableHead className="font-bold">Type</TableHead><TableHead className="font-bold">Dim</TableHead><TableHead className="font-bold">Ln</TableHead><TableHead className="font-bold">Qty</TableHead><TableHead className="font-bold">Cost</TableHead><TableHead className="w-10"></TableHead></TableRow></TableHeader>
                                        <TableBody>
                                            {items.map((item, idx) => (
                                                <TableRow key={item._id}>
                                                    <TableCell className="font-mono">{item.lotId}</TableCell>
                                                    <TableCell>{item.profileName?.split(' ')[0]}</TableCell>
                                                    <TableCell>{item.profileName?.split('(')[0].split(' ').slice(1).join(' ')}</TableCell>
                                                    <TableCell>{item.length}</TableCell>
                                                    <TableCell>{item.quantity}</TableCell>
                                                    <TableCell>{item.totalCost}</TableCell>
                                                    <TableCell><Button size="sm" variant="ghost" onClick={() => setItems(items.filter((_, i) => i !== idx))} className="h-6 w-6 p-0 text-red-500">×</Button></TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            </div>
                        )}

                        <Button onClick={handleSaveAll} className="w-full h-12 text-lg font-bold shadow-xl transition-premium hover:-translate-y-1" disabled={loading || items.length === 0} variant={items.length > 0 ? "default" : "secondary"}>
                            {loading ? 'Saving...' : `Save Batch (${items.length} items)`}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
