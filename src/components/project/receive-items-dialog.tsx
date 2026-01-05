'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { toast } from 'sonner'
import { Upload, X, FileText, CheckCircle, RefreshCw } from 'lucide-react'
// Actions
import { getSignedUploadUrl } from '@/app/actions/upload'
// We will need bulk update actions for parts and plate parts
import { bulkUpdatePieceStatus, generatePartPieces } from '@/app/actions/parts'
// Need to create this action for plates
import { bulkUpdatePlatePieceStatus, generatePlatePieces } from '@/app/actions/plateparts'

// Define a unified interface for the dialog input
interface ReceivableItem {
    id: string
    type: 'part' | 'plate'
    partNumber: string
    description: string
    quantity: number
    // We pass pieces if we have them, otherwise we might fetch them?
    // For simplicity, let's assume we pass the full object which has pieces
    pieces: { id: string, pieceNumber: number, status: string }[]
}

interface ReceiveItemsDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    item: ReceivableItem // We receive one "Part" definition, but we are receiving its pieces
    projectId: string
    onSuccess?: () => void
}

export function ReceiveItemsDialog({ open, onOpenChange, item, projectId, onSuccess }: ReceiveItemsDialogProps) {
    const [step, setStep] = useState<'select' | 'details'>('select')
    const [selectedPieceIds, setSelectedPieceIds] = useState<string[]>([])

    // Local state for pieces (allows us to update list after generation)
    const [currentPieces, setCurrentPieces] = useState<any[]>(item.pieces || [])

    // Form State
    const [supplier, setSupplier] = useState('')
    const [lotId, setLotId] = useState('') // Heat Number / Batch ID
    const [certificateFile, setCertificateFile] = useState<File | null>(null)
    const [isUploading, setIsUploading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [isGenerating, setIsGenerating] = useState(false)

    // Sync pieces when item changes
    useEffect(() => {
        if (item.pieces) {
            setCurrentPieces(item.pieces)
        }
    }, [item])

    // Filter only pending pieces
    const availablePieces = currentPieces.filter(p => p.status === 'PENDING')

    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            setSelectedPieceIds(availablePieces.map(p => p.id))
        } else {
            setSelectedPieceIds([])
        }
    }

    const handleTogglePiece = (id: string) => {
        if (selectedPieceIds.includes(id)) {
            setSelectedPieceIds(selectedPieceIds.filter(pid => pid !== id))
        } else {
            setSelectedPieceIds([...selectedPieceIds, id])
        }
    }

    const handleNext = () => {
        if (selectedPieceIds.length === 0) {
            toast.error("Please select at least one piece to receive")
            return
        }
        setStep('details')
    }

    const handleGeneratePieces = async () => {
        setIsGenerating(true)
        try {
            const action = item.type === 'part' ? generatePartPieces : generatePlatePieces
            const res = await action(item.id)

            if (res.success && res.pieces) {
                toast.success(res.message || "Pieces generated successfully")
                setCurrentPieces(res.pieces)
            } else {
                toast.error(res.error || "Failed to generate pieces")
            }
        } catch (error) {
            toast.error("An error occurred while generating pieces")
        } finally {
            setIsGenerating(false)
        }
    }

    const handleUploadAndSave = async () => {
        if (!supplier || !lotId) {
            toast.error("Supplier and Lot ID are required")
            return
        }

        if (!certificateFile) {
            toast.error("Please upload a certificate")
            return
        }

        setSaving(true)
        try {
            // 1. Upload Certificate
            setIsUploading(true)
            const filename = `CERT-${lotId}-${Date.now()}.${certificateFile.name.split('.').pop()}`
            const uploadPath = `projects/${projectId}/certificates/${filename}`

            // Get Signed URL
            const { success, url, error } = await getSignedUploadUrl(uploadPath, certificateFile.type)
            if (!success || !url) throw new Error(error || "Failed to get upload URL")

            // Upload directly to blob
            const uploadRes = await fetch(url, {
                method: 'PUT',
                body: certificateFile,
                headers: { 'Content-Type': certificateFile.type }
            })

            if (!uploadRes.ok) throw new Error("Failed to upload certificate file")
            setIsUploading(false)

            // 2. Create Receipt Record (Batch) - Server Action
            // We need a specific action to "Receive" items which creates Inventory + Links Pieces + Links Cert
            // For now, let's assume we call a robust server action
            const action = item.type === 'part' ? receiveParts : receivePlates

            const res = await action({
                projectId,
                pieceIds: selectedPieceIds,
                supplier,
                lotId,
                certificatePath: uploadPath,
                certificateFilename: certificateFile.name
            })

            if (!res.success) throw new Error(res.error)

            toast.success(`Successfully received ${selectedPieceIds.length} items`)
            if (onSuccess) onSuccess()
            onOpenChange(false)

        } catch (e: any) {
            console.error(e)
            toast.error(e.message || "Failed to process receipt")
        } finally {
            setSaving(false)
            setIsUploading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Receive Outsourced Items</DialogTitle>
                    <DialogDescription>
                        Record receipt of {item.partNumber} from supplier.
                    </DialogDescription>
                </DialogHeader>

                {step === 'select' ? (
                    <div className="space-y-4">
                        <div className="flex justify-between items-center mb-2">
                            <Label>Select Pieces to Receive ({selectedPieceIds.length}/{availablePieces.length})</Label>
                            <div className="flex items-center space-x-2">
                                <Checkbox
                                    id="select-all"
                                    checked={selectedPieceIds.length === availablePieces.length && availablePieces.length > 0}
                                    onCheckedChange={handleSelectAll}
                                    disabled={availablePieces.length === 0}
                                />
                                <label htmlFor="select-all" className="text-sm cursor-pointer">Select All</label>
                            </div>
                        </div>

                        <div className="border rounded-md max-h-[300px] overflow-y-auto p-2 grid grid-cols-4 gap-2">
                            {availablePieces.length === 0 ? (
                                <div className="col-span-4 flex flex-col items-center justify-center py-8 text-muted-foreground gap-4">
                                    <p>No pending pieces available.</p>

                                    {/* Show Generate Button if we have 0 pieces but quantity > 0 (Legacy Data Fix) */}
                                    {currentPieces.length === 0 && item.quantity > 0 && (
                                        <div className="bg-yellow-50 dark:bg-yellow-950/30 p-4 rounded-md border border-yellow-200 dark:border-yellow-900 flex flex-col items-center gap-2 max-w-sm">
                                            <p className="text-sm text-yellow-800 dark:text-yellow-200 text-center">
                                                This item appears to be missing tracking data (likely created before the tracking update).
                                            </p>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={handleGeneratePieces}
                                                disabled={isGenerating}
                                                className="gap-2"
                                            >
                                                {isGenerating ? <RefreshCw className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                                                Generate {item.quantity} Tracking Pieces
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                availablePieces.map(piece => (
                                    <div
                                        key={piece.id}
                                        onClick={() => handleTogglePiece(piece.id)}
                                        className={`
                                            cursor-pointer p-2 rounded border text-center text-sm transition-colors
                                            ${selectedPieceIds.includes(piece.id)
                                                ? 'bg-primary text-primary-foreground border-primary'
                                                : 'bg-background hover:bg-muted'}
                                        `}
                                    >
                                        Piece #{piece.pieceNumber}
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Supplier Name</Label>
                                <Input
                                    placeholder="e.g. SteelCo Ltd."
                                    value={supplier}
                                    onChange={e => setSupplier(e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Heat / Lot Number</Label>
                                <Input
                                    placeholder="e.g. HT-2024-5592"
                                    value={lotId}
                                    onChange={e => setLotId(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Certificate / Mill Test Report</Label>
                            <div className="border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center bg-muted/30">
                                {certificateFile ? (
                                    <div className="flex items-center gap-2 text-sm bg-background p-2 rounded border">
                                        <FileText className="h-4 w-4 text-blue-500" />
                                        <span className="font-medium truncate max-w-[200px]">{certificateFile.name}</span>
                                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setCertificateFile(null)}>
                                            <X className="h-3 w-3" />
                                        </Button>
                                    </div>
                                ) : (
                                    <>
                                        <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                                        <p className="text-sm text-muted-foreground mb-2">Upload PDF Certificate</p>
                                        <Input
                                            type="file"
                                            accept=".pdf,.jpg,.png"
                                            className="w-full max-w-xs"
                                            onChange={e => {
                                                if (e.target.files?.[0]) setCertificateFile(e.target.files[0])
                                            }}
                                        />
                                    </>
                                )}
                            </div>
                        </div>

                        <div className="bg-blue-50 text-blue-800 p-3 rounded-md text-sm flex gap-2">
                            <CheckCircle className="h-4 w-4 mt-0.5 shrink-0" />
                            <div>
                                This will mark <strong>{selectedPieceIds.length} pieces</strong> as RECEIVED and link them to Lot <strong>{lotId || '...'}</strong>.
                            </div>
                        </div>
                    </div>
                )}


                <DialogFooter>
                    {step === 'select' ? (
                        <>
                            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                            <Button onClick={handleNext} disabled={selectedPieceIds.length === 0}>Next</Button>
                        </>
                    ) : (
                        <>
                            <Button variant="outline" onClick={() => setStep('select')} disabled={saving}>Back</Button>
                            <Button onClick={handleUploadAndSave} disabled={saving}>
                                {saving ? (isUploading ? "Uploading..." : "Saving...") : "Confirm Receipt"}
                            </Button>
                        </>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

// Mock actions for now - need to implement these in appropriate files
// We can define inputs but implementing them needs to be in separate 'use server' files usually
async function receiveParts(data: any) {
    // This will refer to the actual server action we will create
    const { receivePartBatch } = await import('@/app/actions/parts')
    return receivePartBatch(data)
}

async function receivePlates(data: any) {
    const { receivePlateBatch } = await import('@/app/actions/plateparts')
    return receivePlateBatch(data)
}
