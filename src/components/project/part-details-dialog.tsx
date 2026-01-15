'use client'

import { useState, useEffect } from 'react'
import {
    Dialog,
    DialogSurface,
    DialogBody,
    DialogTitle,
    DialogContent,
    Button,
    Input,
    Badge,
    Table,
    TableHeader,
    TableRow,
    TableHeaderCell,
    TableBody,
    TableCell,
    TabList,
    Tab,
    makeStyles,
    tokens,
    shorthands,
    Text,
    Field,
    Spinner
} from "@fluentui/react-components";
import {
    BoxMultipleRegular,
    HistoryRegular,
    LayerRegular,
    DocumentRegular,
    EditRegular,
    SaveRegular,
    DismissRegular,
    ArrowDownloadRegular,
    EyeRegular
} from "@fluentui/react-icons";
import { format } from 'date-fns'
import { toast } from 'sonner'
import { updatePartQuantity } from '@/app/actions/parts'
import { PartWithRelations } from '@/types'

const useStyles = makeStyles({
    dialogContent: {
        display: "flex",
        flexDirection: "column",
        gap: "0",
        minWidth: "800px",
        maxWidth: "1000px",
        height: "85vh",
        padding: "0" // Custom padding control
    },
    header: {
        padding: "24px",
        backgroundColor: tokens.colorNeutralBackground2,
        borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    },
    headerTop: {
        display: "flex",
        justifyContent: "space-between",
        marginBottom: "16px",
    },
    titleRow: {
        display: "flex",
        alignItems: "center",
        gap: "12px",
    },
    description: {
        color: tokens.colorNeutralForeground2,
        marginTop: "4px"
    },
    tabContent: {
        flex: 1,
        overflowY: "auto",
        padding: "24px",
        backgroundColor: tokens.colorNeutralBackground1,
    },
    grid2: {
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "24px",
    },
    card: {
        padding: "24px",
        backgroundColor: tokens.colorNeutralBackgroundAlpha,
        border: `1px solid ${tokens.colorNeutralStroke2}`,
        ...shorthands.borderRadius(tokens.borderRadiusMedium),
        boxShadow: tokens.shadow4,
        display: "flex",
        flexDirection: "column",
        gap: "16px"
    },
    label: {
        fontSize: "10px",
        textTransform: "uppercase",
        fontWeight: "bold",
        color: tokens.colorNeutralForeground3,
        letterSpacing: "0.05em",
        marginBottom: "4px"
    },
    value: {
        fontSize: "16px",
        fontWeight: "semibold",
    },
    productionTable: {
        border: `1px solid ${tokens.colorNeutralStroke2}`,
        ...shorthands.borderRadius(tokens.borderRadiusMedium),
        overflow: "hidden"
    },
    drawingFrame: {
        width: "100%",
        height: "100%",
        minHeight: "500px",
        border: "none",
        ...shorthands.borderRadius(tokens.borderRadiusMedium),
        backgroundColor: "white"
    }
});

const TABS = {
    GENERAL: 'general',
    PRODUCTION: 'production',
    ASSEMBLIES: 'assemblies',
    DRAWING: 'drawing'
} as const;

interface PartDetailsDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    part: PartWithRelations
    projectId: string
    onUpdate?: () => void
    onOpenAssembly?: (assemblyId: string) => void
}

export function PartDetailsDialog({ open, onOpenChange, part, projectId, onUpdate, onOpenAssembly }: PartDetailsDialogProps) {
    const styles = useStyles();
    const [activeTab, setActiveTab] = useState<string>(TABS.GENERAL)
    const [editing, setEditing] = useState(false)
    const [saving, setSaving] = useState(false)
    const [quantity, setQuantity] = useState(part?.quantity || 0)

    useEffect(() => {
        if (part) {
            setQuantity(part.quantity)
        }
    }, [part, open])

    if (!part) return null

    const handleSave = async () => {
        setSaving(true)
        try {
            if (part.quantity !== quantity) {
                const res = await updatePartQuantity(part.id, quantity)
                if (!res.success) throw new Error(res.error)
                toast.success("Quantity updated")
                if (onUpdate) onUpdate()
            }
            setEditing(false)
        } catch (e: any) {
            toast.error(e.message || "Failed to save")
        } finally {
            setSaving(false)
        }
    }

    const drawingUrl = part.drawingRef
        ? `/api/certificates/view?path=${encodeURIComponent(part.drawingRef)}&bucket=projects`
        : null

    return (
        <Dialog open={open} onOpenChange={(e, data) => onOpenChange(data.open)}>
            <DialogSurface className={styles.dialogContent}>
                <div className={styles.header}>
                    <div className={styles.headerTop}>
                        <div>
                            <div className={styles.titleRow}>
                                <DialogTitle style={{ fontSize: '24px', fontFamily: 'monospace' }}>{part.partNumber}</DialogTitle>
                                <Badge appearance={part.isOutsourcedCut ? "outline" : "filled"}>
                                    {part.isOutsourcedCut ? "Outsourced" : "In-House"}
                                </Badge>
                            </div>
                            <div className={styles.description}>
                                {part.description || "No description provided"}
                            </div>
                        </div>
                        <Button
                            icon={editing ? <DismissRegular /> : <EditRegular />}
                            onClick={() => setEditing(!editing)}
                        >
                            {editing ? "Cancel" : "Edit Part"}
                        </Button>
                    </div>

                    <TabList selectedValue={activeTab} onTabSelect={(e, d) => setActiveTab(d.value as string)}>
                        <Tab value={TABS.GENERAL} icon={<BoxMultipleRegular />}>General</Tab>
                        <Tab value={TABS.PRODUCTION} icon={<HistoryRegular />}>Production</Tab>
                        <Tab value={TABS.ASSEMBLIES} icon={<LayerRegular />}>Assemblies ({part.assemblyParts?.length || 0})</Tab>
                        {drawingUrl && <Tab value={TABS.DRAWING} icon={<DocumentRegular />}>Drawing</Tab>}
                    </TabList>
                </div>

                <div className={styles.tabContent}>
                    {activeTab === TABS.GENERAL && (
                        <div className={styles.grid2}>
                            <div className={styles.card}>
                                <Text weight="bold" size={400}>Dimensions & Specs</Text>
                                <div className={styles.grid2}>
                                    <div>
                                        <div className={styles.label}>Type</div>
                                        <div className={styles.value}>{part.profile?.type || part.profileType || '-'}</div>
                                    </div>
                                    <div>
                                        <div className={styles.label}>Dimensions</div>
                                        <div className={styles.value}>{part.profile?.dimensions || part.profileDimensions || '-'}</div>
                                    </div>
                                    <div>
                                        <div className={styles.label}>Length</div>
                                        <div className={styles.value} style={{ fontFamily: 'monospace', color: tokens.colorBrandForeground1 }}>{part.length} mm</div>
                                    </div>
                                    <div>
                                        <div className={styles.label}>Grade</div>
                                        <div className={styles.value}>{part.grade?.name || '-'}</div>
                                    </div>
                                    <div>
                                        <div className={styles.label}>Unit Weight</div>
                                        <div className={styles.value} style={{ fontStyle: 'italic', fontWeight: 'normal' }}>
                                            {(part.unitWeight || part.profile?.weightPerMeter || 0).toFixed(3)} kg/m
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className={styles.card}>
                                <Text weight="bold" size={400}>Project Requirement</Text>
                                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                                    <div className={styles.label} style={{ marginBottom: '12px' }}>Total Pieces Required</div>
                                    {editing ? (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center' }}>
                                            <Input
                                                type="number"
                                                value={quantity.toString()}
                                                onChange={(e, d) => setQuantity(parseInt(d.value) || 0)}
                                                contentAfter="pcs"
                                                style={{ fontSize: '18px', width: '120px', textAlign: 'center' }}
                                            />
                                            <Button appearance="primary" icon={<SaveRegular />} onClick={handleSave} disabled={saving}>
                                                {saving ? "Saving..." : "Update"}
                                            </Button>
                                        </div>
                                    ) : (
                                        <Text size={900} weight="bold" style={{ color: tokens.colorBrandForeground1 }}>
                                            {part.quantity} <span style={{ fontSize: '16px', color: tokens.colorNeutralForeground3 }}>pcs</span>
                                        </Text>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === TABS.PRODUCTION && (
                        <div className={styles.productionTable}>
                            <Table size="small">
                                <TableHeader>
                                    <TableRow>
                                        <TableHeaderCell>Piece #</TableHeaderCell>
                                        <TableHeaderCell>Status</TableHeaderCell>
                                        <TableHeaderCell>Material / Lot ID</TableHeaderCell>
                                        <TableHeaderCell>Timestamps</TableHeaderCell>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {(part.pieces && part.pieces.length > 0) ? (
                                        part.pieces.map((piece: any) => (
                                            <TableRow key={piece.id}>
                                                <TableCell style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>#{piece.pieceNumber}</TableCell>
                                                <TableCell>
                                                    <Badge appearance={piece.status === 'READY' ? "filled" : "outline"} color={piece.status === 'READY' ? "success" : "subtle"}>
                                                        {piece.status}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    {piece.inventory ? (
                                                        <div>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                <span style={{ fontFamily: 'monospace', fontWeight: 'bold', color: tokens.colorBrandForeground2 }}>{piece.inventory.lotId}</span>
                                                                {piece.inventory.certificateFilename && (
                                                                    <Button
                                                                        appearance="subtle"
                                                                        icon={<DocumentRegular />}
                                                                        onClick={() => window.open(`/api/certificates/view?path=${encodeURIComponent(piece.inventory.certificateFilename)}&bucket=projects`, '_blank')}
                                                                        size="small"
                                                                    />
                                                                )}
                                                            </div>
                                                            <div className={styles.label}>{piece.inventory.supplier?.name || 'Stock'}</div>
                                                        </div>
                                                    ) : (
                                                        <span style={{ fontStyle: 'italic', color: tokens.colorNeutralForeground3 }}>Not allocated</span>
                                                    )}
                                                </TableCell>
                                                <TableCell style={{ fontSize: '11px', color: tokens.colorNeutralForeground3 }}>
                                                    {piece.cutAt && <div>Cut: {format(new Date(piece.cutAt), 'dd/MM HH:mm')}</div>}
                                                    {piece.completedAt && <div style={{ color: tokens.colorPaletteGreenForeground1 }}>Ready: {format(new Date(piece.completedAt), 'dd/MM HH:mm')}</div>}
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={4} style={{ textAlign: 'center', padding: '24px', fontStyle: 'italic', color: tokens.colorNeutralForeground3 }}>
                                                No production pieces generated yet.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    )}

                    {activeTab === TABS.ASSEMBLIES && (
                        <div className={styles.productionTable}>
                            <Table size="small">
                                <TableHeader>
                                    <TableRow>
                                        <TableHeaderCell>Assembly #</TableHeaderCell>
                                        <TableHeaderCell>Name</TableHeaderCell>
                                        <TableHeaderCell>Qty Used</TableHeaderCell>
                                        <TableHeaderCell></TableHeaderCell>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {(part.assemblyParts?.length > 0) ? (
                                        part.assemblyParts.map((ap: any) => (
                                            <TableRow key={ap.id}>
                                                <TableCell style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{ap.assembly.assemblyNumber}</TableCell>
                                                <TableCell>{ap.assembly.name}</TableCell>
                                                <TableCell>{ap.quantityInAssembly} pcs</TableCell>
                                                <TableCell>
                                                    <Button appearance="subtle" icon={<EyeRegular />} onClick={() => onOpenAssembly && onOpenAssembly(ap.assemblyId)} />
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={4} style={{ textAlign: 'center', padding: '24px', fontStyle: 'italic', color: tokens.colorNeutralForeground3 }}>
                                                Not used in any assemblies yet.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    )}

                    {drawingUrl && activeTab === TABS.DRAWING && (
                        <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '8px' }}>
                                <Button appearance="outline" icon={<ArrowDownloadRegular />} onClick={() => window.open(drawingUrl, '_blank')}>
                                    Download PDF
                                </Button>
                            </div>
                            <iframe src={drawingUrl + "#toolbar=0"} className={styles.drawingFrame} title="Drawing Preview" />
                        </div>
                    )}
                </div>
            </DialogSurface>
        </Dialog>
    )
}
