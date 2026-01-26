'use client'

import { useState } from 'react'
import {
    Table,
    TableBody,
    TableCell,
    TableHeader,
    TableHeaderCell,
    TableRow,
    Button,
    Card,
    CardHeader,
    Badge,
    ProgressBar,
    Checkbox,
    Dialog,
    DialogSurface,
    DialogTitle,
    DialogBody,
    DialogContent,
    DialogActions,
    Text,
    Title3,
    makeStyles,
    tokens,
    shorthands
} from "@fluentui/react-components"
import {
    PlayRegular,
    CheckmarkCircleRegular,
    ClockRegular,
    ArrowRotateClockwiseRegular,
    DeleteRegular,
    DismissCircleFilled,
    RulerRegular,
    WrenchRegular,
    PrintRegular,
    ChevronDownRegular,
    ChevronRightRegular,
    ClipboardTaskRegular,
    CheckmarkRegular,
    DocumentRegular,
    ReceiptPlayRegular
} from "@fluentui/react-icons"
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
    updateWorkOrderStatus,
    updateWorkOrderItemStatus,
    activateWorkOrder,
    completeWorkOrder,
    completeCuttingWOWithWorkflow
} from '@/app/actions/workorders'
import { BatchCutDialog } from "./batch-cut-dialog"
import { MaterialPrepDialog } from "./material-prep-dialog"
import { DownloadDrawingsButton } from '@/components/work-order/download-drawings-button'

// --- Interfaces ---

interface WorkOrderItem {
    id: string
    pieceId: string | null
    status: string
    completedAt: Date | null
    notes: string | null
    piece?: {
        id: string
        partId: string
        part: {
            partNumber: string
            isSplit?: boolean
            cutAngles?: string | null
            profile?: { type: string; dimensions: string } | null
        }
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
    projectId: string
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

// --- Constants ---

const TYPE_COLORS: Record<string, string> = {
    'MATERIAL_PREP': tokens.colorPaletteBerryBackground2,
    'CUTTING': tokens.colorPaletteBlueBackground2,
    'MACHINING': tokens.colorPaletteTealBackground2,
    'FABRICATION': tokens.colorPaletteYellowBackground2,
    'WELDING': tokens.colorPaletteDarkOrangeBackground2,
    'PAINTING': tokens.colorPalettePurpleBackground2,
    'ASSEMBLY': tokens.colorPaletteGreenBackground2,
}

const ORDERED_PROCESSES = [
    'MATERIAL_PREP',
    'CUTTING',
    'MACHINING',
    'FABRICATION',
    'WELDING',
    'PAINTING',
    'ASSEMBLY',
    'QUALITY_CHECK',
    'PACKAGING'
]

const useStyles = makeStyles({
    root: {
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
    },
    processCard: {
        transition: 'all 0.2s',
        borderLeft: '4px solid transparent',
        ':hover': {
            boxShadow: tokens.shadow4,
        }
    },
    cardExpanded: {
        ...shorthands.borderColor(tokens.colorBrandStroke1),
    },
    cardHeader: {
        padding: '16px',
        display: 'grid',
        gridTemplateColumns: 'minmax(200px, 1fr) 2fr 1fr 40px',
        gap: '16px',
        alignItems: 'center',
        cursor: 'pointer',
    },
    iconBox: {
        padding: '8px',
        borderRadius: tokens.borderRadiusMedium,
        backgroundColor: tokens.colorNeutralBackground3,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
    },
    statsGrid: {
        display: 'flex',
        gap: '24px',
        justifyContent: 'center',
    },
    statItem: {
        textAlign: 'center',
    },
    progressSection: {
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
    },
    tableContainer: {
        backgroundColor: tokens.colorNeutralBackground2,
        padding: '16px',
        borderTop: `1px solid ${tokens.colorNeutralStroke2}`,
    },
    groupTitle: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        fontSize: tokens.fontSizeBase300,
        fontWeight: tokens.fontWeightSemibold,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        marginTop: '16px',
        marginBottom: '8px',
    },
    actionButtons: {
        display: 'flex',
        gap: '8px',
    },
    nestedTable: {
        paddingLeft: '16px',
        borderLeft: `4px solid ${tokens.colorBrandStroke2}`,
        margin: '8px 0',
        backgroundColor: tokens.colorNeutralBackground1,
    },
    summaryCard: {
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
    }
})

// --- Sub-Components ---

export function WorkOrderSummary({ workOrders }: { workOrders: WorkOrder[] }) {
    const styles = useStyles()
    const total = workOrders.length
    const active = workOrders.filter(w => w.status === 'IN_PROGRESS').length
    const completed = workOrders.filter(w => w.status === 'COMPLETED').length
    const highPriority = workOrders.filter(w => w.priority === 'HIGH' && w.status !== 'COMPLETED').length

    const SummaryCard = ({ title, value, color }: { title: string, value: number, color?: string }) => (
        <Card className={styles.summaryCard}>
            <Text size={200} weight="semibold" style={{ color: tokens.colorNeutralForeground3, textTransform: 'uppercase' }}>{title}</Text>
            <Title3 style={{ marginTop: '8px', color: color }}>{value}</Title3>
        </Card>
    )

    return (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '16px' }}>
            <SummaryCard title="Total Orders" value={total} />
            <SummaryCard title="Active" value={active} color={tokens.colorPaletteBlueForeground2} />
            <SummaryCard title="Completed" value={completed} color={tokens.colorPaletteGreenForeground1} />
            <SummaryCard title="High Priority" value={highPriority} color={highPriority > 0 ? tokens.colorPaletteRedForeground1 : undefined} />
        </div>
    )
}

function WorkOrderTable({
    workOrders,
    type,
    projectId
}: {
    workOrders: WorkOrder[],
    type: string,
    projectId: string
}) {
    const styles = useStyles()
    const router = useRouter()
    const [loading, setLoading] = useState<string | null>(null)
    const [selectedBatchItemIds, setSelectedBatchItemIds] = useState<string[]>([])
    const [batchCutDialogOpen, setBatchCutDialogOpen] = useState(false)
    const [completeDialogOpen, setCompleteDialogOpen] = useState(false)
    const [materialPrepDialogOpen, setMaterialPrepDialogOpen] = useState(false)
    const [activeWoForComplete, setActiveWoForComplete] = useState<WorkOrder | null>(null)
    const [machinedPieceIds, setMachinedPieceIds] = useState<string[]>([])

    // Handlers
    const handleStatusChange = async (wo: WorkOrder, status: string) => {
        if (status === 'COMPLETED' && wo.type === 'CUTTING' && wo.status === 'IN_PROGRESS') {
            setActiveWoForComplete(wo)
            setCompleteDialogOpen(true)
            return
        }

        if (status === 'COMPLETED' && wo.type === 'MATERIAL_PREP' && wo.status === 'IN_PROGRESS') {
            setActiveWoForComplete(wo)
            setMaterialPrepDialogOpen(true)
            return
        }

        setLoading(wo.id)
        let res
        if (status === 'IN_PROGRESS') {
            res = await activateWorkOrder(wo.id)
        } else if (status === 'COMPLETED') {
            res = await completeWorkOrder(wo.id)
            if (res.success && res.followUpWO) {
                toast.info(`Coating WO created: ${res.followUpWO.workOrderNumber}`)
            }
        } else {
            res = await updateWorkOrderStatus(wo.id, status as any)
        }

        if (!res.success) {
            toast.error(res.error || 'Failed to update status')
        } else {
            toast.success(`Work order updated`)
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
            router.refresh()
        }
        setLoading(null)
    }

    const handleCompleteCuttingWO = async () => {
        if (!activeWoForComplete) return
        setLoading(activeWoForComplete.id)
        const pieceIdsNeedingMachining = activeWoForComplete.items
            .filter(i => {
                if (!i.pieceId) return false
                return machinedPieceIds.includes(i.id)
            })
            .map(i => i.pieceId!)

        const res = await completeCuttingWOWithWorkflow(activeWoForComplete.id, pieceIdsNeedingMachining)

        if (!res.success) {
            toast.error(res.error || 'Failed to complete WO')
        } else {
            if (res.machiningWO) toast.info(`Machining WO created: ${res.machiningWO.workOrderNumber}`)
            if (res.weldingWO) toast.success(`Welding WO created: ${res.weldingWO.workOrderNumber}`)
            setCompleteDialogOpen(false)
            router.refresh()
        }
        setLoading(null)
    }

    const toggleMachining = (itemId: string) => {
        setMachinedPieceIds(prev => prev.includes(itemId) ? prev.filter(id => id !== itemId) : [...prev, itemId])
    }

    // Grouping
    const inProgress = workOrders.filter(w => w.status === 'IN_PROGRESS')
    const pending = workOrders.filter(w => w.status === 'PENDING')
    const completed = workOrders.filter(w => w.status === 'COMPLETED')

    // Collect all items from IN_PROGRESS cutting WOs for batch selection
    const allActiveCuttingItems = inProgress
        .filter(w => w.type === 'CUTTING')
        .flatMap(w => w.items.filter(i => i.status !== 'COMPLETED'))

    return (
        <div className={styles.root}>
            {/* Batch Cut Actions */}
            {type === 'CUTTING' && inProgress.length > 0 && (
                <div style={{ backgroundColor: tokens.colorNeutralBackground3, padding: '8px', borderRadius: tokens.borderRadiusMedium, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text size={200} style={{ color: tokens.colorNeutralForeground3, marginLeft: '8px' }}>
                        Select individual items from active cutting orders below
                    </Text>
                    <div>
                        {selectedBatchItemIds.length > 0 && (
                            <Button size="small" onClick={() => setBatchCutDialogOpen(true)} icon={<RulerRegular />}>
                                Record Usage / Cut ({selectedBatchItemIds.length})
                            </Button>
                        )}
                    </div>
                </div>
            )}

            {/* renderGroup helper */}
            {[
                { title: 'Active', data: inProgress, color: tokens.colorPaletteBlueForeground2, icon: <PlayRegular /> },
                { title: 'Pending', data: pending, color: tokens.colorNeutralForeground3, icon: <ClockRegular /> },
                { title: 'Completed', data: completed, color: tokens.colorPaletteGreenForeground1, icon: <CheckmarkCircleRegular /> }
            ].map(group => {
                if (group.data.length === 0) return null
                return (
                    <div key={group.title}>
                        <div className={styles.groupTitle} style={{ color: group.color }}>
                            {group.icon}
                            {group.title} ({group.data.length})
                        </div>
                        <Card>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHeaderCell style={{ width: '40px' }}></TableHeaderCell>
                                        <TableHeaderCell style={{ width: '120px' }}>WO #</TableHeaderCell>
                                        <TableHeaderCell>Title</TableHeaderCell>
                                        <TableHeaderCell>Prioriy</TableHeaderCell>
                                        <TableHeaderCell>Items</TableHeaderCell>
                                        <TableHeaderCell>Action</TableHeaderCell>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {group.data.map(wo => (
                                        <>
                                            <TableRow key={wo.id} style={{ backgroundColor: tokens.colorNeutralBackground1 }}>
                                                <TableCell>
                                                    <div style={{
                                                        width: '8px', height: '8px', borderRadius: '50%',
                                                        backgroundColor: wo.status === 'IN_PROGRESS' ? tokens.colorPaletteBlueBackground2 :
                                                            wo.status === 'COMPLETED' ? tokens.colorPaletteGreenBackground1 : tokens.colorNeutralBackground4
                                                    }} />
                                                </TableCell>
                                                <TableCell style={{ fontFamily: 'monospace', fontWeight: 500 }}>{wo.workOrderNumber}</TableCell>
                                                <TableCell>
                                                    <div style={{ fontWeight: 500 }}>{wo.title}</div>
                                                    {wo.description && <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>{wo.description}</Text>}
                                                </TableCell>
                                                <TableCell>
                                                    <Badge appearance="outline">{wo.priority}</Badge>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge shape="rounded" appearance="tint" color="brand">
                                                        {wo.items.filter(i => i.status === 'COMPLETED').length} / {wo.items.length} done
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    <div className={styles.actionButtons}>
                                                        {wo.status === 'PENDING' && (
                                                            <Button appearance="subtle" icon={<PlayRegular />} onClick={() => handleStatusChange(wo, 'IN_PROGRESS')} title="Start" />
                                                        )}
                                                        {wo.status === 'IN_PROGRESS' && (
                                                            <>
                                                                <Button appearance="subtle" icon={<CheckmarkCircleRegular />} style={{ color: tokens.colorPaletteGreenForeground1 }} onClick={() => handleStatusChange(wo, 'COMPLETED')} title="Complete" />
                                                                <Button appearance="subtle" icon={<DeleteRegular />} style={{ color: tokens.colorPaletteRedForeground1 }} onClick={() => handleStatusChange(wo, 'CANCELLED')} title="Cancel" />
                                                            </>
                                                        )}
                                                        <Link href={`/projects/${projectId}/work-orders/${wo.id}`} title="View Details">
                                                            <Button appearance="subtle" icon={<DocumentRegular />} />
                                                        </Link>
                                                        <Link href={`/projects/${projectId}/work-orders/${wo.id}/print`} target="_blank" title="Print Work Order">
                                                            <Button appearance="subtle" icon={<PrintRegular />} />
                                                        </Link>
                                                        <DownloadDrawingsButton
                                                            workOrderId={wo.id}
                                                            workOrderNumber={wo.workOrderNumber}
                                                            showText={false}
                                                            iconOnly
                                                        />
                                                    </div>
                                                </TableCell>
                                            </TableRow>

                                            {(wo.status === 'IN_PROGRESS' || wo.status === 'PENDING') && (
                                                <TableRow key={`${wo.id}-items`}>
                                                    <TableCell colSpan={6} style={{ padding: 0 }}>
                                                        <div className={styles.nestedTable}>
                                                            <Table>
                                                                <TableBody>
                                                                    {wo.items.map((item, idx) => (
                                                                        <TableRow key={item.id} style={{ borderBottom: 'none' }}>
                                                                            <TableCell style={{ width: '40px' }}>
                                                                                {wo.type === 'CUTTING' && wo.status === 'IN_PROGRESS' && item.status !== 'COMPLETED' && (
                                                                                    <Checkbox
                                                                                        checked={selectedBatchItemIds.includes(item.id)}
                                                                                        onChange={(e, d) => {
                                                                                            if (d.checked) setSelectedBatchItemIds(prev => [...prev, item.id])
                                                                                            else setSelectedBatchItemIds(prev => prev.filter(id => id !== item.id))
                                                                                        }}
                                                                                    />
                                                                                )}
                                                                            </TableCell>
                                                                            <TableCell style={{ width: '40px', fontFamily: 'monospace', fontSize: '12px' }}>{idx + 1}</TableCell>
                                                                            <TableCell>
                                                                                {item.piece ? (
                                                                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                                                        <span style={{ fontWeight: 600 }}>
                                                                                            {item.piece.part.partNumber} #{item.piece.pieceNumber}
                                                                                            {item.piece.part.isSplit && <Badge size="extra-small" appearance="tint" color="brand" style={{ marginLeft: '6px' }}>1/2</Badge>}
                                                                                        </span>
                                                                                        {item.piece.part.cutAngles && (
                                                                                            <Text size={100} style={{ color: tokens.colorNeutralForeground4 }}>
                                                                                                {item.piece.part.cutAngles}
                                                                                            </Text>
                                                                                        )}
                                                                                    </div>
                                                                                ) : item.assembly ? item.assembly.name
                                                                                    : item.platePart ? item.platePart.partNumber
                                                                                        : '-'}
                                                                            </TableCell>
                                                                            <TableCell>
                                                                                <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>{item.notes || '-'}</Text>
                                                                            </TableCell>
                                                                            <TableCell style={{ textAlign: 'right', width: '100px' }}>
                                                                                {item.status !== 'COMPLETED' && wo.status === 'IN_PROGRESS' && (
                                                                                    <Button appearance="subtle" size="small" icon={loading === item.id ? undefined : <CheckmarkRegular />} onClick={() => handleItemComplete(item.id)}>
                                                                                        {loading === item.id ? "..." : ""}
                                                                                    </Button>
                                                                                )}
                                                                                {item.status === 'COMPLETED' && <CheckmarkRegular style={{ color: tokens.colorPaletteGreenForeground1 }} />}
                                                                            </TableCell>
                                                                        </TableRow>
                                                                    ))}
                                                                </TableBody>
                                                            </Table>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        </>
                                    ))}
                                </TableBody>
                            </Table>
                        </Card>
                    </div>
                )
            })}

            {activeWoForComplete && (
                <Dialog open={completeDialogOpen} onOpenChange={(e, data) => setCompleteDialogOpen(data.open)}>
                    <DialogSurface>
                        <DialogBody>
                            <DialogTitle>Complete Cutting Work Order</DialogTitle>
                            <div style={{ margin: '12px 0' }}>
                                <Text>Select pieces that need drilling/machining. Other pieces will go directly to welding.</Text>
                            </div>
                            <DialogContent>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '400px', overflowY: 'auto' }}>
                                    <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
                                        {activeWoForComplete.items.filter(i => i.piece).length} pieces in this work order
                                    </Text>
                                    {activeWoForComplete.items.filter(i => i.piece).map(item => (
                                        <div
                                            key={item.id}
                                            style={{
                                                display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', borderRadius: tokens.borderRadiusMedium,
                                                border: `1px solid ${machinedPieceIds.includes(item.id) ? tokens.colorPaletteTealBorderActive : tokens.colorNeutralStroke1}`,
                                                backgroundColor: machinedPieceIds.includes(item.id) ? tokens.colorPaletteRedBackground1 : undefined
                                            }}
                                        >
                                            <Checkbox
                                                checked={machinedPieceIds.includes(item.id)}
                                                onChange={() => toggleMachining(item.id)}
                                            />
                                            <div style={{ flex: 1 }}>
                                                <span style={{ fontFamily: 'monospace', fontWeight: 500 }}>
                                                    {item.piece!.part.partNumber} #{item.piece!.pieceNumber}
                                                </span>
                                            </div>
                                            <Badge appearance="outline" color={machinedPieceIds.includes(item.id) ? 'brand' : 'important'}>
                                                {machinedPieceIds.includes(item.id) ? '→ Machining' : '→ Welding'}
                                            </Badge>
                                        </div>
                                    ))}
                                </div>
                            </DialogContent>
                            <DialogActions>
                                <Button appearance="secondary" onClick={() => setCompleteDialogOpen(false)}>Cancel</Button>
                                <Button appearance="primary" onClick={handleCompleteCuttingWO} disabled={loading === activeWoForComplete.id}>
                                    Complete & Create WOs
                                </Button>
                            </DialogActions>
                        </DialogBody>
                    </DialogSurface>
                </Dialog>
            )}

            <BatchCutDialog
                open={batchCutDialogOpen}
                onOpenChange={setBatchCutDialogOpen}
                projectId={projectId}
                items={allActiveCuttingItems.filter(i => selectedBatchItemIds.includes(i.id))}
                onSuccess={() => {
                    setSelectedBatchItemIds([])
                    router.refresh()
                }}
            />

            {activeWoForComplete && (
                <MaterialPrepDialog
                    open={materialPrepDialogOpen}
                    onOpenChange={setMaterialPrepDialogOpen}
                    workOrder={activeWoForComplete}
                    onSuccess={() => {
                        setMaterialPrepDialogOpen(false)
                        router.refresh()
                    }}
                />
            )}
        </div>
    )
}

function ProcessCard({ type, workOrders, projectId }: { type: string, workOrders: WorkOrder[], projectId: string }) {
    const styles = useStyles()
    const [expanded, setExpanded] = useState(false)

    // Stats
    const total = workOrders.length
    const pending = workOrders.filter(w => w.status === 'PENDING').length
    const active = workOrders.filter(w => w.status === 'IN_PROGRESS').length
    const completed = workOrders.filter(w => w.status === 'COMPLETED').length

    const totalItems = workOrders.reduce((sum, w) => sum + w.items.length, 0)
    const completedItems = workOrders.reduce((sum, w) => sum + w.items.filter(i => i.status === 'COMPLETED').length, 0)
    const progress = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0

    const colorBg = TYPE_COLORS[type] || tokens.colorNeutralBackground3

    return (
        <Card className={`${styles.processCard} ${expanded ? styles.cardExpanded : ''}`} style={{ padding: 0 }}>
            <div className={styles.cardHeader} onClick={() => setExpanded(!expanded)}>
                {/* 1. Title */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div className={styles.iconBox} style={{ backgroundColor: colorBg }}>
                        <ClipboardTaskRegular fontSize={24} />
                    </div>
                    <div>
                        <Title3>{type.replace('_', ' ')}</Title3>
                        <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>{total} Orders</Text>
                    </div>
                </div>

                {/* 2. Stats Grid */}
                <div className={styles.statsGrid}>
                    <div className={styles.statItem}>
                        <div style={{ fontWeight: 700, fontSize: '18px', color: tokens.colorNeutralForeground3 }}>{pending}</div>
                        <Text size={100} style={{ textTransform: 'uppercase' }}>Pending</Text>
                    </div>
                    <div className={styles.statItem}>
                        <div style={{ fontWeight: 700, fontSize: '18px', color: tokens.colorPaletteBlueForeground2 }}>{active}</div>
                        <Text size={100} style={{ textTransform: 'uppercase' }}>Active</Text>
                    </div>
                    <div className={styles.statItem}>
                        <div style={{ fontWeight: 700, fontSize: '18px', color: tokens.colorPaletteGreenForeground1 }}>{completed}</div>
                        <Text size={100} style={{ textTransform: 'uppercase' }}>Done</Text>
                    </div>
                </div>

                {/* 3. Progress */}
                <div className={styles.progressSection}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 500 }}>
                        <span>Completion</span>
                        <span>{progress}%</span>
                    </div>
                    <ProgressBar value={progress / 100} thickness="medium" color="brand" />
                    <Text size={100} align="end" style={{ color: tokens.colorNeutralForeground3 }}>{completedItems} / {totalItems} items</Text>
                </div>

                {/* 4. Icon */}
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    {expanded ? <ChevronDownRegular /> : <ChevronRightRegular />}
                </div>
            </div>

            {/* Expanded Content */}
            {expanded && (
                <div className={styles.tableContainer}>
                    <WorkOrderTable workOrders={workOrders} type={type} projectId={projectId} />
                </div>
            )}
        </Card>
    )
}

// --- Main Component ---

export function WorkOrdersList({ workOrders }: WorkOrdersListProps) {
    if (workOrders.length === 0) {
        return (
            <div style={{ textAlign: 'center', padding: '48px', border: `1px dashed ${tokens.colorNeutralStroke1}`, borderRadius: tokens.borderRadiusMedium }}>
                <ClipboardTaskRegular fontSize={48} style={{ opacity: 0.5, color: tokens.colorNeutralForeground3 }} />
                <div style={{ marginTop: '8px', fontWeight: 600 }}>No work orders</div>
            </div>
        )
    }

    // Group by Type
    const grouped: Record<string, WorkOrder[]> = {}
    workOrders.forEach(wo => {
        if (!grouped[wo.type]) grouped[wo.type] = []
        grouped[wo.type].push(wo)
    })

    const sortedTypes = ORDERED_PROCESSES.filter(t => grouped[t])
    Object.keys(grouped).forEach(t => {
        if (!sortedTypes.includes(t)) sortedTypes.push(t)
    })

    const projectId = workOrders[0]?.projectId || ''

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {sortedTypes.map(type => (
                <ProcessCard key={type} type={type} workOrders={grouped[type]} projectId={projectId} />
            ))}
        </div>
    )
}
