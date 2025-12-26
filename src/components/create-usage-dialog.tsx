'use client'

import { useState } from 'react'
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { getUsageItem, createUsage } from '@/app/actions/usage'
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Check, ChevronsUpDown, CalendarIcon } from "lucide-react"
import { format } from "date-fns"
import { Calendar } from "@/components/ui/calendar"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface CreateUsageDialogProps {
    projects: any[]
    trigger?: React.ReactNode
}

export function CreateUsageDialog({ projects, trigger }: CreateUsageDialogProps) {
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)

    // Global Header State
    const [globalProject, setGlobalProject] = useState('')
    const [date, setDate] = useState<Date | undefined>(new Date())
    const [openProjectCombo, setOpenProjectCombo] = useState(false)

    // Line Items State
    const [lines, setLines] = useState<any[]>([])

    // Current Line State
    const [current, setCurrent] = useState({
        query: '',
        usedLength: '',
        project: '', // Override
    })

    const [fetchedItem, setFetchedItem] = useState<any>(null)
    const [lookupLoading, setLookupLoading] = useState(false)
    const [lookupError, setLookupError] = useState('')

    // Derived State
    const remainingLength = fetchedItem ? fetchedItem.length - parseFloat(current.usedLength || '0') : 0
    const isRemnant = remainingLength > 0
    const [offcutType, setOffcutType] = useState<'REMNANT' | 'SCRAP'>('REMNANT')
    const calculatedCost = fetchedItem ? (parseFloat(current.usedLength || '0') / 1000) * fetchedItem.costPerMeter : 0

    // Handlers
    const handleLookup = async () => {
        if (!current.query) return
        setLookupLoading(true)
        setLookupError('')
        setFetchedItem(null)
        setOffcutType('REMNANT') // Reset default

        try {
            const item = await getUsageItem(current.query)
            if (item) {
                setFetchedItem(item)
                // Default used length to full length if empty (convenience)
                if (!current.usedLength) setCurrent(prev => ({ ...prev, usedLength: item.length.toString() }))
            } else {
                setLookupError('Item not found')
            }
        } catch (e) {
            setLookupError('Lookup failed')
        } finally {
            setLookupLoading(false)
        }
    }

    const handleAddLine = () => {
        if (!fetchedItem) return

        const usedL = parseFloat(current.usedLength)
        if (isNaN(usedL) || usedL <= 0) {
            toast.error("Invalid used length")
            return
        }

        if (usedL > fetchedItem.length) {
            toast.error(`Max length ${fetchedItem.length}mm`)
            return
        }

        // Add to lines
        setLines([...lines, {
            _id: Math.random().toString(),
            item: fetchedItem,
            usedLength: usedL,
            cost: calculatedCost,
            project: current.project || globalProject, // Fallback to global if line empty
            createRemnant: offcutType === 'REMNANT',
            status: offcutType // For display
        }])

        // Reset current line
        setCurrent({ query: '', usedLength: '', project: '' })
        setFetchedItem(null)
        setLookupError('')
    }

    const handleRemoveLine = (idx: number) => {
        setLines(lines.filter((_, i) => i !== idx))
    }

    const submitUsage = async () => {
        if (lines.length === 0) return
        if (!globalProject && lines.some(l => !l.project)) {
            toast.error("Please select a project for all items")
            return
        }

        setLoading(true)
        try {
            // Group by project or just Submit?
            // Action `createUsage` takes a single projectId. 
            // If we have mixed projects, we might need multiple calls or update action to handle per-line project.
            // *Check action*: createUsage(projectId, ..., lines). It uses header project.
            // Lines table has `projectId` optional override. 

            // Preparing submission...

            // Wait, existing action `createUsage` logic:
            // `createUsage(projectId, userId, lines)` returns usage.
            // `UsageLine` creation: `projectId: projectId` (from header override in line created? NO). 
            // Lines 196: `usageId: usage.id`, `projectId`. 

            // Update: We need to ensure the backend uses line-level project if provided. 
            // In my inspection of `usage.ts`: `createUsage` uses the `projectId` arg for the `Usage` header.
            // But `UsageLine` creation uses `projectId,`. 
            // It seems `UsageLine` takes `projectId` from... somewhere? 
            // Ah, line 200: `projectId, // Optional override`. 
            // Wait, `projectId` variable in `createUsage` comes from function arg.
            // It does NOT come from `line` object iteration unless we extract it.
            // Let's assume for now we use Global Project for the Usage Header, and if lines differ,
            // we might need to update the action or just stick to "Usage Bundle is for Project X".
            // The User requested "project can be defined by whole entry, or by line".
            // So I should arguably update `createUsage` to read `line.projectId` if present.
            // I'll proceed with this Component assuming I'll fix the Action next.

            // Map lines to action format (Corrected)
            const payload = lines.map(line => ({
                type: line.item.type,
                id: line.item.id,
                lengthUsed: line.usedLength,
                createRemnant: line.createRemnant,
                projectId: line.project || globalProject
            }))

            const res = await createUsage(
                globalProject,
                '',
                payload
            )

            if (res.success) {
                toast.success("Usage registered")
                setOpen(false)
                setLines([])
                setGlobalProject('')
            } else {
                toast.error((res as any).error)
            }

        } catch (e) {
            toast.error("Failed to submit")
        } finally {
            setLoading(false)
        }
    }

    // Totals
    const totalCost = lines.reduce((acc, l) => acc + l.cost, 0)

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {trigger ? trigger : <Button>Register Usage</Button>}
            </DialogTrigger>
            <DialogContent className="max-h-[100dvh] h-full w-full max-w-none rounded-none sm:h-auto sm:max-h-[90vh] sm:max-w-6xl sm:rounded-lg overflow-y-auto p-4 sm:p-6 !translate-y-0 !top-0 !left-0 !translate-x-0 sm:fixed sm:!top-[50%] sm:!left-[50%] sm:!translate-x-[-50%] sm:!translate-y-[-50%]">
                <DialogHeader>
                    <DialogTitle>Register Material Usage</DialogTitle>
                    <DialogDescription>Record material consumption and track offcuts.</DialogDescription>
                </DialogHeader>

                <div className="space-y-6">
                    {/* Header Controls */}
                    <div className="flex flex-col sm:flex-row gap-4 p-4 border rounded-lg bg-muted/30">
                        <div className="flex flex-col gap-2 flex-1">
                            <Label>Global Project</Label>
                            <Popover open={openProjectCombo} onOpenChange={setOpenProjectCombo}>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" role="combobox" aria-expanded={openProjectCombo} className="justify-between bg-card w-full">
                                        {globalProject ? projects.find(p => p.id === globalProject)?.name || globalProject : "Select project..."}
                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[300px] p-0">
                                    <Command>
                                        <CommandInput placeholder="Search project..." />
                                        <CommandList>
                                            <CommandEmpty>No project found.</CommandEmpty>
                                            <CommandGroup>
                                                {projects.map(p => (
                                                    <CommandItem key={p.id} value={p.name} onSelect={() => { setGlobalProject(p.id); setOpenProjectCombo(false) }}>
                                                        <Check className={cn("mr-2 h-4 w-4", globalProject === p.id ? "opacity-100" : "opacity-0")} />
                                                        {p.projectNumber} - {p.name}
                                                    </CommandItem>
                                                ))}
                                            </CommandGroup>
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>
                        </div>

                        <div className="flex flex-col gap-2 w-full sm:w-auto">
                            <Label>Date</Label>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant={"outline"} className={cn("w-[240px] justify-start text-left font-normal bg-card", !date && "text-muted-foreground")}>
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {date ? format(date, "PPP") : <span>Pick a date</span>}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar mode="single" selected={date} onSelect={setDate} initialFocus />
                                </PopoverContent>
                            </Popover>
                        </div>
                    </div>

                    {/* Input Line */}
                    <div className="p-4 border rounded-lg bg-muted/50 space-y-4">
                        <div className="flex flex-col xl:flex-row gap-4 items-start xl:items-end w-full">
                            {/* Unified Lookup */}
                            <div className="grid gap-2 flex-[2] min-w-[200px] w-full">
                                <Label>Item Lookup (Lot ID / Remnant ID)</Label>
                                <div className="relative">
                                    <Input
                                        placeholder="Scan or type ID..."
                                        className={cn("font-mono bg-card uppercase", lookupError ? "border-red-500" : "")}
                                        value={current.query}
                                        onChange={e => setCurrent({ ...current, query: e.target.value.toUpperCase() })}
                                        onBlur={handleLookup}
                                        onKeyDown={e => e.key === 'Enter' && handleLookup()}
                                    />
                                    {lookupLoading && <span className="absolute right-3 top-2 text-xs text-muted-foreground">Searching...</span>}
                                </div>
                                {lookupError && <span className="text-xs text-red-500">{lookupError}</span>}
                                {fetchedItem && (
                                    <div className="text-xs text-green-700 font-medium font-mono mt-1">
                                        ✓ Found: {fetchedItem.profile.type} {fetchedItem.profile.dimensions} ({fetchedItem.grade.name}) — {fetchedItem.length}mm
                                    </div>
                                )}
                            </div>

                            {/* Used Length */}
                            <div className="grid gap-2 w-full xl:w-32">
                                <Label>Used (mm)</Label>
                                <Input
                                    type="number"
                                    className="bg-card"
                                    value={current.usedLength}
                                    onChange={e => setCurrent({ ...current, usedLength: e.target.value })}
                                    placeholder={fetchedItem ? `${fetchedItem.length}` : "0"}
                                />
                            </div>

                            {/* Remaining Action */}
                            <div className="grid gap-2 w-full xl:w-48">
                                <Label>Remaining: {remainingLength > 0 ? `${remainingLength}mm` : 'None'}</Label>
                                <Select
                                    value={offcutType}
                                    onValueChange={(v: any) => setOffcutType(v)}
                                    disabled={remainingLength <= 0}
                                >
                                    <SelectTrigger className="bg-card">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="REMNANT">Keep (Remnant)</SelectItem>
                                        <SelectItem value="SCRAP">Discard (Scrap)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Line Project Override */}
                            <div className="grid gap-2 flex-1 min-w-[150px] w-full">
                                <Label>Row Project (Optional)</Label>
                                <Select value={current.project || "default"} onValueChange={v => setCurrent({ ...current, project: v === "default" ? "" : v })}>
                                    <SelectTrigger className="bg-card text-xs">
                                        <SelectValue placeholder="Inherit Global" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="default" className="text-muted-foreground font-style-italic">Inherit Global</SelectItem>
                                        {projects.map(p => (
                                            <SelectItem key={p.id} value={p.id}>{p.projectNumber}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Add Button */}
                            <Button onClick={handleAddLine} disabled={!fetchedItem} className="w-full xl:w-auto">Add</Button>
                        </div>
                    </div>

                    {/* Lines Table */}
                    {lines.length > 0 && (
                        <div className="rounded-md border bg-card">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Item</TableHead>
                                        <TableHead>Profile</TableHead>
                                        <TableHead>Used</TableHead>
                                        <TableHead>Offcut Action</TableHead>
                                        <TableHead>Project</TableHead>
                                        <TableHead className="text-right">Cost</TableHead>
                                        <TableHead></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {lines.map((line, idx) => (
                                        <TableRow key={line._id}>
                                            <TableCell className="font-mono text-xs">{line.item.lotId}</TableCell>
                                            <TableCell className="text-xs">
                                                {line.item.profile.type} {line.item.profile.dimensions} <span className="text-muted-foreground">({line.item.grade.name})</span>
                                            </TableCell>
                                            <TableCell>{line.usedLength}mm</TableCell>
                                            <TableCell>
                                                {line.item.length - line.usedLength > 0 ? (
                                                    <span className={cn("text-xs px-2 py-1 rounded", line.createRemnant ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100" : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100")}>
                                                        {line.createRemnant ? `Remnant (${line.item.length - line.usedLength}mm)` : `Scrap (${line.item.length - line.usedLength}mm)`}
                                                    </span>
                                                ) : <span className="text-muted-foreground text-xs">-</span>}
                                            </TableCell>
                                            <TableCell className="text-xs">
                                                {projects.find(p => p.id === line.project)?.name || "Global"}
                                            </TableCell>
                                            <TableCell className="text-right font-mono">€{line.cost.toFixed(2)}</TableCell>
                                            <TableCell>
                                                <Button variant="ghost" size="sm" onClick={() => handleRemoveLine(idx)} className="h-8 w-8 p-0 text-red-500">×</Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    <TableRow className="bg-muted/50 font-bold">
                                        <TableCell colSpan={5} className="text-right">Total Cost</TableCell>
                                        <TableCell className="text-right">€{totalCost.toFixed(2)}</TableCell>
                                        <TableCell></TableCell>
                                    </TableRow>
                                </TableBody>
                            </Table>
                        </div>
                    )}

                    <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                        <Button onClick={submitUsage} disabled={lines.length === 0 || loading || (!globalProject && lines.some(l => !l.project))}>
                            {loading ? "Processing..." : `Register Usage (${lines.length})`}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
