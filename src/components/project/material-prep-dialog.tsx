'use client'

import { useState } from 'react'
import {
    Dialog,
    DialogSurface,
    DialogTitle,
    DialogBody,
    DialogContent,
    DialogActions,
    Button,
    Input,
    Label,
    makeStyles,
    tokens,
    Spinner,
    Text,
    Title3
} from "@fluentui/react-components"
import { completeMaterialPrepWorkOrder } from '@/app/actions/workorders'
import { toast } from 'sonner'

interface MaterialPrepDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    workOrder: any
    onSuccess: () => void
}

interface StockInputItem {
    id: string
    profileId: string
    gradeId: string
    profileType: string
    dimensions: string
    gradeName: string
    totalLengthNeeded: number
    quantityNeeded: number
    lotId: string
    certificate: string
    supplierId: string
    totalCost: number
    receivedLength: number
    receivedQuantity: number
}

const useStyles = makeStyles({
    content: {
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        maxHeight: '80vh',
    },
    itemCard: {
        backgroundColor: tokens.colorNeutralBackground2,
        padding: '16px',
        borderRadius: tokens.borderRadiusMedium,
        border: `1px solid ${tokens.colorNeutralStroke2}`,
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
    },
    itemHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingBottom: '8px',
        borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
        marginBottom: '4px',
    },
    gridThree: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '16px',
    },
    field: {
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
    }
})

export function MaterialPrepDialog({ open, onOpenChange, workOrder, onSuccess }: MaterialPrepDialogProps) {
    const styles = useStyles()
    const [loading, setLoading] = useState(false)
    const [items, setItems] = useState<StockInputItem[]>([])
    const [initialized, setInitialized] = useState(false)

    // Aggregate items on load
    if (open && !initialized && workOrder) {
        const aggregated: Record<string, StockInputItem> = {}

        workOrder.items.forEach((item: any) => {
            if (!item.piece || !item.piece.part.profile) return

            const profile = item.piece.part.profile
            const grade = item.piece.part.grade
            const key = `${profile.id}-${grade?.id || 'unknown'}`

            if (!aggregated[key]) {
                aggregated[key] = {
                    id: key,
                    profileId: profile.id,
                    gradeId: grade?.id || '',
                    profileType: profile.type,
                    dimensions: profile.dimensions,
                    gradeName: grade?.name || 'Unknown',
                    totalLengthNeeded: 0,
                    quantityNeeded: 0,
                    lotId: '',
                    certificate: '',
                    supplierId: '',
                    totalCost: 0,
                    receivedLength: 6000,
                    receivedQuantity: 1
                }
            }

            aggregated[key].totalLengthNeeded += (item.piece.part.length || 0)
            aggregated[key].quantityNeeded += 1
        })

        setItems(Object.values(aggregated))
        setInitialized(true)
    }

    if (!open && initialized) {
        setInitialized(false)
    }

    const updateItem = (id: string, field: keyof StockInputItem, value: any) => {
        setItems(prev => prev.map(item =>
            item.id === id ? { ...item, [field]: value } : item
        ))
    }

    const handleSubmit = async () => {
        setLoading(true)

        // Validate inputs
        const missingFields = items.some(i => !i.lotId || !i.certificate)
        if (missingFields) {
            toast.error("Please fill in Lot ID and Certificate for all items")
            setLoading(false)
            return
        }

        const stockItems = items.map(item => ({
            profileId: item.profileId,
            gradeId: item.gradeId,
            length: Number(item.receivedLength),
            quantity: Number(item.receivedQuantity),
            lotId: item.lotId,
            certificate: item.certificate,
            supplierId: item.supplierId || undefined,
            totalCost: Number(item.totalCost)
        }))

        const res = await completeMaterialPrepWorkOrder(workOrder.id, stockItems)

        if (res.success) {
            toast.success("Material received and Work Order completed")
            onOpenChange(false)
            onSuccess()
        } else {
            toast.error(res.error || "Failed to complete Work Order")
        }
        setLoading(false)
    }

    return (
        <Dialog open={open} onOpenChange={(e, data) => onOpenChange(data.open)}>
            <DialogSurface style={{ minWidth: '800px' }}>
                <DialogBody>
                    <DialogTitle>Receive Material & Complete Prep</DialogTitle>
                    <div style={{ marginBottom: '16px' }}>
                        <Text>Input details for the received stock to create inventory records.</Text>
                    </div>
                    <DialogContent className={styles.content}>
                        {items.map((item, idx) => (
                            <div key={item.id} className={styles.itemCard}>
                                <div className={styles.itemHeader}>
                                    <Title3>{idx + 1}: {item.profileType} {item.dimensions} - {item.gradeName}</Title3>
                                    <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
                                        Needed: {item.quantityNeeded} pieces ({item.totalLengthNeeded / 1000}m total)
                                    </Text>
                                </div>

                                <div className={styles.gridThree}>
                                    <div className={styles.field}>
                                        <Label required>Lot ID / Heat Number</Label>
                                        <Input
                                            value={item.lotId}
                                            onChange={(e, d) => updateItem(item.id, 'lotId', d.value)}
                                            placeholder="e.g. HEAT-12345"
                                        />
                                    </div>
                                    <div className={styles.field}>
                                        <Label required>Certificate Filename</Label>
                                        <Input
                                            value={item.certificate}
                                            onChange={(e, d) => updateItem(item.id, 'certificate', d.value)}
                                            placeholder="e.g. CERT-001.pdf"
                                        />
                                    </div>
                                    <div className={styles.field}>
                                        <Label>Total Cost (€)</Label>
                                        <Input
                                            type="number"
                                            value={item.totalCost.toString()}
                                            onChange={(e, d) => updateItem(item.id, 'totalCost', d.value)}
                                            min="0"
                                        />
                                    </div>
                                    <div className={styles.field}>
                                        <Label>Stock Length (mm)</Label>
                                        <Input
                                            type="number"
                                            value={item.receivedLength.toString()}
                                            onChange={(e, d) => updateItem(item.id, 'receivedLength', d.value)}
                                        />
                                    </div>
                                    <div className={styles.field}>
                                        <Label>Quantity Received</Label>
                                        <Input
                                            type="number"
                                            value={item.receivedQuantity.toString()}
                                            onChange={(e, d) => updateItem(item.id, 'receivedQuantity', d.value)}
                                        />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </DialogContent>
                    <DialogActions>
                        <Button appearance="secondary" onClick={() => onOpenChange(false)}>Cancel</Button>
                        <Button appearance="primary" onClick={handleSubmit} disabled={loading}>
                            {loading ? <Spinner size="tiny" /> : "Confirm Receipt & Complete WO"}
                        </Button>
                    </DialogActions>
                </DialogBody>
            </DialogSurface>
        </Dialog>
    )
}
