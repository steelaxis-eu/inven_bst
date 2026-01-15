"use client"

import { CreateInventoryDialog } from "@/components/create-inventory-dialog"
import { CreateUsageDialog } from "@/components/create-usage-dialog"
import { EditInventoryDialog } from "@/components/edit-inventory-dialog"
import { InventoryCertActions } from "@/components/inventory-cert-actions"
import { CSVImportDialog } from "@/components/csv-import-dialog"
import {
    Table,
    TableBody,
    TableCell,
    TableHeader,
    TableRow,
    TableHeaderCell,
    Button,
    Badge,
    Title1,
    tokens
} from "@fluentui/react-components"
import { DeleteRegular } from "@fluentui/react-icons"

interface InventoryViewProps {
    inventory: any[]
    profiles: any[]
    standardProfiles: any[]
    grades: any[]
    shapes: any[]
    suppliers: any[]
    projects: any[]
    onDelete: (formData: FormData) => Promise<void>
}

export function InventoryView({
    inventory,
    profiles,
    standardProfiles,
    grades,
    shapes,
    suppliers,
    projects,
    onDelete
}: InventoryViewProps) {
    return (
        <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '32px 16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                <Title1>Inventory</Title1>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <CSVImportDialog />
                    <CreateUsageDialog projects={projects} />
                    <CreateInventoryDialog
                        profiles={profiles}
                        standardProfiles={standardProfiles}
                        grades={grades}
                        shapes={shapes}
                        suppliers={suppliers}
                    />
                </div>
            </div>

            <div style={{ border: `1px solid ${tokens.colorNeutralStroke1}`, borderRadius: tokens.borderRadiusMedium }}>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHeaderCell>Lot ID</TableHeaderCell>
                            <TableHeaderCell>Profile</TableHeaderCell>
                            <TableHeaderCell>Dims</TableHeaderCell>
                            <TableHeaderCell>Length</TableHeaderCell>
                            <TableHeaderCell>Qty Hand / Rcv</TableHeaderCell>
                            <TableHeaderCell>Certificate</TableHeaderCell>
                            <TableHeaderCell>Status</TableHeaderCell>
                            <TableHeaderCell>Created By</TableHeaderCell>
                            <TableHeaderCell>Action</TableHeaderCell>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {inventory.map((item) => (
                            <TableRow key={item.id}>
                                <TableCell style={{ fontFamily: 'monospace', fontWeight: 500 }}>{item.lotId}</TableCell>
                                <TableCell>{item.profile.type}</TableCell>
                                <TableCell>{item.profile.dimensions}</TableCell>
                                <TableCell>{item.length} mm</TableCell>
                                <TableCell>{item.quantityAtHand} / {item.quantityReceived}</TableCell>
                                <TableCell>
                                    <InventoryCertActions id={item.id} certificate={item.certificateFilename} />
                                </TableCell>
                                <TableCell><Badge appearance="tint">{item.status}</Badge></TableCell>
                                <TableCell style={{ fontSize: '12px', color: tokens.colorNeutralForeground3 }}>{item.createdBy || '-'}</TableCell>
                                <TableCell>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <EditInventoryDialog item={item} />
                                        <form action={onDelete}>
                                            <input type="hidden" name="id" value={item.id} />
                                            <Button
                                                appearance="subtle"
                                                size="small"
                                                icon={<DeleteRegular style={{ color: tokens.colorPaletteRedForeground1 }} />}
                                                type="submit"
                                                title="Delete"
                                            />
                                        </form>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                        {inventory.length === 0 && (
                            <TableRow><TableCell colSpan={9} style={{ textAlign: 'center', padding: '32px' }}>No inventory items.</TableCell></TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    )
}
