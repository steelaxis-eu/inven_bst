"use client"

import {
    Table,
    TableBody,
    TableCell,
    TableHeader,
    TableRow,
    TableHeaderCell,
    Title1,
    Title3,
    Text,
    tokens,
    Link
} from "@fluentui/react-components"
import { PrintButton } from "./print-button"
import { ArrowLeftRegular, CalendarRegular, CubeRegular } from "@fluentui/react-icons"

interface DeliveryPrintViewProps {
    delivery: any
    projectId: string
}

export function DeliveryPrintView({ delivery, projectId }: DeliveryPrintViewProps) {
    return (
        <div style={{ padding: '32px', maxWidth: '1000px', margin: '0 auto' }}>
            <div className="print:hidden" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                <Link href={`/projects/${projectId}`} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <ArrowLeftRegular /> Back to Project
                </Link>
                <PrintButton />
            </div>

            <div style={{ borderBottom: `1px solid ${tokens.colorNeutralStroke2}`, paddingBottom: '24px', marginBottom: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                        <Title1>Packing List</Title1>
                        <Title3 style={{ color: tokens.colorNeutralForeground3, marginTop: '8px' }}>{delivery.name}</Title3>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px', color: tokens.colorNeutralForeground3, marginBottom: '4px' }}>
                            <CalendarRegular />
                            <Text>Scheduled: {new Date(delivery.scheduledDate).toLocaleDateString()}</Text>
                        </div>
                        <div style={{ fontFamily: tokens.fontFamilyMonospace, fontSize: '12px' }}>
                            <span style={{ backgroundColor: tokens.colorNeutralBackground2, padding: '4px 8px', borderRadius: '4px' }}>
                                ID: {delivery.id.slice(-8)}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px', marginBottom: '32px', fontSize: '14px' }}>
                <div style={{ padding: '16px', backgroundColor: tokens.colorNeutralBackground2, borderRadius: tokens.borderRadiusMedium, border: `1px solid ${tokens.colorNeutralStroke2}` }}>
                    <Text weight="semibold" block style={{ marginBottom: '8px' }}>From:</Text>
                    <div style={{ color: tokens.colorNeutralForeground2 }}>
                        <p style={{ fontWeight: 500 }}>SteelAxis Fab</p>
                        <p>123 Industrial Park</p>
                        <p>Fabrication City, FC 90210</p>
                    </div>
                </div>
                <div style={{ padding: '16px', backgroundColor: tokens.colorNeutralBackground2, borderRadius: tokens.borderRadiusMedium, border: `1px solid ${tokens.colorNeutralStroke2}` }}>
                    <Text weight="semibold" block style={{ marginBottom: '8px' }}>To Project:</Text>
                    <div style={{ color: tokens.colorNeutralForeground2 }}>
                        <p style={{ fontWeight: 500 }}>Project #{projectId}</p>
                    </div>
                </div>
            </div>

            <div style={{ marginBottom: '32px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                    <CubeRegular fontSize={20} />
                    <Title3>Items</Title3>
                </div>

                <div style={{ border: `1px solid ${tokens.colorNeutralStroke2}`, borderRadius: tokens.borderRadiusMedium, overflow: 'hidden' }}>
                    <Table>
                        <TableHeader>
                            <TableRow style={{ backgroundColor: tokens.colorNeutralBackground2 }}>
                                <TableHeaderCell style={{ width: '50px' }}>#</TableHeaderCell>
                                <TableHeaderCell>Assembly Number</TableHeaderCell>
                                <TableHeaderCell>Description</TableHeaderCell>
                                <TableHeaderCell style={{ textAlign: 'right' }}>Qty</TableHeaderCell>
                                <TableHeaderCell style={{ width: '100px' }}>Check</TableHeaderCell>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {delivery.items.map((item: any, index: number) => (
                                <TableRow key={item.id}>
                                    <TableCell style={{ fontFamily: tokens.fontFamilyMonospace, fontSize: '12px' }}>{index + 1}</TableCell>
                                    <TableCell style={{ fontWeight: 600 }}>{item.assembly.assemblyNumber}</TableCell>
                                    <TableCell>{item.assembly.name}</TableCell>
                                    <TableCell style={{ textAlign: 'right' }}>1</TableCell>
                                    <TableCell>
                                        <div style={{ width: '24px', height: '24px', border: `2px solid ${tokens.colorNeutralStroke1}`, borderRadius: '4px' }}></div>
                                    </TableCell>
                                </TableRow>
                            ))}
                            {delivery.items.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={5} style={{ textAlign: 'center', padding: '32px', color: tokens.colorNeutralForeground3 }}>
                                        No items in this shipment.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>

            {delivery.notes && (
                <div style={{ marginBottom: '32px', padding: '16px', backgroundColor: tokens.colorPaletteYellowBackground1, border: `1px solid ${tokens.colorPaletteYellowBorder1}`, borderRadius: tokens.borderRadiusMedium, color: tokens.colorPaletteYellowForeground1 }}>
                    <Text weight="semibold" block style={{ marginBottom: '4px' }}>Notes:</Text>
                    <Text>{delivery.notes}</Text>
                </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '48px', marginTop: '64px', paddingTop: '32px', borderTop: `1px solid ${tokens.colorNeutralStroke1}` }}>
                <div>
                    <Text weight="medium" block style={{ marginBottom: '32px' }}>Checked By:</Text>
                    <div style={{ borderBottom: '1px solid black', height: '32px' }}></div>
                </div>
                <div>
                    <Text weight="medium" block style={{ marginBottom: '32px' }}>Received By:</Text>
                    <div style={{ borderBottom: '1px solid black', height: '32px' }}></div>
                </div>
            </div>

            <div style={{ marginTop: '32px', textAlign: 'center', fontSize: '12px', color: tokens.colorNeutralForeground3 }}>
                Generated by SteelAxis on {new Date().toLocaleString()}
            </div>
        </div>
    )
}
