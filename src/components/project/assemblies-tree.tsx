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
    ProgressBar,
    shorthands,
    Card,
    CardHeader,
    CardFooter,
    CardPreview,
    Caption1,
    Subtitle1,
    Body1
} from "@fluentui/react-components";
import {
    MoreHorizontalRegular,
    EditRegular,
    CheckmarkCircleRegular,
    DeleteRegular,
    BoxRegular,
    ShareRegular,
    ChevronRightRegular,
    ChevronDownRegular,
    CalendarRegular,
    bundleIcon,
    BoxMultipleRegular,
    WrenchRegular,
    Delete20Regular,
    Checkmark20Regular,
    Edit20Regular
} from "@fluentui/react-icons";
import { useState } from 'react'
import { toast } from 'sonner'
import { CreateAssemblyWODialog } from './create-assembly-wo-dialog'
import { finishPart } from '@/app/actions/parts'
import { updatePlatePartStatus } from '@/app/actions/plateparts'
import { removePartFromAssembly, removePlatePartFromAssembly } from '@/app/actions/assemblies'
import { AssemblyDetailsDialog } from './assembly-details-dialog'

const ChevronRight = bundleIcon(ChevronRightRegular, ChevronRightRegular);
const ChevronDown = bundleIcon(ChevronDownRegular, ChevronDownRegular);

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

const useStyles = makeStyles({
    root: {
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
    },
    row: {
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '12px',
        ...shorthands.borderRadius(tokens.borderRadiusMedium),
        backgroundColor: tokens.colorNeutralBackground1,
        border: `1px solid ${tokens.colorNeutralStroke2}`,
        borderLeftWidth: '4px',
        cursor: 'pointer',
        transition: 'background-color 0.2s',
        ':hover': {
            backgroundColor: tokens.colorNeutralBackground1Hover,
        },
    },
    rowSelected: {
        boxShadow: `0 0 0 2px ${tokens.colorBrandBackground}`,
    },
    rowExpanded: {
        backgroundColor: tokens.colorNeutralBackground1Hover,
    },
    statusNotStarted: { borderLeftColor: tokens.colorNeutralStroke1 },
    statusInProgress: { borderLeftColor: tokens.colorBrandBackground },
    statusAssembled: { borderLeftColor: tokens.colorPaletteYellowBackground2 },
    statusQcPassed: { borderLeftColor: tokens.colorPaletteGreenBackground2 },
    statusShipped: { borderLeftColor: tokens.colorPalettePurpleBackground2 },

    details: {
        marginLeft: '32px',
        marginBottom: '16px',
        padding: '16px',
        backgroundColor: tokens.colorNeutralBackgroundAlpha,
        border: `1px solid ${tokens.colorNeutralStroke2}`,
        ...shorthands.borderRadius(tokens.borderRadiusMedium),
    },
    statsGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '16px',
        marginBottom: '16px',
    },
    statCard: {
        padding: '12px',
        backgroundColor: tokens.colorNeutralBackground1,
        ...shorthands.borderRadius(tokens.borderRadiusMedium),
        border: `1px solid ${tokens.colorNeutralStroke2}`,
    },
    statLabel: {
        fontSize: '10px',
        textTransform: 'uppercase',
        color: tokens.colorNeutralForeground3,
        fontWeight: 'bold',
        marginBottom: '4px',
    },
    statValue: {
        fontSize: '18px',
        fontWeight: 'bold',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
    },
    tableContainer: {
        border: `1px solid ${tokens.colorNeutralStroke2}`,
        ...shorthands.borderRadius(tokens.borderRadiusMedium),
        overflow: 'hidden',
        backgroundColor: tokens.colorNeutralBackground1,
    }
});

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
    const styles = useStyles();
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

    const getStatusClass = (status: string) => {
        switch (status) {
            case 'IN_PROGRESS': return styles.statusInProgress;
            case 'ASSEMBLED': return styles.statusAssembled;
            case 'QC_PASSED': return styles.statusQcPassed;
            case 'SHIPPED': return styles.statusShipped;
            default: return styles.statusNotStarted;
        }
    }

    const getBadgeColor = (status: string) => {
        switch (status) {
            case 'IN_PROGRESS': return 'brand';
            case 'ASSEMBLED': return 'warning';
            case 'QC_PASSED': return 'success';
            case 'SHIPPED': return 'important';
            default: return 'subtle';
        }
    }

    return (
        <div style={{ marginLeft: level * 24 }}>
            {/* Main Row */}
            <div
                className={`${styles.row} ${getStatusClass(assembly.status)} ${selected ? styles.rowSelected : ''} ${detailsOpen ? styles.rowExpanded : ''}`}
                onClick={handleRowClick}
            >
                {/* Selection Checkbox */}
                <div onClick={handleCheckboxClick}>
                    <Checkbox
                        checked={selected}
                        onChange={(_, data) => onSelect(assembly.id, data.checked === true)}
                    />
                </div>

                {hasChildren ? (
                    <div onClick={handleChevronClick} style={{ cursor: 'pointer', display: 'flex' }}>
                        {expanded ? <ChevronDown /> : <ChevronRight />}
                    </div>
                ) : (
                    <div style={{ width: 20 }} />
                )}

                <BoxMultipleRegular style={{ color: tokens.colorNeutralForeground3 }} />

                <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Text font="monospace" weight="bold">{assembly.assemblyNumber}</Text>
                        <Text style={{ color: tokens.colorNeutralForeground3 }}>—</Text>
                        <Text>{assembly.name}</Text>
                    </div>
                    {assembly.description && (
                        <Text size={200} style={{ color: tokens.colorNeutralForeground3, display: 'block' }}>{assembly.description}</Text>
                    )}
                </div>

                <Badge appearance="tint" color={getBadgeColor(assembly.status)} style={{ whiteSpace: 'nowrap' }}>
                    {assembly.status.replace('_', ' ')}
                </Badge>

                <div style={{ width: '120px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <ProgressBar value={progress.percent} max={100} thickness="large" shape="rounded" color={progress.percent === 100 ? 'success' : 'brand'} style={{ height: '8px' }} />
                    <Text size={100} align="end">{progress.percent}%</Text>
                </div>

                <div style={{ width: '80px', textAlign: 'right' }}>
                    <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>{allParts.length} parts</Text>
                </div>

                {assembly.scheduledDate && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: tokens.colorNeutralForeground3 }}>
                        <CalendarRegular fontSize={12} />
                        <Text size={200}>{new Date(assembly.scheduledDate).toLocaleDateString()}</Text>
                    </div>
                )}
            </div>

            {/* Details Sub-Row */}
            {detailsOpen && (
                <div className={styles.details}>
                    {/* Summary Cards */}
                    <div className={styles.statsGrid}>
                        <div className={styles.statCard}>
                            <div className={styles.statLabel}>Parts</div>
                            <div className={styles.statValue}>
                                <BoxRegular fontSize={20} style={{ opacity: 0.5 }} />
                                {allParts.length}
                            </div>
                        </div>
                        <div className={styles.statCard}>
                            <div className={styles.statLabel}>Pieces</div>
                            <div className={styles.statValue}>
                                <span style={{ color: tokens.colorPaletteGreenForeground1 }}>{progress.ready}</span>
                                <span style={{ color: tokens.colorNeutralForeground3 }}> / {progress.total}</span>
                            </div>
                        </div>
                        <div className={styles.statCard}>
                            <div className={styles.statLabel}>Weight</div>
                            <div className={styles.statValue}>
                                <span style={{ color: tokens.colorNeutralForeground3 }}>{totalWeight.toFixed(1)} kg</span>
                            </div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', justifyContent: 'center' }}>
                            <Button size="small" appearance="outline" onClick={(e) => { e.stopPropagation(); onViewDetails(assembly); }}>
                                View Details & Traceability
                            </Button>
                        </div>
                    </div>

                    {/* Parts Table */}
                    {allParts.length > 0 ? (
                        <div className={styles.tableContainer}>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHeaderCell>Part #</TableHeaderCell>
                                        <TableHeaderCell>Type/Profile</TableHeaderCell>
                                        <TableHeaderCell>Description</TableHeaderCell>
                                        <TableHeaderCell>Qty</TableHeaderCell>
                                        <TableHeaderCell>Ready</TableHeaderCell>
                                        <TableHeaderCell>Weight</TableHeaderCell>
                                        <TableHeaderCell></TableHeaderCell>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {allParts.map((item, idx) => {
                                        const isComplete = item.ready >= item.quantity
                                        return (
                                            <TableRow key={idx}>
                                                <TableCell>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <Text font="monospace">{item.partNumber}</Text>
                                                        {item.kind === 'PLATE' && (
                                                            <Badge size="extra-small" appearance="tint" color="brand">PL</Badge>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell>{item.detail}</TableCell>
                                                <TableCell>
                                                    <Text style={{ color: tokens.colorNeutralForeground3 }}>{item.description || '-'}</Text>
                                                </TableCell>
                                                <TableCell>{item.quantity}</TableCell>
                                                <TableCell>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                        <span style={{
                                                            fontWeight: 'bold',
                                                            color: isComplete ? tokens.colorPaletteGreenForeground1 : item.ready > 0 ? tokens.colorPaletteDarkOrangeForeground1 : tokens.colorNeutralForeground3
                                                        }}>
                                                            {item.ready}
                                                        </span>
                                                        {isComplete && <CheckmarkCircleRegular fontSize={16} style={{ color: tokens.colorPaletteGreenForeground1 }} />}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    {item.unitWeight ? `${(item.unitWeight * item.quantity).toFixed(1)} kg` : '-'}
                                                </TableCell>
                                                <TableCell>
                                                    <Menu>
                                                        <MenuTrigger disableButtonEnhancement>
                                                            <Button icon={<MoreHorizontalRegular />} appearance="subtle" disabled={loadingId === item.id} />
                                                        </MenuTrigger>
                                                        <MenuPopover>
                                                            <MenuList>
                                                                <MenuItem icon={<Edit20Regular />} onClick={() => handleEdit(item.id)}>Edit</MenuItem>
                                                                <MenuDivider />
                                                                <MenuItem icon={<Checkmark20Regular />} onClick={() => handleFinish(item.id, item.kind)}>Mark Finished</MenuItem>
                                                                <MenuItem icon={<Delete20Regular />} onClick={() => handleRemove(item.id, item.kind)} style={{ color: tokens.colorPaletteRedForeground1 }}>Remove</MenuItem>
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
                    ) : (
                        <div style={{ padding: '24px', textAlign: 'center', color: tokens.colorNeutralForeground3 }}>
                            <BoxRegular fontSize={32} style={{ opacity: 0.5, marginBottom: '8px' }} />
                            <Text block>No parts in this assembly</Text>
                        </div>
                    )}

                    {/* Notes */}
                    {assembly.notes && (
                        <div style={{ marginTop: '16px', padding: '12px', backgroundColor: tokens.colorNeutralBackground1, border: `1px solid ${tokens.colorNeutralStroke2}`, borderRadius: tokens.borderRadiusMedium }}>
                            <div className={styles.statLabel}>Notes</div>
                            <Text>{assembly.notes}</Text>
                        </div>
                    )}
                </div>
            )}

            {/* Child Assemblies */}
            {hasChildren && expanded && (
                <div style={{ marginTop: '4px' }}>
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
    const styles = useStyles();
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
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '48px', color: tokens.colorNeutralForeground3 }}>
                <BoxMultipleRegular fontSize={48} style={{ opacity: 0.5, marginBottom: '16px' }} />
                <Subtitle1>No assemblies defined yet.</Subtitle1>
                <Body1>Create assemblies to group parts for fabrication.</Body1>
            </div>
        )
    }

    return (
        <div className={styles.root}>
            {/* Selection Toolbar */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px',
                backgroundColor: tokens.colorNeutralBackgroundAlpha,
                border: `1px solid ${tokens.colorNeutralStroke2}`,
                borderRadius: tokens.borderRadiusMedium
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <Checkbox
                        checked={selectedIds.length === assemblies.length && assemblies.length > 0}
                        onChange={handleSelectAll}
                    />
                    <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
                        {selectedIds.length > 0
                            ? `${selectedIds.length} selected`
                            : 'Select assemblies'
                        }
                    </Text>
                </div>
                {selectedIds.length > 0 && (
                    <Button
                        size="small"
                        icon={<WrenchRegular />}
                        onClick={() => setWoDialogOpen(true)}
                    >
                        Create Work Order ({selectedIds.length})
                    </Button>
                )}
            </div>

            {/* Assembly List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
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

    const SummaryCard = ({ title, value, color }: { title: string, value: number, color?: string }) => (
        <Card style={{ padding: '16px' }}>
            <Caption1 style={{ color: tokens.colorNeutralForeground3, textTransform: 'uppercase', fontWeight: 'bold' }}>{title}</Caption1>
            <Subtitle1 style={{ marginTop: '8px', color: color }}>{value}</Subtitle1>
        </Card>
    )

    return (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '16px', marginBottom: '24px' }}>
            <SummaryCard title="Total" value={total} />
            <SummaryCard title="Not Started" value={notStarted} color={tokens.colorNeutralForeground2} />
            <SummaryCard title="In Progress" value={inProgress} color={tokens.colorBrandForeground1} />
            <SummaryCard title="Assembled" value={assembled} color={tokens.colorPaletteGreenForeground1} />
            <SummaryCard title="Shipped" value={shipped} color={tokens.colorPalettePurpleForeground2} />
        </div>
    )
}
