'use client'

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { FileText, Package, Truck, ExternalLink } from 'lucide-react'

interface PlatePart {
    id: string
    partNumber: string
    description: string | null
    material: string | null
    thickness: number | null
    quantity: number
    unitWeight: number
    supplier: string | null
    poNumber: string | null
    status: string
    dxfFilename: string | null
    dxfStoragePath: string | null
    orderedAt: Date | null
    expectedDate: Date | null
    receivedAt: Date | null
    receivedQty: number
    grade?: { name: string } | null
}

interface PlatePartsTableProps {
    plateParts: PlatePart[]
    onStatusChange?: (id: string, status: string) => void
}

const STATUS_COLORS: Record<string, string> = {
    'PENDING': 'bg-gray-100 text-gray-800',
    'ORDERED': 'bg-blue-100 text-blue-800',
    'IN_PRODUCTION': 'bg-yellow-100 text-yellow-800',
    'RECEIVED': 'bg-green-100 text-green-800',
    'QC_PASSED': 'bg-emerald-100 text-emerald-800',
}

export function PlatePartsTable({ plateParts, onStatusChange }: PlatePartsTableProps) {
    if (plateParts.length === 0) {
        return (
            <div className="text-center py-12 text-muted-foreground">
                <Package className="mx-auto h-12 w-12 mb-4 opacity-50" />
                <p>No plate parts defined yet.</p>
                <p className="text-sm">Add laser/plasma cut parts for outsourced fabrication.</p>
            </div>
        )
    }

    return (
        <div className="border rounded-lg overflow-hidden">
            <Table>
                <TableHeader>
                    <TableRow className="bg-muted/50">
                        <TableHead>Part #</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Material</TableHead>
                        <TableHead className="text-right">Thickness</TableHead>
                        <TableHead className="text-right">Qty</TableHead>
                        <TableHead>Supplier</TableHead>
                        <TableHead>PO #</TableHead>
                        <TableHead>Expected</TableHead>
                        <TableHead>Received</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>DXF</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {plateParts.map(pp => {
                        const receivedPercent = pp.quantity > 0
                            ? Math.round((pp.receivedQty / pp.quantity) * 100)
                            : 0

                        return (
                            <TableRow key={pp.id}>
                                <TableCell className="font-mono font-medium">{pp.partNumber}</TableCell>
                                <TableCell className="text-muted-foreground">{pp.description || '-'}</TableCell>
                                <TableCell>
                                    {pp.material || pp.grade?.name || '-'}
                                </TableCell>
                                <TableCell className="text-right font-mono">
                                    {pp.thickness ? `${pp.thickness} mm` : '-'}
                                </TableCell>
                                <TableCell className="text-right font-medium">{pp.quantity}</TableCell>
                                <TableCell>{pp.supplier || '-'}</TableCell>
                                <TableCell className="font-mono text-sm">{pp.poNumber || '-'}</TableCell>
                                <TableCell className="text-sm">
                                    {pp.expectedDate
                                        ? new Date(pp.expectedDate).toLocaleDateString()
                                        : '-'}
                                </TableCell>
                                <TableCell>
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-medium">
                                            {pp.receivedQty}/{pp.quantity}
                                        </span>
                                        {pp.quantity > 0 && (
                                            <Progress value={receivedPercent} className="w-16 h-2" />
                                        )}
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <Badge variant="outline" className={STATUS_COLORS[pp.status] || ''}>
                                        {pp.status.replace('_', ' ')}
                                    </Badge>
                                </TableCell>
                                <TableCell>
                                    {pp.dxfFilename ? (
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            className="h-7 gap-1 text-blue-600"
                                        >
                                            <FileText className="h-3 w-3" />
                                            <span className="text-xs">{pp.dxfFilename}</span>
                                        </Button>
                                    ) : (
                                        <span className="text-xs text-muted-foreground">—</span>
                                    )}
                                </TableCell>
                            </TableRow>
                        )
                    })}
                </TableBody>
            </Table>
        </div>
    )
}

// Summary cards for plate parts
export function PlatePartsSummary({ plateParts }: { plateParts: PlatePart[] }) {
    const total = plateParts.length
    const pending = plateParts.filter(p => p.status === 'PENDING').length
    const ordered = plateParts.filter(p => p.status === 'ORDERED' || p.status === 'IN_PRODUCTION').length
    const received = plateParts.filter(p => p.status === 'RECEIVED' || p.status === 'QC_PASSED').length
    const totalWeight = plateParts.reduce((sum, p) => sum + (p.quantity * (p.unitWeight || 0)), 0)

    return (
        <div className="grid grid-cols-5 gap-4 mb-6">
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Total Parts</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{total}</div>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Pending Order</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold text-gray-600">{pending}</div>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Ordered</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold text-blue-600">{ordered}</div>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Received</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold text-green-600">{received}</div>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Total Weight</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{totalWeight.toFixed(0)} <span className="text-sm font-normal">kg</span></div>
                </CardContent>
            </Card>
        </div>
    )
}
