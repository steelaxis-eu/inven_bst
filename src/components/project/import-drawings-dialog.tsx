'use client'

import { useState, useEffect } from 'react'
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
    shorthands
} from "@fluentui/react-components"
import {
    ArrowUploadRegular,
    DocumentTextRegular,
    LayerRegular,
    CheckmarkCircleRegular,
    ErrorCircleRegular,
    BoxRegular,
    AddRegular
} from "@fluentui/react-icons"
import { toast } from 'sonner'
import { getProjectPartsCount, createPart } from '@/app/actions/parts'
import { createPlatePart } from '@/app/actions/plateparts'
import { createAssembly } from '@/app/actions/assemblies'
import { createGrade } from '@/app/actions/grades'

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

interface ReviewAssembly {
    id: string
    filename: string
    assemblyNumber: string
    name: string
    quantity: number
    bom: any[]
    drawingRef?: string
    confidence: number
    include: boolean
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
        position: 'relative', // Context for sticky
    },
    stickyHeader: {
        position: 'sticky',
        top: 0,
        zIndex: 2,
        backgroundColor: tokens.colorNeutralBackground1, // Opaque background
        boxShadow: tokens.shadow2, // Slight shadow to separate from content
    },
    inputSmall: {
        width: '80px',
    },
    inputMedium: {
        width: '100%',
        minWidth: '120px',
    },
    actionRow: {
        display: 'flex',
        gap: '8px',
        alignItems: 'center',
        width: '100%',
    },
    dimensionRow: {
        display: 'grid',
        gridTemplateColumns: 'minmax(140px, 1fr) 1fr 100px', // Type, Dimensions, Length
        gap: '8px',
        alignItems: 'center',
        width: '100%',
    },
    plateRow: {
        display: 'grid',
        gridTemplateColumns: '1fr 16px 1fr 16px 1fr', // T x W x L
        alignItems: 'center',
        gap: '4px',
    }
})

export function ImportDrawingsDialog({ projectId, projectName, profiles, standardProfiles, grades, shapes }: ImportDrawingsDialogProps) {
    const styles = useStyles()
    // @ts-ignore
    const { startImport, resultParts, resultAssemblies, status, progress, dismiss, reset, isDialogOpen, openDialog, closeDialog } = useImport()

    // Local state
    // const [open, setOpen] = useState(false) // Removed in favor of context
    const [mode, setMode] = useState<'parts' | 'assemblies'>('parts')
    const [file, setFile] = useState<File | null>(null)
    const [parts, setParts] = useState<ReviewPart[]>([])
    const [assemblies, setAssemblies] = useState<ReviewAssembly[]>([])
    const [step, setStep] = useState<'upload' | 'review'>('upload')
    const [creating, setCreating] = useState(false)
    const [isDragging, setIsDragging] = useState(false)
    const [hasExistingParts, setHasExistingParts] = useState(false)

    // Dynamic Grade Creation
    const [availableGrades, setAvailableGrades] = useState(grades)
    const [isAddingGrade, setIsAddingGrade] = useState(false)
    const [newGradeName, setNewGradeName] = useState("")

    useEffect(() => {
        const checkParts = async () => {
            const res = await getProjectPartsCount(projectId)
            setHasExistingParts(!!(res.success && res.count && res.count > 0))
        }
        checkParts()
    }, [projectId])

    useEffect(() => {
        setAvailableGrades(grades)
    }, [grades])

    useEffect(() => {
        if (status === 'reviewing') {
            // setOpen(true) // Context handles this now
            if (resultParts.length > 0 && parts.length === 0) {
                const mappedParts = resultParts
                    .filter(p => p.confidence > 90)
                    .map(p => {
                        const rawType = p.type?.toUpperCase() || 'PLATE'
                        const isProfile = rawType === 'PROFILE' || !!p.profileType
                        const matchedGrade = availableGrades.find(g =>
                            g.name.toLowerCase() === p.material?.toLowerCase() ||
                            g.name.replace(/\s+/g, '').toLowerCase() === p.material?.replace(/\s+/g, '').toLowerCase()
                        )
                        return {
                            ...p,
                            include: true,
                            type: (isProfile ? 'PROFILE' : 'PLATE') as 'PROFILE' | 'PLATE',
                            selectedProfileType: p.profileType ? p.profileType.toUpperCase() : undefined,
                            selectedProfileDim: p.profileDimensions,
                            selectedGradeId: matchedGrade?.id,
                            status: 'PENDING'
                        } as ReviewPart
                    })
                setParts(mappedParts)
                setStep('review')
                setMode('parts')
            } else if (resultAssemblies.length > 0 && assemblies.length === 0) {
                setAssemblies(resultAssemblies
                    .filter(a => a.confidence > 90)
                    .map(a => ({ ...a, include: true, status: 'PENDING' } as ReviewAssembly)))
                setStep('review')
                setMode('assemblies')
            }
        }
    }, [status, resultParts, resultAssemblies, availableGrades])

    const profileTypes = Array.from(new Set([
        ...standardProfiles.map(p => p.type),
        ...shapes.map(s => s.id),
        "RHS-EN10219", "SHS-EN10219", "CHS-EN10219", // Explicit listing of standard types
        "IPE", "HEA", "HEB", "UPN", "UPE"
    ])).sort()

    const handleUpload = async () => {
        if (!file) return
        // Don't close dialog here, stay open to show progress
        await startImport(file, mode, projectId, projectName)
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
            reset() // Context reset but keep dialog potentially? Usually we reload or clear.
            window.location.reload()
        }
    }

    const handleCreateAssemblies = async () => {
        const assembliesToCreate = assemblies.filter(a => a.include && a.status !== 'CREATED')
        setCreating(true)
        let successCount = 0
        for (const assembly of assembliesToCreate) {
            try {
                await createAssembly({
                    projectId,
                    assemblyNumber: assembly.assemblyNumber,
                    name: assembly.name,
                    quantity: assembly.quantity,
                    notes: `Imported from ${assembly.filename}`,
                    bom: assembly.bom,
                    drawingRef: assembly.drawingRef
                })
                updateAssembly(assembly.id, { status: 'CREATED' })
                successCount++
            } catch (e: any) {
                updateAssembly(assembly.id, { status: 'ERROR', errorMsg: e.message })
            }
        }
        setCreating(false)
        if (successCount > 0) {
            toast.success(`Created ${successCount} assemblies`)
            reset()
            window.location.reload()
        }
    }

    const handleAddGrade = async () => {
        if (!newGradeName) return
        const res = await createGrade(newGradeName)
        if (res.success && res.grade) {
            toast.success(`Grade ${res.grade.name} created`)
            const newGradeItem = { id: res.grade.id, name: res.grade.name }
            setAvailableGrades(prev => [...prev, newGradeItem])
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

    const handleReset = () => {
        reset()
        setStep('upload')
        setFile(null)
        setParts([])
        setAssemblies([])
        setCreating(false)
    }

    return (
        <Dialog open={isDialogOpen} onOpenChange={(e, data) => data.open ? openDialog() : closeDialog()}>
            <DialogTrigger disableButtonEnhancement>
                <Button icon={<ArrowUploadRegular />} onClick={openDialog}>Import Drawings</Button>
            </DialogTrigger>

            <DialogSurface className={styles.dialogContent}>
                <DialogBody style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    <DialogTitle>Import from Drawings</DialogTitle>
                    <div>
                        <TabList selectedValue={mode} onTabSelect={(e, d) => { setMode(d.value as any); handleReset(); }}>
                            <Tab value="parts" icon={<DocumentTextRegular />}>Parts (Single)</Tab>
                            <Tab value="assemblies" icon={<LayerRegular />} disabled={!hasExistingParts} title={!hasExistingParts ? "Upload parts first" : ""}>Assemblies</Tab>
                        </TabList>
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
                                    if (e.dataTransfer.files?.[0]?.name.endsWith('.zip')) setFile(e.dataTransfer.files[0]);
                                    else toast.error("ZIP files only");
                                }}
                                onClick={() => document.getElementById('file-upload-dialog')?.click()}
                            >
                                {status === 'processing' ? (
                                    <div style={{ width: '100%', maxWidth: '300px', textAlign: 'center' }}>
                                        <Text weight="semibold" size={400}>Processing Drawings...</Text>
                                        <div style={{ marginTop: '16px' }}>
                                            <ProgressBar value={progress} max={100} />
                                            <Text size={200} style={{ color: tokens.colorNeutralForeground3, marginTop: '8px', display: 'block' }}>{progress}% Complete</Text>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <ArrowUploadRegular style={{ fontSize: '48px', color: tokens.colorNeutralForeground3 }} />
                                        <div style={{ textAlign: 'center' }}>
                                            <Text weight="semibold" size={400}>{isDragging ? "Drop ZIP file here" : "Upload Drawings ZIP"}</Text>
                                            <br />
                                            <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>Drag & drop or Click to browse</Text>
                                        </div>
                                        <input
                                            type="file"
                                            id="file-upload-dialog"
                                            style={{ display: 'none' }}
                                            accept=".zip"
                                            onChange={(e) => { if (e.target.files?.[0]) setFile(e.target.files[0]); }}
                                        />
                                        {file && (
                                            <Badge appearance="tint" color="brand" icon={<BoxRegular />}>
                                                {file.name}
                                            </Badge>
                                        )}
                                    </>
                                )}
                            </div>
                        )}

                        {step === 'review' && (
                            <div className={styles.tableContainer}>
                                {mode === 'parts' ? (
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
                                ) : (
                                    <Table>
                                        <TableHeader className={styles.stickyHeader}>
                                            <TableRow>
                                                <TableHeaderCell style={{ width: '40px' }}><Checkbox /></TableHeaderCell>
                                                <TableHeaderCell>Assembly #</TableHeaderCell>
                                                <TableHeaderCell>Name</TableHeaderCell>
                                                <TableHeaderCell>Qty</TableHeaderCell>
                                                <TableHeaderCell>BOM</TableHeaderCell>
                                                <TableHeaderCell></TableHeaderCell>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {assemblies.map(assembly => (
                                                <TableRow key={assembly.id} style={{ opacity: assembly.status === 'CREATED' ? 0.5 : 1 }}>
                                                    <TableCell>
                                                        <Checkbox checked={assembly.include} onChange={(e, d) => updateAssembly(assembly.id, { include: d.checked as boolean })} disabled={assembly.status === 'CREATED'} />
                                                    </TableCell>
                                                    <TableCell>
                                                        <Input value={assembly.assemblyNumber} onChange={(e, d) => updateAssembly(assembly.id, { assemblyNumber: d.value })} className={styles.inputMedium} />
                                                    </TableCell>
                                                    <TableCell>
                                                        <Input value={assembly.name} onChange={(e, d) => updateAssembly(assembly.id, { name: d.value })} className={styles.inputMedium} />
                                                    </TableCell>
                                                    <TableCell>
                                                        <Input type="number" value={assembly.quantity.toString()} onChange={(e, d) => updateAssembly(assembly.id, { quantity: parseInt(d.value) || 0 })} className={styles.inputSmall} />
                                                    </TableCell>
                                                    <TableCell>
                                                        <div style={{ fontSize: '11px', lineHeight: '1.2' }}>
                                                            {assembly.bom.map((b, i) => (
                                                                <div key={i}>{b.quantity}x {b.partNumber} ({b.profileType || 'PLATE'})</div>
                                                            ))}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        {assembly.status === 'CREATED' && <CheckmarkCircleRegular style={{ color: tokens.colorPaletteGreenForeground1 }} />}
                                                        {assembly.status === 'ERROR' && <ErrorCircleRegular style={{ color: tokens.colorPaletteRedForeground1 }} />}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                )}
                            </div>
                        )}
                    </div>

                    <DialogActions>
                        {step === 'upload' ? (
                            <Button appearance="primary" onClick={handleUpload} disabled={!file || status === 'processing'} icon={status === 'processing' ? <Spinner size="tiny" /> : undefined}>
                                Upload & Parse
                            </Button>
                        ) : (
                            <>
                                <Button appearance="subtle" onClick={handleReset}>Cancel / Restart</Button>
                                <Button appearance="primary" onClick={mode === 'parts' ? handleCreateParts : handleCreateAssemblies} disabled={creating} icon={creating ? <Spinner size="tiny" /> : undefined}>
                                    Create {mode === 'parts' ? 'Parts' : 'Assemblies'}
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
