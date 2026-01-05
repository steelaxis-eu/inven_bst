'use client'

import { useState } from 'react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Play, CheckCircle, Clock, RotateCw, AlertTriangle, AlertCircle, Trash2, XCircle, Ruler, Wrench, Printer, ChevronDown, ChevronRight, Layers, ClipboardList, Check } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { updateWorkOrderStatus, updateWorkOrderItemStatus, activateWorkOrder, completeWorkOrder, completeCuttingWOWithWorkflow } from '@/app/actions/workorders'
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { BatchCutDialog } from "./batch-cut-dialog"
import { MaterialPrepDialog } from "./material-prep-dialog"
import { DownloadDrawingsButton } from '@/components/work-order/download-drawings-button'

// --- Interfaces ---

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
    projectId: string
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

// --- Constants ---

const TYPE_COLORS: Record<string, string> = {
    'MATERIAL_PREP': 'bg-amber-100 text-amber-800',
    'CUTTING': 'bg-blue-100 text-blue-800',
    'MACHINING': 'bg-cyan-100 text-cyan-800',
    'FABRICATION': 'bg-yellow-100 text-yellow-800',
    'WELDING': 'bg-orange-100 text-orange-800',
    'PAINTING': 'bg-purple-100 text-purple-800',
    'ASSEMBLY': 'bg-green-100 text-green-800',
}

const ORDERED_PROCESSES = [
    'MATERIAL_PREP',
    'CUTTING',
    'MACHINING',
    'FABRICATION',
    'WELDING',
    'PAINTING',
    'ASSEMBLY',
    'QUALITY_CHECK',
    'PACKAGING'
]

// --- Sub-Components ---

function WorkOrderTable({
    workOrders,
    type,
    projectId
}: {
    workOrders: WorkOrder[],
    type: string,
    projectId: string
}) {
    const router = useRouter()
    const [loading, setLoading] = useState<string | null>(null)
    const [selectedBatchItemIds, setSelectedBatchItemIds] = useState<string[]>([])
    const [batchCutDialogOpen, setBatchCutDialogOpen] = useState(false)
    const [completeDialogOpen, setCompleteDialogOpen] = useState(false)
    const [materialPrepDialogOpen, setMaterialPrepDialogOpen] = useState(false)
    const [activeWoForComplete, setActiveWoForComplete] = useState<WorkOrder | null>(null)
    const [machinedPieceIds, setMachinedPieceIds] = useState<string[]>([])

    // Handlers
    const handleStatusChange = async (wo: WorkOrder, status: string) => {
        if (status === 'COMPLETED' && wo.type === 'CUTTING' && wo.status === 'IN_PROGRESS') {
            setActiveWoForComplete(wo)
            setCompleteDialogOpen(true)
            return
        }

        if (status === 'COMPLETED' && wo.type === 'MATERIAL_PREP' && wo.status === 'IN_PROGRESS') {
            setActiveWoForComplete(wo)
            setMaterialPrepDialogOpen(true)
            return
        }

        setLoading(wo.id)
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
            toast.success(`Work order updated`)
            router.refresh()
        }
        setLoading(null)
    }

    const handleItemComplete = async (itemId: string) => {
        setLoading(itemId)
        const res = await updateWorkOrderItemStatus(itemId, 'COMPLETED')
        if (!res.success) {
            toast.error('Failed to complete item')
        } else {
            router.refresh()
        }
        setLoading(null)
    }

    const handleCompleteCuttingWO = async () => {
        if (!activeWoForComplete) return
        setLoading(activeWoForComplete.id)
        const pieceIdsNeedingMachining = activeWoForComplete.items
            .filter(i => {
                if (!i.pieceId) return false
                return machinedPieceIds.includes(i.id)
            })
            .map(i => i.pieceId!)

        const res = await completeCuttingWOWithWorkflow(activeWoForComplete.id, pieceIdsNeedingMachining)

        if (!res.success) {
            toast.error(res.error || 'Failed to complete WO')
        } else {
            if (res.machiningWO) toast.info(`Machining WO created: ${res.machiningWO.workOrderNumber}`)
            if (res.weldingWO) toast.success(`Welding WO created: ${res.weldingWO.workOrderNumber}`)
            setCompleteDialogOpen(false)
            router.refresh()
        }
        setLoading(null)
    }

    const toggleMachining = (itemId: string) => {
        setMachinedPieceIds(prev => prev.includes(itemId) ? prev.filter(id => id !== itemId) : [...prev, itemId])
    }

    // Grouping
    const inProgress = workOrders.filter(w => w.status === 'IN_PROGRESS')
    const pending = workOrders.filter(w => w.status === 'PENDING')
    const completed = workOrders.filter(w => w.status === 'COMPLETED')

    // Collect all items from IN_PROGRESS cutting WOs for batch selection
    const allActiveCuttingItems = inProgress
        .filter(w => w.type === 'CUTTING')
        .flatMap(w => w.items.filter(i => i.status !== 'COMPLETED'))

    return (
        <div className="space-y-6 animate-in slide-in-from-top-2 duration-200">
            {/* Batch Cut Actions */}
            {type === 'CUTTING' && inProgress.length > 0 && (
                <div className="bg-muted/30 p-2 rounded-md flex justify-between items-center">
                    <div className="text-xs text-muted-foreground ml-2">
                        Select individual items from active cutting orders below
                    </div>
                    <div>
                        {selectedBatchItemIds.length > 0 && (
                            <Button size="sm" onClick={() => setBatchCutDialogOpen(true)}>
                                <Ruler className="h-4 w-4 mr-2" />
                                Record Usage / Cut ({selectedBatchItemIds.length})
                            </Button>
                        )}
                    </div>
                </div>
            )}

            {/* renderGroup helper */}
            {[
                { title: 'Active', data: inProgress, color: 'text-blue-600' },
                { title: 'Pending', data: pending, color: 'text-gray-600' },
                { title: 'Completed', data: completed, color: 'text-green-600' }
            ].map(group => {
                if (group.data.length === 0) return null
                return (
                    <div key={group.title} className="space-y-2">
                        <h4 className={`text-sm font-bold uppercase tracking-wider ${group.color} flex items-center gap-2`}>
                            {group.title === 'Active' && <Play className="h-4 w-4" />}
                            {group.title === 'Pending' && <Clock className="h-4 w-4" />}
                            {group.title === 'Completed' && <CheckCircle className="h-4 w-4" />}
                            {group.title} ({group.data.length})
                        </h4>
                        <div className="rounded-md border bg-card">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-10"></TableHead>
                                        <TableHead className="w-[140px]">WO #</TableHead>
                                        <TableHead>Title</TableHead>
                                        <TableHead>Prioriy</TableHead>
                                        <TableHead>Items</TableHead>
                                        <TableHead>Action</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {group.data.map(wo => (
                                        <>
                                            <TableRow key={wo.id} className="hover:bg-muted/50">
                                                <TableCell>
                                                    {/* Status Indicator */}
                                                    <div className={`w-2 h-2 rounded-full ${wo.status === 'IN_PROGRESS' ? 'bg-blue-500 animate-pulse' :
                                                        wo.status === 'COMPLETED' ? 'bg-green-500' : 'bg-gray-300'
                                                        }`} />
                                                </TableCell>
                                                <TableCell className="font-mono font-medium">{wo.workOrderNumber}</TableCell>
                                                <TableCell>
                                                    <div className="font-medium">{wo.title}</div>
                                                    {wo.description && <div className="text-xs text-muted-foreground">{wo.description}</div>}
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant="outline" className="text-xs">{wo.priority}</Badge>
                                                </TableCell>
                                                <TableCell>
                                                    {/* Items Summary or Expansion? 
                                                    User said "table with two groups... and only WO related to process"
                                                    But also "underneath it shows table...".
                                                    If I list WOs here, I should probably show their items too? 
                                                    Or just list WOs? 
                                                    "shows table... with two groups pending and active" -> List of WOs.
                                                    The items are likely needed to be seen to be worked on.
                                                    I'll render items inline or provide a sub-expand.
                                                 */}
                                                    <div className="text-xs bg-slate-100 rounded px-2 py-1 inline-block">
                                                        {wo.items.filter(i => i.status === 'COMPLETED').length} / {wo.items.length} Items done
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    {/* Actions */}
                                                    <div className="flex gap-2">
                                                        {wo.status === 'PENDING' && (
                                                            <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-blue-600" onClick={() => handleStatusChange(wo, 'IN_PROGRESS')}>
                                                                <Play className="h-4 w-4" />
                                                            </Button>
                                                        )}
                                                        {wo.status === 'IN_PROGRESS' && (
                                                            <>
                                                                <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-green-600" onClick={() => handleStatusChange(wo, 'COMPLETED')}>
                                                                    <CheckCircle className="h-4 w-4" />
                                                                </Button>
                                                                <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-red-600" onClick={() => handleStatusChange(wo, 'CANCELLED')}>
                                                                    <XCircle className="h-4 w-4" />
                                                                </Button>
                                                            </>
                                                        )}
                                                        <Link href={`/projects/${projectId}/work-orders/${wo.id}/print`} target="_blank">
                                                            <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-gray-600" title="Print Work Order">
                                                                <Printer className="h-4 w-4" />
                                                            </Button>
                                                        </Link>
                                                        <DownloadDrawingsButton workOrderId={wo.id} workOrderNumber={wo.workOrderNumber} className="h-8 w-8 p-0 text-gray-600" />
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                            {/* Inline Items Table if Active? User wants to see items to cut presumably. */}
                                            {(wo.status === 'IN_PROGRESS' || wo.status === 'PENDING') && (
                                                <TableRow className="bg-muted/10">
                                                    <TableCell colSpan={6} className="p-0">
                                                        <div className="px-4 py-2 border-l-4 border-l-transparent hover:border-l-blue-200 transition-colors">
                                                            <Table>
                                                                <TableHeader className="invisible h-0"><TableRow><TableHead></TableHead><TableHead></TableHead><TableHead></TableHead><TableHead></TableHead><TableHead></TableHead></TableRow></TableHeader>
                                                                <TableBody>
                                                                    {wo.items.map((item, idx) => (
                                                                        <TableRow key={item.id} className="border-0 h-8">
                                                                            <TableCell className="py-1 w-10">
                                                                                {wo.type === 'CUTTING' && wo.status === 'IN_PROGRESS' && item.status !== 'COMPLETED' && (
                                                                                    <Checkbox
                                                                                        checked={selectedBatchItemIds.includes(item.id)}
                                                                                        onCheckedChange={(checked) => {
                                                                                            if (checked) setSelectedBatchItemIds(prev => [...prev, item.id])
                                                                                            else setSelectedBatchItemIds(prev => prev.filter(id => id !== item.id))
                                                                                        }}
                                                                                    />
                                                                                )}
                                                                            </TableCell>
                                                                            <TableCell className="py-1 font-mono text-xs w-8">{idx + 1}</TableCell>
                                                                            <TableCell className="py-1 text-sm">
                                                                                {item.piece
                                                                                    ? <span className="font-semibold">{item.piece.part.partNumber} #{item.piece.pieceNumber}</span>
                                                                                    : item.assembly ? item.assembly.name
                                                                                        : item.platePart ? item.platePart.partNumber
                                                                                            : '-'}
                                                                            </TableCell>
                                                                            <TableCell className="py-1 text-xs text-muted-foreground">{item.notes}</TableCell>
                                                                            <TableCell className="py-1 text-right w-24">
                                                                                {item.status !== 'COMPLETED' && wo.status === 'IN_PROGRESS' && (
                                                                                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => handleItemComplete(item.id)}>
                                                                                        {loading === item.id ? "..." : <Check className="h-3 w-3" />}
                                                                                    </Button>
                                                                                )}
                                                                                {item.status === 'COMPLETED' && <Check className="h-3 w-3 text-green-500 ml-auto" />}
                                                                            </TableCell>
                                                                        </TableRow>
                                                                    ))}
                                                                </TableBody>
                                                            </Table>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        </>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                )
            })}

            {activeWoForComplete && (
                <Dialog open={completeDialogOpen} onOpenChange={setCompleteDialogOpen}>
                    <DialogContent className="max-w-lg">
                        <DialogHeader>
                            <DialogTitle>Complete Cutting Work Order</DialogTitle>
                            {/* Same Dialog Content as before */}
                            <DialogDescription>
                                Select pieces that need drilling/machining. Other pieces will go directly to welding.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-4 max-h-[400px] overflow-y-auto">
                            <div className="text-sm text-muted-foreground">
                                {activeWoForComplete.items.filter(i => i.piece).length} pieces in this work order
                            </div>

                            <div className="space-y-2">
                                {activeWoForComplete.items.filter(i => i.piece).map(item => (
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
                        </div>

                        <DialogFooter>
                            <Button variant="outline" onClick={() => setCompleteDialogOpen(false)}>Cancel</Button>
                            <Button onClick={handleCompleteCuttingWO} disabled={loading === activeWoForComplete.id}>
                                Complete & Create WOs
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            )}

            {
                // Note: We need to find *which* items correspond to the selected IDs for the Dialog
                // Since we filtered `allActiveCuttingItems` above, we can pass relevant ones.
                // But for `projectId` we can pick one (assuming same project in context).
            }
            <BatchCutDialog
                open={batchCutDialogOpen}
                onOpenChange={setBatchCutDialogOpen}
                projectId={projectId}
                items={allActiveCuttingItems.filter(i => selectedBatchItemIds.includes(i.id))}
                onSuccess={() => {
                    setSelectedBatchItemIds([])
                    router.refresh()
                }}
            />

            {/* Material Prep Dialog */}
            {activeWoForComplete && (
                <MaterialPrepDialog
                    open={materialPrepDialogOpen}
                    onOpenChange={setMaterialPrepDialogOpen}
                    workOrder={activeWoForComplete}
                    onSuccess={() => {
                        setMaterialPrepDialogOpen(false)
                        router.refresh()
                    }}
                />
            )}
        </div>
    )
}

function ProcessCard({ type, workOrders, projectId }: { type: string, workOrders: WorkOrder[], projectId: string }) {
    const [expanded, setExpanded] = useState(false)

    // Stats
    const total = workOrders.length
    const pending = workOrders.filter(w => w.status === 'PENDING').length
    const active = workOrders.filter(w => w.status === 'IN_PROGRESS').length
    const completed = workOrders.filter(w => w.status === 'COMPLETED').length

    // Overall Process Completion (based on item status?) Or WO status? 
    // User said "percentage of total process finished". Usually Item completion is more accurate.
    const totalItems = workOrders.reduce((sum, w) => sum + w.items.length, 0)
    const completedItems = workOrders.reduce((sum, w) => sum + w.items.filter(i => i.status === 'COMPLETED').length, 0)
    const progress = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0

    const colorClass = TYPE_COLORS[type] || 'bg-gray-100 text-gray-800'

    return (
        <Card className={`bg-muted/5 border-l-4 overflow-hidden transition-all duration-200 ${expanded ? 'ring-2 ring-primary ring-offset-2' : 'hover:shadow-md'}`}>
            <div
                className="cursor-pointer"
                onClick={() => setExpanded(!expanded)}
            >
                <div className="p-6 grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
                    {/* 1. Title */}
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${colorClass} bg-opacity-20`}>
                            <Layers className="h-6 w-6" />
                        </div>
                        <div>
                            <h3 className="font-bold text-lg">{type.replace('_', ' ')}</h3>
                            <p className="text-xs text-muted-foreground">{total} Orders</p>
                        </div>
                    </div>

                    {/* 2. Stats Grid */}
                    <div className="flex gap-6 justify-center text-sm">
                        <div className="text-center">
                            <div className="font-bold text-lg text-gray-500">{pending}</div>
                            <div className="text-xs text-muted-foreground uppercase">Pending</div>
                        </div>
                        <div className="text-center">
                            <div className="font-bold text-lg text-blue-600">{active}</div>
                            <div className="text-xs text-muted-foreground uppercase">Active</div>
                        </div>
                        <div className="text-center">
                            <div className="font-bold text-lg text-green-600">{completed}</div>
                            <div className="text-xs text-muted-foreground uppercase">Done</div>
                        </div>
                    </div>

                    {/* 3. Progress */}
                    <div className="space-y-1">
                        <div className="flex justify-between text-xs font-medium">
                            <span>Process Completion</span>
                            <span>{progress}%</span>
                        </div>
                        <Progress value={progress} className="h-2" />
                        <p className="text-xs text-muted-foreground text-right">{completedItems} / {totalItems} items</p>
                    </div>

                    {/* 4. Icon */}
                    <div className="flex justify-end">
                        {expanded ? <ChevronDown className="h-6 w-6 text-muted-foreground" /> : <ChevronRight className="h-6 w-6 text-muted-foreground" />}
                    </div>
                </div>
            </div>

            {/* Expanded Content */}
            {expanded && (
                <div className="bg-muted/50 border-t p-4">
                    <WorkOrderTable workOrders={workOrders} type={type} projectId={projectId} />
                </div>
            )}
        </Card>
    )
}

// --- Main Component ---

export function WorkOrdersList({ workOrders }: WorkOrdersListProps) {
    if (workOrders.length === 0) {
        return (
            <div className="text-center py-12 text-muted-foreground border rounded-lg border-dashed">
                <ClipboardList className="mx-auto h-12 w-12 text-gray-300 opacity-50" />
                <h3 className="mt-2 text-sm font-semibold">No work orders</h3>
            </div>
        )
    }

    // Group by Type
    const grouped: Record<string, WorkOrder[]> = {}
    workOrders.forEach(wo => {
        if (!grouped[wo.type]) grouped[wo.type] = []
        grouped[wo.type].push(wo)
    })

    // Sort types or iterate specific order?
    // Use ORDERED_PROCESSES and filter
    const sortedTypes = ORDERED_PROCESSES.filter(t => grouped[t])
    // Add any remaining types
    Object.keys(grouped).forEach(t => {
        if (!sortedTypes.includes(t)) sortedTypes.push(t)
    })

    const projectId = workOrders[0]?.projectId || ''

    return (
        <div className="space-y-4">
            {sortedTypes.map(type => (
                <ProcessCard key={type} type={type} workOrders={grouped[type]} projectId={projectId} />
            ))}
        </div>
    )
}

// Optional: Keep Summary if needed, or remove? 
// User asked for stats IN the cards. So main summary might be redundant but okay to keep.
export function WorkOrderSummary({ workOrders }: WorkOrdersListProps) {
    return null // Disabled as requested stats are now in cards
}
