'use client'

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Truck, Calendar, Package, CheckCircle, AlertTriangle, Printer } from 'lucide-react'
import Link from 'next/link'
import { Button } from "@/components/ui/button"

interface DeliverySchedule {
    id: string
    projectId: string
    name: string
    scheduledDate: Date
    status: string
    shippedAt: Date | null
    deliveredAt: Date | null
    notes: string | null
    items: {
        assembly: {
            id: string
            assemblyNumber: string
            name: string
            status: string
            assemblyParts: {
                quantityInAssembly: number
                part: { pieces: { status: string }[] }
            }[]
        }
    }[]
}

interface DeliveriesListProps {
    deliveries: DeliverySchedule[]
}

const STATUS_COLORS: Record<string, string> = {
    'PENDING': 'bg-gray-100 text-gray-800 border-gray-300',
    'SHIPPED': 'bg-blue-100 text-blue-800 border-blue-300',
    'DELIVERED': 'bg-green-100 text-green-800 border-green-300',
}

function getDeliveryReadiness(delivery: DeliverySchedule): { ready: number; total: number; percent: number } {
    let total = 0
    let ready = 0

    delivery.items.forEach(item => {
        item.assembly.assemblyParts.forEach(ap => {
            const needed = ap.quantityInAssembly
            const readyPieces = ap.part.pieces.filter(p => p.status === 'READY').length
            total += needed
            ready += Math.min(readyPieces, needed)
        })
    })

    return {
        ready,
        total,
        percent: total > 0 ? Math.round((ready / total) * 100) : 100
    }
}

function DeliveryCard({ delivery }: { delivery: DeliverySchedule }) {
    const readiness = getDeliveryReadiness(delivery)
    const scheduledDate = new Date(delivery.scheduledDate)
    const daysUntil = Math.ceil((scheduledDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    const isOverdue = daysUntil < 0 && delivery.status === 'PENDING'
    const isReady = readiness.percent === 100

    return (
        <Card className={`${isOverdue ? 'border-red-300 bg-red-50/30' : isReady ? 'border-green-300 bg-green-50/30' : ''} flex flex-col h-full`}>
            <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                    <div>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Truck className="h-5 w-5" />
                            {delivery.name}
                        </CardTitle>
                        <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            {scheduledDate.toLocaleDateString()}
                            {isOverdue && (
                                <span className="text-red-600 font-medium flex items-center gap-1">
                                    <AlertTriangle className="h-3 w-3" />
                                    {Math.abs(daysUntil)} days overdue
                                </span>
                            )}
                            {!isOverdue && delivery.status === 'PENDING' && daysUntil <= 7 && (
                                <span className="text-orange-600">
                                    {daysUntil === 0 ? 'Today' : `${daysUntil} days`}
                                </span>
                            )}
                        </div>
                    </div>
                    <Badge variant="outline" className={STATUS_COLORS[delivery.status]}>
                        {delivery.status}
                    </Badge>
                </div>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col">
                <div className="space-y-3 flex-1">
                    <div>
                        <div className="flex items-center justify-between text-sm mb-1">
                            <span className="text-muted-foreground">Readiness</span>
                            <span className="font-medium">
                                {readiness.ready}/{readiness.total} pieces ({readiness.percent}%)
                            </span>
                        </div>
                        <Progress value={readiness.percent} className="h-2" />
                    </div>

                    <div className="space-y-1">
                        <div className="text-sm text-muted-foreground">Assemblies:</div>
                        <div className="flex flex-wrap gap-1">
                            {delivery.items.map(item => (
                                <Badge
                                    key={item.assembly.id}
                                    variant="outline"
                                    className={
                                        item.assembly.status === 'SHIPPED'
                                            ? 'bg-green-50 text-green-700'
                                            : item.assembly.status === 'QC_PASSED'
                                                ? 'bg-blue-50 text-blue-700'
                                                : ''
                                    }
                                >
                                    {item.assembly.assemblyNumber}
                                </Badge>
                            ))}
                        </div>
                    </div>

                    {delivery.notes && (
                        <p className="text-xs text-muted-foreground italic">{delivery.notes}</p>
                    )}

                    {isReady && delivery.status === 'PENDING' && (
                        <div className="flex items-center gap-1 text-green-600 text-sm font-medium pt-2">
                            <CheckCircle className="h-4 w-4" />
                            Ready to ship
                        </div>
                    )}
                </div>

                <div className="mt-4 pt-4 border-t flex justify-between items-center bg-white/50 -mx-6 -mb-6 p-4 rounded-b-lg">
                    <Link href={`/projects/${delivery.projectId}/deliveries/${delivery.id}/print`} target="_blank" className="w-full">
                        <Button variant="outline" size="sm" className="w-full">
                            <Printer className="mr-2 h-3 w-3" />
                            Print Packing List
                        </Button>
                    </Link>
                </div>
            </CardContent>
        </Card>
    )
}

export function DeliveriesList({ deliveries }: DeliveriesListProps) {
    if (deliveries.length === 0) {
        return (
            <div className="text-center py-12 text-muted-foreground">
                <Truck className="mx-auto h-12 w-12 mb-4 opacity-50" />
                <p>No deliveries scheduled yet.</p>
                <p className="text-sm">Create delivery schedules to track shipments.</p>
            </div>
        )
    }

    // Sort by date, pending first
    const sorted = [...deliveries].sort((a, b) => {
        if (a.status === 'PENDING' && b.status !== 'PENDING') return -1
        if (a.status !== 'PENDING' && b.status === 'PENDING') return 1
        return new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime()
    })

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sorted.map(delivery => (
                <DeliveryCard key={delivery.id} delivery={delivery} />
            ))}
        </div>
    )
}

// Summary for deliveries
export function DeliveriesSummary({ deliveries }: { deliveries: DeliverySchedule[] }) {
    const pending = deliveries.filter(d => d.status === 'PENDING')
    const overdue = pending.filter(d => new Date(d.scheduledDate) < new Date()).length
    const thisWeek = pending.filter(d => {
        const diff = Math.ceil((new Date(d.scheduledDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        return diff >= 0 && diff <= 7
    }).length
    const shipped = deliveries.filter(d => d.status === 'SHIPPED').length
    const delivered = deliveries.filter(d => d.status === 'DELIVERED').length

    return (
        <div className="grid grid-cols-5 gap-4 mb-6">
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Total</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{deliveries.length}</div>
                </CardContent>
            </Card>
            <Card className={overdue > 0 ? 'border-red-300 bg-red-50/50' : ''}>
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Overdue</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className={`text-2xl font-bold ${overdue > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                        {overdue}
                    </div>
                </CardContent>
            </Card>
            <Card className={thisWeek > 0 ? 'border-orange-300 bg-orange-50/50' : ''}>
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">This Week</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className={`text-2xl font-bold ${thisWeek > 0 ? 'text-orange-600' : 'text-gray-400'}`}>
                        {thisWeek}
                    </div>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Shipped</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold text-blue-600">{shipped}</div>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Delivered</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold text-green-600">{delivered}</div>
                </CardContent>
            </Card>
        </div>
    )
}
