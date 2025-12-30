'use client'

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { ChevronDown, ChevronRight, Package, MoreHorizontal, RefreshCw, Scissors, Factory } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { togglePartSource } from '@/app/actions/parts'
import { togglePlatePartSource } from '@/app/actions/plateparts'
import { cn } from '@/lib/utils'

// Union type for the table
export type UnifiedPartItem =
    | { kind: 'part', data: any }
    | { kind: 'plate', data: any }

interface UnifiedPartsTableProps {
    items: UnifiedPartItem[]
    projectId: string
}

export function UnifiedPartsTable({ items, projectId }: UnifiedPartsTableProps) {
    const [expandedParts, setExpandedParts] = useState<Set<string>>(new Set())
    const [loadingId, setLoadingId] = useState<string | null>(null)

    const toggleExpand = (id: string) => {
        const newExpanded = new Set(expandedParts)
        if (newExpanded.has(id)) {
            newExpanded.delete(id)
        } else {
            newExpanded.add(id)
        }
        setExpandedParts(newExpanded)
    }

    const handleToggleSource = async (item: UnifiedPartItem) => {
        const id = item.kind === 'part' ? item.data.id : item.data.id
        setLoadingId(id)

        try {
            let res
            if (item.kind === 'part') {
                res = await togglePartSource(id)
            } else {
                res = await togglePlatePartSource(id)
            }

            if (res.success) {
                toast.success(`Moved to ${res.isOutsourced ? 'Outsourced' : 'In-House'}`)
            } else {
                toast.error(res.error || 'Failed to toggle source')
            }
        } catch (e) {
            toast.error('An error occurred')
        } finally {
            setLoadingId(null)
        }
    }

    const getProgress = (pieces: any[]) => {
        if (!pieces || pieces.length === 0) return 0
        const ready = pieces.filter((p: any) => p.status === 'READY').length
        return Math.round((ready / pieces.length) * 100)
    }

    if (items.length === 0) {
        return (
            <div className="text-center py-12 text-muted-foreground border rounded-lg bg-muted/10">
                <Package className="mx-auto h-12 w-12 mb-4 opacity-50" />
                <p>No parts in this list.</p>
            </div>
        )
    }

    return (
        <div className="border rounded-lg overflow-hidden">
            <Table>
                <TableHeader>
                    <TableRow className="bg-muted/50">
                        <TableHead className="w-10"></TableHead>
                        <TableHead>Part #</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Dimensions</TableHead>
                        <TableHead>Grade</TableHead>
                        <TableHead className="text-right">Qty</TableHead>
                        <TableHead className="text-right">Weight</TableHead>
                        <TableHead className="w-40">Status / Progress</TableHead>
                        <TableHead className="w-10"></TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {items.map((item) => {
                        const data = item.data
                        const isPart = item.kind === 'part'
                        const id = data.id
                        const isExpanded = expandedParts.has(id)

                        // Derived values
                        const dimensions = isPart
                            ? (data.profile ? `${data.profile.type} ${data.profile.dimensions} (${data.length}mm)` : '-')
                            : `${data.thickness}mm x ${data.width}mm x ${data.length}mm`

                        const weight = isPart
                            ? (data.unitWeight * data.quantity)
                            : (data.unitWeight * data.quantity)

                        const progress = isPart ? getProgress(data.pieces) : 0

                        return (
                            <>
                                <TableRow key={id} className="hover:bg-muted/30">
                                    <TableCell>
                                        {isPart && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-6 w-6 p-0"
                                                onClick={() => toggleExpand(id)}
                                            >
                                                {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                            </Button>
                                        )}
                                    </TableCell>
                                    <TableCell className="font-mono font-medium">
                                        {data.partNumber}
                                    </TableCell>
                                    <TableCell>
                                        {isPart ? (
                                            <Badge variant="outline" className="gap-1">
                                                <Package className="h-3 w-3" /> Profile
                                            </Badge>
                                        ) : (
                                            <Badge variant="secondary" className="gap-1">
                                                <Scissors className="h-3 w-3" /> Plate
                                            </Badge>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-muted-foreground text-sm">
                                        {data.description || '-'}
                                    </TableCell>
                                    <TableCell className="text-sm">
                                        {dimensions}
                                    </TableCell>
                                    <TableCell>
                                        {data.grade?.name || '-'}
                                    </TableCell>
                                    <TableCell className="text-right font-medium">
                                        {data.quantity}
                                    </TableCell>
                                    <TableCell className="text-right text-muted-foreground text-sm">
                                        {weight > 0 ? `${weight.toFixed(1)} kg` : '-'}
                                    </TableCell>
                                    <TableCell>
                                        {isPart ? (
                                            <div className="flex items-center gap-2">
                                                <Progress value={progress} className="h-2 flex-1" />
                                                <span className="text-xs w-8">{progress}%</span>
                                            </div>
                                        ) : (
                                            <Badge variant="outline" className={cn(
                                                data.status === 'RECEIVED' ? 'bg-green-100 text-green-800' :
                                                    data.status === 'ORDERED' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100'
                                            )}>
                                                {data.status}
                                            </Badge>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                                    <MoreHorizontal className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                                <DropdownMenuItem onClick={() => handleToggleSource(item)} disabled={loadingId === id}>
                                                    <Factory className="mr-2 h-4 w-4" />
                                                    {isPart
                                                        ? (data.isOutsourcedCut ? "Make In-House" : "Outsource Cutting")
                                                        : (data.isOutsourced ? "Make In-House" : "Outsource")
                                                    }
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                                {/* Expanded Content for Parts (Pieces) */}
                                {isPart && isExpanded && (
                                    <TableRow>
                                        <TableCell colSpan={10} className="bg-muted/10 p-0">
                                            <div className="p-4 grid grid-cols-10 gap-2">
                                                {data.pieces.map((piece: any) => (
                                                    <div key={piece.id} className="text-xs border rounded p-1 text-center bg-background">
                                                        {piece.pieceNumber} <br />
                                                        <span className={cn(
                                                            "font-bold",
                                                            piece.status === 'READY' ? "text-green-600" : "text-gray-500"
                                                        )}>{piece.status}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                )}
                            </>
                        )
                    })}
                </TableBody>
            </Table>
        </div>
    )
}
