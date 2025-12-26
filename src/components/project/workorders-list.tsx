'use client'

import { useState } from 'react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { ClipboardList, Play, CheckCircle, XCircle, ChevronDown, ChevronRight, Check, Clock } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { updateWorkOrderStatus, updateWorkOrderItemStatus, activateWorkOrder, completeWorkOrder, completeCuttingWOWithWorkflow } from '@/app/actions/workorders'
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"

interface WorkOrderItem {
    id: string
    pieceId: string | null
    status: string
    completedAt: Date | null
    notes: string | null
    piece?: {
        id: string
        partId: string
        part: { partNumber: string }
        pieceNumber: number
    } | null
    assembly?: {
        assemblyNumber: string
        name: string
    } | null
    platePart?: {
        partNumber: string
        description: string | null
    } | null
}

interface WorkOrder {
    id: string
    workOrderNumber: string
    title: string
    description: string | null
    type: string
    priority: string
    status: string
    assignedTo: string | null
    scheduledDate: Date | null
    startedAt: Date | null
    completedAt: Date | null
    notes: string | null
    items: WorkOrderItem[]
}

interface WorkOrdersListProps {
    workOrders: WorkOrder[]
}

const TYPE_COLORS: Record<string, string> = {
    'MATERIAL_PREP': 'bg-amber-100 text-amber-800',
    'CUTTING': 'bg-blue-100 text-blue-800',
    'MACHINING': 'bg-cyan-100 text-cyan-800',
    'FABRICATION': 'bg-yellow-100 text-yellow-800',
    'WELDING': 'bg-orange-100 text-orange-800',
    'PAINTING': 'bg-purple-100 text-purple-800',
    'ASSEMBLY': 'bg-green-100 text-green-800',
}

const STATUS_COLORS: Record<string, string> = {
    'PENDING': 'bg-gray-100 text-gray-800',
    'IN_PROGRESS': 'bg-blue-100 text-blue-800',
    'COMPLETED': 'bg-green-100 text-green-800',
    'CANCELLED': 'bg-red-100 text-red-800',
}

const PRIORITY_COLORS: Record<string, string> = {
    'LOW': 'text-gray-500',
    'MEDIUM': 'text-yellow-600',
    'HIGH': 'text-orange-600',
    'URGENT': 'text-red-600 font-bold',
}

function WorkOrderRow({ wo }: { wo: WorkOrder }) {
    const [expanded, setExpanded] = useState(false)
    const [loading, setLoading] = useState<string | null>(null)
    const [completeDialogOpen, setCompleteDialogOpen] = useState(false)
    const [machinedPieceIds, setMachinedPieceIds] = useState<string[]>([])
    const router = useRouter()

    const completedItems = wo.items.filter(i => i.status === 'COMPLETED').length
    const totalItems = wo.items.length
    const progress = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0

    // Get all pieces in this WO (for machining selection)
    const allPieces = wo.items.filter(i => i.piece).map(i => ({
        pieceId: i.piece!.partId + '-' + i.piece!.pieceNumber,  // Temporary - need actual piece ID
        itemId: i.id,
        partNumber: i.piece!.part.partNumber,
        pieceNumber: i.piece!.pieceNumber
    }))

    const handleStatusChange = async (status: string) => {
        // For CUTTING WOs in progress, show machining selection dialog
        if (status === 'COMPLETED' && wo.type === 'CUTTING' && wo.status === 'IN_PROGRESS') {
            setCompleteDialogOpen(true)
            return
        }

        setLoading('wo')
        let res
        if (status === 'IN_PROGRESS') {
            res = await activateWorkOrder(wo.id)
        } else if (status === 'COMPLETED') {
            res = await completeWorkOrder(wo.id)
            if (res.success && res.followUpWO) {
                toast.info(`Coating WO created: ${res.followUpWO.workOrderNumber}`)
            }
        } else {
            res = await updateWorkOrderStatus(wo.id, status as any)
        }

        if (!res.success) {
            toast.error(res.error || 'Failed to update status')
        } else {
            toast.success(`Work order ${status.replace('_', ' ').toLowerCase()}`)
            router.refresh()
        }
        setLoading(null)
    }

    const handleCompleteCuttingWO = async () => {
        setLoading('wo')
        // Get actual piece IDs from WO items that need machining
        const pieceIdsNeedingMachining = wo.items
            .filter(i => {
                if (!i.pieceId) return false
                // Check if marked for machining (using itemId to track selection)
                return machinedPieceIds.includes(i.id)
            })
            .map(i => i.pieceId!)

        const res = await completeCuttingWOWithWorkflow(wo.id, pieceIdsNeedingMachining)

        if (!res.success) {
            toast.error(res.error || 'Failed to complete WO')
        } else {
            if (res.machiningWO) {
                toast.info(`Machining WO created: ${res.machiningWO.workOrderNumber} (${res.machinedCount} pieces)`)
            }
            if (res.weldingWO) {
                toast.success(`Welding WO created: ${res.weldingWO.workOrderNumber} (${res.directCount} pieces)`)
            }
            setCompleteDialogOpen(false)
            router.refresh()
        }
        setLoading(null)
    }

    const toggleMachining = (itemId: string) => {
        setMachinedPieceIds(prev =>
            prev.includes(itemId)
                ? prev.filter(id => id !== itemId)
                : [...prev, itemId]
        )
    }

    const handleItemComplete = async (itemId: string) => {
        setLoading(itemId)
        const res = await updateWorkOrderItemStatus(itemId, 'COMPLETED')
        if (!res.success) {
            toast.error('Failed to complete item')
        } else {
            toast.success('Item completed')
            router.refresh()
        }
        setLoading(null)
    }

    const getItemLabel = (item: WorkOrderItem): string => {
        if (item.piece) {
            return `${item.piece.part.partNumber} #${item.piece.pieceNumber}`
        }
        if (item.assembly) {
            return `${item.assembly.assemblyNumber} - ${item.assembly.name}`
        }
        if (item.platePart) {
            return item.platePart.partNumber
        }
        return 'Unknown item'
    }

    return (
        <>
            {/* Main WO Row */}
            <TableRow
                className={`cursor-pointer hover:bg-muted/50 ${expanded ? 'bg-muted/30' : ''}`}
                onClick={() => setExpanded(!expanded)}
            >
                <TableCell className="w-8">
                    {wo.items.length > 0 && (
                        expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />
                    )}
                </TableCell>
                <TableCell className="font-mono font-medium">{wo.workOrderNumber}</TableCell>
                <TableCell>
                    <div>{wo.title}</div>
                    {wo.description && (
                        <div className="text-xs text-muted-foreground">{wo.description}</div>
                    )}
                    {wo.notes?.includes('[Waiting for parts]') && (
                        <Badge variant="outline" className="mt-1 text-xs bg-yellow-50 text-yellow-700">
                            <Clock className="h-3 w-3 mr-1" /> Waiting for parts
                        </Badge>
                    )}
                </TableCell>
                <TableCell>
                    <Badge variant="outline" className={TYPE_COLORS[wo.type] || ''}>
                        {wo.type}
                    </Badge>
                </TableCell>
                <TableCell>
                    <span className={PRIORITY_COLORS[wo.priority] || ''}>
                        {wo.priority}
                    </span>
                </TableCell>
                <TableCell className="text-muted-foreground">
                    {wo.assignedTo || '-'}
                </TableCell>
                <TableCell className="text-sm">
                    {wo.scheduledDate
                        ? new Date(wo.scheduledDate).toLocaleDateString()
                        : '-'}
                </TableCell>
                <TableCell>
                    <div className="flex items-center gap-2 w-24">
                        <Progress value={progress} className="h-2 flex-1" />
                        <span className="text-xs font-mono">{completedItems}/{totalItems}</span>
                    </div>
                </TableCell>
                <TableCell>
                    <Badge variant="outline" className={STATUS_COLORS[wo.status] || ''}>
                        {wo.status.replace('_', ' ')}
                    </Badge>
                </TableCell>
                <TableCell onClick={e => e.stopPropagation()}>
                    <div className="flex gap-1">
                        {wo.status === 'PENDING' && (
                            <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0 text-blue-600"
                                onClick={() => handleStatusChange('IN_PROGRESS')}
                                disabled={loading === 'wo'}
                                title="Start"
                            >
                                <Play className="h-4 w-4" />
                            </Button>
                        )}
                        {wo.status === 'IN_PROGRESS' && (
                            <>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 w-7 p-0 text-green-600"
                                    onClick={() => handleStatusChange('COMPLETED')}
                                    disabled={loading === 'wo'}
                                    title="Complete All"
                                >
                                    <CheckCircle className="h-4 w-4" />
                                </Button>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 w-7 p-0 text-red-600"
                                    onClick={() => handleStatusChange('CANCELLED')}
                                    disabled={loading === 'wo'}
                                    title="Cancel"
                                >
                                    <XCircle className="h-4 w-4" />
                                </Button>
                            </>
                        )}
                    </div>
                </TableCell>
            </TableRow>

            {/* Expanded Items */}
            {expanded && wo.items.length > 0 && (
                <TableRow className="bg-muted/20 hover:bg-muted/20">
                    <TableCell colSpan={10} className="p-0">
                        <div className="px-8 py-4 space-y-2">
                            <div className="text-xs uppercase text-muted-foreground mb-2">Work Order Items</div>
                            <div className="border rounded-lg overflow-hidden bg-background">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-muted/30">
                                            <TableHead className="w-12">#</TableHead>
                                            <TableHead>Item</TableHead>
                                            <TableHead>Type</TableHead>
                                            <TableHead>Notes</TableHead>
                                            <TableHead className="text-center">Status</TableHead>
                                            <TableHead className="w-20">Action</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {wo.items.map((item, idx) => (
                                            <TableRow
                                                key={item.id}
                                                className={item.status === 'COMPLETED' ? 'bg-green-50/50' : ''}
                                            >
                                                <TableCell className="font-mono text-muted-foreground">{idx + 1}</TableCell>
                                                <TableCell className="font-medium">{getItemLabel(item)}</TableCell>
                                                <TableCell>
                                                    <Badge variant="outline" className="text-xs">
                                                        {item.piece ? 'Piece' : item.assembly ? 'Assembly' : item.platePart ? 'Plate' : '-'}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-muted-foreground text-sm">
                                                    {item.notes || '-'}
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    {item.status === 'COMPLETED' ? (
                                                        <Badge className="bg-green-100 text-green-800">
                                                            <Check className="h-3 w-3 mr-1" /> Done
                                                        </Badge>
                                                    ) : item.status === 'IN_PROGRESS' ? (
                                                        <Badge className="bg-blue-100 text-blue-800">Working</Badge>
                                                    ) : (
                                                        <Badge className="bg-gray-100 text-gray-800">Pending</Badge>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    {item.status !== 'COMPLETED' && wo.status === 'IN_PROGRESS' && (
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            className="h-7 px-2 text-green-600 border-green-300 hover:bg-green-50"
                                                            onClick={() => handleItemComplete(item.id)}
                                                            disabled={loading === item.id}
                                                        >
                                                            {loading === item.id ? (
                                                                <span className="animate-pulse">...</span>
                                                            ) : (
                                                                <>
                                                                    <Check className="h-3 w-3 mr-1" /> Done
                                                                </>
                                                            )}
                                                        </Button>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                    </TableCell>
                </TableRow>
            )}

            {/* Complete Cutting WO Dialog - Machining Selection */}
            <Dialog open={completeDialogOpen} onOpenChange={setCompleteDialogOpen}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Complete Cutting Work Order</DialogTitle>
                        <DialogDescription>
                            Select pieces that need drilling/machining. Other pieces will go directly to welding.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 max-h-[400px] overflow-y-auto">
                        <div className="text-sm text-muted-foreground">
                            {wo.items.filter(i => i.piece).length} pieces in this work order
                        </div>

                        <div className="space-y-2">
                            {wo.items.filter(i => i.piece).map(item => (
                                <div
                                    key={item.id}
                                    className={`flex items-center gap-3 p-3 rounded-lg border ${machinedPieceIds.includes(item.id)
                                        ? 'bg-cyan-50 border-cyan-300'
                                        : 'bg-background'
                                        }`}
                                >
                                    <Checkbox
                                        checked={machinedPieceIds.includes(item.id)}
                                        onCheckedChange={() => toggleMachining(item.id)}
                                    />
                                    <div className="flex-1">
                                        <span className="font-mono font-medium">
                                            {item.piece!.part.partNumber} #{item.piece!.pieceNumber}
                                        </span>
                                    </div>
                                    <Badge variant="outline" className={
                                        machinedPieceIds.includes(item.id)
                                            ? 'bg-cyan-100 text-cyan-800'
                                            : 'bg-orange-100 text-orange-800'
                                    }>
                                        {machinedPieceIds.includes(item.id) ? '→ Machining' : '→ Welding'}
                                    </Badge>
                                </div>
                            ))}
                        </div>

                        <div className="p-3 bg-muted/50 rounded-lg text-sm space-y-1">
                            <div>
                                <span className="text-muted-foreground">To Machining: </span>
                                <span className="font-semibold text-cyan-700">{machinedPieceIds.length}</span>
                            </div>
                            <div>
                                <span className="text-muted-foreground">Direct to Welding: </span>
                                <span className="font-semibold text-orange-700">
                                    {wo.items.filter(i => i.piece).length - machinedPieceIds.length}
                                </span>
                            </div>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setCompleteDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleCompleteCuttingWO} disabled={loading === 'wo'}>
                            {loading === 'wo' ? 'Completing...' : 'Complete & Create WOs'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    )
}

export function WorkOrdersList({ workOrders }: WorkOrdersListProps) {
    if (workOrders.length === 0) {
        return (
            <div className="text-center py-12 text-muted-foreground">
                <ClipboardList className="mx-auto h-12 w-12 mb-4 opacity-50" />
                <p>No work orders created yet.</p>
                <p className="text-sm">Create work orders to track production tasks.</p>
            </div>
        )
    }

    return (
        <div className="border rounded-lg overflow-hidden">
            <Table>
                <TableHeader>
                    <TableRow className="bg-muted/50">
                        <TableHead className="w-8"></TableHead>
                        <TableHead>WO #</TableHead>
                        <TableHead>Title</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Priority</TableHead>
                        <TableHead>Assigned</TableHead>
                        <TableHead>Scheduled</TableHead>
                        <TableHead>Progress</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="w-24">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {workOrders.map(wo => (
                        <WorkOrderRow key={wo.id} wo={wo} />
                    ))}
                </TableBody>
            </Table>
        </div>
    )
}

// Process type labels and colors
const PROCESS_TYPES = [
    { type: 'MATERIAL_PREP', label: 'Material Prep', color: 'amber', bgColor: 'bg-amber-100', textColor: 'text-amber-800', borderColor: 'border-amber-500' },
    { type: 'CUTTING', label: 'Cutting', color: 'blue', bgColor: 'bg-blue-100', textColor: 'text-blue-800', borderColor: 'border-blue-500' },
    { type: 'MACHINING', label: 'Machining', color: 'cyan', bgColor: 'bg-cyan-100', textColor: 'text-cyan-800', borderColor: 'border-cyan-500' },
    { type: 'FABRICATION', label: 'Fabrication', color: 'yellow', bgColor: 'bg-yellow-100', textColor: 'text-yellow-800', borderColor: 'border-yellow-500' },
    { type: 'WELDING', label: 'Welding', color: 'orange', bgColor: 'bg-orange-100', textColor: 'text-orange-800', borderColor: 'border-orange-500' },
    { type: 'COATING', label: 'Coating', color: 'purple', bgColor: 'bg-purple-100', textColor: 'text-purple-800', borderColor: 'border-purple-500' },
    { type: 'ASSEMBLY', label: 'Assembly', color: 'green', bgColor: 'bg-green-100', textColor: 'text-green-800', borderColor: 'border-green-500' },
]

// Process card with expandable WO table
function ProcessCard({
    processType,
    workOrders,
    expanded,
    onToggle
}: {
    processType: typeof PROCESS_TYPES[0]
    workOrders: WorkOrder[]
    expanded: boolean
    onToggle: () => void
}) {
    const pending = workOrders.filter(wo => wo.status === 'PENDING')
    const inProgress = workOrders.filter(wo => wo.status === 'IN_PROGRESS')
    const completed = workOrders.filter(wo => wo.status === 'COMPLETED')

    if (workOrders.length === 0) return null

    return (
        <div className="space-y-2">
            <Card
                className={`cursor-pointer hover:shadow-md transition-shadow border-t-4 ${processType.borderColor} ${expanded ? 'ring-2 ring-primary' : ''}`}
                onClick={onToggle}
            >
                <CardHeader className="pb-2 pt-3">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-medium">{processType.label}</CardTitle>
                        {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </div>
                </CardHeader>
                <CardContent className="pt-0">
                    <div className="flex items-center gap-3 text-xs">
                        <div className="flex flex-col items-center">
                            <span className="text-lg font-bold text-gray-500">{pending.length}</span>
                            <span className="text-muted-foreground">Pending</span>
                        </div>
                        <div className="flex flex-col items-center">
                            <span className="text-lg font-bold text-blue-600">{inProgress.length}</span>
                            <span className="text-muted-foreground">Active</span>
                        </div>
                        <div className="flex flex-col items-center">
                            <span className="text-lg font-bold text-green-600">{completed.length}</span>
                            <span className="text-muted-foreground">Done</span>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {expanded && (
                <div className={`p-4 rounded-lg border-2 ${processType.borderColor} ${processType.bgColor} space-y-4`}>
                    {/* Pending WOs */}
                    {pending.length > 0 && (
                        <div>
                            <h4 className="text-xs uppercase font-semibold text-muted-foreground mb-2">Pending ({pending.length})</h4>
                            <div className="bg-background rounded border overflow-hidden">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-muted/30">
                                            <TableHead className="text-xs">WO #</TableHead>
                                            <TableHead className="text-xs">Title</TableHead>
                                            <TableHead className="text-xs text-center">Items</TableHead>
                                            <TableHead className="text-xs">Priority</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {pending.map(wo => (
                                            <TableRow key={wo.id}>
                                                <TableCell className="font-mono text-xs">{wo.workOrderNumber}</TableCell>
                                                <TableCell className="text-xs">{wo.title}</TableCell>
                                                <TableCell className="text-center text-xs">{wo.items.length}</TableCell>
                                                <TableCell>
                                                    <span className={`text-xs ${PRIORITY_COLORS[wo.priority]}`}>{wo.priority}</span>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                    )}

                    {/* In Progress WOs */}
                    {inProgress.length > 0 && (
                        <div>
                            <h4 className="text-xs uppercase font-semibold text-muted-foreground mb-2">In Progress ({inProgress.length})</h4>
                            <div className="bg-background rounded border overflow-hidden">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-muted/30">
                                            <TableHead className="text-xs">WO #</TableHead>
                                            <TableHead className="text-xs">Title</TableHead>
                                            <TableHead className="text-xs text-center">Progress</TableHead>
                                            <TableHead className="text-xs">Priority</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {inProgress.map(wo => {
                                            const done = wo.items.filter(i => i.status === 'COMPLETED').length
                                            return (
                                                <TableRow key={wo.id}>
                                                    <TableCell className="font-mono text-xs">{wo.workOrderNumber}</TableCell>
                                                    <TableCell className="text-xs">{wo.title}</TableCell>
                                                    <TableCell className="text-center text-xs font-mono">{done}/{wo.items.length}</TableCell>
                                                    <TableCell>
                                                        <span className={`text-xs ${PRIORITY_COLORS[wo.priority]}`}>{wo.priority}</span>
                                                    </TableCell>
                                                </TableRow>
                                            )
                                        })}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                    )}

                    {pending.length === 0 && inProgress.length === 0 && (
                        <div className="text-center py-4 text-muted-foreground text-sm">
                            All {processType.label} work orders completed
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

// Summary cards grouped by process type with expandable detail
export function WorkOrderSummary({ workOrders }: { workOrders: WorkOrder[] }) {
    const [expandedType, setExpandedType] = useState<string | null>(null)

    // Get types that have WOs
    const activeTypes = PROCESS_TYPES.filter(pt =>
        workOrders.some(wo => wo.type === pt.type)
    )

    if (activeTypes.length === 0) {
        return null
    }

    return (
        <div className="space-y-4 mb-6">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">
                {PROCESS_TYPES.map(pt => (
                    <ProcessCard
                        key={pt.type}
                        processType={pt}
                        workOrders={workOrders.filter(wo => wo.type === pt.type)}
                        expanded={expandedType === pt.type}
                        onToggle={() => setExpandedType(expandedType === pt.type ? null : pt.type)}
                    />
                ))}
            </div>

            {/* Overall Summary */}
            <div className="flex gap-4 p-3 bg-muted/30 rounded-lg text-sm">
                <div>
                    <span className="text-muted-foreground">Total: </span>
                    <span className="font-semibold">{workOrders.length}</span>
                </div>
                <div>
                    <span className="text-muted-foreground">Pending: </span>
                    <span className="font-semibold text-gray-600">{workOrders.filter(wo => wo.status === 'PENDING').length}</span>
                </div>
                <div>
                    <span className="text-muted-foreground">In Progress: </span>
                    <span className="font-semibold text-blue-600">{workOrders.filter(wo => wo.status === 'IN_PROGRESS').length}</span>
                </div>
                <div>
                    <span className="text-muted-foreground">Completed: </span>
                    <span className="font-semibold text-green-600">{workOrders.filter(wo => wo.status === 'COMPLETED').length}</span>
                </div>
                {workOrders.filter(wo => wo.priority === 'URGENT' && wo.status !== 'COMPLETED').length > 0 && (
                    <div className="ml-auto">
                        <span className="text-red-600 font-semibold">
                            ⚠ {workOrders.filter(wo => wo.priority === 'URGENT' && wo.status !== 'COMPLETED').length} Urgent
                        </span>
                    </div>
                )}
            </div>
        </div>
    )
}

