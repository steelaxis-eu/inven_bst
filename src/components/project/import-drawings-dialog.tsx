'use client'

import { useState, useEffect } from 'react'
import { useImport } from "@/context/import-context"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Upload, FileText, CheckCircle, AlertCircle, Loader2, Package, Scissors, Layers } from 'lucide-react'
import { toast } from 'sonner'
import { parseDrawingsZip, ParsedPart, parseAssemblyZip, ParsedAssembly } from '@/app/actions/drawings'
import { createPart } from '@/app/actions/parts'
import { createPlatePart } from '@/app/actions/plateparts'
import { createAssembly } from '@/app/actions/assemblies'

// Extended Helper Interfaces
interface ReviewPart extends ParsedPart {
    include: boolean
    type: 'PROFILE' | 'PLATE'
    selectedProfileType?: string
    selectedProfileDim?: string
    selectedGradeId?: string
    status?: 'PENDING' | 'CREATED' | 'ERROR'
    errorMsg?: string
    drawingRef?: string
}

interface ReviewAssembly extends ParsedAssembly {
    include: boolean
    status?: 'PENDING' | 'CREATED' | 'ERROR'
    errorMsg?: string
}

interface ImportDrawingsDialogProps {
    projectId: string
    profiles: { id: string; type: string; dimensions: string; weightPerMeter: number }[]
    standardProfiles: { type: string; dimensions: string; weightPerMeter: number }[]
    grades: { id: string; name: string }[]
    shapes: { id: string; params: string[] }[]
}

export function ImportDrawingsDialog({ projectId, profiles, standardProfiles, grades, shapes }: ImportDrawingsDialogProps) {
    const { startImport, resultParts, resultAssemblies, status, dismiss, reset } = useImport()

    // Local state for the dialog open/close, BUT we want it to auto-open if reviewing
    const [open, setOpen] = useState(false)

    // Sync context status with dialog open state
    // If status becomes 'reviewing', open dialog
    useEffect(() => {
        if (status === 'reviewing') {
            setOpen(true)
            if (resultParts.length > 0) {
                setParts(resultParts)
                setStep('review')
                setMode('parts')
            } else if (resultAssemblies.length > 0) {
                setAssemblies(resultAssemblies)
                setStep('review')
                setMode('assemblies')
            }
        }
    }, [status, resultParts, resultAssemblies])

    const [mode, setMode] = useState<'parts' | 'assemblies'>('parts')
    const [file, setFile] = useState<File | null>(null)
    const [parts, setParts] = useState<ReviewPart[]>([])
    const [assemblies, setAssemblies] = useState<ReviewAssembly[]>([])
    const [step, setStep] = useState<'upload' | 'review'>('upload')
    const [creating, setCreating] = useState(false)
    const [isDragging, setIsDragging] = useState(false)

    // ... (drag handlers same as before) ...
    const handleDragEnter = (e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setIsDragging(true)
    }

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setIsDragging(false)
    }

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault()
    }

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setIsDragging(false)
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            const droppedFile = e.dataTransfer.files[0]
            if (droppedFile.name.endsWith('.zip')) {
                setFile(droppedFile)
            } else {
                toast.error("Please upload a ZIP file")
            }
        }
    }


    // Derived lists for Profile Selectors
    const profileTypes = Array.from(new Set([
        ...standardProfiles.map(p => p.type),
        ...shapes.map(s => s.id),
        "RHS", "SHS", "CHS"
    ])).sort()

    // ... (drag handlers same as before) ...
    // Note: Kept drag handlers above since they are fine.

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0])
        }
    }

    const handleUpload = async () => {
        if (!file) return
        setOpen(false) // Close dialog immediately
        await startImport(file, mode) // Start background process
    }

    const updatePart = (id: string, updates: Partial<ReviewPart>) => {
        setParts(parts.map(p => p.id === id ? { ...p, ...updates } : p))
    }

    const updateAssembly = (id: string, updates: Partial<ReviewAssembly>) => {
        setAssemblies(assemblies.map(a => a.id === id ? { ...a, ...updates } : a))
    }

    const handleCreateParts = async () => {
        const partsToCreate = parts.filter(p => p.include && p.status !== 'CREATED')
        if (partsToCreate.length === 0) return

        setCreating(true)
        let successCount = 0

        for (const part of partsToCreate) {
            try {
                if (part.type === 'PROFILE') {
                    if (!part.selectedProfileType || !part.selectedProfileDim) {
                        throw new Error("Profile Type/Dimensions not selected")
                    }
                    await createPart({
                        projectId,
                        partNumber: part.partNumber,
                        description: part.description,
                        quantity: part.quantity,
                        gradeId: part.selectedGradeId,
                        profileType: part.selectedProfileType,
                        profileDimensions: part.selectedProfileDim,
                        length: part.length,
                        drawingRef: part.drawingRef,
                        notes: `Imported from ${part.filename}`
                    })
                } else {
                    await createPlatePart({
                        projectId,
                        partNumber: part.partNumber,
                        description: part.description,
                        quantity: part.quantity,
                        gradeId: part.selectedGradeId,
                        thickness: part.thickness,
                        width: part.width,
                        length: part.length,
                        notes: `Imported from ${part.filename}`,
                        isOutsourced: false
                    })
                }
                updatePart(part.id, { status: 'CREATED' })
                successCount++
            } catch (e: any) {
                console.error(e)
                updatePart(part.id, { status: 'ERROR', errorMsg: e.message || "Failed" })
            }
        }
        setCreating(false)
        if (successCount > 0) {
            toast.success(`Created ${successCount} parts`)
            window.location.reload()
        }
    }

    const handleCreateAssemblies = async () => {
        const assembliesToCreate = assemblies.filter(a => a.include && a.status !== 'CREATED')
        if (assembliesToCreate.length === 0) return

        setCreating(true)
        let successCount = 0

        for (const assembly of assembliesToCreate) {
            try {
                await createAssembly({
                    projectId,
                    assemblyNumber: assembly.assemblyNumber,
                    name: assembly.name,
                    quantity: assembly.quantity,
                    notes: `Imported from ${assembly.filename}. BOM parsed.`,
                    bom: assembly.bom
                })
                updateAssembly(assembly.id, { status: 'CREATED' })
                successCount++
            } catch (e: any) {
                console.error(e)
                updateAssembly(assembly.id, { status: 'ERROR', errorMsg: e.message || "Failed" })
            }
        }
        setCreating(false)
        if (successCount > 0) {
            toast.success(`Created ${successCount} assemblies`)
            window.location.reload()
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen} >
            <DialogTrigger asChild>
                <Button variant="outline" className="gap-2">
                    <Upload className="h-4 w-4" />
                    Import Drawings
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-[98vw] w-[98vw] h-[95vh] flex flex-col p-4 md:max-w-screen-2xl lg:max-w-none">
                <DialogHeader>
                    <DialogTitle>Import from Drawings</DialogTitle>
                    <DialogDescription>
                        Automated extraction for Parts and Assemblies using AI.
                    </DialogDescription>
                    <div className="pt-2">
                        <Tabs value={mode} onValueChange={(v: any) => { setMode(v); reset(); }}>
                            <TabsList>
                                <TabsTrigger value="parts" className="gap-2"><FileText className="h-4 w-4" /> Parts (Single)</TabsTrigger>
                                <TabsTrigger value="assemblies" className="gap-2"><Layers className="h-4 w-4" /> Assemblies</TabsTrigger>
                            </TabsList>
                        </Tabs>
                    </div>
                </DialogHeader>

                <div className="flex-1 overflow-hidden p-1 mt-2">
                    {step === 'upload' ? (
                        <div
                            className={`h-full flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-10 transition-colors duration-200 ${isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 bg-muted/50'}`}
                            onDragEnter={handleDragEnter}
                            onDragLeave={handleDragLeave}
                            onDragOver={handleDragOver}
                            onDrop={handleDrop}
                        >
                            {(status === 'processing' || status === 'uploading') ? (
                                <div className="flex flex-col items-center justify-center text-center space-y-4 animate-in fade-in zoom-in duration-500">
                                    <Loader2 className="h-16 w-16 text-primary animate-spin" />
                                    <div className="space-y-2">
                                        <h3 className="text-xl font-semibold">Analyzing {mode === 'parts' ? 'Part' : 'Assembly'} Drawings</h3>
                                        <p className="text-muted-foreground">Extracting BOM, Dimensions, and Details with Gemini AI.</p>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <Upload className="h-12 w-12 text-muted-foreground mb-4" />
                                    <h3 className="text-lg font-semibold mb-2">Upload {mode === 'parts' ? 'Parts' : 'Assembly'} ZIP</h3>
                                    <p className="text-muted-foreground mb-6 text-center max-w-sm">
                                        Drag and drop a ZIP file containing PDF drawings.
                                    </p>
                                    <Input type="file" accept=".zip" className="hidden" id="zip-upload" onChange={handleFileChange} />
                                    <Label htmlFor="zip-upload">
                                        <Button variant="secondary" asChild className="cursor-pointer"><span>Browse Files</span></Button>
                                    </Label>
                                    {file && (
                                        <div className="mt-4 flex items-center gap-2 text-sm bg-background p-2 rounded border">
                                            <FileText className="h-4 w-4" />
                                            {file.name}
                                            <Button variant="ghost" size="sm" onClick={() => setFile(null)} className="h-6 w-6 p-0 ml-2">x</Button>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    ) : (
                        <ScrollArea className="h-full border rounded-md">
                            <div className="min-w-max p-2">
                                {mode === 'parts' ? (
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead className="w-12"><Checkbox /></TableHead>
                                                <TableHead className="min-w-[200px]">Part Number</TableHead>
                                                <TableHead className="min-w-[140px]">Type</TableHead>
                                                <TableHead className="min-w-[80px]">Qty</TableHead>
                                                <TableHead className="min-w-[140px]">Grade</TableHead>
                                                <TableHead className="min-w-[350px]">Dimensions</TableHead>
                                                <TableHead className="w-12"></TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {parts.map((part) => (
                                                <TableRow key={part.id} className={part.status === 'CREATED' ? 'opacity-50 bg-green-50' : ''}>
                                                    <TableCell>
                                                        <Checkbox checked={part.include} onCheckedChange={(c) => updatePart(part.id, { include: c === true })} disabled={part.status === 'CREATED'} />
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="space-y-1">
                                                            <Input value={part.partNumber} onChange={(e) => updatePart(part.id, { partNumber: e.target.value })} className="h-8 font-mono w-full" />
                                                            <p className="text-[10px] text-muted-foreground truncate max-w-[200px]" title={part.filename}>{part.filename}</p>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Select value={part.type} onValueChange={(v: any) => updatePart(part.id, { type: v })}>
                                                            <SelectTrigger className="h-8 w-full"><SelectValue /></SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="PLATE">Plate</SelectItem>
                                                                <SelectItem value="PROFILE">Profile</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Input type="number" value={part.quantity} onChange={(e) => updatePart(part.id, { quantity: parseInt(e.target.value) || 0 })} className="h-8 w-16" />
                                                    </TableCell>
                                                    <TableCell>
                                                        <Select value={part.selectedGradeId} onValueChange={(v) => updatePart(part.id, { selectedGradeId: v })}>
                                                            <SelectTrigger className="h-8 w-full"><SelectValue placeholder="Grade" /></SelectTrigger>
                                                            <SelectContent>{grades.map(g => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}</SelectContent>
                                                        </Select>
                                                    </TableCell>
                                                    <TableCell>
                                                        {part.type === 'PLATE' ? (
                                                            <div className="flex items-center gap-1">
                                                                <Input placeholder="T" value={part.thickness} onChange={(e) => updatePart(part.id, { thickness: parseFloat(e.target.value) || 0 })} className="h-8 w-20" />
                                                                <span className="text-xs">x</span>
                                                                <Input placeholder="W" value={part.width} onChange={(e) => updatePart(part.id, { width: parseFloat(e.target.value) || 0 })} className="h-8 w-20" />
                                                                <span className="text-xs">x</span>
                                                                <Input placeholder="L" value={part.length} onChange={(e) => updatePart(part.id, { length: parseFloat(e.target.value) || 0 })} className="h-8 w-20" />
                                                            </div>
                                                        ) : (
                                                            <div className="flex items-center gap-1">
                                                                <Select value={part.selectedProfileType} onValueChange={(v) => updatePart(part.id, { selectedProfileType: v })}>
                                                                    <SelectTrigger className="h-8 w-32"><SelectValue placeholder="Type" /></SelectTrigger>
                                                                    <SelectContent>{profileTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                                                                </Select>
                                                                <div className="relative">
                                                                    <Input
                                                                        placeholder="Dim"
                                                                        value={part.selectedProfileDim}
                                                                        onChange={(e) => updatePart(part.id, { selectedProfileDim: e.target.value })}
                                                                        className="h-8 w-36"
                                                                        list={`dims-${part.id}`}
                                                                    />
                                                                    <datalist id={`dims-${part.id}`}>
                                                                        {standardProfiles.filter(p => p.type === part.selectedProfileType).map(p => <option key={p.dimensions} value={p.dimensions} />)}
                                                                    </datalist>
                                                                </div>

                                                                <Input placeholder="L" value={part.length} onChange={(e) => updatePart(part.id, { length: parseFloat(e.target.value) || 0 })} className="h-8 w-24" />
                                                            </div>
                                                        )}
                                                    </TableCell>
                                                    <TableCell>
                                                        {part.status === 'CREATED' && <CheckCircle className="h-4 w-4 text-green-500" />}
                                                        {part.status === 'ERROR' && <AlertCircle className="h-4 w-4 text-red-500" />}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                ) : (
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead className="w-10"><Checkbox /></TableHead>
                                                <TableHead className="w-40">Assembly Number</TableHead>
                                                <TableHead className="w-48">Name</TableHead>
                                                <TableHead className="w-20">Qty</TableHead>
                                                <TableHead>BOM Summary</TableHead>
                                                <TableHead className="w-10"></TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {assemblies.map((assembly) => (
                                                <TableRow key={assembly.id} className={assembly.status === 'CREATED' ? 'opacity-50 bg-green-50' : ''}>
                                                    <TableCell>
                                                        <Checkbox checked={assembly.include} onCheckedChange={(c) => updateAssembly(assembly.id, { include: c === true })} disabled={assembly.status === 'CREATED'} />
                                                    </TableCell>
                                                    <TableCell>
                                                        <Input value={assembly.assemblyNumber} onChange={(e) => updateAssembly(assembly.id, { assemblyNumber: e.target.value })} className="h-8 font-mono" />
                                                    </TableCell>
                                                    <TableCell>
                                                        <Input value={assembly.name} onChange={(e) => updateAssembly(assembly.id, { name: e.target.value })} className="h-8" />
                                                    </TableCell>
                                                    <TableCell>
                                                        <Input type="number" value={assembly.quantity} onChange={(e) => updateAssembly(assembly.id, { quantity: parseInt(e.target.value) || 1 })} className="h-8" />
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex flex-col text-xs text-muted-foreground space-y-1">
                                                            <div className="font-semibold">{assembly.bom.length} items extracted</div>
                                                            <div className="max-h-[100px] overflow-y-auto pr-2 space-y-1">
                                                                {assembly.bom.map((b, i) => (
                                                                    <div key={i} className="flex gap-2 whitespace-nowrap">
                                                                        <span className="w-6 font-mono text-foreground/70">{b.quantity}x</span>
                                                                        <span className="w-20 font-mono text-foreground/70">{b.partNumber}</span>
                                                                        <span>
                                                                            {b.profileType ? (
                                                                                <span className="text-foreground">
                                                                                    {b.profileType} - {b.profileDimensions} - {b.length}mm
                                                                                </span>
                                                                            ) : (
                                                                                <span>{b.description}</span>
                                                                            )}
                                                                        </span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        {assembly.status === 'CREATED' && <CheckCircle className="h-4 w-4 text-green-500" />}
                                                        {assembly.status === 'ERROR' && <AlertCircle className="h-4 w-4 text-red-500" />}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                )}
                            </div>
                        </ScrollArea>
                    )}
                </div>

                <DialogFooter>
                    {step === 'upload' ? (
                        <Button onClick={handleUpload} disabled={!file || status === 'processing'}>
                            {status === 'processing' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Upload & Parse
                        </Button>
                    ) : (
                        <>
                            <Button variant="outline" onClick={reset}>Cancel / Restart</Button>
                            <Button onClick={mode === 'parts' ? handleCreateParts : handleCreateAssemblies} disabled={creating}>
                                {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Create {mode === 'parts' ? 'Parts' : 'Assemblies'}
                            </Button>
                        </>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog >
    )
}
