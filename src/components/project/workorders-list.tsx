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
import { updateWorkOrderStatus, updateWorkOrderItemStatus, activateWorkOrder, completeWorkOrder } from '@/app/actions/workorders'

interface WorkOrderItem {
    id: string
    status: string
    completedAt: Date | null
    notes: string | null
    piece?: {
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
    const router = useRouter()

    const completedItems = wo.items.filter(i => i.status === 'COMPLETED').length
    const totalItems = wo.items.length
    const progress = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0

    const handleStatusChange = async (status: string) => {
        setLoading('wo')
        let res
        if (status === 'IN_PROGRESS') {
            res = await activateWorkOrder(wo.id)
        } else if (status === 'COMPLETED') {
            res = await completeWorkOrder(wo.id)
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

// Summary cards for work orders
export function WorkOrderSummary({ workOrders }: { workOrders: WorkOrder[] }) {
    const pending = workOrders.filter(wo => wo.status === 'PENDING').length
    const inProgress = workOrders.filter(wo => wo.status === 'IN_PROGRESS').length
    const completed = workOrders.filter(wo => wo.status === 'COMPLETED').length
    const urgent = workOrders.filter(wo => wo.priority === 'URGENT' && wo.status !== 'COMPLETED').length

    return (
        <div className="grid grid-cols-4 gap-4 mb-6">
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Pending</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold text-gray-600">{pending}</div>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">In Progress</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold text-blue-600">{inProgress}</div>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Completed</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold text-green-600">{completed}</div>
                </CardContent>
            </Card>
            <Card className={urgent > 0 ? 'border-red-300 bg-red-50/50' : ''}>
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Urgent</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className={`text-2xl font-bold ${urgent > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                        {urgent}
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
