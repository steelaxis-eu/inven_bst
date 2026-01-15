'use client'

import { useState, useRef } from 'react'
import {
    Dialog,
    DialogTrigger,
    DialogSurface,
    DialogTitle,
    DialogBody,
    DialogActions,
    DialogContent,
    Button,
    Input,
    Field,
    makeStyles,
    Table,
    TableHeader,
    TableRow,
    TableHeaderCell,
    TableBody,
    TableCell,
    Badge,
    tokens,
    shorthands,
    Text,
    Spinner
} from "@fluentui/react-components";
import {
    ArrowUploadRegular,
    ArrowDownloadRegular,
    TableSimpleRegular,
    CheckmarkCircleRegular,
    DismissCircleRegular,
    DocumentRegular
} from "@fluentui/react-icons";
import { toast } from 'sonner'
import { generateCSVTemplate, generateExcelTemplate, parseCSV, parseExcel, ParsedInventoryRow } from '@/lib/csv-parser'
import { importInventoryBatch } from '@/app/actions/import'

const useStyles = makeStyles({
    dialogContent: {
        display: "flex",
        flexDirection: "column",
        gap: "16px",
        minWidth: "800px",
        maxWidth: "1200px",
        height: "90vh",
    },
    controls: {
        display: "flex",
        gap: "8px",
        alignItems: "center",
        flexWrap: "wrap",
        padding: "16px",
        backgroundColor: tokens.colorNeutralBackground2,
        ...shorthands.borderRadius(tokens.borderRadiusMedium),
    },
    divider: {
        width: "1px",
        height: "24px",
        backgroundColor: tokens.colorNeutralStroke2,
        margin: "0 8px"
    },
    previewArea: {
        flex: 1,
        overflowY: "auto",
        border: `1px solid ${tokens.colorNeutralStroke2}`,
        ...shorthands.borderRadius(tokens.borderRadiusMedium),
    },
    statusRow: {
        display: "flex",
        gap: "12px",
        marginBottom: "8px",
    },
    hiddenInput: {
        display: "none"
    },
    errorText: {
        color: tokens.colorPaletteRedForeground1,
        fontSize: "12px"
    }
});

export function CSVImportDialog() {
    const styles = useStyles();
    const [open, setOpen] = useState(false)
    const [parsedRows, setParsedRows] = useState<ParsedInventoryRow[]>([])
    const [loading, setLoading] = useState(false)
    const [fileName, setFileName] = useState('')
    const fileInputRef = useRef<HTMLInputElement>(null)

    const handleDownloadCSV = () => {
        const csv = generateCSVTemplate()
        const blob = new Blob([csv], { type: 'text/csv' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'inventory-template.csv'
        a.click()
        URL.revokeObjectURL(url)
    }

    const handleDownloadExcel = async () => {
        const data = await generateExcelTemplate()
        const blob = new Blob([data.buffer as ArrayBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'inventory-template.xlsx'
        a.click()
        URL.revokeObjectURL(url)
    }

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        setFileName(file.name)

        const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls')

        let result
        if (isExcel) {
            const buffer = await file.arrayBuffer()
            result = await parseExcel(buffer)
        } else {
            const text = await file.text()
            result = parseCSV(text)
        }

        setParsedRows(result.rows)

        if (result.totalInvalid > 0) {
            toast.warning(`${result.totalInvalid} row(s) have validation errors`)
        }
    }

    const handleImport = async () => {
        const validRows = parsedRows.filter(r => r.valid)
        if (validRows.length === 0) {
            toast.error('No valid rows to import')
            return
        }

        setLoading(true)
        try {
            const result = await importInventoryBatch(validRows.map(r => ({
                lotId: r.lotId,
                profileType: r.profileType,
                dimensions: r.dimensions,
                grade: r.grade,
                lengthMm: r.lengthMm,
                quantity: r.quantity,
                totalCost: r.totalCost,
                certificate: r.certificate,
                supplier: r.supplier,
                invoiceNumber: r.invoiceNumber
            })))

            if (result.created > 0) {
                toast.success(`Successfully imported ${result.created} item(s)`)
            }

            if (result.errors.length > 0) {
                result.errors.forEach(err => toast.error(err))
            }

            if (result.success) {
                setOpen(false)
                setParsedRows([])
                setFileName('')
            }
        } catch (e: any) {
            toast.error(e.message || 'Import failed')
        } finally {
            setLoading(false)
        }
    }

    const validCount = parsedRows.filter(r => r.valid).length
    const invalidCount = parsedRows.filter(r => !r.valid).length

    return (
        <Dialog open={open} onOpenChange={(e, data) => { setOpen(data.open); if (!data.open) { setParsedRows([]); setFileName('') } }}>
            <DialogTrigger disableButtonEnhancement>
                <Button icon={<ArrowUploadRegular />}>Import</Button>
            </DialogTrigger>
            <DialogSurface className={styles.dialogContent}>
                <DialogBody>
                    <DialogTitle>Import Inventory from CSV/Excel</DialogTitle>

                    <div className={styles.controls}>
                        <Button appearance="outline" size="small" icon={<ArrowDownloadRegular />} onClick={handleDownloadCSV}>
                            CSV Template
                        </Button>
                        <Button appearance="outline" size="small" icon={<TableSimpleRegular />} onClick={handleDownloadExcel}>
                            Excel Template
                        </Button>

                        <div className={styles.divider} />

                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".csv,.xlsx,.xls"
                            onChange={handleFileSelect}
                            className={styles.hiddenInput}
                        />
                        <Button appearance="secondary" size="small" icon={<DocumentRegular />} onClick={() => fileInputRef.current?.click()}>
                            Select File
                        </Button>
                        {fileName && <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>{fileName}</Text>}
                    </div>

                    {parsedRows.length > 0 && (
                        <>
                            <div className={styles.statusRow}>
                                <Badge appearance="filled" color="success" icon={<CheckmarkCircleRegular />}>
                                    {validCount} valid
                                </Badge>
                                {invalidCount > 0 && (
                                    <Badge appearance="filled" color="danger" icon={<DismissCircleRegular />}>
                                        {invalidCount} invalid
                                    </Badge>
                                )}
                            </div>

                            <div className={styles.previewArea}>
                                <Table size="small">
                                    <TableHeader>
                                        <TableRow>
                                            <TableHeaderCell style={{ width: '32px' }} />
                                            <TableHeaderCell>Lot ID</TableHeaderCell>
                                            <TableHeaderCell>Profile</TableHeaderCell>
                                            <TableHeaderCell>Grade</TableHeaderCell>
                                            <TableHeaderCell>Length</TableHeaderCell>
                                            <TableHeaderCell>Qty</TableHeaderCell>
                                            <TableHeaderCell>Cost</TableHeaderCell>
                                            <TableHeaderCell>Invoice</TableHeaderCell>
                                            <TableHeaderCell>Errors</TableHeaderCell>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {parsedRows.map((row, idx) => (
                                            <TableRow key={idx} style={{ backgroundColor: !row.valid ? tokens.colorPaletteRedBackground1 : undefined }}>
                                                <TableCell>
                                                    {row.valid ? <CheckmarkCircleRegular color="green" /> : <DismissCircleRegular color="red" />}
                                                </TableCell>
                                                <TableCell style={{ fontFamily: 'monospace' }}>{row.lotId || '-'}</TableCell>
                                                <TableCell>{row.profileType} {row.dimensions}</TableCell>
                                                <TableCell>{row.grade}</TableCell>
                                                <TableCell>{row.lengthMm}</TableCell>
                                                <TableCell>{row.quantity}</TableCell>
                                                <TableCell>€{row.totalCost.toFixed(2)}</TableCell>
                                                <TableCell style={{ fontSize: '10px' }}>{row.invoiceNumber || '-'}</TableCell>
                                                <TableCell className={styles.errorText}>
                                                    {row.errors.join(', ')}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </>
                    )}
                </DialogBody>
                <DialogActions>
                    <Button appearance="secondary" onClick={() => setOpen(false)}>Cancel</Button>
                    <Button
                        appearance="primary"
                        onClick={handleImport}
                        disabled={loading || validCount === 0}
                        icon={loading ? <Spinner size="tiny" /> : <ArrowUploadRegular />}
                    >
                        {loading ? 'Importing...' : `Import ${validCount} Item(s)`}
                    </Button>
                </DialogActions>
            </DialogSurface>
        </Dialog>
    )
}
