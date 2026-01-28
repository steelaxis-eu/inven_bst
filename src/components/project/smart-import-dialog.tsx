'use client'

import { useState, useEffect, useRef } from 'react'
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
    Spinner,
    makeStyles,
    tokens,
    Text,
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
    Accordion,
    AccordionItem,
    AccordionHeader,
    AccordionPanel
} from "@fluentui/react-components"
import {
    ArrowUploadRegular,
    BoxRegular,
    ArrowClockwiseRegular,
    WarningRegular,
    CodeRegular,
    BeakerRegular,
    DocumentPdfRegular,
    DocumentTableRegular,
    DocumentRegular,
    FolderRegular,
    DeleteRegular
} from "@fluentui/react-icons"

import { toast } from 'sonner'
import JSZip from 'jszip'
import { v4 as uuidv4 } from 'uuid'
import { uploadSmartFile, createSmartImportBatch, getSmartBatchStatus } from '@/app/actions/smart-import'
import { createPartsBatch, BatchPartInput } from '@/app/actions/parts'

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
    warnings?: string[]
    raw?: any
    isSplit?: boolean
    cutAngles?: string
    source: 'PDF' | 'EXCEL'
    dxfRef?: string
}

interface SmartImportDialogProps {
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
    },
    warningIcon: {
        color: tokens.colorPaletteDarkOrangeForeground1,
        cursor: 'help'
    },
    manifestContainer: {
        padding: '24px',
        flex: 1,
        overflow: 'auto'
    }
})

// Types for Sorting Engine
type FileType = 'PDF' | 'EXCEL' | 'DXF' | 'OTHER' | 'TRASH'

interface ScannedFile {
    id: string
    path: string
    name: string
    file: File | Blob
    type: FileType
    size: number
}

export function SmartImportDialog({ projectId, projectName, profiles, standardProfiles, grades, shapes }: SmartImportDialogProps) {
    const styles = useStyles()
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [step, setStep] = useState<'upload' | 'manifest' | 'processing' | 'review'>('upload')

    // File Sorting State
    const [scannedFiles, setScannedFiles] = useState<ScannedFile[]>([])
    const [isScanning, setIsScanning] = useState(false)
    const [scanProgress, setScanProgress] = useState("")

    // Drag & Drop
    const [isDragging, setIsDragging] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)

    // Processing State
    const [batchId, setBatchId] = useState<string | null>(null)
    const [processingStats, setProcessingStats] = useState({ total: 0, completed: 0, failed: 0, pending: 0, totalPartsFound: 0 })
    const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0, status: 'IDLE' })

    // Review State
    const [parts, setParts] = useState<ReviewPart[]>([])

    // Polling Effect
    useEffect(() => {
        let interval: NodeJS.Timeout
        if (batchId && (step === 'processing' || step === 'review')) {
            const checkStatus = async () => {
                try {
                    const status = await getSmartBatchStatus(batchId)
                    setProcessingStats(prev => ({
                        total: status.total,
                        completed: status.completed,
                        failed: status.failed,
                        pending: status.pending,
                        totalPartsFound: status.totalPartsFound
                    }))

                    if (status.results.length > 0) {
                        setParts(prevParts => {
                            const newParts = [...prevParts]
                            status.results.forEach(resPart => {
                                const exists = newParts.find(p => p.id === resPart.id)
                                if (!exists) {
                                    // Map ParsedPart to ReviewPart
                                    const matchedGrade = grades.find(g =>
                                        g.name.toLowerCase() === resPart.material?.toLowerCase() ||
                                        g.name.replace(/\s+/g, '').toLowerCase() === resPart.material?.replace(/\s+/g, '').toLowerCase()
                                    )

                                    newParts.push({
                                        ...resPart,
                                        include: true,
                                        selectedProfileType: resPart.profileType,
                                        selectedProfileDim: resPart.profileDimensions,
                                        selectedGradeId: matchedGrade?.id,
                                        status: 'PENDING',
                                        source: (resPart as any).source || 'PDF'
                                    } as ReviewPart)
                                }
                            })
                            return newParts
                        })
                    }

                    if (status.pending === 0 && status.total > 0 && step === 'processing') {
                        setTimeout(() => setStep('review'), 1000)
                    }
                } catch (e) {
                    console.error(e)
                }
            }
            checkStatus()
            interval = setInterval(checkStatus, 3000)
        }
        return () => clearInterval(interval)
    }, [batchId, step, grades])

    // Handlers
    const handleFiles = async (files: FileList | null) => {
        if (!files || files.length === 0) return

        setIsScanning(true)
        setStep('manifest')
        const newScannedFiles: ScannedFile[] = []

        try {
            // Helper to process a single Item (File or Directory entry from zip or otherwise)
            // For now dealing with flat file list from input, but plan for zip

            const fileArray = Array.from(files)

            // 1. Initial Pass - Check for ZIPs to explode
            for (const file of fileArray) {
                if (file.name.toLowerCase().endsWith('.zip')) {
                    setScanProgress(`Unzipping ${file.name}...`)
                    try {
                        const zip = new JSZip()
                        const zipContent = await zip.loadAsync(file)

                        // Recursive extraction (JSZip handles folders naturally)
                        for (const [relativePath, zipEntry] of Object.entries(zipContent.files)) {
                            if (zipEntry.dir) continue

                            // Check for Trash
                            if (relativePath.includes('__MACOSX') || relativePath.includes('.DS_Store') || relativePath.startsWith('~$')) {
                                continue
                            }

                            const blob = await zipEntry.async('blob')
                            const type = classifyFile(zipEntry.name)

                            if (type === 'TRASH') continue

                            newScannedFiles.push({
                                id: uuidv4(),
                                path: relativePath,
                                name: zipEntry.name.split('/').pop() || zipEntry.name,
                                file: blob,
                                type,
                                size: (blob as any).size || 0 // JSZip blob might miss size prop visibly but it has it
                            })
                        }
                    } catch (e) {
                        toast.error(`Failed to unzip ${file.name}`)
                    }
                } else {
                    // Regular file
                    if (file.name.includes('__MACOSX') || file.name === '.DS_Store' || file.name.startsWith('~$')) continue

                    const type = classifyFile(file.name)
                    if (type === 'TRASH') continue

                    newScannedFiles.push({
                        id: uuidv4(),
                        path: file.name,
                        name: file.name,
                        file: file,
                        type,
                        size: file.size
                    })
                }
            }

            setScannedFiles(prev => [...prev, ...newScannedFiles])
            setScanProgress("")
            setIsScanning(false)

        } catch (e) {
            console.error(e)
            toast.error("Error scanning files")
            setIsScanning(false)
        }
    }

    const classifyFile = (filename: string): FileType => {
        const lower = filename.toLowerCase()
        if (lower.endsWith('.pdf')) return 'PDF'
        if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) return 'EXCEL'
        if (lower.endsWith('.dxf')) return 'DXF'
        return 'OTHER'
    }

    const removeScannedFile = (id: string) => {
        setScannedFiles(prev => prev.filter(f => f.id !== id))
    }

    const startProcessing = async () => {
        setStep('processing')
        setUploadProgress({ current: 0, total: scannedFiles.length, status: 'UPLOADING' })

        const uploadMetadata: { filename: string, storagePath: string, type: 'PDF' | 'EXCEL' | 'DXF' | 'OTHER' }[] = []

        try {
            // Upload in chunks
            const CHUNK_SIZE = 5
            for (let i = 0; i < scannedFiles.length; i += CHUNK_SIZE) {
                const chunk = scannedFiles.slice(i, i + CHUNK_SIZE)
                await Promise.all(chunk.map(async (entry) => {
                    const formData = new FormData()
                    formData.append('file', entry.file, entry.name) // name ensures filename is passed correctly even for blobs

                    const res = await uploadSmartFile(formData, projectId)
                    if (res.success && res.storagePath) {
                        uploadMetadata.push({ filename: entry.name, storagePath: res.storagePath, type: entry.type as 'PDF' | 'EXCEL' | 'DXF' | 'OTHER' })
                    }
                }))
                setUploadProgress(prev => ({ ...prev, current: Math.min(prev.current + chunk.length, scannedFiles.length) }))
            }

            if (uploadMetadata.length === 0) {
                toast.error("Upload failed")
                setStep('manifest')
                return
            }

            setUploadProgress(prev => ({ ...prev, status: 'QUEUED' }))

            const batchRes = await createSmartImportBatch(uploadMetadata, projectId)
            if (batchRes.success && batchRes.batchId) {
                setBatchId(batchRes.batchId)
                // Polling Effect takes over
            } else {
                toast.error("Failed to create batch")
                setStep('manifest')
            }

        } catch (e: any) {
            console.error(e)
            toast.error("Error starting processing")
            setStep('manifest')
        }
    }

    const reset = () => {
        setScannedFiles([])
        setParts([])
        setStep('upload')
    }

    return (
        <Dialog open={isDialogOpen} onOpenChange={(e, data) => setIsDialogOpen(data.open)}>
            <DialogTrigger disableButtonEnhancement>
                <Button appearance="subtle" icon={<BeakerRegular />} style={{ color: tokens.colorPalettePurpleForeground2 }}>Smart Import (Exp)</Button>
            </DialogTrigger>

            <DialogSurface className={styles.dialogContent}>
                <DialogBody style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    <DialogTitle>Smart Project Import (Experimental)</DialogTitle>

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
                                    handleFiles(e.dataTransfer.files)
                                }}
                                onClick={() => fileInputRef.current?.click()}
                            >
                                <FolderRegular style={{ fontSize: '48px', color: tokens.colorNeutralForeground3 }} />
                                <div style={{ textAlign: 'center' }}>
                                    <Text weight="semibold" size={400}>{isDragging ? "Drop Files/Folders here" : "Smart Import Dropzone"}</Text>
                                    <br />
                                    <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
                                        Drag & drop ZIPs, PDFs, Excels, DXFs or Folders.<br />
                                        We'll sort them out automatically.
                                    </Text>
                                </div>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    multiple
                                    style={{ display: 'none' }}
                                    accept=".zip,.pdf,.xlsx,.xls,.dxf"
                                    onChange={(e) => handleFiles(e.target.files)}
                                />
                                {isScanning && (
                                    <div style={{ marginTop: 24, display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <Spinner size="tiny" />
                                        <Text>{scanProgress || "Scanning..."}</Text>
                                    </div>
                                )}
                            </div>
                        )}

                        {step === 'manifest' && (
                            <div className={styles.manifestContainer}>
                                <Text size={500} weight="semibold">Found {scannedFiles.length} files</Text>
                                <div style={{ marginTop: 16, border: `1px solid ${tokens.colorNeutralStroke1}`, borderRadius: tokens.borderRadiusMedium }}>
                                    <Table size="small">
                                        <TableHeader>
                                            <TableRow>
                                                <TableHeaderCell>Type</TableHeaderCell>
                                                <TableHeaderCell>Path / Name</TableHeaderCell>
                                                <TableHeaderCell>Action</TableHeaderCell>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {scannedFiles.map(file => (
                                                <TableRow key={file.id}>
                                                    <TableCell>
                                                        {file.type === 'PDF' && <Badge icon={<DocumentPdfRegular />} color="danger">PDF</Badge>}
                                                        {file.type === 'EXCEL' && <Badge icon={<DocumentTableRegular />} color="success">Excel</Badge>}
                                                        {file.type === 'DXF' && <Badge icon={<BoxRegular />} color="brand">DXF</Badge>}
                                                        {file.type === 'OTHER' && <Badge icon={<DocumentRegular />} appearance="ghost">Other</Badge>}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Text size={200} style={{ fontFamily: 'monospace' }}>{file.path}</Text>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Button icon={<DeleteRegular />} appearance="subtle" size="small" onClick={() => removeScannedFile(file.id)} />
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            </div>
                        )}

                        {step === 'processing' && (
                            <div className={styles.uploadArea} style={{ cursor: 'default' }}>
                                <Spinner size="large" />
                                <Text size={500} weight="semibold" style={{ marginTop: 16 }}>Processing with AI...</Text>
                                <Text>This is a stub.</Text>
                            </div>
                        )}

                        {step === 'review' && (
                            <div className={styles.uploadArea}>
                                <Text>Review Screen Stub</Text>
                            </div>
                        )}

                    </div>

                    <DialogActions>
                        {step === 'upload' && (
                            <Button appearance="secondary" onClick={() => setIsDialogOpen(false)}>Close</Button>
                        )}
                        {step === 'manifest' && (
                            <>
                                <Button appearance="subtle" onClick={reset}>Clear All</Button>
                                <Button appearance="primary" onClick={startProcessing} disabled={scannedFiles.length === 0}>
                                    Process {scannedFiles.length} Files
                                </Button>
                            </>
                        )}
                        {(step === 'processing' || step === 'review') && (
                            <Button appearance="subtle" onClick={reset}>Restart</Button>
                        )}
                    </DialogActions>
                </DialogBody>
            </DialogSurface>
        </Dialog>
    )
}
