'use client'

import { useState, useEffect } from 'react'
import { Button } from "@/components/ui/button"
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

    const availableDims = standardProfiles
        .filter(p => p.type === selectedType)
        .map(p => p.dimensions)

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
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label>Lot ID</Label>
                                <Input
                                    className="bg-background"
                                    value={current.lotId}
                                    onChange={e => setCurrent({ ...current, lotId: e.target.value })}
                                    placeholder="e.g. L-500"
                                />
                            </div>

                            {/* New Profile Selectors */}
                            <div className="grid gap-4 col-span-1 md:col-span-2 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 items-end">
                                <div>
                                    <Label>Type</Label>
                                    <Popover open={openTypeCombo} onOpenChange={setOpenTypeCombo}>
                                        <PopoverTrigger asChild>
                                            <Button variant="outline" role="combobox" aria-expanded={openTypeCombo} className="w-full justify-between px-3 font-normal">
                                                {selectedType || "Select type..."}
                                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-[200px] p-0">
                                            <Command>
                                                <CommandInput placeholder="Search type..." />
                                                <CommandList>
                                                    <CommandEmpty>No type found.</CommandEmpty>
                                                    <CommandGroup heading="Standard Profiles">
                                                        {uniqueTypes.map(t => (
                                                            <CommandItem
                                                                key={t}
                                                                value={t}
                                                                onSelect={(currentValue) => {
                                                                    setSelectedType(currentValue === selectedType ? "" : currentValue)
                                                                    setSelectedDim('')
                                                                    setCustomDim('')
                                                                    setManualWeight('')
                                                                    setShapeParams({})
                                                                    setOpenTypeCombo(false)
                                                                }}
                                                            >
                                                                <Check className={cn("mr-2 h-4 w-4", selectedType === t ? "opacity-100" : "opacity-0")} />
                                                                {t}
                                                            </CommandItem>
                                                        ))}
                                                    </CommandGroup>
                                                    <CommandGroup heading="Custom Shapes">
                                                        {shapes.map(s => (
                                                            <CommandItem
                                                                key={s.id}
                                                                value={s.id}
                                                                onSelect={(currentValue) => {
                                                                    setSelectedType(currentValue === selectedType ? "" : currentValue)
                                                                    setSelectedDim('')
                                                                    setCustomDim('')
                                                                    setManualWeight('')
                                                                    setShapeParams({})
                                                                    setOpenTypeCombo(false)
                                                                }}
                                                            >
                                                                <Check className={cn("mr-2 h-4 w-4", selectedType === s.id ? "opacity-100" : "opacity-0")} />
                                                                {s.id} ({s.name})
                                                            </CommandItem>
                                                        ))}
                                                    </CommandGroup>
                                                </CommandList>
                                            </Command>
                                        </PopoverContent>
                                    </Popover>
                                </div>

                                <div className="space-y-1">
                                    <Label>Dimensions / Params</Label>
                                    {isStandardType ? (
                                        // Standard Profile Selection
                                        availableDims.length > 0 ? (
                                            <Popover open={openDimCombo} onOpenChange={setOpenDimCombo}>
                                                <PopoverTrigger asChild>
                                                    <Button variant="outline" role="combobox" aria-expanded={openDimCombo} className="w-full justify-between px-3 font-normal">
                                                        {selectedDim || "Select..."}
                                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                    </Button>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-[200px] p-0">
                                                    <Command>
                                                        <CommandInput
                                                            placeholder="Search or enter custom..."
                                                            value={dimSearch}
                                                            onValueChange={setDimSearch}
                                                        />
                                                        <CommandList>
                                                            <CommandEmpty>
                                                                <div className="flex flex-col gap-2 p-1">
                                                                    <p className="text-xs text-muted-foreground">No catalog match.</p>
                                                                    <Button
                                                                        variant="outline"
                                                                        size="sm"
                                                                        className="w-full text-xs h-8"
                                                                        onClick={() => {
                                                                            setSelectedDim(dimSearch)
                                                                            setCustomDim(dimSearch) // Treat as custom so logic flows
                                                                            setOpenDimCombo(false)
                                                                        }}
                                                                    >
                                                                        Use "{dimSearch}"
                                                                    </Button>
                                                                </div>
                                                            </CommandEmpty>
                                                            <CommandGroup heading="Catalog Dimensions">
                                                                {availableDims.map(d => (
                                                                    <CommandItem
                                                                        key={d}
                                                                        value={d}
                                                                        onSelect={(currentValue) => {
                                                                            setSelectedDim(currentValue === selectedDim ? "" : currentValue)
                                                                            setCustomDim('')
                                                                            setOpenDimCombo(false)
                                                                        }}
                                                                    >
                                                                        <Check className={cn("mr-2 h-4 w-4", selectedDim === d ? "opacity-100" : "opacity-0")} />
                                                                        {d}
                                                                    </CommandItem>
                                                                ))}
                                                            </CommandGroup>
                                                        </CommandList>
                                                    </Command>
                                                </PopoverContent>
                                            </Popover>
                                        ) : (
                                            <Input disabled placeholder="Select Type first" />
                                        )
                                    ) : (
                                        // Custom Shape Inputs
                                        activeShape ? (
                                            <div className="flex flex-col gap-2">
                                                <div className="flex gap-2">
                                                    {(activeShape.params as string[]).map(param => (
                                                        <Input
                                                            key={param}
                                                            placeholder={param}
                                                            className="h-8 text-xs"
                                                            value={shapeParams[param] || ''}
                                                            onChange={e => {
                                                                const val = e.target.value
                                                                const newParams = { ...shapeParams, [param]: val }
                                                                setShapeParams(newParams)

                                                                // Auto-construct customDim string
                                                                const dimStr = (activeShape.params as string[]).map(p => newParams[p] || '?').join('x')
                                                                setCustomDim(dimStr)
                                                            }}
                                                        />
                                                    ))}
                                                </div>
                                                {activeShape.formula && (
                                                    <p className="text-[10px] text-muted-foreground font-mono">
                                                        Formula: {activeShape.formula}
                                                    </p>
                                                )}
                                            </div>
                                        ) : (
                                            <Input placeholder="Custom Dims" value={customDim} onChange={e => setCustomDim(e.target.value)} />
                                        )
                                    )}
                                </div>

                                <div>
                                    <Label>Grade</Label>
                                    <Select value={selectedGrade} onValueChange={setSelectedGrade}>
                                        <SelectTrigger><SelectValue placeholder="Grade" /></SelectTrigger>
                                        <SelectContent>
                                            {grades.map(g => <SelectItem key={g.id} value={g.name}>{g.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="flex flex-col gap-1">
                                    <Label>Weight (kg/m)</Label>
                                    <div className="flex gap-1">
                                        <Input
                                            type="number"
                                            placeholder={calcedWeight > 0 ? calcedWeight.toFixed(2) : "0"}
                                            value={manualWeight}
                                            onChange={e => setManualWeight(e.target.value)}
                                            className={manualWeight ? "border-yellow-500" : ""}
                                        />
                                        {activeShape && (
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="px-2"
                                                title="Calculate Weight"
                                                onClick={async () => {
                                                    // Trigger Calc logic
                                                    // We can duplicate the calc logic or define a server action wrapper
                                                    // Ideally strictly server side.
                                                    // For now, let user trust the placeholder or override.
                                                    // To properly calculate, we need to call server action with params.
                                                    await handleCalculateWeight()
                                                }}
                                            >
                                                🧮
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div className="grid gap-2">
                                <Label>Length (mm)</Label>
                                <Input className="bg-background" type="number" value={current.length} onChange={e => setCurrent({ ...current, length: e.target.value })} />
                            </div>
                            <div className="grid gap-2">
                                <Label>Quantity</Label>
                                <Input className="bg-background" type="number" value={current.quantity} onChange={e => setCurrent({ ...current, quantity: e.target.value })} />
                            </div>
                            <div className="grid gap-2">
                                <Label>Total Cost (€)</Label>
                                <Input className="bg-background" type="number" step="0.01" value={current.totalCost} onChange={e => setCurrent({ ...current, totalCost: e.target.value })} />
                            </div>
                        </div>

                        <div className="grid gap-2">
                            <Label>Certificate (PDF)</Label>
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

                        <Button type="button" onClick={handleAddItem} variant="secondary">Add to Batch</Button>
                    </div>

                    {/* List Section */}
                    {items.length > 0 && (
                        <div>
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
            </DialogContent>
        </Dialog >
    )
}
