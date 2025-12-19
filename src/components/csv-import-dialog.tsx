'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { Upload, Download, AlertTriangle, CheckCircle } from 'lucide-react'
import { generateCSVTemplate, parseCSV, ParsedInventoryRow } from '@/lib/csv-parser'
import { importInventoryBatch } from '@/app/actions/import'

export function CSVImportDialog() {
    const [open, setOpen] = useState(false)
    const [parsedRows, setParsedRows] = useState<ParsedInventoryRow[]>([])
    const [loading, setLoading] = useState(false)
    const [fileName, setFileName] = useState('')
    const fileInputRef = useRef<HTMLInputElement>(null)

    const handleDownloadTemplate = () => {
        const csv = generateCSVTemplate()
        const blob = new Blob([csv], { type: 'text/csv' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'inventory-template.csv'
        a.click()
        URL.revokeObjectURL(url)
    }

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        setFileName(file.name)

        const text = await file.text()
        const result = parseCSV(text)
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
                supplier: r.supplier
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
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setParsedRows([]); setFileName('') } }}>
            <DialogTrigger asChild>
                <Button variant="outline">
                    <Upload className="mr-2 h-4 w-4" />
                    Import CSV
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
                <DialogHeader>
                    <DialogTitle>Import Inventory from CSV</DialogTitle>
                </DialogHeader>

                <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
                    <div className="flex gap-4 items-center">
                        <Button variant="outline" size="sm" onClick={handleDownloadTemplate}>
                            <Download className="mr-2 h-4 w-4" />
                            Download Template
                        </Button>

                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".csv"
                            onChange={handleFileSelect}
                            className="hidden"
                        />
                        <Button variant="secondary" size="sm" onClick={() => fileInputRef.current?.click()}>
                            <Upload className="mr-2 h-4 w-4" />
                            Select CSV File
                        </Button>

                        {fileName && (
                            <span className="text-sm text-muted-foreground">{fileName}</span>
                        )}
                    </div>

                    {parsedRows.length > 0 && (
                        <>
                            <div className="flex gap-4 items-center text-sm">
                                <Badge variant="default" className="bg-green-600">
                                    <CheckCircle className="mr-1 h-3 w-3" />
                                    {validCount} valid
                                </Badge>
                                {invalidCount > 0 && (
                                    <Badge variant="destructive">
                                        <AlertTriangle className="mr-1 h-3 w-3" />
                                        {invalidCount} invalid
                                    </Badge>
                                )}
                            </div>

                            <div className="border rounded-md overflow-auto flex-1 max-h-[400px]">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-8"></TableHead>
                                            <TableHead>Lot ID</TableHead>
                                            <TableHead>Profile</TableHead>
                                            <TableHead>Grade</TableHead>
                                            <TableHead>Length (mm)</TableHead>
                                            <TableHead>Qty</TableHead>
                                            <TableHead>Cost</TableHead>
                                            <TableHead>Errors</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {parsedRows.map((row, idx) => (
                                            <TableRow key={idx} className={!row.valid ? 'bg-destructive/10' : ''}>
                                                <TableCell>
                                                    {row.valid ? (
                                                        <CheckCircle className="h-4 w-4 text-green-600" />
                                                    ) : (
                                                        <AlertTriangle className="h-4 w-4 text-destructive" />
                                                    )}
                                                </TableCell>
                                                <TableCell className="font-mono">{row.lotId || '-'}</TableCell>
                                                <TableCell>{row.profileType} {row.dimensions}</TableCell>
                                                <TableCell>{row.grade}</TableCell>
                                                <TableCell>{row.lengthMm}</TableCell>
                                                <TableCell>{row.quantity}</TableCell>
                                                <TableCell>€{row.totalCost.toFixed(2)}</TableCell>
                                                <TableCell className="text-destructive text-xs">
                                                    {row.errors.join(', ')}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                    <Button
                        onClick={handleImport}
                        disabled={loading || validCount === 0}
                    >
                        {loading ? 'Importing...' : `Import ${validCount} Item(s)`}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
