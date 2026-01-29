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
    DeleteRegular,
    CheckmarkCircleRegular
} from "@fluentui/react-icons"

import { toast } from 'sonner'
import JSZip from 'jszip'
import { v4 as uuidv4 } from 'uuid'
import {
    uploadSmartFile,
    createSmartImportBatch,
    getSmartBatchStatus,
    addToSmartBatch,
    scanSmartFiles
} from '@/app/actions/smart-import'
import { createPartsBatch, BatchPartInput } from '@/app/actions/parts'
import { ParsedPart } from '@/lib/smart-parsing-logic'
import { ScanResult } from '@/lib/agentic-scanner'

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
    storagePath?: string // Set after upload
    name: string
    file: File | Blob
    type: FileType
    category: 'LIST' | 'DRAWING' | 'ASSET'
    size: number
    scanResult?: ScanResult
    selectedAction?: 'IMPORT_PARTS' | 'IMPORT_ASSEMBLY' | 'EXTRACT_CUTS' | 'IGNORE' | 'ASSOCIATE'
}

export function SmartImportDialog({ projectId, projectName, profiles, standardProfiles, grades, shapes }: SmartImportDialogProps) {
    const styles = useStyles()
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [step, setStep] = useState<'upload' | 'scanning' | 'triage' | 'manifest' | 'processing' | 'review'>('upload')
    const [processingStage, setProcessingStage] = useState<'LISTS' | 'CONFIRM_DRAWINGS' | 'DRAWINGS' | 'COMPLETED'>('LISTS')

    // File Sorting State
    const [scannedFiles, setScannedFiles] = useState<ScannedFile[]>([])
    const [isScanning, setIsScanning] = useState(false)
    const [scanProgress, setScanProgress] = useState("")

    // Drag & Drop
    const [isDragging, setIsDragging] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)

    // Processing State
    const [batchId, setBatchId] = useState<string | null>(null)
    const [processingStats, setProcessingStats] = useState<{
        total: number,
        completed: number,
        failed: number,
        pending: number,
        totalPartsFound: number,
        fileSummaries: { id: string, filename: string, status: string, error?: string, partCount: number, summary?: string, rawData?: any }[]
    }>({ total: 0, completed: 0, failed: 0, pending: 0, totalPartsFound: 0, fileSummaries: [] })
    const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0, status: 'IDLE' })

    const [inspectFile, setInspectFile] = useState<{ filename: string, summary?: string, rawData?: any } | null>(null)

    // Review State
    const [parts, setParts] = useState<ReviewPart[]>([])
    const [showSlowWarning, setShowSlowWarning] = useState(false)
    const [startTime, setStartTime] = useState(0)

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
                        totalPartsFound: status.totalPartsFound,
                        fileSummaries: (status as any).fileSummaries || []
                    }))

                    if (status.results.length > 0) {
                        setParts(prevParts => {
                            const newParts = [...prevParts]
                            status.results.forEach((resPart: ParsedPart) => {
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
                        const zip = await JSZip.loadAsync(file)
                        for (const [relativePath, zipEntry] of Object.entries(zip.files)) {
                            if (zipEntry.dir || zipEntry.name.includes('__MACOSX') || zipEntry.name.startsWith('.')) continue

                            const category = classifyFileCategory(zipEntry.name, relativePath)
                            if (category === 'TRASH') continue

                            const blob = await zipEntry.async('blob')
                            const type = classifyFile(zipEntry.name)

                            newScannedFiles.push({
                                id: uuidv4(),
                                path: relativePath,
                                name: zipEntry.name.split('/').pop() || zipEntry.name,
                                file: blob,
                                type,
                                category,
                                size: (blob as any).size || 0
                            })
                        }
                    } catch (e) {
                        toast.error(`Failed to unzip ${file.name}`)
                    }
                } else {
                    // Regular file
                    if (file.name.includes('__MACOSX') || file.name === '.DS_Store' || file.name.startsWith('~$')) continue

                    const category = classifyFileCategory(file.name)
                    if (category === 'TRASH') continue
                    const type = classifyFile(file.name)

                    newScannedFiles.push({
                        id: uuidv4(),
                        path: file.name,
                        name: file.name,
                        file: file,
                        type,
                        category,
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

    const classifyFileCategory = (filename: string, path: string = ''): 'LIST' | 'DRAWING' | 'ASSET' | 'TRASH' => {
        const lowerName = filename.toLowerCase()
        const lowerPath = path.toLowerCase()

        // Excel is always a LIST
        if (lowerName.endsWith('.xlsx')) return 'LIST'

        // PDF can be LIST or DRAWING
        if (lowerName.endsWith('.pdf')) {
            if (lowerName.includes('list') || lowerName.includes('bom') || lowerName.includes('schedule') ||
                lowerPath.includes('list') || lowerPath.includes('bom')) {
                return 'LIST'
            }
            return 'DRAWING'
        }

        // CAD is ASSET
        if (lowerName.endsWith('.dxf') || lowerName.endsWith('.dwg')) return 'ASSET'

        return 'TRASH'
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

    const processFiles = async (filesToProcess: ScannedFile[], batchId: string) => {
        const CHUNK_SIZE = 5
        let processedCount = 0

        // If "uploading" was reset, we continue where we left off or start new
        // Ideally we assume filesToProcess are those needing upload

        for (let i = 0; i < filesToProcess.length; i += CHUNK_SIZE) {
            const chunk = filesToProcess.slice(i, i + CHUNK_SIZE)

            // 1. Upload Chunk (only those missing storagePath)
            const chunkMetadata: { filename: string, storagePath: string, type: 'PDF' | 'EXCEL' | 'DXF' | 'OTHER', instruction?: string }[] = []

            await Promise.all(chunk.map(async (entry) => {
                if (entry.storagePath) {
                    chunkMetadata.push({
                        filename: entry.name,
                        storagePath: entry.storagePath,
                        type: entry.type as any,
                        instruction: entry.selectedAction
                    })
                    return
                }

                const formData = new FormData()
                formData.append('file', entry.file, entry.name)

                const res = await uploadSmartFile(formData, projectId)
                if (res.success && res.storagePath) {
                    entry.storagePath = res.storagePath
                    chunkMetadata.push({
                        filename: entry.name,
                        storagePath: res.storagePath,
                        type: entry.type as any,
                        instruction: entry.selectedAction
                    })
                }
            }))

            // 2. Add to Batch
            if (chunkMetadata.length > 0) {
                await addToSmartBatch(batchId, chunkMetadata, projectId)
            }

            processedCount += chunk.length
            setUploadProgress(prev => ({
                ...prev,
                current: Math.min(prev.current + chunk.length, scannedFiles.length)
            }))
        }
    }

    const scanAndTriage = async () => {
        setStep('scanning')
        setScanProgress("Uploading files and glancing at content...")
        setStartTime(Date.now())

        try {
            // 1. Upload all files (or at least those that need scanning)
            const filesToScan = scannedFiles.filter(f => !f.storagePath)
            if (filesToScan.length > 0) {
                await Promise.all(filesToScan.map(async (entry) => {
                    const formData = new FormData()
                    formData.append('file', entry.file, entry.name)
                    const res = await uploadSmartFile(formData, projectId)
                    if (res.success && res.storagePath) {
                        entry.storagePath = res.storagePath
                    }
                }))
            }

            // 2. Call Scanner for non-assets
            // (Scanner internal logic already handles skipping/fast-tracking certain types)
            const scanResponse = await scanSmartFiles(scannedFiles.map(f => ({
                filename: f.name,
                storagePath: f.storagePath!
            })))

            if (scanResponse.error) throw new Error(scanResponse.error)

            // 3. Merge Results
            setScannedFiles(prev => prev.map(f => {
                const result = scanResponse.results.find(r => r.filename === f.name)
                if (result) {
                    return {
                        ...f,
                        scanResult: result,
                        selectedAction: result.suggestedAction as any
                    }
                }
                return f
            }))

            setStep('triage')
        } catch (e: any) {
            console.error(e)
            toast.error("Scanning failed: " + e.message)
            setStep('manifest')
        }
    }

    const executeTriageActions = async () => {
        setStep('processing')
        setProcessingStage('LISTS')
        setStartTime(Date.now())
        setShowSlowWarning(false)

        const newBatchId = uuidv4()
        setBatchId(newBatchId)

        // Filter files by their selected action
        const filesToProcess = scannedFiles.filter(f => f.selectedAction && f.selectedAction !== 'IGNORE')

        setUploadProgress({ current: 0, total: filesToProcess.length, status: 'PROCESSING' })

        try {
            if (filesToProcess.length > 0) {
                await processFiles(filesToProcess, newBatchId)
            }

            setProcessingStage('COMPLETED')
            setUploadProgress(prev => ({ ...prev, status: 'COMPLETED' }))

        } catch (e: any) {
            console.error(e)
            toast.error("Execution failed")
            setStep('triage')
        }
    }

    const startProcessingLists = async () => {
        // This is the old entrance, we can either remove it or redirect to scanAndTriage
        await scanAndTriage()
    }

    const confirmProcessDrawings = async () => {
        if (!batchId) return
        setProcessingStage('DRAWINGS')
        const drawingFiles = scannedFiles.filter(f => f.category === 'DRAWING')

        try {
            await processFiles(drawingFiles, batchId)
            setProcessingStage('COMPLETED')
            setUploadProgress(prev => ({ ...prev, status: 'COMPLETED' }))
        } catch (e) {
            toast.error("Error processing drawings")
        }
    }

    const skipDrawings = () => {
        setProcessingStage('COMPLETED')
        setUploadProgress(prev => ({ ...prev, status: 'COMPLETED' }))
    }

    const reset = () => {
        setScannedFiles([])
        setParts([])
        setStep('upload')
    }

    return (
        <>
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

                            {step === 'scanning' && (
                                <div className={styles.uploadArea} style={{ cursor: 'default', justifyContent: 'center', gap: '32px' }}>
                                    <div style={{ textAlign: 'center' }}>
                                        <Spinner size="large" label={scanProgress || "Scanning files..."} labelPosition="below" />
                                        <div style={{ marginTop: 24 }}>
                                            <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
                                                Using lightweight AI to understand your documents structure...
                                            </Text>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {step === 'triage' && (
                                <div className={styles.manifestContainer} style={{ display: 'flex', flexDirection: 'column' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                                        <div>
                                            <Text size={500} weight="semibold">AI Triage Results</Text>
                                            <br />
                                            <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>Review what the AI found and confirm how to proceed with each file.</Text>
                                        </div>
                                        <Button appearance="primary" onClick={executeTriageActions}>Execute Selected Actions</Button>
                                    </div>
                                    <div className={styles.tableContainer}>
                                        <Table size="small">
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHeaderCell style={{ width: '200px' }}>File</TableHeaderCell>
                                                    <TableHeaderCell>AI Description</TableHeaderCell>
                                                    <TableHeaderCell style={{ width: '200px' }}>Proposed Action</TableHeaderCell>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {scannedFiles.map(file => (
                                                    <TableRow key={file.id}>
                                                        <TableCell>{file.name}</TableCell>
                                                        <TableCell>
                                                            <div style={{ padding: '4px 8px', background: tokens.colorNeutralBackground2, borderRadius: 4, borderLeft: `3px solid ${tokens.colorBrandBackground}` }}>
                                                                <Text size={200} italic>{file.scanResult?.description || "Awaiting scan..."}</Text>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell>
                                                            <Dropdown
                                                                size="small"
                                                                style={{ width: '100%' }}
                                                                value={file.selectedAction}
                                                                selectedOptions={[file.selectedAction || 'IGNORE']}
                                                                onOptionSelect={(e, data) => {
                                                                    setScannedFiles(prev => prev.map(f => f.id === file.id ? { ...f, selectedAction: data.optionValue as any } : f))
                                                                }}
                                                            >
                                                                <Option value="IMPORT_PARTS">Import Parts</Option>
                                                                <Option value="IMPORT_ASSEMBLY">Import Assembly</Option>
                                                                <Option value="EXTRACT_CUTS">Extract Cuts</Option>
                                                                <Option value="ASSOCIATE">Associate Drawing</Option>
                                                                <Option value="IGNORE">Ignore</Option>
                                                            </Dropdown>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </div>
                            )}

                            {step === 'manifest' && (
                                <div className={styles.manifestContainer}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <Text size={500} weight="semibold">Found {scannedFiles.length} files</Text>
                                        <Button appearance="primary" icon={<ArrowClockwiseRegular />} onClick={scanAndTriage}>Analyze with AI</Button>
                                    </div>
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
                                <div className={styles.uploadArea} style={{ cursor: 'default', justifyContent: 'center', gap: '32px' }}>
                                    {/* Staged Processing Status */}
                                    {processingStage === 'CONFIRM_DRAWINGS' ? (
                                        <div style={{ textAlign: 'center', padding: 24, background: tokens.colorNeutralBackground2, borderRadius: 8 }}>
                                            <Text size={500} weight="semibold" block style={{ marginBottom: 12 }}>Drawings Found</Text>
                                            <Text block style={{ marginBottom: 24 }}>
                                                We found {scannedFiles.filter(f => f.category === 'DRAWING').length} potential drawings (PDFs) that might need parsing.
                                                <br />
                                                Do you want to process them with AI? (This may take longer)
                                            </Text>
                                            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                                                <Button appearance="secondary" onClick={skipDrawings}>Skip Drawings</Button>
                                                <Button appearance="primary" onClick={confirmProcessDrawings}>Process Drawings</Button>
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            {/* Upload Section */}
                                            <div style={{ width: '100%', maxWidth: '400px' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                        {uploadProgress.status === 'UPLOADING' ? <Spinner size="tiny" /> : <ArrowUploadRegular />}
                                                        <Text weight="semibold">Syncing to Cloud ({processingStage})</Text>
                                                    </div>
                                                    <Text>{uploadProgress.current} / {uploadProgress.total}</Text>
                                                </div>
                                                <ProgressBar
                                                    value={uploadProgress.total > 0 ? uploadProgress.current / uploadProgress.total : 0}
                                                    color={uploadProgress.status === 'COMPLETED' ? 'success' : 'brand'}
                                                />
                                            </div>

                                            {/* Processing Section */}
                                            <div style={{ width: '100%', maxWidth: '400px', opacity: uploadProgress.current > 0 ? 1 : 0.5, transition: 'opacity 0.3s' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                        {(processingStats.pending > 0 || processingStats.total === 0) && uploadProgress.status === 'COMPLETED' ? <Spinner size="tiny" /> : <BeakerRegular />}
                                                        <Text weight="semibold">AI Analysis</Text>
                                                    </div>
                                                    <div style={{ display: 'flex', gap: 12 }}>
                                                        {processingStats.failed > 0 && (
                                                            <Badge color="danger" icon={<WarningRegular />}>{processingStats.failed} Failed</Badge>
                                                        )}
                                                        <Text>{processingStats.completed} / {scannedFiles.filter(f => f.category !== 'ASSET').length}</Text>
                                                    </div>
                                                </div>
                                                <ProgressBar
                                                    value={(scannedFiles.length > 0) ? (processingStats.completed / Math.max(1, processingStats.total)) : 0}
                                                    // Note: processingStats.total comes from backend, which only knows about submitted batch items
                                                    thickness="large"
                                                    color={processingStats.total > 0 && processingStats.total === processingStats.completed ? "success" : "brand"}
                                                />
                                                {processingStats.totalPartsFound > 0 && (
                                                    <Text size={200} style={{ display: 'block', marginTop: 4, textAlign: 'right', color: tokens.colorPaletteGreenForeground1 }}>
                                                        Found {processingStats.totalPartsFound} parts so far
                                                    </Text>
                                                )}
                                            </div>

                                            {showSlowWarning && (
                                                <Badge color="warning" icon={<WarningRegular />}>
                                                    AI is taking longer than expected. You can wait or close this dialog - it will finish in the background.
                                                </Badge>
                                            )}
                                        </>
                                    )}
                                </div>
                            )}

                            {step === 'review' && (
                                <div className={styles.uploadArea} style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                                    <div style={{ padding: '16px', borderBottom: `1px solid ${tokens.colorNeutralStroke2}` }}>
                                        <Text weight="semibold" size={400}>Import Summary</Text>
                                        <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
                                            <Badge color="subtle">{processingStats.total} Files</Badge>
                                            <Badge color="success">{processingStats.completed} Processed</Badge>
                                            <Badge color="brand">{processingStats.totalPartsFound} Parts Found</Badge>
                                            {processingStats.failed > 0 && <Badge color="danger">{processingStats.failed} Failed</Badge>}
                                        </div>
                                    </div>
                                    <div style={{ flex: 1, overflow: 'auto' }}>
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHeaderCell>File</TableHeaderCell>
                                                    <TableHeaderCell>Status</TableHeaderCell>
                                                    <TableHeaderCell>Parts</TableHeaderCell>
                                                    <TableHeaderCell>Insights</TableHeaderCell>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {processingStats.fileSummaries.map(f => (
                                                    <TableRow key={f.id}>
                                                        <TableCell><Text style={{ fontFamily: 'monospace' }}>{f.filename}</Text></TableCell>
                                                        <TableCell>
                                                            {f.status === 'COMPLETED' && <Badge appearance="tint" color="success" icon={<CheckmarkCircleRegular />}>Done</Badge>}
                                                            {f.status === 'FAILED' && <Badge appearance="tint" color="danger" icon={<WarningRegular />}>Failed</Badge>}
                                                            {f.status === 'PENDING' && <Spinner size="tiny" />}
                                                        </TableCell>
                                                        <TableCell>{f.partCount > 0 ? f.partCount : '-'}</TableCell>
                                                        <TableCell>
                                                            {f.status === 'COMPLETED' && (f.summary || f.rawData) && (
                                                                <Button size="small" appearance="subtle" icon={<CodeRegular />} onClick={() => setInspectFile({ filename: f.filename, summary: f.summary, rawData: f.rawData })}>
                                                                    Inspect
                                                                </Button>
                                                            )}
                                                            {f.error && <Text style={{ color: tokens.colorPaletteRedForeground1 }}>{f.error}</Text>}
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
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
                                    <Button appearance="primary" onClick={startProcessingLists} disabled={scannedFiles.length === 0}>
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

            {/* Inspection Dialog */}
            <Dialog open={!!inspectFile} onOpenChange={(e, data) => { if (!data.open) setInspectFile(null) }}>
                <DialogSurface style={{ maxWidth: '800px', width: '90%' }}>
                    <DialogBody>
                        <DialogTitle>AI Insight: {inspectFile?.filename}</DialogTitle>
                        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
                            {inspectFile?.summary && (
                                <div style={{ padding: 16, background: tokens.colorNeutralBackground2, borderRadius: 8, borderLeft: `4px solid ${tokens.colorBrandBackground}` }}>
                                    <Text weight="semibold" block style={{ marginBottom: 4 }}>Content Structure</Text>
                                    <Text style={{ whiteSpace: 'pre-wrap' }}>{inspectFile.summary}</Text>
                                </div>
                            )}
                            <div>
                                <Text weight="semibold" block style={{ marginBottom: 4 }}>Raw Data</Text>
                                <div style={{
                                    padding: 12,
                                    background: tokens.colorNeutralBackgroundAlpha,
                                    borderRadius: 4,
                                    maxHeight: '400px',
                                    overflow: 'auto',
                                    fontFamily: 'monospace',
                                    fontSize: '12px',
                                    border: `1px solid ${tokens.colorNeutralStroke2}`
                                }}>
                                    <pre>{JSON.stringify(inspectFile?.rawData, null, 2)}</pre>
                                </div>
                            </div>
                        </div>
                        <DialogActions>
                            <Button appearance="secondary" onClick={() => setInspectFile(null)}>Close</Button>
                        </DialogActions>
                    </DialogBody>
                </DialogSurface>
            </Dialog>
        </>
    )
}
