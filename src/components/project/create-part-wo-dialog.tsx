'use client'

import { useState } from 'react'
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, Wrench } from 'lucide-react'
import { createPartPrepWorkOrder } from '@/app/actions/workorders'

interface SelectedPiece {
    pieceId: string
    partNumber: string
    pieceNumber: number
    status: string
}

interface CreatePartWODialogProps {
    projectId: string
    selectedPieces: SelectedPiece[]
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function CreatePartWODialog({
    projectId,
    selectedPieces,
    open,
    onOpenChange
}: CreatePartWODialogProps) {
    const [loading, setLoading] = useState(false)
    const [title, setTitle] = useState('')
    const [woType, setWoType] = useState('CUTTING')
    const [priority, setPriority] = useState('MEDIUM')
    const [scheduledDate, setScheduledDate] = useState('')
    const router = useRouter()

    const handleSubmit = async () => {
        if (selectedPieces.length === 0) return
        setLoading(true)

        try {
            const res = await createPartPrepWorkOrder({
                projectId,
                pieceIds: selectedPieces.map(p => p.pieceId),
                title: title || `${woType} - ${selectedPieces.length} pieces`,
                priority,
                scheduledDate: scheduledDate ? new Date(scheduledDate) : undefined
            })

            if (!res.success) {
                toast.error(res.error || 'Failed to create work order')
                setLoading(false)
                return
            }

            toast.success(`Work order created: ${res.data?.mainWO?.workOrderNumber}`)
            onOpenChange(false)
            router.refresh()

        } catch (e: any) {
            toast.error('Failed to create work order')
        } finally {
            setLoading(false)
        }
    }

    // Group pieces by part
    const groupedPieces = selectedPieces.reduce((acc, piece) => {
        if (!acc[piece.partNumber]) {
            acc[piece.partNumber] = []
        }
        acc[piece.partNumber].push(piece)
        return acc
    }, {} as Record<string, SelectedPiece[]>)

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Wrench className="h-5 w-5" />
                        Create Work Order for Parts
                    </DialogTitle>
                    <DialogDescription>
                        Create work order for {selectedPieces.length} selected pieces
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6">
                    {/* WO Details */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label className="text-xs uppercase text-muted-foreground">Title (optional)</Label>
                            <Input
                                value={title}
                                onChange={e => setTitle(e.target.value)}
                                placeholder="Auto-generated"
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label className="text-xs uppercase text-muted-foreground">Work Type</Label>
                            <Select value={woType} onValueChange={setWoType}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="MATERIAL_PREP">Material Prep/Order</SelectItem>
                                    <SelectItem value="CUTTING">Cutting</SelectItem>
                                    <SelectItem value="MACHINING">Drilling/Machining</SelectItem>
                                    <SelectItem value="FABRICATION">Fabrication</SelectItem>
                                    <SelectItem value="WELDING">Welding</SelectItem>
                                    <SelectItem value="COATING">Coating</SelectItem>
                                </SelectContent>
                            </Select>
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

                    {/* Selected Pieces Summary */}
                    <div className="border rounded-lg overflow-hidden">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-muted/50">
                                    <TableHead>Part #</TableHead>
                                    <TableHead>Pieces</TableHead>
                                    <TableHead className="text-center">Count</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {Object.entries(groupedPieces).map(([partNumber, pieces]) => (
                                    <TableRow key={partNumber}>
                                        <TableCell className="font-mono font-medium">{partNumber}</TableCell>
                                        <TableCell>
                                            <div className="flex gap-1 flex-wrap">
                                                {pieces.map(p => (
                                                    <Badge key={p.pieceId} variant="outline" className="text-xs">
                                                        #{p.pieceNumber}
                                                    </Badge>
                                                ))}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-center font-medium">{pieces.length}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={handleSubmit} disabled={loading || selectedPieces.length === 0}>
                        {loading ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                Creating...
                            </>
                        ) : (
                            <>Create Work Order</>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
