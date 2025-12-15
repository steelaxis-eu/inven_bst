'use client'

import { useState, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog"
import { getStandardProfileTypes, getStandardProfileDimensions, calculateProfileWeight } from "@/app/actions/calculator"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Check, ChevronsUpDown } from "lucide-react"
import { cn } from "@/lib/utils"

interface ProfileCalculatorProps {
    onSelect: (profile: { type: string, dimensions: string, weight: number }) => void
    trigger?: React.ReactNode
}

export function ProfileCalculator({ onSelect, trigger }: ProfileCalculatorProps) {
    const [open, setOpen] = useState(false)
    const [mode, setMode] = useState<'STANDARD' | 'CUSTOM'>('STANDARD')

    // Standard Headers
    const [stdTypes, setStdTypes] = useState<string[]>([])
    const [stdDims, setStdDims] = useState<string[]>([])

    // Standard Selection
    const [type, setType] = useState('') // Initialized to empty, will be set by useEffect
    const [dim, setDim] = useState('')

    // Combobox states
    const [openType, setOpenType] = useState(false)
    const [openDim, setOpenDim] = useState(false)

    // Custom
    const [customType, setCustomType] = useState('RHS')
    const [w, setW] = useState('')
    const [h, setH] = useState('')
    const [t, setT] = useState('')
    const [d, setD] = useState('')
    const [s, setS] = useState('') // For square bar

    // Result
    const [calculatedWeight, setCalculatedWeight] = useState<number | null>(null)
    const [calculating, setCalculating] = useState(false)

    // Initial Fetch for standard types
    useEffect(() => {
        getStandardProfileTypes().then(types => {
            setStdTypes(types)
            if (types.length > 0) {
                setType(types[0]) // Set initial type to the first available
            }
        })
    }, [])

    // Fetch Dims when Type changes (for standard mode)
    useEffect(() => {
        if (mode === 'STANDARD' && type) {
            setCalculating(true)
            getStandardProfileDimensions(type).then(dims => {
                setStdDims(dims)
                setDim('') // Reset dim when type changes
                setCalculatedWeight(null)
                setCalculating(false)
            }).catch(() => {
                setStdDims([])
                setDim('')
                setCalculatedWeight(null)
                setCalculating(false)
            })
        } else if (mode === 'CUSTOM') {
            setStdDims([]) // Clear standard dims if mode changes to custom
            setDim('')
        }
    }, [mode, type])

    // Calculate (Debounce or explicit? Let's do explicit via Effect for automatic updates)
    useEffect(() => {
        const fetchWeight = async () => {
            setCalculating(true)
            try {
                let weight = 0
                if (mode === 'STANDARD') {
                    if (type && dim) {
                        weight = await calculateProfileWeight(type, { mode: 'STANDARD', dimension: dim })
                    }
                } else {
                    // Custom
                    // Only calc if sufficient params
                    const params: any = {
                        w: parseFloat(w),
                        h: parseFloat(h),
                        t: parseFloat(t),
                        d: parseFloat(d),
                        s: parseFloat(s)
                    }
                    // Check if at least one relevant dimension is a valid number
                    const hasValidDimension = !isNaN(params.w) || !isNaN(params.h) || !isNaN(params.t) || !isNaN(params.d) || !isNaN(params.s);

                    if (hasValidDimension) {
                        weight = await calculateProfileWeight(customType, params)
                    }
                }
                setCalculatedWeight(weight > 0 ? weight : null)
            } catch (e) {
                console.error("Calc error", e)
                setCalculatedWeight(null)
            } finally {
                setCalculating(false)
            }
        }

        // Debounce slightly to avoid too many server calls
        const timer = setTimeout(fetchWeight, 300)
        return () => clearTimeout(timer)
    }, [mode, type, dim, customType, w, h, t, d, s])


    const handleUseCheck = () => {
        if (!calculatedWeight) return

        let finalType = mode === 'STANDARD' ? type : customType
        let finalDim = ''

        if (mode === 'STANDARD') {
            finalDim = dim
        } else {
            // Build dimension string for display
            switch (customType) {
                case 'RHS': finalDim = `${w}x${h}x${t}`; break;
                case 'SHS': finalDim = `${w}x${w}x${t}`; break;
                case 'CHS': finalDim = `${d}x${t}`; break;
                case 'FB': finalDim = `${w}x${t}`; break;
                case 'PL': finalDim = `${w}x${t}`; break;
                case 'R': finalDim = `D${d}`; break;
                case 'SQB': finalDim = `${s || w}`; break;
            }
        }

        onSelect({
            type: finalType,
            dimensions: finalDim,
            weight: calculatedWeight
        })
        setOpen(false)
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {trigger || <Button variant="outline">⚖️ Calculator</Button>}
            </DialogTrigger>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Find or Calculate Profile</DialogTitle>
                    <DialogDescription>Search for standard profiles or calculate custom weights.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="flex gap-4 border-b pb-4">
                        <Button variant={mode === 'STANDARD' ? 'default' : 'ghost'} onClick={() => setMode('STANDARD')}>Standard Catalog</Button>
                        <Button variant={mode === 'CUSTOM' ? 'default' : 'ghost'} onClick={() => setMode('CUSTOM')}>Custom Calculator</Button>
                    </div>

                    {mode === 'STANDARD' ? (
                        <div className="grid gap-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2 flex flex-col">
                                    <Label>Profile Type</Label>
                                    <Popover open={openType} onOpenChange={setOpenType}>
                                        <PopoverTrigger asChild>
                                            <Button
                                                variant="outline"
                                                role="combobox"
                                                aria-expanded={openType}
                                                className="w-full justify-between"
                                            >
                                                {type || "Select type..."}
                                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-[200px] p-0">
                                            <Command>
                                                <CommandInput placeholder="Search type..." />
                                                <CommandList>
                                                    <CommandEmpty>No type found.</CommandEmpty>
                                                    <CommandGroup>
                                                        {stdTypes.map((t) => (
                                                            <CommandItem
                                                                key={t}
                                                                value={t}
                                                                onSelect={(currentValue) => {
                                                                    setType(currentValue === type ? "" : currentValue) // Or keep selected? keeping is better usually
                                                                    setType(t) // Force set value from key
                                                                    setOpenType(false)
                                                                }}
                                                            >
                                                                <Check
                                                                    className={cn(
                                                                        "mr-2 h-4 w-4",
                                                                        type === t ? "opacity-100" : "opacity-0"
                                                                    )}
                                                                />
                                                                {t}
                                                            </CommandItem>
                                                        ))}
                                                    </CommandGroup>
                                                </CommandList>
                                            </Command>
                                        </PopoverContent>
                                    </Popover>
                                </div>
                                <div className="space-y-2 flex flex-col">
                                    <Label>Dimension</Label>
                                    <Popover open={openDim} onOpenChange={setOpenDim}>
                                        <PopoverTrigger asChild>
                                            <Button
                                                variant="outline"
                                                role="combobox"
                                                aria-expanded={openDim}
                                                className="w-full justify-between"
                                                disabled={stdDims.length === 0}
                                            >
                                                {dim || "Select size..."}
                                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-[200px] p-0">
                                            <Command>
                                                <CommandInput placeholder="Search size..." />
                                                <CommandList>
                                                    <CommandEmpty>No size found.</CommandEmpty>
                                                    <CommandGroup>
                                                        {stdDims.map((dItem) => (
                                                            <CommandItem
                                                                key={dItem}
                                                                value={dItem}
                                                                onSelect={(currentValue) => {
                                                                    setDim(dItem)
                                                                    setOpenDim(false)
                                                                }}
                                                            >
                                                                <Check
                                                                    className={cn(
                                                                        "mr-2 h-4 w-4",
                                                                        dim === dItem ? "opacity-100" : "opacity-0"
                                                                    )}
                                                                />
                                                                {dItem}
                                                            </CommandItem>
                                                        ))}
                                                    </CommandGroup>
                                                </CommandList>
                                            </Command>
                                        </PopoverContent>
                                    </Popover>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label>Shape Type</Label>
                                <Select value={customType} onValueChange={setCustomType}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="RHS">RHS (Rectangular Hollow)</SelectItem>
                                        <SelectItem value="SHS">SHS (Square Hollow)</SelectItem>
                                        <SelectItem value="CHS">CHS (Circular Hollow)</SelectItem>
                                        <SelectItem value="FB">FB / PL (Flat Bar)</SelectItem>
                                        <SelectItem value="R">Round Bar</SelectItem>
                                        <SelectItem value="SQB">Square Bar</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                {(customType === 'RHS' || customType === 'SHS' || customType === 'FB' || customType === 'PL') && (
                                    <>
                                        <div className="space-y-2"><Label>Width (W) mm</Label><Input type="number" value={w} onChange={e => setW(e.target.value)} /></div>
                                        {(customType === 'RHS') && <div className="space-y-2"><Label>Height (H) mm</Label><Input type="number" value={h} onChange={e => setH(e.target.value)} /></div>}
                                    </>
                                )}
                                {(customType === 'CHS' || customType === 'R') && (
                                    <div className="space-y-2"><Label>Diameter (D) mm</Label><Input type="number" value={d} onChange={e => setD(e.target.value)} /></div>
                                )}
                                {(customType === 'SQB') && (
                                    <div className="space-y-2"><Label>Side (S) mm</Label><Input type="number" value={s} onChange={e => setS(e.target.value)} /></div>
                                )}
                                {(customType !== 'R' && customType !== 'SQB') && (
                                    <div className="space-y-2"><Label>Thickness (t) mm</Label><Input type="number" value={t} onChange={e => setT(e.target.value)} /></div>
                                )}
                            </div>
                        </div>
                    )}

                    <div className="bg-muted p-4 rounded text-center">
                        <div className="text-sm text-muted-foreground">Weight (Calculated on Server)</div>
                        <div className="text-3xl font-bold text-primary">
                            {calculating ? '...' : (calculatedWeight ? calculatedWeight.toFixed(2) : '---')} <span className="text-base text-muted-foreground">kg/m</span>
                        </div>
                    </div>

                    <Button onClick={handleUseCheck} disabled={!calculatedWeight || calculating} className="w-full">
                        Use This Profile
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}
