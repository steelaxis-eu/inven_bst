'use client'

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ClipboardList, Play, CheckCircle, XCircle } from 'lucide-react'

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
    items: {
        id: string
        status: string
        piece?: { part: { partNumber: string }; pieceNumber: number } | null
        assembly?: { assemblyNumber: string } | null
    }[]
}

interface WorkOrdersListProps {
    workOrders: WorkOrder[]
    onStatusChange?: (id: string, status: string) => void
}

const TYPE_COLORS: Record<string, string> = {
    'CUTTING': 'bg-blue-100 text-blue-800',
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

export function WorkOrdersList({ workOrders, onStatusChange }: WorkOrdersListProps) {
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
                        <TableHead>WO #</TableHead>
                        <TableHead>Title</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Priority</TableHead>
                        <TableHead>Assigned</TableHead>
                        <TableHead>Scheduled</TableHead>
                        <TableHead>Items</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="w-24">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {workOrders.map(wo => (
                        <TableRow key={wo.id}>
                            <TableCell className="font-mono font-medium">{wo.workOrderNumber}</TableCell>
                            <TableCell>
                                <div>{wo.title}</div>
                                {wo.description && (
                                    <div className="text-xs text-muted-foreground">{wo.description}</div>
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
                                <span className="text-sm">
                                    {wo.items.filter(i => i.status === 'COMPLETED').length}/{wo.items.length}
                                </span>
                            </TableCell>
                            <TableCell>
                                <Badge variant="outline" className={STATUS_COLORS[wo.status] || ''}>
                                    {wo.status.replace('_', ' ')}
                                </Badge>
                            </TableCell>
                            <TableCell>
                                <div className="flex gap-1">
                                    {wo.status === 'PENDING' && (
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            className="h-7 w-7 p-0 text-blue-600"
                                            onClick={() => onStatusChange?.(wo.id, 'IN_PROGRESS')}
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
                                                onClick={() => onStatusChange?.(wo.id, 'COMPLETED')}
                                                title="Complete"
                                            >
                                                <CheckCircle className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                className="h-7 w-7 p-0 text-red-600"
                                                onClick={() => onStatusChange?.(wo.id, 'CANCELLED')}
                                                title="Cancel"
                                            >
                                                <XCircle className="h-4 w-4" />
                                            </Button>
                                        </>
                                    )}
                                </div>
                            </TableCell>
                        </TableRow>
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
