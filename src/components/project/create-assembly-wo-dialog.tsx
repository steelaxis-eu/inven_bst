'use client'

import { useState, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Checkbox } from "@/components/ui/checkbox"
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, AlertTriangle, CheckCircle, Clock, Package, Wrench } from 'lucide-react'
import {
    checkAssemblyReadiness,
    createAssemblyWorkOrder,
    createPartPrepWorkOrder,
    type AssemblyReadiness,
    type PartReadiness
} from '@/app/actions/workorders'

interface CreateAssemblyWODialogProps {
    projectId: string
    selectedAssemblyIds: string[]
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function CreateAssemblyWODialog({
    projectId,
    selectedAssemblyIds,
    open,
    onOpenChange
}: CreateAssemblyWODialogProps) {
    const [loading, setLoading] = useState(false)
    const [checking, setChecking] = useState(false)
    const [calculating, setCalculating] = useState(false)
    const [readiness, setReadiness] = useState<AssemblyReadiness[]>([])

    // Workflow State
    const [step, setStep] = useState<'READINESS' | 'PLANNING'>('READINESS')
    const [planningResults, setPlanningResults] = useState<any[]>([])
    const [stockLength, setStockLength] = useState(12000)

    // Form inputs
    const [createPartPrepWO, setCreatePartPrepWO] = useState(true)
    const [title, setTitle] = useState('')
    const [priority, setPriority] = useState('MEDIUM')
    const [scheduledDate, setScheduledDate] = useState('')
    const router = useRouter()

    // Check readiness when dialog opens
    useEffect(() => {
        if (open && selectedAssemblyIds.length > 0) {
            checkReadiness()
            setStep('READINESS')
        }
    }, [open, selectedAssemblyIds])

    const checkReadiness = async () => {
        setChecking(true)
        const result = await checkAssemblyReadiness(selectedAssemblyIds)
        if (result.success && result.data) {
            setReadiness(result.data)
        } else {
            toast.error('Failed to check readiness')
        }
        setChecking(false)
    }

    const allReady = readiness.every(a => a.isReady)
    const notReadyParts = readiness.flatMap(a => a.parts).filter(p => !p.isReady)
    const notReadyPieceIds = notReadyParts.flatMap(p =>
        p.pieces.filter(pc => pc.status !== 'READY').map(pc => pc.id)
    )

    // Planning Function
    const calculatePlan = async (length: number) => {
        setCalculating(true)
        // Dynamically import to avoid server-client issues if strictly typed? 
        // No, standard import should work if action is 'use server'
        const { calculateCuttingPlan } = await import('@/app/actions/planning')

        const res = await calculateCuttingPlan(notReadyPieceIds, length)
        if (res.success && res.data) {
            setPlanningResults(res.data)
        } else {
            toast.error("Optimization failed")
        }
        setCalculating(false)
    }

    // Effect to recalculate when length changes
    useEffect(() => {
        if (step === 'PLANNING' && notReadyPieceIds.length > 0) {
            calculatePlan(stockLength)
        }
    }, [step, stockLength])

    const handleNext = async () => {
        if (allReady) {
            // Direct to submit (Only Welding WO)
            await handleSubmit()
        } else {
            // Go to planning
            setStep('PLANNING')
        }
    }

    const handleSubmit = async () => {
        setLoading(true)

        try {
            // 1. Handle Prep/Cutting WOs if needed
            if (!allReady && createPartPrepWO && notReadyPieceIds.length > 0) {
                // Use the existing logic but improved:
                // We typically use 'createSmartWorkOrder' or 'createPartPrepWorkOrder' 
                // but the optimized flow is handled inside createSmartWorkOrder.

                // TODO: Pass the PREFERRED STOCK info? 
                // Currently backend smart WO does checking again. 
                // For now, we trust the backend to do the same split.
                // The optimization visualization was just for USER CONFIRMATION.

                // However, the user wants "give user question if stock will be 6 or 12m long and outputs pieces needed"
                // This output has been shown in the PLANNING step.
                // The backend currently auto-calculates. 
                // If we want to SAVE the order list (e.g. "Buy 5x 12m"), we might need to pass notes.

                const purchaseNote = planningResults.flatMap(r =>
                    r.newStockNeeded.map((n: any) => `${n.quantity}x ${n.length / 1000}m ${r.profileType} ${r.dimensions} (${r.grade})`)
                ).join('\n')

                const prepRes = await createPartPrepWorkOrder({
                    projectId,
                    pieceIds: notReadyPieceIds,
                    title: `Part Prep for Assembly`,
                    priority,
                    scheduledDate: scheduledDate ? new Date(scheduledDate) : undefined,
                    notes: purchaseNote ? `Recommended Purchase:\n${purchaseNote}` : undefined
                })

                if (!prepRes.success) {
                    toast.error(`Part Prep WO Error: ${prepRes.error}`)
                } else {
                    toast.success(`Part Prep & Cutting WOs created`)
                }
            }

            // 2. Create Assembly WO (Welding)
            // If parts were missing, this WO will likely be waiting or we might want to delay its creation?
            // "from aseemblies ... if all parts available -> Welding WO. if not -> Cutting WO"
            // The requirement says "if NOT ... auto creates cutting wo". 
            // It implies we DON'T create the Welding WO yet? Or check readiness again later?
            // Usually we create the Assembly WO (Welding) but set it to PENDING (Waiting).

            const res = await createAssemblyWorkOrder({
                projectId,
                assemblyIds: selectedAssemblyIds,
                title: title || undefined,
                priority,
                scheduledDate: scheduledDate ? new Date(scheduledDate) : undefined,
                forceCreate: true  // Create even if parts not ready
            })

            if (!res.success) {
                toast.error(`Assembly WO Error: ${res.error}`)
            } else {
                toast.success(`Assembly WO created`)
            }

            onOpenChange(false)
            router.refresh()

        } catch (e: any) {
            toast.error('Failed to create work orders')
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Wrench className="h-5 w-5" />
                        Create Work Order for Assemblies
                    </DialogTitle>
                    <DialogDescription>
                        {step === 'READINESS'
                            ? `Checking readiness for ${selectedAssemblyIds.length} assemblies`
                            : `Plan Material & Cutting`
                        }
                    </DialogDescription>
                </DialogHeader>

                {checking ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        <span className="ml-2">Checking part readiness...</span>
                    </div>
                ) : step === 'READINESS' ? (
                    <div className="space-y-6">
                        {/* Readiness Summary */}
                        <div className={`p-4 rounded-lg ${allReady ? 'bg-green-50 border border-green-200' : 'bg-yellow-50 border border-yellow-200'}`}>
                            <div className="flex items-center gap-2">
                                {allReady ? (
                                    <>
                                        <CheckCircle className="h-5 w-5 text-green-600" />
                                        <span className="font-medium text-green-800">All parts ready! Welding WO will be created.</span>
                                    </>
                                ) : (
                                    <>
                                        <AlertTriangle className="h-5 w-5 text-yellow-600" />
                                        <span className="font-medium text-yellow-800">
                                            {notReadyParts.length} part(s) missing. Material Prep & Cutting WOs needed.
                                        </span>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Parts Not Ready Table */}
                        {!allReady && notReadyParts.length > 0 && (
                            <div className="border rounded-lg overflow-hidden">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-muted/50">
                                            <TableHead>Missing Part</TableHead>
                                            <TableHead>Profile</TableHead>
                                            <TableHead className="text-center">Count</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {notReadyParts.map(part => (
                                            <TableRow key={part.partId}>
                                                <TableCell className="font-mono">{part.partNumber}</TableCell>
                                                <TableCell>{part.profileType} {part.profileDimensions}</TableCell>
                                                <TableCell className="text-center text-red-600 font-bold">{part.notStarted}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        )}

                        {/* Common Fields */}
                        <div className="grid grid-cols-3 gap-4 pt-4 border-t">
                            <div className="grid gap-2">
                                <Label>Priority</Label>
                                <Select value={priority} onValueChange={setPriority}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="MEDIUM">Medium</SelectItem>
                                        <SelectItem value="HIGH">High</SelectItem>
                                        <SelectItem value="URGENT">Urgent</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {/* PLANNING STEP */}
                        <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
                            <div className="space-y-1">
                                <h4 className="font-medium">Material Optimization</h4>
                                <p className="text-sm text-muted-foreground">Select preferred stock length for new orders</p>
                            </div>
                            <div className="flex items-center gap-4">
                                <Label>Stock Length:</Label>
                                <Select
                                    value={stockLength.toString()}
                                    onValueChange={(v) => setStockLength(Number(v))}
                                >
                                    <SelectTrigger className="w-[180px]">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="6000">6 meters</SelectItem>
                                        <SelectItem value="12000">12 meters</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {calculating ? (
                            <div className="py-12 flex justify-center text-muted-foreground">
                                <Loader2 className="animate-spin mr-2" /> Optimizing plan...
                            </div>
                        ) : (
                            <div className="space-y-6">
                                {planningResults.map((res: any, idx: number) => (
                                    <div key={idx} className="border rounded-lg p-4 space-y-3">
                                        <h5 className="font-bold flex items-center gap-2">
                                            <Package className="h-4 w-4" />
                                            {res.profileType} {res.dimensions} <Badge variant="outline">{res.grade}</Badge>
                                        </h5>

                                        <div className="grid grid-cols-2 gap-8">
                                            {/* Stock Used */}
                                            <div>
                                                <h6 className="text-xs font-bold uppercase text-muted-foreground mb-2">From Stock</h6>
                                                {res.stockUsed.length === 0 ? <span className="text-sm text-muted-foreground italic">None used</span> : (
                                                    <ul className="text-sm space-y-1">
                                                        {res.stockUsed.map((s: any, i: number) => (
                                                            <li key={i} className="flex justify-between">
                                                                <span>Lot {s.lotId.substring(0, 8)}...</span>
                                                                <span className="text-green-600 font-mono">{s.length / 1000}m</span>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                )}
                                            </div>

                                            {/* To Buy */}
                                            <div>
                                                <h6 className="text-xs font-bold uppercase text-muted-foreground mb-2">To Order / Buy</h6>
                                                {res.newStockNeeded.length === 0 ? <span className="text-sm text-muted-foreground italic">No purchase needed</span> : (
                                                    <ul className="text-sm space-y-1">
                                                        {res.newStockNeeded.map((n: any, i: number) => (
                                                            <li key={i} className="font-bold text-blue-700 bg-blue-50 p-1 rounded flex justify-between">
                                                                <span>{n.quantity}x bars</span>
                                                                <span>{n.length / 1000}m</span>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                <DialogFooter>
                    {step === 'PLANNING' && (
                        <Button variant="ghost" onClick={() => setStep('READINESS')}>Back</Button>
                    )}
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>

                    {step === 'READINESS' ? (
                        <Button onClick={handleNext}>
                            {allReady ? 'Create Welding WO' : 'Plan Material & Cutting'}
                        </Button>
                    ) : (
                        <Button onClick={handleSubmit} disabled={loading || calculating}>
                            {loading ? <Loader2 className="animate-spin mr-2" /> : null}
                            Confirm Plan & Create WOs
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
