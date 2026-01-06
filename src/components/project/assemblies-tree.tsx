'use client'

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Checkbox } from "@/components/ui/checkbox"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { ChevronDown, ChevronRight, Layers, Package, Calendar, Weight, Check, Wrench, MoreHorizontal, Pencil, CheckCircle, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { CreateAssemblyWODialog } from './create-assembly-wo-dialog'
import { finishPart } from '@/app/actions/parts'
import { updatePlatePartStatus } from '@/app/actions/plateparts'
import { removePartFromAssembly, removePlatePartFromAssembly } from '@/app/actions/assemblies'
import { AssemblyDetailsDialog } from './assembly-details-dialog'

interface Assembly {
    id: string
    assemblyNumber: string
    name: string
    description: string | null
    status: string
    sequence: number
    scheduledDate: Date | null
    parentId: string | null
    notes: string | null
    children: Assembly[]
    assemblyParts: {
        part: {
            id: string
            partNumber: string
            description: string | null
            length: number | null
            unitWeight: number | null
            profile: { type: string; dimensions: string } | null
            profileType?: string | null
            profileDimensions?: string | null
            pieces: { status: string }[]
        }
        quantityInAssembly: number
    }[]
    plateAssemblyParts: {
        platePart: {
            id: string
            partNumber: string
            description: string | null
            material: string | null
            width: number | null
            length: number | null
            unitWeight: number | null
            status: string
            receivedQty: number
        }
        quantityInAssembly: number
    }[]
}

interface AssembliesTreeProps {
    assemblies: Assembly[]
    projectId: string
}

const STATUS_COLORS: Record<string, string> = {
    'NOT_STARTED': 'bg-gray-100 text-gray-800',
    'IN_PROGRESS': 'bg-blue-100 text-blue-800',
    'ASSEMBLED': 'bg-yellow-100 text-yellow-800',
    'QC_PASSED': 'bg-green-100 text-green-800',
    'SHIPPED': 'bg-purple-100 text-purple-800',
}

function getAssemblyProgress(assembly: Assembly): { percent: number; ready: number; total: number } {
    let totalPieces = 0
    let readyPieces = 0

    // Profiles
    assembly.assemblyParts.forEach(ap => {
        const needed = ap.quantityInAssembly
        const ready = ap.part.pieces.filter(p => p.status === 'READY').length
        totalPieces += needed
        readyPieces += Math.min(ready, needed)
    })

    // Plates
    assembly.plateAssemblyParts?.forEach(pap => {
        const needed = pap.quantityInAssembly
        // Plate is ready if RECEIVED or QC_PASSED or based on receivedQty if available?
        // Using receivedQty is safer given the schema has it
        const ready = pap.platePart.receivedQty || 0
        totalPieces += needed
        readyPieces += Math.min(ready, needed)
    })

    return {
        percent: totalPieces > 0 ? Math.round((readyPieces / totalPieces) * 100) : 0,
        ready: readyPieces,
        total: totalPieces
    }
}

function getTotalWeight(assembly: Assembly): number {
    const profileWeight = assembly.assemblyParts.reduce((sum, ap) => {
        return sum + (ap.part.unitWeight || 0) * ap.quantityInAssembly
    }, 0)

    const plateWeight = (assembly.plateAssemblyParts || []).reduce((sum, pap) => {
        return sum + (pap.platePart.unitWeight || 0) * pap.quantityInAssembly
    }, 0)

    return profileWeight + plateWeight
}

function AssemblyItem({
    assembly,
    level = 0,
    selected,
    onSelect,
    onViewDetails
}: {
    assembly: Assembly
    level?: number
    selected: boolean
    onSelect: (id: string, checked: boolean) => void
    onViewDetails: (assembly: Assembly) => void
}) {
    const [expanded, setExpanded] = useState(false)
    const [detailsOpen, setDetailsOpen] = useState(false)
    const [loadingId, setLoadingId] = useState<string | null>(null)
    const hasChildren = assembly.children && assembly.children.length > 0
    const progress = getAssemblyProgress(assembly)
    const totalWeight = getTotalWeight(assembly)

    // Combine parts for display
    const allParts = [
        ...assembly.assemblyParts.map(ap => ({
            id: ap.part.id,
            kind: 'PROFILE',
            partNumber: ap.part.partNumber,
            description: ap.part.description,
            detail: ap.part.profile
                ? `${ap.part.profile.type} ${ap.part.profile.dimensions}`
                : (ap.part.profileType && ap.part.profileDimensions)
                    ? `${ap.part.profileType} ${ap.part.profileDimensions}`
                    : '-',
            quantity: ap.quantityInAssembly,
            ready: ap.part.pieces.filter(p => p.status === 'READY').length,
            unitWeight: ap.part.unitWeight || 0
        })),
        ...(assembly.plateAssemblyParts || []).map(pap => ({
            id: pap.platePart.id,
            kind: 'PLATE',
            partNumber: pap.platePart.partNumber,
            description: pap.platePart.description,
            detail: `${pap.platePart.material || ''} ${pap.platePart.width}x${pap.platePart.length}`,
            quantity: pap.quantityInAssembly,
            ready: pap.platePart.receivedQty || 0,
            unitWeight: pap.platePart.unitWeight || 0
        }))
    ]

    const handleRowClick = () => {
        setDetailsOpen(!detailsOpen)
    }

    const handleChevronClick = (e: React.MouseEvent) => {
        e.stopPropagation()
        setExpanded(!expanded)
    }

    const handleCheckboxClick = (e: React.MouseEvent) => {
        e.stopPropagation()
    }

    const handleRemove = async (partId: string, kind: string) => {
        if (!window.confirm("Are you sure you want to remove this part from the assembly?")) return

        setLoadingId(partId)
        try {
            let res
            if (kind === 'PROFILE') {
                res = await removePartFromAssembly(assembly.id, partId)
            } else {
                res = await removePlatePartFromAssembly(assembly.id, partId)
            }

            if (res.success) {
                toast.success('Part removed from assembly')
            } else {
                toast.error(res.error || 'Failed to remove part')
            }
        } catch (e) {
            toast.error('Failed to remove')
        } finally {
            setLoadingId(null)
        }
    }

    const handleFinish = async (partId: string, kind: string) => {
        setLoadingId(partId)
        try {
            let res
            if (kind === 'PROFILE') {
                res = await finishPart(partId)
            } else {
                res = await updatePlatePartStatus(partId, 'RECEIVED')
            }

            if (res.success) {
                toast.success('Part marked as finished/received')
            } else {
                toast.error(res.error || 'Failed to finish part')
            }
        } catch (e) {
            toast.error('Failed to finish')
        } finally {
            setLoadingId(null)
        }
    }

    const handleEdit = (partId: string) => {
        toast.info("Edit feature coming soon")
    }

    return (
        <div className="w-full">
            {/* Main Row */}
            <div
                className={`flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 cursor-pointer border-l-4 transition-colors ${progress.percent === 100 ? 'border-l-green-500' : progress.percent > 0 ? 'border-l-blue-500' : 'border-l-gray-300'
                    } ${detailsOpen ? 'bg-muted/50' : ''} ${selected ? 'ring-2 ring-primary ring-offset-1' : ''}`}
                style={{ marginLeft: level * 24 }}
                onClick={handleRowClick}
            >
                {/* Selection Checkbox */}
                <div onClick={handleCheckboxClick}>
                    <Checkbox
                        checked={selected}
                        onCheckedChange={(checked) => onSelect(assembly.id, checked === true)}
                    />
                </div>

                {hasChildren ? (
                    <span
                        className="text-muted-foreground hover:text-foreground"
                        onClick={handleChevronClick}
                    >
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
                    <Progress value={progress.percent} className="h-2" />
                    <span className="text-xs font-medium w-8">{progress.percent}%</span>
                </div>
                <div className="text-xs text-muted-foreground w-16 text-right">
                    {allParts.length} parts
                </div>
                {assembly.scheduledDate && (
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(assembly.scheduledDate).toLocaleDateString()}
                    </div>
                )}
            </div>

            {/* Details Sub-Row */}
            {detailsOpen && (
                <div
                    className="ml-8 mr-2 mb-4 mt-1 p-4 bg-muted/30 rounded-lg border"
                    style={{ marginLeft: level * 24 + 32 }}
                >
                    {/* Summary Cards */}
                    <div className="grid grid-cols-4 gap-4 mb-4">
                        <div className="bg-background p-3 rounded border">
                            <div className="text-xs text-muted-foreground uppercase mb-1">Parts</div>
                            <div className="text-lg font-semibold flex items-center gap-2">
                                <Package className="h-4 w-4 text-muted-foreground" />
                                {allParts.length}
                            </div>
                        </div>
                        <div className="bg-background p-3 rounded border">
                            <div className="text-xs text-muted-foreground uppercase mb-1">Pieces</div>
                            <div className="text-lg font-semibold">
                                <span className="text-green-600">{progress.ready}</span>
                                <span className="text-muted-foreground"> / {progress.total}</span>
                            </div>
                        </div>
                        <div className="bg-background p-3 rounded border">
                            <div className="text-xs text-muted-foreground uppercase mb-1">Weight</div>
                            <div className="text-lg font-semibold flex items-center gap-2">
                                <Weight className="h-4 w-4 text-muted-foreground" />
                                {totalWeight.toFixed(1)} kg
                            </div>
                        </div>
                        <div className="text-lg font-semibold flex items-center gap-2">
                            <Weight className="h-4 w-4 text-muted-foreground" />
                            {totalWeight.toFixed(1)} kg
                        </div>
                    </div>
                    <div className="flex flex-col gap-2">
                        <div className="bg-background p-3 rounded border flex-1 flex flex-col justify-center items-center">
                            <Badge variant="outline" className={`${STATUS_COLORS[assembly.status] || ''} text-sm mb-1`}>
                                {assembly.status.replace('_', ' ')}
                            </Badge>
                        </div>
                        <Button size="sm" variant="outline" className="w-full text-xs h-8" onClick={(e) => { e.stopPropagation(); onViewDetails(assembly); }}>
                            View Details & Traceability
                        </Button>
                    </div>

                    {/* Parts Table */}
                    {allParts.length > 0 ? (
                        <div className="border rounded overflow-hidden bg-background">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-muted/50">
                                        <TableHead>Part #</TableHead>
                                        <TableHead>Type/Profile</TableHead>
                                        <TableHead>Description</TableHead>
                                        <TableHead className="text-center">Qty</TableHead>
                                        <TableHead className="text-center">Ready</TableHead>
                                        <TableHead className="text-right">Weight</TableHead>
                                        <TableHead className="w-10"></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {allParts.map((item, idx) => {
                                        const isComplete = item.ready >= item.quantity
                                        return (
                                            <TableRow key={idx}>
                                                <TableCell className="font-mono flex items-center gap-2">
                                                    {item.partNumber}
                                                    {item.kind === 'PLATE' && <Badge variant="secondary" className="text-[10px] h-4 px-1">PL</Badge>}
                                                </TableCell>
                                                <TableCell>
                                                    {item.detail}
                                                </TableCell>
                                                <TableCell className="text-muted-foreground">
                                                    {item.description || '-'}
                                                </TableCell>
                                                <TableCell className="text-center">{item.quantity}</TableCell>
                                                <TableCell className="text-center">
                                                    <span className={isComplete ? 'text-green-600 font-medium' : item.ready > 0 ? 'text-orange-600' : 'text-muted-foreground'}>
                                                        {item.ready}
                                                        {isComplete && <Check className="h-3 w-3 inline ml-1" />}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    {item.unitWeight
                                                        ? `${(item.unitWeight * item.quantity).toFixed(1)} kg`
                                                        : '-'
                                                    }
                                                </TableCell>
                                                <TableCell>
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" disabled={loadingId === item.id}>
                                                                <MoreHorizontal className="h-4 w-4" />
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end">
                                                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                                            <DropdownMenuItem onClick={() => handleEdit(item.id)}>
                                                                <Pencil className="mr-2 h-4 w-4" /> Edit
                                                            </DropdownMenuItem>
                                                            <DropdownMenuSeparator />
                                                            <DropdownMenuItem onClick={() => handleFinish(item.id, item.kind)}>
                                                                <CheckCircle className="mr-2 h-4 w-4 text-green-600" /> Mark Finished
                                                            </DropdownMenuItem>
                                                            <DropdownMenuSeparator />
                                                            <DropdownMenuItem onClick={() => handleRemove(item.id, item.kind)} className="text-red-600">
                                                                <Trash2 className="mr-2 h-4 w-4" /> Remove
                                                            </DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </TableCell>
                                            </TableRow>
                                        )
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    ) : (
                        <div className="text-center py-6 text-muted-foreground bg-background rounded border">
                            <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
                            <p>No parts in this assembly</p>
                        </div>
                    )}

                    {/* Notes */}
                    {/* Notes */}
                    {assembly.notes && (
                        <div className="mt-4 p-3 bg-background border rounded">
                            <div className="text-xs text-muted-foreground uppercase mb-1">Notes</div>
                            <p className="text-sm">{assembly.notes}</p>
                        </div>
                    )}

                </div>
            )}

            {/* Child Assemblies */}
            {hasChildren && expanded && (
                <div className="mt-1">
                    {assembly.children.map(child => (
                        <AssemblyItem
                            key={child.id}
                            assembly={child}
                            level={level + 1}
                            selected={selected}
                            onSelect={onSelect}
                            onViewDetails={onViewDetails}
                        />
                    ))}
                </div>
            )}
        </div>
    )
}

export function AssembliesTree({ assemblies, projectId }: AssembliesTreeProps) {
    const [selectedIds, setSelectedIds] = useState<string[]>([])
    const [woDialogOpen, setWoDialogOpen] = useState(false)
    const [detailsAssembly, setDetailsAssembly] = useState<Assembly | null>(null)

    const rootAssemblies = assemblies.filter(a => !a.parentId)

    const handleSelect = (id: string, checked: boolean) => {
        if (checked) {
            setSelectedIds([...selectedIds, id])
        } else {
            setSelectedIds(selectedIds.filter(i => i !== id))
        }
    }

    const handleSelectAll = () => {
        if (selectedIds.length === assemblies.length) {
            setSelectedIds([])
        } else {
            setSelectedIds(assemblies.map(a => a.id))
        }
    }

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
        <div className="space-y-4">
            {/* Selection Toolbar */}
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border">
                <div className="flex items-center gap-3">
                    <Checkbox
                        checked={selectedIds.length === assemblies.length}
                        onCheckedChange={handleSelectAll}
                    />
                    <span className="text-sm text-muted-foreground">
                        {selectedIds.length > 0
                            ? `${selectedIds.length} selected`
                            : 'Select assemblies'
                        }
                    </span>
                </div>
                {selectedIds.length > 0 && (
                    <Button
                        size="sm"
                        onClick={() => setWoDialogOpen(true)}
                        className="gap-2"
                    >
                        <Wrench className="h-4 w-4" />
                        Create Work Order ({selectedIds.length})
                    </Button>
                )}
            </div>

            {/* Assembly List */}
            <div className="space-y-2">
                {rootAssemblies.map(assembly => (
                    <AssemblyItem
                        key={assembly.id}
                        assembly={assembly}
                        selected={selectedIds.includes(assembly.id)}
                        onSelect={handleSelect}
                        onViewDetails={setDetailsAssembly}
                    />
                ))}
            </div>

            <AssemblyDetailsDialog
                open={!!detailsAssembly}
                onOpenChange={(open) => !open && setDetailsAssembly(null)}
                assembly={detailsAssembly}
                projectId={projectId}
            />

            {/* Create WO Dialog */}
            <CreateAssemblyWODialog
                projectId={projectId}
                selectedAssemblyIds={selectedIds}
                open={woDialogOpen}
                onOpenChange={(open) => {
                    setWoDialogOpen(open)
                    if (!open) setSelectedIds([])  // Clear selection when dialog closes
                }}
            />
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
