'use client'

import {
    Table,
    TableHeader,
    TableRow,
    TableBody,
    TableCell,
    TableHeaderCell,
    Button,
    Checkbox,
    Menu,
    MenuTrigger,
    MenuList,
    MenuItem,
    MenuPopover,
    MenuDivider,
    Badge,
    makeStyles,
    tokens,
    Avatar,
    Text,
    Link,
    ProgressBar,
    shorthands
} from "@fluentui/react-components";
import {
    MoreHorizontalRegular,
    EditRegular,
    CheckmarkCircleRegular,
    DeleteRegular,
    BoxRegular, // Replaces Package
    CutRegular, // Replaces Scissors
    DocumentRegular,
    ClipboardTaskRegular, // Work Order
    ArrowSwapRegular
} from "@fluentui/react-icons";
import { useState } from 'react'
import { toast } from 'sonner'
import { togglePartSource, deletePart, finishPart } from '@/app/actions/parts'
import { togglePlatePartSource, deletePlatePart, updatePlatePartStatus } from '@/app/actions/plateparts'
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

const useStyles = makeStyles({
    root: {
        display: "flex",
        flexDirection: "column",
        gap: "16px",
    },
    toolbar: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "12px",
        gap: "12px", // Ensure spacing between items
        backgroundColor: tokens.colorNeutralBackground2,
        ...shorthands.borderRadius(tokens.borderRadiusMedium),
        border: `1px solid ${tokens.colorNeutralStroke2}`,
    },
    tableContainer: {
        border: `1px solid ${tokens.colorNeutralStroke1}`,
        ...shorthands.borderRadius(tokens.borderRadiusMedium),
        overflowX: "auto",
        boxShadow: tokens.shadow2,
    },
    partLink: {
        fontWeight: "bold",
        cursor: "pointer",
        color: tokens.colorBrandForeground1,
        "&:hover": {
            textDecoration: "underline",
        }
    },
    mono: {
        fontFamily: tokens.fontFamilyMonospace
    },
    headerCell: {
        fontWeight: "bold",
        textTransform: "uppercase",
        fontSize: "11px",
        color: tokens.colorNeutralForeground2,
        letterSpacing: "0.05em",
    }
});

export function UnifiedPartsTable({ items, projectId }: UnifiedPartsTableProps) {
    const styles = useStyles();
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
    const [woPieceIds, setWoPieceIds] = useState<{ id: string, type: 'part' | 'plate' }[]>([])

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
        const pieceIds: { id: string, type: 'part' | 'plate' }[] = []

        selectedItems.forEach(item => {
            if (item.data.pieces && Array.isArray(item.data.pieces)) {
                item.data.pieces.forEach((p: any) => pieceIds.push({ id: p.id, type: item.kind }))
            }
        })

        if (pieceIds.length === 0) {
            toast.error("No pieces found in selected parts.")
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
                window.location.reload();
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
                window.location.reload();
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
                window.location.reload();
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
            setLoadingId(assemblyId)
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
            <div className={styles.root}>
                <div style={{ textAlign: 'center', padding: '48px', backgroundColor: tokens.colorNeutralBackground2, borderRadius: tokens.borderRadiusMedium }}>
                    <BoxRegular style={{ fontSize: '48px', color: tokens.colorNeutralForeground3, marginBottom: '16px' }} />
                    <Text block size={400} weight="semibold" style={{ color: tokens.colorNeutralForeground3 }}>No parts in this list.</Text>
                </div>
            </div>
        )
    }

    return (
        <div className={styles.root}>
            {/* Toolbar */}
            <div className={styles.toolbar}>
                <Text size={300} style={{ color: tokens.colorNeutralForeground2 }}>
                    {selectedIds.length > 0
                        ? `${selectedIds.length} selected`
                        : 'Select parts to process'
                    }
                </Text>
                {selectedIds.length > 0 && (
                    <Button
                        size="small"
                        icon={<ClipboardTaskRegular />}
                        appearance="primary"
                        onClick={handleCreateWO}
                    >
                        Create Work Order ({selectedIds.length})
                    </Button>
                )}
            </div>

            <div className={styles.tableContainer}>
                <Table size="small" style={{ minWidth: "1100px" }}>
                    <TableHeader>
                        <TableRow style={{ backgroundColor: tokens.colorNeutralBackground2 }}>
                            <TableHeaderCell style={{ width: '40px' }} className={styles.headerCell}>
                                <Checkbox
                                    checked={allSelected ? true : selectedIds.length > 0 ? "mixed" : false}
                                    onChange={handleSelectAll}
                                />
                            </TableHeaderCell>
                            <TableHeaderCell className={styles.headerCell}>Part #</TableHeaderCell>
                            <TableHeaderCell className={styles.headerCell}>Type</TableHeaderCell>
                            <TableHeaderCell style={{ width: '40px' }} className={styles.headerCell}>Dwng</TableHeaderCell>
                            <TableHeaderCell className={styles.headerCell}>Description</TableHeaderCell>
                            <TableHeaderCell className={styles.headerCell}>Dimensions</TableHeaderCell>
                            <TableHeaderCell className={styles.headerCell}>Grade</TableHeaderCell>
                            <TableHeaderCell style={{ textAlign: 'right' }} className={styles.headerCell}>Qty</TableHeaderCell>
                            <TableHeaderCell style={{ textAlign: 'right' }} className={styles.headerCell}>Weight</TableHeaderCell>
                            <TableHeaderCell style={{ width: '160px' }} className={styles.headerCell}>Status / Progress</TableHeaderCell>
                            <TableHeaderCell style={{ width: '40px' }} className={styles.headerCell}></TableHeaderCell>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {items.map((item) => {
                            const data = item.data
                            const isPart = item.kind === 'part'
                            const id = data.id

                            // Derived values
                            const dimensions = isPart
                                ? (data.profile
                                    ? `${data.profile.type} - ${data.profile.dimensions} - ${data.length}mm`
                                    : (data.profileType && data.profileDimensions
                                        ? `${data.profileType} - ${data.profileDimensions} - ${data.length}mm`
                                        : '-'))
                                : `${data.thickness}mm x ${data.width}mm x ${data.length}mm`

                            const weight = isPart
                                ? (data.unitWeight * data.quantity)
                                : (data.unitWeight * data.quantity)

                            const progress = isPart ? getProgress(data.pieces) : 0

                            return (
                                <TableRow
                                    key={id}
                                    style={{
                                        backgroundColor: selectedIds.includes(id) ? tokens.colorBrandBackground2 : undefined
                                    }}
                                >
                                    <TableCell>
                                        <Checkbox
                                            checked={selectedIds.includes(id)}
                                            onChange={() => handleSelect(id)}
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <span onClick={() => handleOpenDetails(item)} className={styles.partLink + " " + styles.mono}>
                                            {data.partNumber}
                                        </span>
                                    </TableCell>
                                    <TableCell>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                                {isPart ? (
                                                    <Badge appearance="outline" shape="rounded" icon={<BoxRegular />}>
                                                        Profile
                                                    </Badge>
                                                ) : (
                                                    <Badge appearance="filled" shape="rounded" color="brand" icon={<CutRegular />}>
                                                        Plate
                                                    </Badge>
                                                )}
                                                {isPart && data.isSplit && (
                                                    <Badge appearance="tint" color="warning" shape="rounded" size="small">1/2</Badge>
                                                )}
                                            </div>
                                            {isPart && data.cutAngles && (
                                                <Text size={100} style={{ color: tokens.colorNeutralForeground4 }}>
                                                    Angles: {data.cutAngles}
                                                </Text>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        {(isPart ? data.drawingRef : data.dxfStoragePath) && (
                                            <Link
                                                href={`/api/certificates/view?path=${encodeURIComponent(isPart ? data.drawingRef : data.dxfStoragePath)}&bucket=projects`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                title="Open Drawing"
                                            >
                                                <DocumentRegular />
                                            </Link>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
                                            {data.description || '-'}
                                        </Text>
                                    </TableCell>
                                    <TableCell>
                                        <Text size={200}>{dimensions}</Text>
                                    </TableCell>
                                    <TableCell>
                                        {data.grade?.name || '-'}
                                    </TableCell>
                                    <TableCell style={{ textAlign: 'right', fontWeight: 'bold' }}>
                                        {data.quantity}
                                    </TableCell>
                                    <TableCell style={{ textAlign: 'right' }}>
                                        <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
                                            {weight > 0 ? `${weight.toFixed(1)} kg` : '-'}
                                        </Text>
                                    </TableCell>
                                    <TableCell>
                                        {isPart ? (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <ProgressBar value={progress} max={100} style={{ flex: 1 }} color={progress === 100 ? "success" : "brand"} />
                                                <Text font="monospace" size={100} weight="bold">{progress}%</Text>
                                            </div>
                                        ) : (
                                            <Badge appearance="tint" color={data.status === 'RECEIVED' ? "success" : "brand"}>
                                                {data.status}
                                            </Badge>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <Menu>
                                            <MenuTrigger disableButtonEnhancement>
                                                <Button appearance="subtle" icon={<MoreHorizontalRegular />} size="small" disabled={loadingId === id} />
                                            </MenuTrigger>
                                            <MenuPopover>
                                                <MenuList>
                                                    <MenuItem icon={<EditRegular />} onClick={() => handleEdit(item)}>Edit</MenuItem>
                                                    <MenuDivider />
                                                    <MenuItem icon={<CheckmarkCircleRegular />} onClick={() => handleFinish(item)}>Mark Finished</MenuItem>
                                                    <MenuItem icon={<ArrowSwapRegular />} onClick={() => handleToggleSource(item)}>
                                                        {isPart
                                                            ? (data.isOutsourcedCut ? "Make In-House" : "Outsource Cutting")
                                                            : (data.isOutsourced ? "Make In-House" : "Outsource")
                                                        }
                                                    </MenuItem>
                                                    <MenuDivider />
                                                    <MenuItem icon={<DeleteRegular />} onClick={() => handleDelete(item)} style={{ color: tokens.colorPaletteRedForeground1 }}>Delete</MenuItem>
                                                </MenuList>
                                            </MenuPopover>
                                        </Menu>
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
                />
            )}

            {itemToReceive && (
                <ReceiveItemsDialog
                    open={receiveDialogOpen}
                    onOpenChange={setReceiveDialogOpen}
                    part={itemToReceive}
                />
            )}

            {selectedAssembly && (
                <AssemblyDetailsDialog
                    open={assemblyDetailsOpen}
                    onOpenChange={setAssemblyDetailsOpen}
                    assembly={selectedAssembly}
                />
            )}

            {/* Create Work Order Dialog */}
            <CreateWorkOrderDialog
                open={createWODialogOpen}
                onOpenChange={setCreateWODialogOpen}
                selectedParts={woPieceIds.filter(x => x.type === 'part').map(x => x.id)}
                selectedPlates={woPieceIds.filter(x => x.type === 'plate').map(x => x.id)}
                projectId={projectId}
                onSuccess={() => {
                    setSelectedIds([])
                    toast.success("Work Order Created")
                }}
            />
        </div>
    )
}
