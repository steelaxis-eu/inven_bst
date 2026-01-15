'use client'

import {
    Table,
    TableBody,
    TableCell,
    TableHeader,
    TableRow,
    TableHeaderCell,
    Badge,
    Button,
    Card,
    CardHeader,
    CardPreview,
    Text,
    Subtitle2,
    Title3
} from "@fluentui/react-components"
import { CheckmarkCircleRegular, DismissCircleRegular, AlertRegular, ShieldRegular, CheckmarkRegular, DismissRegular } from '@fluentui/react-icons'
import { tokens } from "@fluentui/react-components"

interface QualityCheck {
    id: string
    projectId: string
    assemblyId: string | null
    processStage: string
    type: string
    status: string
    inspectedBy: string | null
    inspectedAt: Date | null
    dueDate: Date | null
    findings: string | null
    ncr: string | null
    assembly?: { assemblyNumber: string; name: string } | null
}

interface QualityChecksListProps {
    checks: QualityCheck[]
    onStatusChange?: (id: string, status: string, findings?: string, ncr?: string) => void
}

const STATUS_COLORS: Record<string, string> = {
    'PENDING': 'neutral',
    'PASSED': 'success',
    'FAILED': 'danger',
    'WAIVED': 'warning',
}

const TYPE_ICONS: Record<string, React.ReactNode> = {
    'VISUAL': <ShieldRegular />,
    'DIMENSIONAL': <ShieldRegular />,
    'NDT': <ShieldRegular />,
    'COATING': <ShieldRegular />,
}

export function QualityChecksList({ checks, onStatusChange }: QualityChecksListProps) {
    if (checks.length === 0) {
        return (
            <div style={{ textAlign: 'center', padding: '48px', color: tokens.colorNeutralForeground2 }}>
                <ShieldRegular style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.5 }} />
                <p>No quality checks defined yet.</p>
                <p style={{ fontSize: '12px' }}>Create quality checks to track inspections.</p>
            </div>
        )
    }

    return (
        <div style={{ border: `1px solid ${tokens.colorNeutralStroke1}`, borderRadius: tokens.borderRadiusMedium, overflow: 'hidden' }}>
            <Table>
                <TableHeader>
                    <TableRow style={{ backgroundColor: tokens.colorNeutralBackground2 }}>
                        <TableHeaderCell>Type</TableHeaderCell>
                        <TableHeaderCell>Stage</TableHeaderCell>
                        <TableHeaderCell>Assembly</TableHeaderCell>
                        <TableHeaderCell>Due Date</TableHeaderCell>
                        <TableHeaderCell>Inspector</TableHeaderCell>
                        <TableHeaderCell>Findings</TableHeaderCell>
                        <TableHeaderCell>Status</TableHeaderCell>
                        <TableHeaderCell style={{ width: '100px' }}>Actions</TableHeaderCell>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {checks.map(qc => {
                        const isOverdue = qc.dueDate && new Date(qc.dueDate) < new Date() && qc.status === 'PENDING'

                        return (
                            <TableRow key={qc.id} style={isOverdue ? { backgroundColor: tokens.colorPaletteRedBackground1 } : undefined}>
                                <TableCell>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        {TYPE_ICONS[qc.type]}
                                        <span>{qc.type}</span>
                                    </div>
                                </TableCell>
                                <TableCell style={{ fontWeight: 600 }}>{qc.processStage}</TableCell>
                                <TableCell>
                                    {qc.assembly
                                        ? `${qc.assembly.assemblyNumber} - ${qc.assembly.name}`
                                        : <span style={{ color: tokens.colorNeutralForeground3 }}>Project-level</span>}
                                </TableCell>
                                <TableCell>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        {isOverdue && <AlertRegular style={{ color: tokens.colorPaletteRedForeground1 }} />}
                                        <span style={isOverdue ? { color: tokens.colorPaletteRedForeground1, fontWeight: 600 } : {}}>
                                            {qc.dueDate ? new Date(qc.dueDate).toLocaleDateString() : '-'}
                                        </span>
                                    </div>
                                </TableCell>
                                <TableCell style={{ color: tokens.colorNeutralForeground3 }}>
                                    {qc.inspectedBy || '-'}
                                </TableCell>
                                <TableCell>
                                    <div style={{ maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {qc.findings || '-'}
                                    </div>
                                    {qc.ncr && (
                                        <div style={{ fontSize: '10px', color: tokens.colorPaletteRedForeground1 }}>NCR: {qc.ncr}</div>
                                    )}
                                </TableCell>
                                <TableCell>
                                    <Badge appearance="tint" color={STATUS_COLORS[qc.status] as any || 'brand'}>
                                        {qc.status}
                                    </Badge>
                                </TableCell>
                                <TableCell>
                                    {qc.status === 'PENDING' && (
                                        <div style={{ display: 'flex', gap: '4px' }}>
                                            <Button
                                                size="small"
                                                appearance="subtle"
                                                icon={<CheckmarkRegular style={{ color: tokens.colorPaletteGreenForeground1 }} />}
                                                onClick={() => onStatusChange?.(qc.id, 'PASSED')}
                                                title="Pass"
                                            />
                                            <Button
                                                size="small"
                                                appearance="subtle"
                                                icon={<DismissRegular style={{ color: tokens.colorPaletteRedForeground1 }} />}
                                                onClick={() => onStatusChange?.(qc.id, 'FAILED')}
                                                title="Fail"
                                            />
                                        </div>
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

// Summary cards for quality
export function QualitySummary({ checks }: { checks: QualityCheck[] }) {
    const pending = checks.filter(c => c.status === 'PENDING').length
    const passed = checks.filter(c => c.status === 'PASSED').length
    const failed = checks.filter(c => c.status === 'FAILED').length
    const overdue = checks.filter(c =>
        c.status === 'PENDING' && c.dueDate && new Date(c.dueDate) < new Date()
    ).length

    return (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
            <Card>
                <CardHeader header={<Text weight="semibold" style={{ color: tokens.colorNeutralForeground2 }}>Pending</Text>} />
                <div style={{ padding: '0 12px 12px 12px' }}>
                    <Title3>{pending}</Title3>
                </div>
            </Card>
            <Card>
                <CardHeader header={<Text weight="semibold" style={{ color: tokens.colorNeutralForeground2 }}>Passed</Text>} />
                <div style={{ padding: '0 12px 12px 12px' }}>
                    <Title3 style={{ color: tokens.colorPaletteGreenForeground1 }}>{passed}</Title3>
                </div>
            </Card>
            <Card>
                <CardHeader header={<Text weight="semibold" style={{ color: tokens.colorNeutralForeground2 }}>Failed</Text>} />
                <div style={{ padding: '0 12px 12px 12px' }}>
                    <Title3 style={{ color: tokens.colorPaletteRedForeground1 }}>{failed}</Title3>
                </div>
            </Card>
            <Card style={overdue > 0 ? { backgroundColor: tokens.colorPaletteDarkOrangeBackground1, borderColor: tokens.colorPaletteDarkOrangeBorder1 } : undefined}>
                <CardHeader header={<Text weight="semibold" style={{ color: tokens.colorNeutralForeground2 }}>Overdue</Text>} />
                <div style={{ padding: '0 12px 12px 12px' }}>
                    <Title3 style={{ color: overdue > 0 ? tokens.colorPaletteDarkOrangeForeground1 : tokens.colorNeutralForegroundDisabled }}>
                        {overdue}
                    </Title3>
                </div>
            </Card>
        </div>
    )
}
