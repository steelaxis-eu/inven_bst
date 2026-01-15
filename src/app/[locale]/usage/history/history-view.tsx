"use client"

import {
    Table,
    TableBody,
    TableCell,
    TableHeader,
    TableRow,
    TableHeaderCell,
    Title1,
    Badge,
    Link,
    tokens
} from "@fluentui/react-components"
import { EditUsageDialog } from "@/components/edit-usage-dialog"
import { DocumentRegular } from "@fluentui/react-icons"

interface HistoryViewProps {
    history: any[]
}

export function HistoryView({ history }: HistoryViewProps) {
    return (
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <Title1>Global Material Usage History</Title1>
            <div style={{
                border: `1px solid ${tokens.colorNeutralStroke2}`,
                borderRadius: tokens.borderRadiusMedium,
                overflow: 'hidden'
            }}>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHeaderCell>Date</TableHeaderCell>
                            <TableHeaderCell>User</TableHeaderCell>
                            <TableHeaderCell>Project</TableHeaderCell>
                            <TableHeaderCell>Item ID</TableHeaderCell>
                            <TableHeaderCell>Profile</TableHeaderCell>
                            <TableHeaderCell>Source</TableHeaderCell>
                            <TableHeaderCell>Qty Used</TableHeaderCell>
                            <TableHeaderCell>Scrap Generated</TableHeaderCell>
                            <TableHeaderCell>Created By</TableHeaderCell>
                            <TableHeaderCell>Cert</TableHeaderCell>
                            <TableHeaderCell style={{ width: '50px' }}></TableHeaderCell>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {history.map(row => (
                            <TableRow key={row.id}>
                                <TableCell>
                                    {row.date.toLocaleDateString()} {row.date.toLocaleTimeString()}
                                </TableCell>
                                <TableCell>{row.user}</TableCell>
                                <TableCell style={{ fontWeight: 500 }}>{row.projectName}</TableCell>
                                <TableCell style={{ fontFamily: tokens.fontFamilyMonospace }}>{row.itemId}</TableCell>
                                <TableCell>{row.profile}</TableCell>
                                <TableCell>{row.source}</TableCell>
                                <TableCell>{row.quantityUsed}</TableCell>
                                <TableCell>
                                    {row.generatedRemnantStatus === 'SCRAP' ? (
                                        row.scrapValue > 0 ? (
                                            <span style={{ color: tokens.colorPaletteGreenForeground1, fontWeight: 500 }}>
                                                +€{row.scrapValue.toFixed(2)}
                                            </span>
                                        ) : '-'
                                    ) : row.generatedRemnantStatus === 'AVAILABLE' ? (
                                        <Badge appearance="tint" color="brand" size="extra-small">Remnant</Badge>
                                    ) : (
                                        '-'
                                    )}
                                </TableCell>
                                <TableCell style={{ color: tokens.colorNeutralForeground3 }}>{row.createdBy || '-'}</TableCell>
                                <TableCell>
                                    {row.certificateFilename ? (
                                        <Link
                                            href={`/api/certificates/view?path=${encodeURIComponent(row.certificateFilename)}&bucket=certificates`}
                                            target="_blank"
                                            title="View Certificate"
                                            style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                                        >
                                            <DocumentRegular fontSize={16} /> View
                                        </Link>
                                    ) : (
                                        <span style={{ opacity: 0.5, fontSize: '12px' }}>-</span>
                                    )}
                                </TableCell>
                                <TableCell>
                                    <EditUsageDialog
                                        usageId={row.id}
                                        originalLength={row.originalLength}
                                        cost={row.cost}
                                        costPerMeter={row.costPerMeter}
                                        profile={row.profile}
                                        initialStatus={row.generatedRemnantStatus as any}
                                    />
                                </TableCell>
                            </TableRow>
                        ))}
                        {history.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={11} style={{ textAlign: 'center', padding: '32px' }}>
                                    No usage recorded yet.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    )
}
