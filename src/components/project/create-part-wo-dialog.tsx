'use client'

import { useState } from 'react'
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
    Dropdown,
    Option,
    Table,
    TableHeader,
    TableRow,
    TableHeaderCell,
    TableBody,
    TableCell,
    Badge,
    Spinner,
    makeStyles,
    tokens,
    Text
} from "@fluentui/react-components"
import {
    WrenchRegular
} from "@fluentui/react-icons"
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createPartPrepWorkOrder } from '@/app/actions/workorders'

interface SelectedPiece {
    pieceId: string
    partNumber: string
    pieceNumber: number
    status: string
}

interface CreatePartWODialogProps {
    projectId: string
    selectedPieces: SelectedPiece[]
    open: boolean
    onOpenChange: (open: boolean) => void
}

const useStyles = makeStyles({
    content: {
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
    },
    grid: {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '16px',
    },
    field: {
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
    },
    tableContainer: {
        border: `1px solid ${tokens.colorNeutralStroke1}`,
        borderRadius: tokens.borderRadiusMedium,
        overflow: 'hidden',
    },
    badgeContainer: {
        display: 'flex',
        gap: '4px',
        flexWrap: 'wrap',
    }
})

export function CreatePartWODialog({
    projectId,
    selectedPieces,
    open,
    onOpenChange
}: CreatePartWODialogProps) {
    const styles = useStyles()
    const [loading, setLoading] = useState(false)
    const [title, setTitle] = useState('')
    const [woType, setWoType] = useState('CUTTING')
    const [priority, setPriority] = useState('MEDIUM')
    const [scheduledDate, setScheduledDate] = useState('')
    const router = useRouter()

    const handleSubmit = async () => {
        if (selectedPieces.length === 0) return
        setLoading(true)

        try {
            const res = await createPartPrepWorkOrder({
                projectId,
                pieceIds: selectedPieces.map(p => p.pieceId),
                title: title || `${woType} - ${selectedPieces.length} pieces`,
                priority,
                scheduledDate: scheduledDate ? new Date(scheduledDate) : undefined
            })

            if (res.error) {
                toast.error(res.error)
                setLoading(false)
                return
            }

            const woNum = (res as any).data?.mainWO?.workOrderNumber
                || (res as any).data?.workOrderNumber
                || (res as any).message
                || "created"

            toast.success(`Work Order(s) ${woNum}`)
            onOpenChange(false)
            router.refresh()

        } catch (e: any) {
            toast.error('Failed to create work order')
        } finally {
            setLoading(false)
        }
    }

    const groupedPieces = selectedPieces.reduce((acc, piece) => {
        if (!acc[piece.partNumber]) {
            acc[piece.partNumber] = []
        }
        acc[piece.partNumber].push(piece)
        return acc
    }, {} as Record<string, SelectedPiece[]>)

    return (
        <Dialog open={open} onOpenChange={(e, data) => onOpenChange(data.open)}>
            <DialogSurface>
                <DialogBody>
                    <DialogTitle>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <WrenchRegular />
                            Create Work Order for Parts
                        </div>
                    </DialogTitle>
                    <div style={{ marginBottom: '12px' }}>
                        <Text>Create work order for {selectedPieces.length} selected pieces</Text>
                    </div>

                    <DialogContent className={styles.content}>
                        <div className={styles.grid}>
                            <div className={styles.field}>
                                <Label>Title (optional)</Label>
                                <Input
                                    value={title}
                                    onChange={(e, d) => setTitle(d.value)}
                                    placeholder="Auto-generated"
                                />
                            </div>
                            <div className={styles.field}>
                                <Label>Work Type</Label>
                                <Dropdown
                                    value={woType}
                                    selectedOptions={[woType]}
                                    onOptionSelect={(e, d) => setWoType(d.optionValue as string)}
                                >
                                    {[
                                        { key: "MATERIAL_PREP", text: "Material Prep/Order" },
                                        { key: "CUTTING", text: "Cutting" },
                                        { key: "MACHINING", text: "Drilling/Machining" },
                                        { key: "FABRICATION", text: "Fabrication" },
                                        { key: "WELDING", text: "Welding" },
                                        { key: "COATING", text: "Coating" }
                                    ].map(opt => (
                                        <Option key={opt.key} value={opt.key} text={opt.text}>
                                            {opt.text}
                                        </Option>
                                    ))}
                                </Dropdown>
                            </div>
                            <div className={styles.field}>
                                <Label>Priority</Label>
                                <Dropdown
                                    value={priority}
                                    selectedOptions={[priority]}
                                    onOptionSelect={(e, d) => setPriority(d.optionValue as string)}
                                >
                                    {['LOW', 'MEDIUM', 'HIGH', 'URGENT'].map(p => (
                                        <Option key={p} value={p} text={p}>{p}</Option>
                                    ))}
                                </Dropdown>
                            </div>
                            <div className={styles.field}>
                                <Label>Scheduled Date</Label>
                                <Input
                                    type="date"
                                    value={scheduledDate}
                                    onChange={(e, d) => setScheduledDate(d.value)}
                                />
                            </div>
                        </div>

                        <div className={styles.tableContainer}>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHeaderCell>Part #</TableHeaderCell>
                                        <TableHeaderCell>Pieces</TableHeaderCell>
                                        <TableHeaderCell style={{ textAlign: 'center' }}>Count</TableHeaderCell>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {Object.entries(groupedPieces).map(([partNumber, pieces]) => (
                                        <TableRow key={partNumber}>
                                            <TableCell style={{ fontFamily: 'monospace', fontWeight: 500 }}>{partNumber}</TableCell>
                                            <TableCell>
                                                <div className={styles.badgeContainer}>
                                                    {pieces.map(p => (
                                                        <Badge key={p.pieceId} appearance="outline" size="small">
                                                            #{p.pieceNumber}
                                                        </Badge>
                                                    ))}
                                                </div>
                                            </TableCell>
                                            <TableCell style={{ textAlign: 'center', fontWeight: 500 }}>
                                                {pieces.length}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </DialogContent>

                    <DialogActions>
                        <Button appearance="secondary" onClick={() => onOpenChange(false)}>Cancel</Button>
                        <Button
                            appearance="primary"
                            onClick={handleSubmit}
                            disabled={loading || selectedPieces.length === 0}
                            icon={loading ? <Spinner size="tiny" /> : undefined}
                        >
                            {loading ? "Creating..." : "Create Work Order"}
                        </Button>
                    </DialogActions>
                </DialogBody>
            </DialogSurface>
        </Dialog>
    )
}
