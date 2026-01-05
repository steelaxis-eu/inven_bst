'use client'

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Checkbox } from "@/components/ui/checkbox"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { ChevronDown, ChevronRight, Package, MoreHorizontal, RefreshCw, Scissors, Factory, ClipboardList, FileText } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { togglePartSource, deletePart, finishPart } from '@/app/actions/parts'
import { togglePlatePartSource, deletePlatePart, updatePlatePartStatus } from '@/app/actions/plateparts'
import { cn } from '@/lib/utils'
import { Trash2, CheckCircle, Pencil } from 'lucide-react'
import { PartDetailsDialog } from './part-details-dialog'
import { CreateWorkOrderDialog } from './create-work-order-dialog'
import { PlateDetailsDialog } from './plate-details-dialog'
import { ReceiveItemsDialog } from './receive-items-dialog'
import { AssemblyDetailsDialog } from './assembly-details-dialog'
import { getAssembly } from '@/app/actions/assemblies'

// Union type for the table
export type UnifiedPartItem =
    | { kind: 'part', data: any }
    | { kind: 'plate', data: any }

interface UnifiedPartsTableProps {
    items: UnifiedPartItem[]
    projectId: string
}

export function UnifiedPartsTable({ items, projectId }: UnifiedPartsTableProps) {
    const [selectedIds, setSelectedIds] = useState<string[]>([])
    const [loadingId, setLoadingId] = useState<string | null>(null)
    const [detailsOpen, setDetailsOpen] = useState(false)
    const [selectedPart, setSelectedPart] = useState<any>(null)
    const [selectedPlate, setSelectedPlate] = useState<any>(null)
    const [plateDetailsOpen, setPlateDetailsOpen] = useState(false)

    // Receive Dialog State
    const [receiveDialogOpen, setReceiveDialogOpen] = useState(false)
    const [itemToReceive, setItemToReceive] = useState<any>(null)

    // Assembly Details State
    const [assemblyDetailsOpen, setAssemblyDetailsOpen] = useState(false)
    const [selectedAssembly, setSelectedAssembly] = useState<any>(null)

    // Create Work Order State
    const [createWODialogOpen, setCreateWODialogOpen] = useState(false)
    const [woPieceIds, setWoPieceIds] = useState<string[]>([])

    const handleOpenDetails = (item: UnifiedPartItem) => {
        if (item.kind === 'part') {
            setSelectedPart(item.data)
            setDetailsOpen(true)
        } else {
            setSelectedPlate(item.data)
            setPlateDetailsOpen(true)
        }
    }

    const allIds = items.map(i => i.data.id)
    const allSelected = items.length > 0 && selectedIds.length === items.length

    const handleSelect = (id: string) => {
        if (selectedIds.includes(id)) {
            setSelectedIds(selectedIds.filter(i => i !== id))
        } else {
            setSelectedIds([...selectedIds, id])
        }
    }

    const handleSelectAll = () => {
        if (allSelected) {
            setSelectedIds([])
        } else {
            setSelectedIds(allIds)
        }
    }

    const handleCreateWO = () => {
        const selectedItems = items.filter(i => selectedIds.includes(i.data.id))
        const pieceIds: string[] = []

        selectedItems.forEach(item => {
            if (item.data.pieces && Array.isArray(item.data.pieces)) {
                // Determine which pieces to include?
                // For now, include ALL pieces of the selected parts
                // The User optimizes or filters later (or we could select specific pieces, but table selects Parts)
                item.data.pieces.forEach((p: any) => pieceIds.push(p.id))
            }
        })

        if (pieceIds.length === 0) {
            toast.error("No pieces found in selected parts. (Try generating pieces first?)")
            return
        }

        setWoPieceIds(pieceIds)
        setCreateWODialogOpen(true)
    }

    const handleToggleSource = async (item: UnifiedPartItem) => {
        const id = item.data.id
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

    const handleDelete = async (item: UnifiedPartItem) => {
        if (!window.confirm("Are you sure you want to delete this part?")) return

        const id = item.data.id
        setLoadingId(id)

        try {
            let res
            if (item.kind === 'part') {
                res = await deletePart(id)
            } else {
                res = await deletePlatePart(id)
            }

            if (res.success) {
                toast.success('Part deleted')
            } else {
                toast.error(res.error || 'Failed to delete part')
            }
        } catch (e) {
            toast.error('Failed to delete')
        } finally {
            setLoadingId(null)
        }
    }

    const handleFinish = async (item: UnifiedPartItem) => {
        const data = item.data
        const isOutsourced = item.kind === 'part' ? data.isOutsourcedCut : data.isOutsourced

        if (isOutsourced) {
            // Open Receive Dialog
            setItemToReceive({
                id: data.id,
                type: item.kind,
                partNumber: data.partNumber,
                description: data.description,
                quantity: data.quantity,
                pieces: data.pieces // Assumes pieces are included in data
            })
            setReceiveDialogOpen(true)
            return
        }

        // In-House Logic
        const id = item.data.id
        setLoadingId(id)

        try {
            let res
            if (item.kind === 'part') {
                res = await finishPart(id)
            } else {
                res = await updatePlatePartStatus(id, 'RECEIVED')
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

    const handleEdit = (item: UnifiedPartItem) => {
        handleOpenDetails(item)
    }

    const handleOpenAssembly = async (assemblyId: string) => {
        try {
            setLoadingId(assemblyId) // usage of loadingId might be confusing here as it disables buttons, but okay for now
            const assembly = await getAssembly(assemblyId)
            if (assembly) {
                setSelectedAssembly(assembly)
                setAssemblyDetailsOpen(true)
            } else {
                toast.error("Assembly not found")
            }
        } catch (error) {
            toast.error("Failed to load assembly details")
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
        <div className="space-y-4">
            {/* Toolbar */}
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border">
                <div className="flex items-center gap-3">
                    <span className="text-sm text-muted-foreground">
                        {selectedIds.length > 0
                            ? `${selectedIds.length} selected`
                            : 'Select parts to process'
                        }
                    </span>
                </div>
                {selectedIds.length > 0 && (
                    <Button
                        size="sm"
                        onClick={handleCreateWO}
                        className="gap-2"
                    >
                        <ClipboardList className="h-4 w-4" />
                        Create Work Order ({selectedIds.length})
                    </Button>
                )}
            </div>

            <div className="border rounded-lg overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-muted/50">
                            <TableHead className="w-10">
                                <Checkbox
                                    checked={allSelected}
                                    onCheckedChange={handleSelectAll}
                                />
                            </TableHead>
                            <TableHead>Part #</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead className="w-10">Dwng</TableHead>
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

                            // Derived values
                            const dimensions = isPart
                                ? (data.profile ? `${data.profile.type} ${data.profile.dimensions} (${data.length}mm)` : '-')
                                : `${data.thickness}mm x ${data.width}mm x ${data.length}mm`

                            const weight = isPart
                                ? (data.unitWeight * data.quantity)
                                : (data.unitWeight * data.quantity)

                            const progress = isPart ? getProgress(data.pieces) : 0

                            return (
                                <TableRow key={id} className={`hover:bg-muted/30 ${selectedIds.includes(id) ? 'bg-muted/50' : ''}`}>
                                    <TableCell>
                                        <Checkbox
                                            checked={selectedIds.includes(id)}
                                            onCheckedChange={() => handleSelect(id)}
                                        />
                                    </TableCell>
                                    <TableCell className="font-mono font-medium">
                                        <button
                                            onClick={() => handleOpenDetails(item)}
                                            className="hover:underline text-primary text-left"
                                        >
                                            {data.partNumber}
                                        </button>
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
                                    <TableCell>
                                        {(isPart ? data.drawingRef : data.dxfStoragePath) && (
                                            <a
                                                href={`/api/certificates/view?path=${encodeURIComponent(isPart ? data.drawingRef : data.dxfStoragePath)}&bucket=projects`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-blue-600 hover:text-blue-800"
                                                title="Open Drawing"
                                            >
                                                <FileText className="h-4 w-4" />
                                            </a>
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
                                                data.status === 'RECEIVED' ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300 border-green-200 dark:border-green-800' :
                                                    data.status === 'ORDERED' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 border-blue-200 dark:border-blue-800' :
                                                        'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300 border-gray-200 dark:border-gray-700'
                                            )}>
                                                {data.status}
                                            </Badge>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0" disabled={loadingId === id}>
                                                    <MoreHorizontal className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                                <DropdownMenuItem onClick={() => handleEdit(item)}>
                                                    <Pencil className="mr-2 h-4 w-4" /> Edit
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem onClick={() => handleFinish(item)}>
                                                    <CheckCircle className="mr-2 h-4 w-4 text-green-600" /> Mark Finished
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => handleToggleSource(item)}>
                                                    <Factory className="mr-2 h-4 w-4" />
                                                    {isPart
                                                        ? (data.isOutsourcedCut ? "Make In-House" : "Outsource Cutting")
                                                        : (data.isOutsourced ? "Make In-House" : "Outsource")
                                                    }
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem onClick={() => handleDelete(item)} className="text-red-600">
                                                    <Trash2 className="mr-2 h-4 w-4" /> Delete
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

            {selectedPart && (
                <PartDetailsDialog
                    open={detailsOpen}
                    onOpenChange={setDetailsOpen}
                    part={selectedPart}
                    projectId={projectId}
                    onUpdate={() => {
                        setDetailsOpen(false)
                        window.location.reload()
                    }}
                    onOpenAssembly={handleOpenAssembly}
                />
            )}

            {selectedPlate && (
                <PlateDetailsDialog
                    open={plateDetailsOpen}
                    onOpenChange={setPlateDetailsOpen}
                    plate={selectedPlate}
                    projectId={projectId}
                    onUpdate={() => {
                        setPlateDetailsOpen(false)
                        window.location.reload()
                    }}
                    onOpenAssembly={handleOpenAssembly}
                />
            )}

            {itemToReceive && (
                <ReceiveItemsDialog
                    open={receiveDialogOpen}
                    onOpenChange={setReceiveDialogOpen}
                    item={itemToReceive}
                    projectId={projectId}
                    onSuccess={() => {
                        window.location.reload()
                    }}
                />
            )}

            {selectedAssembly && (
                <AssemblyDetailsDialog
                    open={assemblyDetailsOpen}
                    onOpenChange={setAssemblyDetailsOpen}
                    assembly={selectedAssembly}
                    projectId={projectId}
                    onUpdate={() => {
                        // Optional: reload if needed
                    }}
                />
            )}

            {/* Create Work Order Dialog */}
            <CreateWorkOrderDialog
                open={createWODialogOpen}
                onOpenChange={setCreateWODialogOpen}
                pieceIds={woPieceIds}
                projectId={projectId}
                onSuccess={() => {
                    setSelectedIds([])
                    toast.success("Work Order Created")
                }}
            />
        </div>
    )
}
