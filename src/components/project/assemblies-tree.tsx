'use client'

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { ChevronDown, ChevronRight, Layers, Package } from 'lucide-react'
import { useState } from 'react'

interface Assembly {
    id: string
    assemblyNumber: string
    name: string
    description: string | null
    status: string
    sequence: number
    scheduledDate: Date | null
    parentId: string | null
    children: Assembly[]
    assemblyParts: {
        part: {
            partNumber: string
            pieces: { status: string }[]
        }
        quantityInAssembly: number
    }[]
}

interface AssembliesTreeProps {
    assemblies: Assembly[]
}

const STATUS_COLORS: Record<string, string> = {
    'NOT_STARTED': 'bg-gray-100 text-gray-800',
    'IN_PROGRESS': 'bg-blue-100 text-blue-800',
    'ASSEMBLED': 'bg-yellow-100 text-yellow-800',
    'QC_PASSED': 'bg-green-100 text-green-800',
    'SHIPPED': 'bg-purple-100 text-purple-800',
}

function getAssemblyProgress(assembly: Assembly): number {
    let totalPieces = 0
    let readyPieces = 0

    assembly.assemblyParts.forEach(ap => {
        const needed = ap.quantityInAssembly
        const ready = ap.part.pieces.filter(p => p.status === 'READY').length
        totalPieces += needed
        readyPieces += Math.min(ready, needed)
    })

    return totalPieces > 0 ? Math.round((readyPieces / totalPieces) * 100) : 0
}

function AssemblyItem({ assembly, level = 0 }: { assembly: Assembly; level?: number }) {
    const [expanded, setExpanded] = useState(true)
    const hasChildren = assembly.children && assembly.children.length > 0
    const progress = getAssemblyProgress(assembly)

    return (
        <div className="w-full">
            <div
                className={`flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 cursor-pointer border-l-4 ${progress === 100 ? 'border-l-green-500' : progress > 0 ? 'border-l-blue-500' : 'border-l-gray-300'
                    }`}
                style={{ marginLeft: level * 24 }}
                onClick={() => hasChildren && setExpanded(!expanded)}
            >
                {hasChildren ? (
                    <span className="text-muted-foreground">
                        {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </span>
                ) : (
                    <span className="w-4" />
                )}
                <Layers className="h-4 w-4 text-muted-foreground" />
                <div className="flex-1">
                    <div className="flex items-center gap-2">
                        <span className="font-mono font-medium">{assembly.assemblyNumber}</span>
                        <span className="text-muted-foreground">—</span>
                        <span>{assembly.name}</span>
                    </div>
                    {assembly.description && (
                        <p className="text-xs text-muted-foreground">{assembly.description}</p>
                    )}
                </div>
                <Badge variant="outline" className={STATUS_COLORS[assembly.status] || ''}>
                    {assembly.status.replace('_', ' ')}
                </Badge>
                <div className="flex items-center gap-2 w-32">
                    <Progress value={progress} className="h-2" />
                    <span className="text-xs font-medium w-8">{progress}%</span>
                </div>
                {assembly.scheduledDate && (
                    <div className="text-xs text-muted-foreground">
                        Due: {new Date(assembly.scheduledDate).toLocaleDateString()}
                    </div>
                )}
            </div>
            {hasChildren && expanded && (
                <div className="mt-1">
                    {assembly.children.map(child => (
                        <AssemblyItem key={child.id} assembly={child} level={level + 1} />
                    ))}
                </div>
            )}
        </div>
    )
}

export function AssembliesTree({ assemblies }: AssembliesTreeProps) {
    // Build tree structure (show only root-level assemblies)
    const rootAssemblies = assemblies.filter(a => !a.parentId)

    if (rootAssemblies.length === 0) {
        return (
            <div className="text-center py-12 text-muted-foreground">
                <Layers className="mx-auto h-12 w-12 mb-4 opacity-50" />
                <p>No assemblies defined yet.</p>
                <p className="text-sm">Create assemblies to group parts for fabrication.</p>
            </div>
        )
    }

    return (
        <div className="space-y-2">
            {rootAssemblies.map(assembly => (
                <AssemblyItem key={assembly.id} assembly={assembly} />
            ))}
        </div>
    )
}

// Summary cards for assembly overview
export function AssemblySummary({ assemblies }: { assemblies: Assembly[] }) {
    const total = assemblies.length
    const notStarted = assemblies.filter(a => a.status === 'NOT_STARTED').length
    const inProgress = assemblies.filter(a => a.status === 'IN_PROGRESS').length
    const assembled = assemblies.filter(a => a.status === 'ASSEMBLED' || a.status === 'QC_PASSED').length
    const shipped = assemblies.filter(a => a.status === 'SHIPPED').length

    return (
        <div className="grid grid-cols-5 gap-4 mb-6">
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Total</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{total}</div>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Not Started</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold text-gray-600">{notStarted}</div>
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
                    <CardTitle className="text-sm font-medium text-muted-foreground">Assembled</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold text-green-600">{assembled}</div>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Shipped</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold text-purple-600">{shipped}</div>
                </CardContent>
            </Card>
        </div>
    )
}
