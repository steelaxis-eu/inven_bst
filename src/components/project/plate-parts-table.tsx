'use client'

import {
    Table,
    TableBody,
    TableCell,
    TableHeader,
    TableHeaderCell,
    TableRow,
    Badge,
    Button,
    Card,
    CardHeader,
    ProgressBar,
    tokens,
    Title3,
    Text
} from "@fluentui/react-components"
import {
    DocumentRegular,
    BoxRegular
} from "@fluentui/react-icons"

interface PlatePart {
    id: string
    partNumber: string
    description: string | null
    material: string | null
    thickness: number | null
    quantity: number
    unitWeight: number
    supplier: string | null
    poNumber: string | null
    status: string
    dxfFilename: string | null
    dxfStoragePath: string | null
    orderedAt: Date | null
    expectedDate: Date | null
    receivedAt: Date | null
    receivedQty: number
    grade?: { name: string } | null
}

interface PlatePartsTableProps {
    plateParts: PlatePart[]
    onStatusChange?: (id: string, status: string) => void
}

const STATUS_COLORS: Record<string, "outline" | "filled" | "tint"> = {
    'PENDING': 'outline',
    'ORDERED': 'tint',
    'IN_PRODUCTION': 'tint',
    'RECEIVED': 'filled',
    'QC_PASSED': 'filled',
}

export function PlatePartsTable({ plateParts, onStatusChange }: PlatePartsTableProps) {
    if (plateParts.length === 0) {
        return (
            <div style={{ textAlign: 'center', padding: '48px', border: `1px dashed ${tokens.colorNeutralStroke1}`, borderRadius: tokens.borderRadiusMedium }}>
                <BoxRegular fontSize={48} style={{ opacity: 0.5, color: tokens.colorNeutralForeground3 }} />
                <div style={{ marginTop: '8px', fontWeight: 600 }}>No plate parts defined yet</div>
                <Text>Add laser/plasma cut parts for outsourced fabrication.</Text>
            </div>
        )
    }

    return (
        <div style={{ border: `1px solid ${tokens.colorNeutralStroke1}`, borderRadius: tokens.borderRadiusMedium, overflow: 'hidden' }}>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHeaderCell>Part #</TableHeaderCell>
                        <TableHeaderCell>Description</TableHeaderCell>
                        <TableHeaderCell>Material</TableHeaderCell>
                        <TableHeaderCell style={{ textAlign: 'right' }}>Thickness</TableHeaderCell>
                        <TableHeaderCell style={{ textAlign: 'right' }}>Qty</TableHeaderCell>
                        <TableHeaderCell>Supplier</TableHeaderCell>
                        <TableHeaderCell>PO #</TableHeaderCell>
                        <TableHeaderCell>Expected</TableHeaderCell>
                        <TableHeaderCell>Received</TableHeaderCell>
                        <TableHeaderCell>Status</TableHeaderCell>
                        <TableHeaderCell>DXF</TableHeaderCell>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {plateParts.map(pp => {
                        const receivedPercent = pp.quantity > 0
                            ? Math.round((pp.receivedQty / pp.quantity) * 100)
                            : 0

                        return (
                            <TableRow key={pp.id}>
                                <TableCell style={{ fontFamily: 'monospace', fontWeight: 500 }}>{pp.partNumber}</TableCell>
                                <TableCell><Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>{pp.description || '-'}</Text></TableCell>
                                <TableCell>
                                    {pp.material || pp.grade?.name || '-'}
                                </TableCell>
                                <TableCell style={{ textAlign: 'right', fontFamily: 'monospace' }}>
                                    {pp.thickness ? `${pp.thickness} mm` : '-'}
                                </TableCell>
                                <TableCell style={{ textAlign: 'right', fontWeight: 500 }}>{pp.quantity}</TableCell>
                                <TableCell>{pp.supplier || '-'}</TableCell>
                                <TableCell style={{ fontFamily: 'monospace', fontSize: '12px' }}>{pp.poNumber || '-'}</TableCell>
                                <TableCell style={{ fontSize: '12px' }}>
                                    {pp.expectedDate
                                        ? new Date(pp.expectedDate).toLocaleDateString()
                                        : '-'}
                                </TableCell>
                                <TableCell>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span style={{ fontSize: '12px', fontWeight: 500 }}>
                                            {pp.receivedQty}/{pp.quantity}
                                        </span>
                                        {pp.quantity > 0 && (
                                            <ProgressBar value={receivedPercent / 100} style={{ width: '60px' }} />
                                        )}
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <Badge appearance={STATUS_COLORS[pp.status] || 'outline'}>
                                        {pp.status.replace('_', ' ')}
                                    </Badge>
                                </TableCell>
                                <TableCell>
                                    {pp.dxfFilename ? (
                                        <Button
                                            size="small"
                                            appearance="subtle"
                                            icon={<DocumentRegular />}
                                            style={{ color: tokens.colorPaletteBlueForeground2 }}
                                        >
                                            <span style={{ fontSize: '11px' }}>{pp.dxfFilename}</span>
                                        </Button>
                                    ) : (
                                        <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>—</Text>
                                    )}
                                </TableCell>
                            </TableRow>
                        )
                    })}
                </TableBody>
            </Table>
        </div>
    )
}

export function PlatePartsSummary({ plateParts }: { plateParts: PlatePart[] }) {
    const total = plateParts.length
    const pending = plateParts.filter(p => p.status === 'PENDING').length
    const ordered = plateParts.filter(p => p.status === 'ORDERED' || p.status === 'IN_PRODUCTION').length
    const received = plateParts.filter(p => p.status === 'RECEIVED' || p.status === 'QC_PASSED').length
    const totalWeight = plateParts.reduce((sum, p) => sum + (p.quantity * (p.unitWeight || 0)), 0)

    return (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '16px', marginBottom: '24px' }}>
            <Card>
                <CardHeader header={<Text weight="medium" style={{ color: tokens.colorNeutralForeground3 }}>Total Parts</Text>} />
                <Title3>{total}</Title3>
            </Card>
            <Card>
                <CardHeader header={<Text weight="medium" style={{ color: tokens.colorNeutralForeground3 }}>Pending Order</Text>} />
                <Title3 style={{ color: tokens.colorNeutralForegroundDisabled }}>{pending}</Title3>
            </Card>
            <Card>
                <CardHeader header={<Text weight="medium" style={{ color: tokens.colorNeutralForeground3 }}>Ordered</Text>} />
                <Title3 style={{ color: tokens.colorPaletteBlueForeground2 }}>{ordered}</Title3>
            </Card>
            <Card>
                <CardHeader header={<Text weight="medium" style={{ color: tokens.colorNeutralForeground3 }}>Received</Text>} />
                <Title3 style={{ color: tokens.colorPaletteGreenForeground1 }}>{received}</Title3>
            </Card>
            <Card>
                <CardHeader header={<Text weight="medium" style={{ color: tokens.colorNeutralForeground3 }}>Total Weight</Text>} />
                <Title3>{totalWeight.toFixed(0)} <span style={{ fontSize: '14px', fontWeight: 400 }}>kg</span></Title3>
            </Card>
        </div>
    )
}
