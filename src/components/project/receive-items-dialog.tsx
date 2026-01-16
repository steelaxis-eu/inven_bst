'use client'

import { useState, useEffect } from 'react'
import {
    Dialog,
    DialogSurface,
    DialogBody,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Input,
    Label,
    Textarea,
    Table,
    TableHeader,
    TableRow,
    TableHeaderCell,
    TableBody,
    TableCell,
    makeStyles,
    tokens,
    shorthands,
    Text,
    Field,
    Spinner,
    Combobox,
    Option
} from "@fluentui/react-components";
import {
    BoxRegular,
    CheckmarkCircleRegular,
    DismissRegular,
    AddRegular,
    DeleteRegular
} from "@fluentui/react-icons";
import { toast } from 'sonner'
import { receivePartBatch } from '@/app/actions/parts'
import { getSuppliers } from '@/app/actions/inventory'
import { FluentFileUploader } from '@/components/common/fluent-file-uploader'
import { PartWithRelations } from '@/types'

const useStyles = makeStyles({
    dialogSurface: {
        width: '95vw',
        maxWidth: '1000px',
        minWidth: '320px',
        height: 'auto',
        maxHeight: '90vh',
    },
    dialogContent: {
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
    },
    grid2: {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '24px',
        '@media (max-width: 768px)': {
            display: 'flex',
            flexDirection: 'column',
        }
    },
    section: {
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
    },
    sectionTitle: {
        fontSize: '14px',
        fontWeight: 'bold',
        textTransform: 'uppercase',
        color: tokens.colorNeutralForeground3,
        borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
        paddingBottom: '8px',
        marginBottom: '8px',
    },
    fileUploaderContainer: {
        border: `1px dashed ${tokens.colorNeutralStroke1}`,
        ...shorthands.borderRadius(tokens.borderRadiusMedium),
        padding: '16px',
        backgroundColor: tokens.colorNeutralBackgroundAlpha,
    }
});

interface ReceiveItemsDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    part: PartWithRelations | null
    onSuccess?: () => void
}

export function ReceiveItemsDialog({ open, onOpenChange, part, onSuccess }: ReceiveItemsDialogProps) {
    const styles = useStyles();
    const [quantity, setQuantity] = useState(1)
    const [heatValues, setHeatValues] = useState<{ [key: number]: string }>({})
    const [supplierId, setSupplierId] = useState<string>('')
    const [suppliers, setSuppliers] = useState<{ id: string, name: string }[]>([])
    const [certificatePath, setCertificatePath] = useState<string | null>(null)
    const [submitting, setSubmitting] = useState(false)

    useEffect(() => {
        if (open) {
            getSuppliers().then(setSuppliers)
            setQuantity(1)
            setHeatValues({})
            setCertificatePath(null)
            setSupplierId('')
        }
    }, [open])

    if (!part) return null

    const handleReceive = async () => {
        if (!part) return
        setSubmitting(true)

        // Validate Heat Numbers
        const heats = []
        for (let i = 0; i < quantity; i++) {
            heats.push(heatValues[i] || '')
        }

        try {
            const res = await receivePartBatch({
                projectId: part.projectId,
                pieceIds: part.pieces.filter(p => p.status === 'PENDING').slice(0, quantity).map(p => p.id),
                supplier: suppliers.find(s => s.id === supplierId)?.name || 'Unknown',
                lotId: heatValues[0] || 'Batch',
                certificatePath: certificatePath || undefined
            })

            if (res.success) {
                toast.success(`Successfully received ${quantity} items`)
                onSuccess?.()
                onOpenChange(false)
            } else {
                toast.error(res.error || "Failed using server action")
            }
        } catch (e: any) {
            toast.error(e.message || "Failed to receive items")
        } finally {
            setSubmitting(false)
        }
    }

    const setHeatValue = (index: number, val: string) => {
        setHeatValues(prev => ({ ...prev, [index]: val }))
    }

    const batchFillHeat = (val: string) => {
        const newHeats: any = {}
        for (let i = 0; i < quantity; i++) {
            newHeats[i] = val
        }
        setHeatValues(newHeats)
    }

    return (
        <Dialog open={open} onOpenChange={(e, data) => onOpenChange(data.open)}>
            <DialogSurface className={styles.dialogSurface}>
                <DialogBody>
                    <DialogTitle>Receive Items: {part.partNumber}</DialogTitle>
                    <DialogContent className={styles.dialogContent}>
                        <div className={styles.grid2}>
                            <div className={styles.section}>
                                <div className={styles.sectionTitle}>Details</div>
                                <Field label="Quantity to Receive">
                                    <Input
                                        type="number"
                                        min={1}
                                        value={quantity.toString()}
                                        onChange={(e, d) => setQuantity(parseInt(d.value) || 1)}
                                    />
                                </Field>
                                <Field label="Supplier (Optional)">
                                    <Combobox
                                        placeholder="Select Supplier"
                                        value={suppliers.find(s => s.id === supplierId)?.name || ''}
                                        onOptionSelect={(e, d) => setSupplierId(d.optionValue || '')}
                                    >
                                        {suppliers.map(s => <Option key={s.id} value={s.id} text={s.name}>{s.name}</Option>)}
                                    </Combobox>
                                </Field>
                            </div>

                            <div className={styles.section}>
                                <div className={styles.sectionTitle}>Certificate</div>
                                <div className={styles.fileUploaderContainer}>
                                    <FluentFileUploader
                                        bucketName="projects"
                                        folderPath={`certificates/${part.projectId}`}
                                        onUploadComplete={(path) => setCertificatePath(path)}
                                        accept=".pdf,image/*"
                                        label="Upload Material Cert"
                                    />
                                    {certificatePath && (
                                        <Text size={200} style={{ color: tokens.colorPaletteGreenForeground1, marginTop: '8px', display: 'block' }}>
                                            <CheckmarkCircleRegular /> Certificate Attached
                                        </Text>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className={styles.section}>
                            <div className={styles.sectionTitle} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span>Heat Numbers / Lot IDs</span>
                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                    {/* Quick fill helper */}
                                    {quantity > 1 && (
                                        <Input
                                            placeholder="Batch fill all..."
                                            size="small"
                                            onChange={(e, d) => batchFillHeat(d.value)}
                                        />
                                    )}
                                </div>
                            </div>

                            <div style={{ maxHeight: '300px', overflowY: 'auto', border: `1px solid ${tokens.colorNeutralStroke2}`, borderRadius: tokens.borderRadiusMedium }}>
                                <Table size="small">
                                    <TableHeader>
                                        <TableRow>
                                            <TableHeaderCell style={{ width: '60px' }}>#</TableHeaderCell>
                                            <TableHeaderCell>Heat Number / Lot ID</TableHeaderCell>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {Array.from({ length: quantity }).map((_, idx) => (
                                            <TableRow key={idx}>
                                                <TableCell>{idx + 1}</TableCell>
                                                <TableCell>
                                                    <Input
                                                        value={heatValues[idx] || ''}
                                                        onChange={(e, d) => setHeatValue(idx, d.value)}
                                                        placeholder="Enter Heat No."
                                                        style={{ width: '100%' }}
                                                    />
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => onOpenChange(false)} appearance="secondary">Cancel</Button>
                        <Button onClick={handleReceive} appearance="primary" disabled={submitting} icon={submitting ? <Spinner size="small" /> : <BoxRegular />}>
                            {submitting ? "Receiving..." : "Receive Items"}
                        </Button>
                    </DialogActions>
                </DialogBody>
            </DialogSurface>
        </Dialog>
    )
}
