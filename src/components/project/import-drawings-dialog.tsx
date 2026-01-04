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
import { Upload, FileText, CheckCircle, AlertCircle, Loader2, Package, Scissors } from 'lucide-react'
import { toast } from 'sonner'
import { parseDrawingsZip, ParsedPart } from '@/app/actions/drawings'
import { createPart } from '@/app/actions/parts'
import { createPlatePart } from '@/app/actions/plateparts'

// We extend ParsedPart to include UI state
interface ReviewPart extends ParsedPart {
    include: boolean
    type: 'PROFILE' | 'PLATE'
    selectedProfileType?: string
    selectedProfileDim?: string
    selectedGradeId?: string
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
    const [file, setFile] = useState<File | null>(null)
    const [parts, setParts] = useState<ReviewPart[]>([])
    const [step, setStep] = useState<'upload' | 'review'>('upload')
    const [uploading, setUploading] = useState(false)
    const [creating, setCreating] = useState(false)

    // Derived lists for Profile Selectors
    const profileTypes = Array.from(new Set(standardProfiles.map(p => p.type))).sort()

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
            const result = await parseDrawingsZip(formData)

            if (result.success && result.parts) {
                const reviewParts: ReviewPart[] = result.parts.map(p => {
                    // Smart Type Detection
                    let type: 'PROFILE' | 'PLATE' = 'PLATE' // Default
                    // If no thickness/width but has "HEA" or similar in filename/desc -> Profile
                    const name = (p.filename + p.partNumber).toUpperCase()
                    if (profileTypes.some(t => name.includes(t))) {
                        type = 'PROFILE'
                    } else if (p.thickness > 0 && p.width > 0) {
                        type = 'PLATE'
                    }

                    // Try to match Grade
                    const initialGrade = grades.find(g =>
                        (p.material && g.name.toLowerCase().includes(p.material.toLowerCase())) ||
                        g.name === 'S355' // Default fallback
                    )?.id

                    return {
                        ...p,
                        include: true,
                        type,
                        selectedGradeId: initialGrade,
                        status: 'PENDING',
                        // Try to extract profile type from filename if PROFILE
                        selectedProfileType: type === 'PROFILE' ? profileTypes.find(t => name.includes(t)) || '' : ''
                    }
                })
                setParts(reviewParts)
                setStep('review')
            } else {
                toast.error(result.error || "Failed to parse ZIP")
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

    const handleCreateParts = async () => {
        const partsToCreate = parts.filter(p => p.include && p.status !== 'CREATED')
        if (partsToCreate.length === 0) return

        setCreating(true)
        let successCount = 0

        for (const part of partsToCreate) {
            try {
                if (part.type === 'PROFILE') {
                    // Create Profile Part
                    // Need to find profileId based on type/dims
                    // Or if manual, create logic etc. 
                    // For now, let's assume we REQUIRE standard profile matches
                    if (!part.selectedProfileType || !part.selectedProfileDim) {
                        throw new Error("Profile Type/Dimensions not selected")
                    }

                    // Note: createPart usually expects profileId for Inventory tracking or just type/dim for definition
                    // If we use standardProfiles, we are creating a DEFINITION.
                    // The createPart action handles checking if defined part exists or creates new one
                    // But it takes profileId (of existing SteelProfile?) or properties?
                    // Looking at createPart: it takes profileType, profileDimensions etc.

                    await createPart({
                        projectId,
                        partNumber: part.partNumber,
                        description: part.description,
                        quantity: part.quantity,
                        gradeId: part.selectedGradeId, // or selectedGradeId
                        profileType: part.selectedProfileType,
                        profileDimensions: part.selectedProfileDim,
                        length: part.length,
                        notes: `Imported from ${part.filename}`
                    })

                } else {
                    // Create Plate Part
                    await createPlatePart({
                        projectId,
                        partNumber: part.partNumber,
                        description: part.description,
                        quantity: part.quantity,
                        gradeId: part.selectedGradeId,
                        thickness: part.thickness,
                        width: part.width,
                        length: part.length,
                        // material: part.material, // Grade handles this mostly
                        notes: `Imported from ${part.filename}`,
                        isOutsourced: false // Default to in-house, user can toggle later
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
            toast.success(`Successfully created ${successCount} parts`)
            // If all done, maybe close?
            if (parts.filter(p => p.include && p.status !== 'CREATED').length === 0) {
                setTimeout(() => setOpen(false), 1500)
            }
        } else {
            toast.error("Failed to create parts")
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" className="gap-2">
                    <Upload className="h-4 w-4" />
                    Import Drawings (ZIP)
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-5xl h-[80vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>Import Parts from Drawings</DialogTitle>
                    <DialogDescription>
                        Upload a ZIP file containing PDF drawings to automatically extract part data.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-hidden p-1">
                    {step === 'upload' ? (
                        <div className="h-full flex flex-col items-center justify-center border-2 border-dashed rounded-lg bg-muted/50 p-10">
                            <Upload className="h-12 w-12 text-muted-foreground mb-4" />
                            <h3 className="text-lg font-semibold mb-2">Upload ZIP File</h3>
                            <p className="text-muted-foreground mb-6 text-center max-w-sm">
                                Drag and drop your ZIP file here or click to browse.
                                Supports PDF parsing for Part #, Dimensions, and Quantity.
                            </p>
                            <Input
                                type="file"
                                accept=".zip"
                                className="hidden"
                                id="zip-upload"
                                onChange={handleFileChange}
                            />
                            <Label htmlFor="zip-upload">
                                <Button variant="secondary" asChild className="cursor-pointer">
                                    <span>Browse Files</span>
                                </Button>
                            </Label>
                            {file && (
                                <div className="mt-4 flex items-center gap-2 text-sm bg-background p-2 rounded border">
                                    <FileText className="h-4 w-4" />
                                    {file.name}
                                    <Button variant="ghost" size="sm" onClick={() => setFile(null)} className="h-6 w-6 p-0 ml-2">x</Button>
                                </div>
                            )}
                        </div>
                    ) : (
                        <ScrollArea className="h-full border rounded-md">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-10"><Checkbox /></TableHead>
                                        <TableHead className="w-40">Part Number</TableHead>
                                        <TableHead className="w-24">Type</TableHead>
                                        <TableHead className="w-20">Qty</TableHead>
                                        <TableHead className="w-32">Grade</TableHead>
                                        <TableHead className="w-64">Dimensions / Profile</TableHead>
                                        <TableHead className="w-10"></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {parts.map((part) => (
                                        <TableRow key={part.id} className={part.status === 'CREATED' ? 'opacity-50 bg-green-50' : ''}>
                                            <TableCell>
                                                <Checkbox
                                                    checked={part.include}
                                                    onCheckedChange={(c) => updatePart(part.id, { include: c === true })}
                                                    disabled={part.status === 'CREATED'}
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <div className="space-y-1">
                                                    <Input
                                                        value={part.partNumber}
                                                        onChange={(e) => updatePart(part.id, { partNumber: e.target.value })}
                                                        className="h-8 font-mono"
                                                    />
                                                    <p className="text-[10px] text-muted-foreground truncate" title={part.filename}>{part.filename}</p>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Select
                                                    value={part.type}
                                                    onValueChange={(v: 'PROFILE' | 'PLATE') => updatePart(part.id, { type: v })}
                                                >
                                                    <SelectTrigger className="h-8 w-24">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="PLATE"><div className="flex items-center gap-2"><Scissors className="h-3 w-3" /> Plate</div></SelectItem>
                                                        <SelectItem value="PROFILE"><div className="flex items-center gap-2"><Package className="h-3 w-3" /> Profile</div></SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </TableCell>
                                            <TableCell>
                                                <Input
                                                    type="number"
                                                    value={part.quantity}
                                                    onChange={(e) => updatePart(part.id, { quantity: parseInt(e.target.value) || 0 })}
                                                    className="h-8 w-16"
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <Select
                                                    value={part.selectedGradeId}
                                                    onValueChange={(v) => updatePart(part.id, { selectedGradeId: v })}
                                                >
                                                    <SelectTrigger className="h-8 w-32">
                                                        <SelectValue placeholder="Grade" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {grades.map(g => (
                                                            <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </TableCell>
                                            <TableCell>
                                                {part.type === 'PLATE' ? (
                                                    <div className="flex items-center gap-1">
                                                        <Input
                                                            placeholder="T"
                                                            title="Thickness"
                                                            value={part.thickness || ''}
                                                            onChange={(e) => updatePart(part.id, { thickness: parseFloat(e.target.value) || 0 })}
                                                            className="h-8 w-14"
                                                        />
                                                        <span className="text-xs text-muted-foreground">x</span>
                                                        <Input
                                                            placeholder="W"
                                                            title="Width"
                                                            value={part.width || ''}
                                                            onChange={(e) => updatePart(part.id, { width: parseFloat(e.target.value) || 0 })}
                                                            className="h-8 w-16"
                                                        />
                                                        <span className="text-xs text-muted-foreground">x</span>
                                                        <Input
                                                            placeholder="L"
                                                            title="Length"
                                                            value={part.length || ''}
                                                            onChange={(e) => updatePart(part.id, { length: parseFloat(e.target.value) || 0 })}
                                                            className="h-8 w-16"
                                                        />
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-1">
                                                        <Select
                                                            value={part.selectedProfileType}
                                                            onValueChange={(v) => updatePart(part.id, { selectedProfileType: v, selectedProfileDim: '' })}
                                                        >
                                                            <SelectTrigger className="h-8 w-24">
                                                                <SelectValue placeholder="Type" />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                {profileTypes.map(t => (
                                                                    <SelectItem key={t} value={t}>{t}</SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                        <Select
                                                            value={part.selectedProfileDim}
                                                            onValueChange={(v) => updatePart(part.id, { selectedProfileDim: v })}
                                                            disabled={!part.selectedProfileType}
                                                        >
                                                            <SelectTrigger className="h-8 w-24">
                                                                <SelectValue placeholder="Dim" />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                {standardProfiles
                                                                    .filter(p => p.type === part.selectedProfileType)
                                                                    .map(p => (
                                                                        <SelectItem key={p.dimensions} value={p.dimensions}>{p.dimensions}</SelectItem>
                                                                    ))
                                                                }
                                                            </SelectContent>
                                                        </Select>
                                                        <Input
                                                            placeholder="Len"
                                                            value={part.length || ''}
                                                            onChange={(e) => updatePart(part.id, { length: parseFloat(e.target.value) || 0 })}
                                                            className="h-8 w-16"
                                                        />
                                                    </div>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                {part.status === 'CREATED' && <CheckCircle className="h-4 w-4 text-green-500" />}
                                                {part.status === 'ERROR' && <span title={part.errorMsg}><AlertCircle className="h-4 w-4 text-red-500" /></span>}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </ScrollArea>
                    )}
                </div>

                <DialogFooter className="mt-4">
                    {step === 'upload' ? (
                        <Button onClick={handleUpload} disabled={!file || uploading}>
                            {uploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Upload & Parse
                        </Button>
                    ) : (
                        <>
                            <Button variant="outline" onClick={() => setStep('upload')}>Back to Upload</Button>
                            <Button onClick={handleCreateParts} disabled={creating}>
                                {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Create Parts
                            </Button>
                        </>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
