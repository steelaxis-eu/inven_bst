'use client'

import { useState } from 'react'
import {
    Dialog,
    DialogSurface,
    DialogBody,
    DialogTitle,
    Button,
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
    ArrowDownloadRegular,
    CubeRegular,
    DismissRegular
} from "@fluentui/react-icons";
import { format } from 'date-fns'

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
    COMPONENTS: 'components',
    HISTORY: 'history',
    DRAWING: 'drawing'
} as const;

interface AssemblyDetailsDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    assembly: any // Using any for now as the type might be complex with relations
    onOpenPart?: (partId: string) => void
}

export function AssemblyDetailsDialog({ open, onOpenChange, assembly, onOpenPart }: AssemblyDetailsDialogProps) {
    const styles = useStyles();
    const [activeTab, setActiveTab] = useState<string>(TABS.COMPONENTS)

    if (!assembly) return null

    const drawingUrl = assembly.drawingRef
        ? `/api/certificates/view?path=${encodeURIComponent(assembly.drawingRef)}&bucket=projects`
        : null

    return (
        <Dialog open={open} onOpenChange={(e, data) => onOpenChange(data.open)}>
            <DialogSurface className={styles.dialogContent}>
                <div className={styles.header}>
                    <div className={styles.headerTop}>
                        <div>
                            <div className={styles.titleRow}>
                                <DialogTitle style={{ fontSize: '24px', fontFamily: 'monospace' }}>{assembly.assemblyNumber}</DialogTitle>
                                <Badge appearance={assembly.status === 'COMPLETED' ? "filled" : "outline"} color={assembly.status === 'COMPLETED' ? "success" : "subtle"}>
                                    {assembly.status}
                                </Badge>
                            </div>
                            <div className={styles.description}>
                                {assembly.name}
                            </div>
                        </div>
                        <Button icon={<DismissRegular />} onClick={() => onOpenChange(false)} appearance="subtle" />
                    </div>

                    <TabList selectedValue={activeTab} onTabSelect={(e, d) => setActiveTab(d.value as string)}>
                        <Tab value={TABS.COMPONENTS} icon={<CubeRegular />}>Components ({assembly.parts?.length || 0})</Tab>
                        <Tab value={TABS.HISTORY} icon={<HistoryRegular />}>Production History</Tab>
                        {drawingUrl && <Tab value={TABS.DRAWING} icon={<DocumentRegular />}>Drawing</Tab>}
                    </TabList>
                </div>

                <div className={styles.tabContent}>
                    {activeTab === TABS.COMPONENTS && (
                        <div className={styles.productionTable}>
                            <Table size="small">
                                <TableHeader>
                                    <TableRow>
                                        <TableHeaderCell>Part Number</TableHeaderCell>
                                        <TableHeaderCell>Description / Specs</TableHeaderCell>
                                        <TableHeaderCell>Qty per Assy</TableHeaderCell>
                                        <TableHeaderCell>Total Qty</TableHeaderCell>
                                        <TableHeaderCell></TableHeaderCell>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {(assembly.parts && assembly.parts.length > 0) ? (
                                        assembly.parts.map((ap: any) => (
                                            <TableRow key={ap.id}>
                                                <TableCell style={{ fontFamily: 'monospace', fontWeight: 'bold', color: tokens.colorBrandForeground1 }}>
                                                    {ap.part?.partNumber}
                                                </TableCell>
                                                <TableCell>
                                                    <div style={{ fontSize: '12px' }}>{ap.part?.description}</div>
                                                    <div style={{ fontSize: '11px', color: tokens.colorNeutralForeground3 }}>
                                                        {ap.part?.profile?.type} {ap.part?.profile?.dimensions} - {ap.part?.length}mm
                                                    </div>
                                                </TableCell>
                                                <TableCell style={{ fontWeight: 'bold' }}>{ap.quantityInAssembly}</TableCell>
                                                <TableCell>{ap.quantityInAssembly * assembly.quantity} pcs</TableCell>
                                                <TableCell>
                                                    <Button size="small" appearance="subtle" onClick={() => onOpenPart && onOpenPart(ap.partId)}>View</Button>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={5} style={{ textAlign: 'center', padding: '24px', fontStyle: 'italic', color: tokens.colorNeutralForeground3 }}>
                                                No parts linked to this assembly.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    )}

                    {activeTab === TABS.HISTORY && (
                        <div className={styles.productionTable}>
                            <Table size="small">
                                <TableHeader>
                                    <TableRow>
                                        <TableHeaderCell>Date</TableHeaderCell>
                                        <TableHeaderCell>Event</TableHeaderCell>
                                        <TableHeaderCell>User</TableHeaderCell>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    <TableRow>
                                        <TableCell style={{ color: tokens.colorNeutralForeground3 }}>{format(new Date(assembly.createdAt), 'dd/MM/yyyy HH:mm')}</TableCell>
                                        <TableCell>Assembly Created</TableCell>
                                        <TableCell>System</TableCell>
                                    </TableRow>
                                    {/* Add more history events here if available */}
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
