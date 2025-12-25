'use client'

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { ChevronDown, ChevronRight, Package } from 'lucide-react'
import { useState } from 'react'

interface Part {
    id: string
    partNumber: string
    description: string | null
    profile: { type: string; dimensions: string } | null
    grade: { name: string } | null
    length: number | null
    quantity: number
    unitWeight: number
    requiresWelding: boolean
    pieces: { id: string; pieceNumber: number; status: string }[]
}

interface PartsTableProps {
    parts: Part[]
    onPieceStatusChange?: (pieceId: string, status: string) => void
}

const STATUS_COLORS: Record<string, string> = {
    'PENDING': 'bg-gray-100 text-gray-800 border-gray-300',
    'CUT': 'bg-blue-100 text-blue-800 border-blue-300',
    'FABRICATED': 'bg-yellow-100 text-yellow-800 border-yellow-300',
    'WELDED': 'bg-orange-100 text-orange-800 border-orange-300',
    'PAINTED': 'bg-purple-100 text-purple-800 border-purple-300',
    'READY': 'bg-green-100 text-green-800 border-green-300',
}

export function PartsTable({ parts, onPieceStatusChange }: PartsTableProps) {
    const [expandedParts, setExpandedParts] = useState<Set<string>>(new Set())

    const toggleExpand = (partId: string) => {
        const newExpanded = new Set(expandedParts)
        if (newExpanded.has(partId)) {
            newExpanded.delete(partId)
        } else {
            newExpanded.add(partId)
        }
        setExpandedParts(newExpanded)
    }

    const getProgress = (pieces: Part['pieces']) => {
        if (pieces.length === 0) return 0
        const ready = pieces.filter(p => p.status === 'READY').length
        return Math.round((ready / pieces.length) * 100)
    }

    const getStatusCounts = (pieces: Part['pieces']) => {
        const counts: Record<string, number> = {}
        pieces.forEach(p => {
            counts[p.status] = (counts[p.status] || 0) + 1
        })
        return counts
    }

    if (parts.length === 0) {
        return (
            <div className="text-center py-12 text-muted-foreground">
                <Package className="mx-auto h-12 w-12 mb-4 opacity-50" />
                <p>No parts added yet.</p>
                <p className="text-sm">Add your first BOM part to get started.</p>
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
                        <TableHead>Description</TableHead>
                        <TableHead>Profile</TableHead>
                        <TableHead>Grade</TableHead>
                        <TableHead className="text-right">Length</TableHead>
                        <TableHead className="text-right">Qty</TableHead>
                        <TableHead className="text-right">Weight</TableHead>
                        <TableHead className="w-48">Progress</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {parts.map(part => {
                        const isExpanded = expandedParts.has(part.id)
                        const progress = getProgress(part.pieces)
                        const statusCounts = getStatusCounts(part.pieces)

                        return (
                            <>
                                <TableRow
                                    key={part.id}
                                    className="cursor-pointer hover:bg-muted/30"
                                    onClick={() => toggleExpand(part.id)}
                                >
                                    <TableCell>
                                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                                            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                        </Button>
                                    </TableCell>
                                    <TableCell className="font-mono font-medium">{part.partNumber}</TableCell>
                                    <TableCell className="text-muted-foreground">{part.description || '-'}</TableCell>
                                    <TableCell>
                                        {part.profile ? `${part.profile.type} ${part.profile.dimensions}` : '-'}
                                    </TableCell>
                                    <TableCell>{part.grade?.name || '-'}</TableCell>
                                    <TableCell className="text-right font-mono">
                                        {part.length ? `${part.length.toLocaleString()} mm` : '-'}
                                    </TableCell>
                                    <TableCell className="text-right font-medium">{part.quantity}</TableCell>
                                    <TableCell className="text-right font-mono">
                                        {part.unitWeight > 0 ? `${(part.unitWeight * part.quantity).toFixed(1)} kg` : '-'}
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <Progress value={progress} className="flex-1 h-2" />
                                            <span className="text-xs font-medium w-8">{progress}%</span>
                                        </div>
                                    </TableCell>
                                </TableRow>
                                {isExpanded && (
                                    <TableRow key={`${part.id}-pieces`}>
                                        <TableCell colSpan={9} className="bg-muted/20 p-4">
                                            <div className="space-y-3">
                                                <div className="flex gap-2 flex-wrap">
                                                    {Object.entries(statusCounts).map(([status, count]) => (
                                                        <Badge key={status} variant="outline" className={STATUS_COLORS[status]}>
                                                            {status}: {count}
                                                        </Badge>
                                                    ))}
                                                </div>
                                                <div className="grid grid-cols-10 gap-1">
                                                    {part.pieces.map(piece => (
                                                        <div
                                                            key={piece.id}
                                                            className={`text-center text-xs py-1 px-2 rounded border ${STATUS_COLORS[piece.status]}`}
                                                            title={`Piece ${piece.pieceNumber}: ${piece.status}`}
                                                        >
                                                            {piece.pieceNumber}
                                                        </div>
                                                    ))}
                                                </div>
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
