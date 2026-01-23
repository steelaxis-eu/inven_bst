'use client'

import { useState, useEffect, useRef } from 'react'
import { useImport } from "@/context/import-context"
import {
    Dialog,
    DialogTrigger,
    DialogSurface,
    DialogBody,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Input,
    Label,
    Spinner,
    makeStyles,
    tokens,
    Text,
    TabList,
    Tab,
    Table,
    TableHeader,
    TableRow,
    TableHeaderCell,
    TableBody,
    TableCell,
    Checkbox,
    Dropdown,
    Option,
    Combobox,
    ProgressBar,
    Badge,
    shorthands,
    Link
} from "@fluentui/react-components"
import {
    ArrowUploadRegular,
    DocumentTextRegular,
    LayerRegular,
    CheckmarkCircleRegular,
    ErrorCircleRegular,
    BoxRegular,
    AddRegular,
    ArrowClockwiseRegular
} from "@fluentui/react-icons"
import { toast } from 'sonner'
import { getProjectPartsCount, createPart } from '@/app/actions/parts'
import { createPlatePart } from '@/app/actions/plateparts'
import { createAssembly } from '@/app/actions/assemblies'
import { createGrade } from '@/app/actions/grades'
import { createImportBatch, getBatchStatus, uploadSingleDrawing, cancelImportBatch, ParsedPart } from '@/app/actions/drawings'
import JSZip from 'jszip'

// Interfaces
interface ReviewPart {
    id: string
    filename: string
    partNumber: string
    description?: string
    quantity: number
    material?: string
    thickness?: number
    width?: number
    length?: number
    profileType?: string | null
    profileDimensions?: string | null
    drawingRef?: string
    confidence: number
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
    projectName: string
    profiles: { id: string; type: string; dimensions: string; weightPerMeter: number }[]
    standardProfiles: { type: string; dimensions: string; weightPerMeter: number }[]
    grades: { id: string; name: string }[]
    shapes: { id: string; params: string[] }[]
}

const useStyles = makeStyles({
    dialogContent: {
        height: '90vh',
        width: '95vw',
        maxWidth: '1600px',
        display: 'flex',
        flexDirection: 'column',
    },
    uploadArea: {
        border: `2px dashed ${tokens.colorNeutralStroke1}`,
        borderRadius: tokens.borderRadiusLarge,
        padding: '48px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '16px',
        margin: '24px',
        transition: 'all 0.2s',
        cursor: 'pointer',
        ':hover': {
            ...shorthands.borderColor(tokens.colorBrandStroke1),
            backgroundColor: tokens.colorBrandBackground2,
        }
    },
    activeUpload: {
        ...shorthands.borderColor(tokens.colorBrandStroke1),
        backgroundColor: tokens.colorBrandBackground2,
    },
    tableContainer: {
        flex: 1,
        overflow: 'auto',
        border: `1px solid ${tokens.colorNeutralStroke1}`,
        borderRadius: tokens.borderRadiusMedium,
        marginTop: '16px',
        position: 'relative',
    },
    stickyHeader: {
        position: 'sticky',
        top: 0,
        zIndex: 2,
        backgroundColor: tokens.colorNeutralBackground1,
        boxShadow: tokens.shadow2,
    },
    inputSmall: { width: '80px' },
    inputMedium: { width: '100%', minWidth: '120px' },
    dimensionRow: {
        display: 'grid',
        gridTemplateColumns: 'minmax(140px, 1fr) 1fr 100px',
        gap: '8px',
        alignItems: 'center',
        width: '100%',
    },
    plateRow: {
        display: 'grid',
        gridTemplateColumns: '1fr 16px 1fr 16px 1fr',
        alignItems: 'center',
        gap: '4px',
    }
})

export function ImportDrawingsDialog({ projectId, projectName, profiles, standardProfiles, grades, shapes }: ImportDrawingsDialogProps) {
    const styles = useStyles()
    // Using local state for the queue logic instead of global context for now as it's specific to this robust flow
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [file, setFile] = useState<File | null>(null)
    const [step, setStep] = useState<'upload' | 'processing' | 'review'>('upload')

    // Processing State
    const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0, status: 'IDLE' }) // IDLE, UNZIPPING, UPLOADING, QUEUED
    const [batchId, setBatchId] = useState<string | null>(null)
    const [processingStats, setProcessingStats] = useState({ total: 0, completed: 0, failed: 0, pending: 0 })

    // Review State
    const [parts, setParts] = useState<ReviewPart[]>([])
    const [creating, setCreating] = useState(false)
    const [isDragging, setIsDragging] = useState(false)

    // Grade Creation
    const [availableGrades, setAvailableGrades] = useState(grades)
    const [isAddingGrade, setIsAddingGrade] = useState(false)
    const [newGradeName, setNewGradeName] = useState("")

    useEffect(() => { setAvailableGrades(grades) }, [grades])

    // Load resumable batch
    useEffect(() => {
        const savedBatch = localStorage.getItem(`import_batch_${projectId}`)
        if (savedBatch && step === 'upload' && isDialogOpen) {
            setBatchId(savedBatch)
            setStep('processing')
            toast.info("Resumed previous import session")
        }
    }, [projectId, step, isDialogOpen])

    // POLLING EFFECT
    useEffect(() => {
        let interval: NodeJS.Timeout
        if (step === 'processing' && batchId) {
            const checkStatus = async () => {
                try {
                    const status = await getBatchStatus(batchId)
                    setProcessingStats({
                        total: status.total,
                        completed: status.completed,
                        failed: status.failed,
                        pending: status.pending
                    })

                    if (status.pending === 0 && status.total > 0) {
                        // Finished!
                        localStorage.removeItem(`import_batch_${projectId}`)

                        const mappedParts = status.results.map(p => {
                            const matchedGrade = availableGrades.find(g =>
                                g.name.toLowerCase() === p.material?.toLowerCase() ||
                                g.name.replace(/\s+/g, '').toLowerCase() === p.material?.replace(/\s+/g, '').toLowerCase()
                            )
                            return {
                                ...p,
                                include: true,
                                type: (p.type === 'PROFILE' || !!p.profileType) ? 'PROFILE' : 'PLATE',
                                selectedProfileType: p.profileType ? p.profileType.toUpperCase() : undefined,
                                selectedProfileDim: p.profileDimensions,
                                selectedGradeId: matchedGrade?.id,
                                status: 'PENDING'
                            } as ReviewPart
                        })
                        setParts(mappedParts)
                        setStep('review')
                        toast.success("All drawings processed!")
                    }
                } catch (e) {
                    console.error("Polling error", e)
                }
            }

            checkStatus() // Initial check
            interval = setInterval(checkStatus, 3000) // Poll every 3s
        }
        return () => clearInterval(interval)
    }, [step, batchId, projectId, availableGrades])

    const handleFileUpload = async () => {
        if (!file) return

        try {
            setStep('processing')
            setUploadProgress({ current: 0, total: 100, status: 'UNZIPPING' })

            const zip = new JSZip()
            const zipContent = await zip.loadAsync(file)

            const pdfFiles: { name: string, data: Blob }[] = []

            zipContent.forEach((path, entry) => {
                if (entry.name.toLowerCase().endsWith('.pdf') && !entry.name.startsWith('__MACOSX') && !entry.dir) {
                    pdfFiles.push({ name: entry.name.split('/').pop() || entry.name, data: {} as any /* placeholder, fetch in loop */ })
                }
            })

            // Iterate and get data
            const validFiles = []
            let count = 0
            setUploadProgress({ current: 0, total: pdfFiles.length, status: 'UPLOADING' })

            const uploadMetadata: { filename: string, storagePath: string }[] = []

            // Upload in chunks of 5 to avoid browser network clogging
            const CHUNK_SIZE = 5
            const entries = Object.values(zipContent.files).filter(e => e.name.toLowerCase().endsWith('.pdf') && !e.name.startsWith('__MACOSX') && !e.dir)

            for (let i = 0; i < entries.length; i += CHUNK_SIZE) {
                const chunk = entries.slice(i, i + CHUNK_SIZE)
                await Promise.all(chunk.map(async (entry) => {
                    const blob = await entry.async('blob')
                    const filename = entry.name.split('/').pop() || entry.name

                    const formData = new FormData()
                    formData.append('file', blob, filename)

                    const res = await uploadSingleDrawing(formData, projectId)
                    if (res.success && res.storagePath) {
                        uploadMetadata.push({ filename, storagePath: res.storagePath })
                    }
                }))
                count += chunk.length
                setUploadProgress({ current: count, total: entries.length, status: 'UPLOADING' })
            }

            if (uploadMetadata.length === 0) {
                toast.error("No valid PDF files uploaded")
                setStep('upload')
                return
            }

            setUploadProgress({ ...uploadProgress, status: 'QUEUED' })

            // Create Batch and Trigger Queue
            const batchRes = await createImportBatch(uploadMetadata, projectId)
            if (batchRes.success && batchRes.batchId) {
                setBatchId(batchRes.batchId)
                localStorage.setItem(`import_batch_${projectId}`, batchRes.batchId)
                // Polling effect creates takes over
            } else {
                throw new Error(batchRes.error || "Failed to create batch")
            }

        } catch (e: any) {
            console.error(e)
            toast.error("Import failed: " + e.message)
            setStep('upload')
        }
    }

    const resetImport = async () => {
        if (batchId) {
            // Clean up database records
            await cancelImportBatch(batchId)
            localStorage.removeItem(`import_batch_${projectId}`)
        }
        setBatchId(null)
        setFile(null)
        setParts([])
        setProcessingStats({ total: 0, completed: 0, failed: 0, pending: 0 })
        setStep('upload')
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
                    if (!part.selectedProfileType || !part.selectedProfileDim) throw new Error("Missing profile info")
                    await createPart({
                        projectId,
                        partNumber: part.partNumber,
                        description: part.description || undefined,
                        quantity: part.quantity,
                        gradeId: part.selectedGradeId!,
                        profileType: part.selectedProfileType,
                        profileDimensions: part.selectedProfileDim,
                        length: part.length || 0,
                        drawingRef: part.drawingRef,
                        notes: `Imported from ${part.filename}`
                    })
                } else {
                    await createPlatePart({
                        projectId,
                        partNumber: part.partNumber,
                        description: part.description || undefined,
                        quantity: part.quantity,
                        gradeId: part.selectedGradeId!,
                        thickness: part.thickness || 0,
                        width: part.width || 0,
                        length: part.length || 0,
                        notes: `Imported from ${part.filename}`,
                        isOutsourced: false
                    })
                }
                updatePart(part.id, { status: 'CREATED' })
                successCount++
            } catch (e: any) {
                updatePart(part.id, { status: 'ERROR', errorMsg: e.message || "Failed" })
            }
        }
        setCreating(false)
        if (successCount > 0) {
            toast.success(`Created ${successCount} parts`)
            setTimeout(() => window.location.reload(), 1500)
        }
    }

    // Grade Creation Handler
    const handleAddGrade = async () => {
        if (!newGradeName) return
        const res = await createGrade(newGradeName)
        if (res.success && res.grade) {
            toast.success(`Grade ${res.grade.name} created`)
            const newGradeItem = { id: res.grade.id, name: res.grade.name }
            setAvailableGrades(prev => [...prev, newGradeItem])
            // Auto update selected
            setParts(prevParts => prevParts.map(p => {
                if (!p.selectedGradeId && p.material?.toLowerCase() === newGradeName.toLowerCase()) {
                    return { ...p, selectedGradeId: res.grade.id }
                }
                return p
            }))
            setNewGradeName("")
            setIsAddingGrade(false)
        } else {
            toast.error("Failed to create grade")
        }
    }

    const fileInputRef = useRef<HTMLInputElement>(null)
    const profileTypes = Array.from(new Set([
        ...standardProfiles.map(p => p.type),
        ...shapes.map(s => s.id),
        "RHS-EN10219", "SHS-EN10219", "CHS-EN10219", "IPE", "HEA", "HEB", "UPN", "UPE"
    ])).sort()

    return (
        <Dialog open={isDialogOpen} onOpenChange={(e, data) => setIsDialogOpen(data.open)}>
            <DialogTrigger disableButtonEnhancement>
                <Button icon={<ArrowUploadRegular />} onClick={() => setIsDialogOpen(true)}>Import Drawings</Button>
            </DialogTrigger>

            <DialogSurface className={styles.dialogContent}>
                <DialogBody style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    <DialogTitle>Import from Drawings (Robust Mode)</DialogTitle>
                    <div>
                        {/* Optional Tab List if adding back Assembly mode later */}
                    </div>

                    <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                        {step === 'upload' && (
                            <div
                                className={`${styles.uploadArea} ${isDragging ? styles.activeUpload : ''}`}
                                onDragEnter={(e) => { e.preventDefault(); setIsDragging(true); }}
                                onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={(e) => {
                                    e.preventDefault();
                                    setIsDragging(false);
                                    if (e.dataTransfer.files?.[0]?.name.toLowerCase().endsWith('.zip')) setFile(e.dataTransfer.files[0]);
                                    else toast.error("ZIP files only");
                                }}
                                onClick={() => fileInputRef.current?.click()}
                            >
                                <ArrowUploadRegular style={{ fontSize: '48px', color: tokens.colorNeutralForeground3 }} />
                                <div style={{ textAlign: 'center' }}>
                                    <Text weight="semibold" size={400}>{isDragging ? "Drop ZIP file here" : "Upload Drawings ZIP"}</Text>
                                    <br />
                                    <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>Drag & drop or Click to browse</Text>
                                    {localStorage.getItem(`import_batch_${projectId}`) && (
                                        <div style={{ marginTop: 8 }}>
                                            <Button appearance="outline" size="small" onClick={(e) => {
                                                e.stopPropagation();
                                                setBatchId(localStorage.getItem(`import_batch_${projectId}`));
                                                setStep('processing');
                                            }}>Resume Previous Import</Button>
                                        </div>
                                    )}
                                </div>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    style={{ display: 'none' }}
                                    accept=".zip"
                                    onChange={(e) => { if (e.target.files?.[0]) setFile(e.target.files[0]); }}
                                />
                                {file && (
                                    <Badge appearance="tint" color="brand" icon={<BoxRegular />}>
                                        {file.name}
                                    </Badge>
                                )}
                            </div>
                        )}

                        {step === 'processing' && (
                            <div className={styles.uploadArea} style={{ cursor: 'default' }}>
                                <Spinner size="large" />
                                <Text size={500} weight="semibold" style={{ marginTop: 16 }}>
                                    {uploadProgress.status === 'UPLOADING' ? `Uploading... (${uploadProgress.current}/${uploadProgress.total})` :
                                        uploadProgress.status === 'UNZIPPING' ? 'Preparing Files...' :
                                            'Processing Drawings with AI...'}
                                </Text>

                                {uploadProgress.status === 'UPLOADING' && (
                                    <ProgressBar value={uploadProgress.current} max={uploadProgress.total} style={{ width: 300, marginTop: 8 }} />
                                )}

                                <div style={{ marginTop: 24, textAlign: 'center' }}>
                                    <div style={{ display: 'flex', gap: 24 }}>
                                        <div style={{ textAlign: 'center' }}>
                                            <Text size={600} weight="bold">{processingStats.completed}</Text><br />
                                            <Text size={200}>Completed</Text>
                                        </div>
                                        <div style={{ textAlign: 'center' }}>
                                            <Text size={600} weight="bold" style={{ color: tokens.colorPaletteRedForeground1 }}>{processingStats.failed}</Text><br />
                                            <Text size={200}>Failed</Text>
                                        </div>
                                        <div style={{ textAlign: 'center' }}>
                                            <Text size={600} weight="bold" style={{ color: tokens.colorPaletteBlueForeground2 }}>{processingStats.pending}</Text><br />
                                            <Text size={200}>Remaining</Text>
                                        </div>
                                    </div>
                                </div>
                                <Text size={200} style={{ marginTop: 24, color: tokens.colorNeutralForeground3 }}>
                                    You can close this window. Processing will continue in the background. Is 'Robust Mode' enabled.
                                </Text>
                            </div>
                        )}

                        {step === 'review' && (
                            <div className={styles.tableContainer}>
                                <Table size="medium" style={{ tableLayout: 'fixed', minWidth: '1000px' }}>
                                    <TableHeader className={styles.stickyHeader}>
                                        <TableRow>
                                            <TableHeaderCell style={{ width: '48px' }}><Checkbox /></TableHeaderCell>
                                            <TableHeaderCell style={{ width: '220px' }}>Part Number</TableHeaderCell>
                                            <TableHeaderCell style={{ width: '140px' }}>Type</TableHeaderCell>
                                            <TableHeaderCell style={{ width: '80px' }}>Qty</TableHeaderCell>
                                            <TableHeaderCell style={{ width: '200px' }}>Grade</TableHeaderCell>
                                            <TableHeaderCell style={{ width: 'auto', minWidth: '500px' }}>Dimensions</TableHeaderCell>
                                            <TableHeaderCell style={{ width: '48px' }}></TableHeaderCell>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {parts.map(part => (
                                            <TableRow key={part.id} style={{
                                                opacity: part.status === 'CREATED' ? 0.5 : 1,
                                                backgroundColor: part.status === 'CREATED' ? tokens.colorPaletteGreenBackground1 : undefined,
                                            }}>
                                                <TableCell style={{ verticalAlign: 'top', paddingTop: '12px' }}>
                                                    <Checkbox checked={part.include} onChange={(e, d) => updatePart(part.id, { include: d.checked as boolean })} disabled={part.status === 'CREATED'} />
                                                </TableCell>
                                                <TableCell style={{ verticalAlign: 'top', paddingTop: '12px' }}>
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                        <Input value={part.partNumber} onChange={(e, d) => updatePart(part.id, { partNumber: d.value })} className={styles.inputMedium} />
                                                        <Text size={100} style={{ color: tokens.colorNeutralForeground3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{part.filename}</Text>
                                                    </div>
                                                </TableCell>
                                                <TableCell style={{ verticalAlign: 'top', paddingTop: '12px' }}>
                                                    <Dropdown
                                                        value={part.type === 'PLATE' ? "Plate" : "Profile"}
                                                        selectedOptions={[part.type]}
                                                        onOptionSelect={(e, d) => updatePart(part.id, { type: d.optionValue as any })}
                                                        style={{ width: '100%' }}
                                                    >
                                                        <Option value="PLATE">Plate</Option>
                                                        <Option value="PROFILE">Profile</Option>
                                                    </Dropdown>
                                                </TableCell>
                                                <TableCell style={{ verticalAlign: 'top', paddingTop: '12px' }}>
                                                    <Input type="number" value={part.quantity.toString()} onChange={(e, d) => updatePart(part.id, { quantity: parseInt(d.value) || 0 })} className={styles.inputSmall} />
                                                </TableCell>
                                                <TableCell style={{ verticalAlign: 'top', paddingTop: '12px' }}>
                                                    <Combobox
                                                        value={availableGrades.find(g => g.id === part.selectedGradeId)?.name || part.material || ''}
                                                        selectedOptions={part.selectedGradeId ? [part.selectedGradeId] : []}
                                                        onOptionSelect={(e, d) => {
                                                            if (d.optionValue === 'new') {
                                                                setNewGradeName("")
                                                                setIsAddingGrade(true)
                                                            } else {
                                                                updatePart(part.id, { selectedGradeId: d.optionValue as string })
                                                            }
                                                        }}
                                                        placeholder={(!part.selectedGradeId && part.material) ? `Add ${part.material}?` : "Grade"}
                                                        style={{
                                                            width: '100%',
                                                            border: (!part.selectedGradeId && part.material) ? `1px solid ${tokens.colorPaletteDarkOrangeBorder1}` : undefined
                                                        }}
                                                    >
                                                        {availableGrades.map(g => <Option key={g.id} value={g.id} text={g.name}>{g.name}</Option>)}
                                                        <Option value="new" text="+ Add New Grade">+ Add New Grade</Option>
                                                    </Combobox>
                                                </TableCell>
                                                <TableCell style={{ verticalAlign: 'top', paddingTop: '12px' }}>
                                                    {part.type === 'PLATE' ? (
                                                        <div className={styles.plateRow}>
                                                            <Input placeholder="T" value={part.thickness?.toString()} onChange={(e, d) => updatePart(part.id, { thickness: parseFloat(d.value) })} style={{ width: '100%' }} />
                                                            <Text align="center">x</Text>
                                                            <Input placeholder="W" value={part.width?.toString()} onChange={(e, d) => updatePart(part.id, { width: parseFloat(d.value) })} style={{ width: '100%' }} />
                                                            <Text align="center">x</Text>
                                                            <Input placeholder="L" value={part.length?.toString()} onChange={(e, d) => updatePart(part.id, { length: parseFloat(d.value) })} style={{ width: '100%' }} />
                                                        </div>
                                                    ) : (
                                                        <div className={styles.dimensionRow}>
                                                            <Dropdown
                                                                value={part.selectedProfileType || ''}
                                                                selectedOptions={part.selectedProfileType ? [part.selectedProfileType] : []}
                                                                onOptionSelect={(e, d) => updatePart(part.id, { selectedProfileType: d.optionValue as string })}
                                                                placeholder="Type"
                                                                style={{ width: '100%' }}
                                                            >
                                                                {profileTypes.map(t => <Option key={t} value={t}>{t}</Option>)}
                                                            </Dropdown>
                                                            <Combobox
                                                                value={part.selectedProfileDim || ''}
                                                                onOptionSelect={(e, d) => updatePart(part.id, { selectedProfileDim: d.optionValue as string })}
                                                                onInput={(e) => updatePart(part.id, { selectedProfileDim: (e.target as HTMLInputElement).value })}
                                                                placeholder="Dim"
                                                                style={{ width: '100%' }}
                                                                freeform
                                                            >
                                                                {standardProfiles.filter(p => p.type === part.selectedProfileType).map(p => (
                                                                    <Option key={p.dimensions} value={p.dimensions}>{p.dimensions}</Option>
                                                                ))}
                                                            </Combobox>
                                                            <Input placeholder="L" value={part.length?.toString()} onChange={(e, d) => updatePart(part.id, { length: parseFloat(d.value) })} style={{ width: '100px' }} />
                                                        </div>
                                                    )}
                                                </TableCell>
                                                <TableCell style={{ verticalAlign: 'top', paddingTop: '12px' }}>
                                                    {part.status === 'CREATED' && <CheckmarkCircleRegular style={{ color: tokens.colorPaletteGreenForeground1 }} />}
                                                    {part.status === 'ERROR' && <ErrorCircleRegular style={{ color: tokens.colorPaletteRedForeground1 }} title={part.errorMsg} />}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </div>

                    <DialogActions>
                        {step === 'upload' ? (
                            <Button appearance="primary" onClick={handleFileUpload} disabled={!file} icon={<ArrowUploadRegular />}>
                                Start Upload & Process
                            </Button>
                        ) : step === 'processing' ? (
                            <Button appearance="subtle" onClick={resetImport} icon={<ArrowClockwiseRegular />}>Restart / Cancel</Button>
                        ) : (
                            <>
                                <Button appearance="subtle" onClick={resetImport}>Cancel / Restart</Button>
                                <Button appearance="primary" onClick={handleCreateParts} disabled={creating} icon={creating ? <Spinner size="tiny" /> : undefined}>
                                    Create Parts
                                </Button>
                            </>
                        )}
                    </DialogActions>

                    <Dialog open={isAddingGrade} onOpenChange={(e, data) => setIsAddingGrade(data.open)}>
                        <DialogSurface>
                            <DialogBody>
                                <DialogTitle>Add New Grade</DialogTitle>
                                <DialogContent>
                                    <Label>Name</Label>
                                    <Input value={newGradeName} onChange={(e, d) => setNewGradeName(d.value)} placeholder="e.g. S355" />
                                </DialogContent>
                                <DialogActions>
                                    <Button appearance="secondary" onClick={() => setIsAddingGrade(false)}>Cancel</Button>
                                    <Button appearance="primary" onClick={handleAddGrade} disabled={!newGradeName} icon={<AddRegular />}>Create Grade</Button>
                                </DialogActions>
                            </DialogBody>
                        </DialogSurface>
                    </Dialog>

                </DialogBody>
            </DialogSurface>
        </Dialog>
    )
}
