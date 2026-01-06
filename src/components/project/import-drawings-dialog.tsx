'use client'

import { useState } from 'react'
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
}

export function ImportDrawingsDialog({ projectId, profiles, standardProfiles, grades }: ImportDrawingsDialogProps) {
    const [open, setOpen] = useState(false)
    const [mode, setMode] = useState<'parts' | 'assemblies'>('parts')

    const [file, setFile] = useState<File | null>(null)
    const [parts, setParts] = useState<ReviewPart[]>([])
    const [assemblies, setAssemblies] = useState<ReviewAssembly[]>([])

    const [step, setStep] = useState<'upload' | 'review'>('upload')
    const [uploading, setUploading] = useState(false)
    const [creating, setCreating] = useState(false)
    const [isDragging, setIsDragging] = useState(false)

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
        "RHS", "SHS", "CHS"
    ])).sort()

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0])
        }
    }

    const handleUpload = async () => {
        if (!file) return
        setUploading(true)
        try {
            const formData = new FormData()
            formData.set('file', file)
            formData.set('projectId', projectId)

            if (mode === 'parts') {
                const result = await parseDrawingsZip(formData)
                if (result.success && result.parts) {
                    const reviewParts: ReviewPart[] = result.parts.map(p => {
                        let type: 'PROFILE' | 'PLATE' = 'PLATE'

                        // Enhanced Profile Detection Logic
                        // 1. Trust AI: If AI identifies a profile type or explicitly says PROFILE, it is a profile.
                        if (p.profileType || p.type === 'PROFILE') {
                            type = 'PROFILE'
                        }

                        // 2. Fallback to name/filename matching if not already found
                        if (type === 'PLATE') {
                            const name = (p.filename + p.partNumber).toUpperCase()
                            // If name contains common profile indicators
                            if (profileTypes.some(t => name.includes(t)) || /RHS|SHS|IPE|HEA|HEB|UNP|TUB|BEAM/i.test(name)) {
                                type = 'PROFILE'
                            }
                        }

                        // 3. Fallback to checking dimensions (if thickness is 0/missing but profile dim exists)
                        if (type === 'PLATE' && (p.thickness === 0 || !p.thickness) && p.profileDimensions) {
                            type = 'PROFILE'
                        }

                        // Determine initial grade
                        const initialGrade = grades.find(g =>
                            (p.material && g.name.toLowerCase().includes(p.material.toLowerCase())) ||
                            g.name === 'S355'
                        )?.id

                        // Determine initial profile type selection
                        let selectedProfileType = ''
                        if (type === 'PROFILE') {
                            if (p.profileType) {
                                selectedProfileType = profileTypes.find(t => p.profileType?.toUpperCase().includes(t)) || ''
                            }
                            if (!selectedProfileType) {
                                const name = (p.filename + p.partNumber).toUpperCase()
                                selectedProfileType = profileTypes.find(t => name.includes(t)) || ''
                            }
                        }

                        return {
                            ...p,
                            include: true,
                            type,
                            selectedGradeId: initialGrade,
                            status: 'PENDING',
                            selectedProfileType,
                            selectedProfileDim: p.profileDimensions || '' // Use AI extracted dim if available
                        }
                    })
                    setParts(reviewParts)
                    setStep('review')
                } else {
                    toast.error(result.error || "Failed to parse ZIP")
                }
            } else {
                // Assembly Mode
                const result = await parseAssemblyZip(formData)
                if (result.success && result.assemblies) {
                    const reviewAssemblies: ReviewAssembly[] = result.assemblies.map(a => ({
                        ...a,
                        include: true,
                        status: 'PENDING'
                    }))
                    setAssemblies(reviewAssemblies)
                    setStep('review')
                } else {
                    toast.error(result.error || "Failed to parse Assembly ZIP")
                }
            }

        } catch (e) {
            toast.error("Upload failed")
        } finally {
            setUploading(false)
        }
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
        if (successCount > 0) toast.success(`Created ${successCount} parts`)
    }

    const handleCreateAssemblies = async () => {
        // ... (Assembly creation logic - unchanged) ...
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
                    notes: `Imported from ${assembly.filename}. BOM parsed.`
                })
                updateAssembly(assembly.id, { status: 'CREATED' })
                successCount++
            } catch (e: any) {
                console.error(e)
                updateAssembly(assembly.id, { status: 'ERROR', errorMsg: e.message || "Failed" })
            }
        }
        setCreating(false)
        if (successCount > 0) toast.success(`Created ${successCount} assemblies`)
    }

    const reset = () => {
        setStep('upload')
        setFile(null)
        setParts([])
        setAssemblies([])
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
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
                            {/* ... (Upload UI - unchanged, just omitted for brevity in replace block if possible, but safely included here) ... */}
                            {uploading ? (
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
                                        {/* ... (Assembluy table - unchanged) ... */}
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
                                                        <div className="flex flex-col text-xs text-muted-foreground">
                                                            <span>{assembly.bom.length} items extracted</span>
                                                            <span className="truncate max-w-[200px]" title={assembly.bom.map(b => `${b.quantity}x ${b.partNumber}`).join(', ')}>
                                                                {assembly.bom.slice(0, 3).map(b => `${b.quantity}x ${b.partNumber}`).join(', ')}
                                                                {assembly.bom.length > 3 && '...'}
                                                            </span>
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
                        <Button onClick={handleUpload} disabled={!file || uploading}>
                            {uploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
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
        </Dialog>
    )
}
