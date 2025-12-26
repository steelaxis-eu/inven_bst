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
    const [readiness, setReadiness] = useState<AssemblyReadiness[]>([])
    const [createPartPrepWO, setCreatePartPrepWO] = useState(true)
    const [title, setTitle] = useState('')
    const [priority, setPriority] = useState('MEDIUM')
    const [scheduledDate, setScheduledDate] = useState('')
    const router = useRouter()

    // Check readiness when dialog opens
    useEffect(() => {
        if (open && selectedAssemblyIds.length > 0) {
            checkReadiness()
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

    const handleSubmit = async () => {
        if (selectedAssemblyIds.length === 0) return
        setLoading(true)

        try {
            // If parts not ready and user wants Part Prep WO
            if (!allReady && createPartPrepWO && notReadyPieceIds.length > 0) {
                const prepRes = await createPartPrepWorkOrder({
                    projectId,
                    pieceIds: notReadyPieceIds,
                    title: `Part Prep for Assembly`,
                    priority,
                    scheduledDate: scheduledDate ? new Date(scheduledDate) : undefined
                })

                if (!prepRes.success) {
                    toast.error(`Part Prep WO Error: ${prepRes.error}`)
                } else {
                    toast.success(`Part Prep WO created: ${prepRes.data?.workOrderNumber}`)
                }
            }

            // Create Assembly WO
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
                setLoading(false)
                return
            }

            toast.success(`Assembly WO created: ${res.data?.workOrderNumber}`)
            if (!res.allReady) {
                toast.info('Work Order is PENDING - waiting for parts')
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
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Wrench className="h-5 w-5" />
                        Create Work Order for Assemblies
                    </DialogTitle>
                    <DialogDescription>
                        Create assembly work order for {selectedAssemblyIds.length} selected assemblies
                    </DialogDescription>
                </DialogHeader>

                {checking ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        <span className="ml-2">Checking part readiness...</span>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {/* Readiness Summary */}
                        <div className={`p-4 rounded-lg ${allReady ? 'bg-green-50 border border-green-200' : 'bg-yellow-50 border border-yellow-200'}`}>
                            <div className="flex items-center gap-2">
                                {allReady ? (
                                    <>
                                        <CheckCircle className="h-5 w-5 text-green-600" />
                                        <span className="font-medium text-green-800">All parts ready!</span>
                                    </>
                                ) : (
                                    <>
                                        <AlertTriangle className="h-5 w-5 text-yellow-600" />
                                        <span className="font-medium text-yellow-800">
                                            {notReadyParts.length} part(s) not ready
                                        </span>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Selected Assemblies */}
                        <div className="border rounded-lg overflow-hidden">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-muted/50">
                                        <TableHead>Assembly</TableHead>
                                        <TableHead>Name</TableHead>
                                        <TableHead className="text-center">Parts</TableHead>
                                        <TableHead className="text-center">Status</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {readiness.map(asm => (
                                        <TableRow key={asm.assemblyId}>
                                            <TableCell className="font-mono">{asm.assemblyNumber}</TableCell>
                                            <TableCell>{asm.name}</TableCell>
                                            <TableCell className="text-center">{asm.parts.length}</TableCell>
                                            <TableCell className="text-center">
                                                {asm.isReady ? (
                                                    <Badge className="bg-green-100 text-green-800">Ready</Badge>
                                                ) : (
                                                    <Badge className="bg-yellow-100 text-yellow-800">Waiting</Badge>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>

                        {/* Parts Not Ready */}
                        {notReadyParts.length > 0 && (
                            <div className="space-y-3">
                                <h4 className="text-sm font-medium text-muted-foreground uppercase">Parts Needing Preparation</h4>
                                <div className="border rounded-lg overflow-hidden">
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="bg-muted/50">
                                                <TableHead>Part #</TableHead>
                                                <TableHead>Profile</TableHead>
                                                <TableHead className="text-center">Needed</TableHead>
                                                <TableHead className="text-center">Ready</TableHead>
                                                <TableHead className="text-center">In Progress</TableHead>
                                                <TableHead className="text-center">Not Started</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {notReadyParts.map(part => (
                                                <TableRow key={part.partId}>
                                                    <TableCell className="font-mono">{part.partNumber}</TableCell>
                                                    <TableCell>{part.profileType} {part.profileDimensions}</TableCell>
                                                    <TableCell className="text-center">{part.needed}</TableCell>
                                                    <TableCell className="text-center text-green-600">{part.ready}</TableCell>
                                                    <TableCell className="text-center text-yellow-600">{part.inProgress}</TableCell>
                                                    <TableCell className="text-center text-red-600">{part.notStarted}</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>

                                {/* Create Part Prep WO Option */}
                                <div className="flex items-center gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                                    <Checkbox
                                        id="createPartPrep"
                                        checked={createPartPrepWO}
                                        onCheckedChange={(c) => setCreatePartPrepWO(c === true)}
                                    />
                                    <Label htmlFor="createPartPrep" className="cursor-pointer flex-1">
                                        <span className="font-medium text-blue-800">Create Part Prep Work Order</span>
                                        <p className="text-xs text-blue-600 mt-1">
                                            Creates a CUTTING work order for {notReadyPieceIds.length} pieces that need preparation
                                        </p>
                                    </Label>
                                </div>
                            </div>
                        )}

                        {/* WO Details */}
                        <div className="grid grid-cols-3 gap-4 pt-4 border-t">
                            <div className="grid gap-2">
                                <Label className="text-xs uppercase text-muted-foreground">Title (optional)</Label>
                                <Input
                                    value={title}
                                    onChange={e => setTitle(e.target.value)}
                                    placeholder="Auto-generated"
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label className="text-xs uppercase text-muted-foreground">Priority</Label>
                                <Select value={priority} onValueChange={setPriority}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="LOW">Low</SelectItem>
                                        <SelectItem value="MEDIUM">Medium</SelectItem>
                                        <SelectItem value="HIGH">High</SelectItem>
                                        <SelectItem value="URGENT">Urgent</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="grid gap-2">
                                <Label className="text-xs uppercase text-muted-foreground">Scheduled Date</Label>
                                <Input
                                    type="date"
                                    value={scheduledDate}
                                    onChange={e => setScheduledDate(e.target.value)}
                                />
                            </div>
                        </div>

                        {/* Status Preview */}
                        <div className="p-3 bg-muted/50 rounded-lg text-sm">
                            <span className="text-muted-foreground">Work Order Status: </span>
                            {allReady ? (
                                <Badge variant="outline" className="bg-blue-50 text-blue-700">PENDING</Badge>
                            ) : (
                                <Badge variant="outline" className="bg-yellow-50 text-yellow-700">
                                    PENDING (waiting for parts)
                                </Badge>
                            )}
                        </div>
                    </div>
                )}

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={handleSubmit} disabled={loading || checking || selectedAssemblyIds.length === 0}>
                        {loading ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                Creating...
                            </>
                        ) : (
                            <>Create Work Order{!allReady && createPartPrepWO ? 's' : ''}</>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
