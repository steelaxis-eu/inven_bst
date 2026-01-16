'use client'

import { useState } from 'react'
import {
    Dialog,
    DialogSurface,
    DialogTitle,
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
} from "@fluentui/react-components";
import {
    BoxMultipleRegular,
    HistoryRegular,
    DocumentRegular,
    EditRegular,
    SaveRegular,
    DismissRegular,
    ArrowDownloadRegular,
    EyeRegular
} from "@fluentui/react-icons";
import { format } from 'date-fns'
import { toast } from 'sonner'
import { updatePlatePartQuantity } from '@/app/actions/plateparts'
import { PlatePartWithRelations } from '@/types'

const useStyles = makeStyles({
    dialogContent: {
        display: "flex",
        flexDirection: "column",
        gap: "0",
        minWidth: "800px",
        maxWidth: "1000px",
        height: "85vh",
        padding: "0"
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
    dxfFrame: {
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
    DRAWING: 'drawing'
} as const;

interface PlateDetailsDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    plate: PlatePartWithRelations
    projectId: string
    onUpdate?: () => void
    onOpenAssembly?: (assemblyId: string) => void
}

export function PlateDetailsDialog({ open, onOpenChange, plate, projectId, onUpdate, onOpenAssembly }: PlateDetailsDialogProps) {
    const styles = useStyles();
    const [activeTab, setActiveTab] = useState<string>(TABS.GENERAL)
    const [editing, setEditing] = useState(false)
    const [saving, setSaving] = useState(false)
    const [quantity, setQuantity] = useState(plate?.quantity || 0)

    if (!plate) return null

    const handleSave = async () => {
        setSaving(true)
        try {
            if (plate.quantity !== quantity) {
                const res = await updatePlatePartQuantity(plate.id, quantity)
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

    const dxfUrl = plate.dxfStoragePath
        ? `/api/certificates/view?path=${encodeURIComponent(plate.dxfStoragePath)}&bucket=projects`
        : null

    const pieces = (plate as any).pieces || []

    return (
        <Dialog open={open} onOpenChange={(e, data) => onOpenChange(data.open)}>
            <DialogSurface className={styles.dialogContent}>
                <div className={styles.header}>
                    <div className={styles.headerTop}>
                        <div>
                            <div className={styles.titleRow}>
                                <DialogTitle style={{ fontSize: '24px', fontFamily: 'monospace' }}>{plate.partNumber}</DialogTitle>
                                <Badge appearance={plate.isOutsourced ? "outline" : "filled"}>
                                    {plate.isOutsourced ? "Outsourced" : "In-House"}
                                </Badge>
                            </div>
                            <div className={styles.description}>
                                {plate.description || "No description provided"}
                            </div>
                        </div>
                        <Button
                            icon={editing ? <DismissRegular /> : <EditRegular />}
                            onClick={() => setEditing(!editing)}
                        >
                            {editing ? "Cancel" : "Edit Plate"}
                        </Button>
                    </div>

                    <TabList selectedValue={activeTab} onTabSelect={(e, d) => setActiveTab(d.value as string)}>
                        <Tab value={TABS.GENERAL} icon={<BoxMultipleRegular />}>General</Tab>
                        <Tab value={TABS.PRODUCTION} icon={<HistoryRegular />}>Production</Tab>
                        {dxfUrl && <Tab value={TABS.DRAWING} icon={<DocumentRegular />}>Drawing</Tab>}
                    </TabList>
                </div>

                <div className={styles.tabContent}>
                    {activeTab === TABS.GENERAL && (
                        <div className={styles.grid2}>
                            <div className={styles.card}>
                                <Text weight="bold" size={400}>Dimensions & Specs</Text>
                                <div className={styles.grid2}>
                                    <div>
                                        <div className={styles.label}>Material</div>
                                        <div className={styles.value}>{plate.material || 'Steel'}</div>
                                    </div>
                                    <div>
                                        <div className={styles.label}>Grade</div>
                                        <div className={styles.value}>{plate.grade?.name || '-'}</div>
                                    </div>
                                    <div>
                                        <div className={styles.label}>Thickness</div>
                                        <div className={styles.value}>{plate.thickness} mm</div>
                                    </div>
                                    <div>
                                        <div className={styles.label}>Dimensions</div>
                                        <div className={styles.value}>{plate.length} x {plate.width} mm</div>
                                    </div>
                                    <div>
                                        <div className={styles.label}>Unit Weight</div>
                                        <div className={styles.value} style={{ fontStyle: 'italic', fontWeight: 'normal' }}>
                                            {plate.unitWeight.toFixed(3)} kg
                                        </div>
                                    </div>
                                    <div>
                                        <div className={styles.label}>Area</div>
                                        <div className={styles.value} style={{ fontStyle: 'italic', fontWeight: 'normal' }}>
                                            {(plate.area || 0).toFixed(3)} m²
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
                                            {plate.quantity} <span style={{ fontSize: '16px', color: tokens.colorNeutralForeground3 }}>pcs</span>
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
                                        <TableHeaderCell>Source / Material</TableHeaderCell>
                                        <TableHeaderCell>Timestamps</TableHeaderCell>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {(pieces && pieces.length > 0) ? (
                                        pieces.map((piece: any) => (
                                            <TableRow key={piece.id}>
                                                <TableCell style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>#{piece.pieceNumber || '-'}</TableCell>
                                                <TableCell>
                                                    <Badge appearance={piece.status === 'READY' ? "filled" : "outline"} color={piece.status === 'READY' ? "success" : "subtle"}>
                                                        {piece.status}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    {/* Assuming plate pieces might have inventory relation, similar to PartPiece */}
                                                    {piece.inventoryId ? (
                                                        <div className={styles.label}>{piece.inventoryId}</div>
                                                    ) : (
                                                        <span style={{ fontStyle: 'italic', color: tokens.colorNeutralForeground3 }}>-</span>
                                                    )}
                                                </TableCell>
                                                <TableCell style={{ fontSize: '11px', color: tokens.colorNeutralForeground3 }}>
                                                    {piece.receivedAt && <div>Received: {format(new Date(piece.receivedAt), 'dd/MM HH:mm')}</div>}
                                                    {/* Using completedAt if available, otherwise just receivedAt for plate parts usually */}
                                                    {piece.completedAt && <div style={{ color: tokens.colorPaletteGreenForeground1 }}>Ready: {format(new Date(piece.completedAt), 'dd/MM HH:mm')}</div>}
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={4} style={{ textAlign: 'center', padding: '24px', fontStyle: 'italic', color: tokens.colorNeutralForeground3 }}>
                                                No individual production pieces generated for this plate item yet.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    )}

                    {dxfUrl && activeTab === TABS.DRAWING && (
                        <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '8px' }}>
                                <Button appearance="outline" icon={<ArrowDownloadRegular />} onClick={() => window.open(dxfUrl, '_blank')}>
                                    Download DXF
                                </Button>
                            </div>
                            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${tokens.colorNeutralStroke2}`, borderRadius: tokens.borderRadiusMedium, backgroundColor: 'white' }}>
                                <Text>DXF Preview not available in browser. Please download.</Text>
                            </div>
                        </div>
                    )}
                </div>
            </DialogSurface>
        </Dialog>
    )
}
