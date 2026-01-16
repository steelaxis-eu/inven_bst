'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
    Dialog,
    DialogTrigger,
    DialogSurface,
    DialogTitle,
    DialogBody,
    DialogActions,
    DialogContent,
    Button,
    Input,
    Field,
    makeStyles,
    Dropdown,
    Option,
    tokens
} from "@fluentui/react-components";
import { EditRegular, SaveRegular } from "@fluentui/react-icons";
import { updateInventory } from '@/app/actions/inventory'
import { toast } from "sonner"

const useStyles = makeStyles({
    content: {
        display: "flex",
        flexDirection: "column",
        gap: "16px", // Increased for better spacing
    },
});

interface EditInventoryProps {
    item: {
        id: string
        lotId: string
        length: number
        quantityAtHand: number
        status: string
        costPerMeter: number
        certificateFilename?: string | null
    }
}

export function EditInventoryDialog({ item }: EditInventoryProps) {
    const styles = useStyles();
    const router = useRouter()
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)

    const [lotId, setLotId] = useState(item.lotId)
    const [length, setLength] = useState(item.length.toString())
    const [quantity, setQuantity] = useState(item.quantityAtHand.toString())
    const [status, setStatus] = useState(item.status)

    // Calculate initial total cost
    const initialTotalCost = (item.length * item.quantityAtHand / 1000) * (item.costPerMeter || 0)
    const [totalCost, setTotalCost] = useState(initialTotalCost.toFixed(2))

    const handleSubmit = async () => {
        setLoading(true)
        try {
            const res = await updateInventory(item.id, {
                lotId,
                length: parseFloat(length),
                quantityAtHand: parseInt(quantity),
                status: status as any,
                totalCost: parseFloat(totalCost)
            })
            if (res.success) {
                setOpen(false)
                toast.success("Inventory updated")
                router.refresh()
            } else {
                toast.error(`Error: ${res.error}`)
            }
        } catch (e: any) {
            toast.error(e.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={(e, data) => setOpen(data.open)}>
            <DialogTrigger disableButtonEnhancement>
                <Button appearance="subtle" icon={<EditRegular />} />
            </DialogTrigger>
            <DialogSurface>
                <DialogBody>
                    <DialogTitle>Edit Inventory Item</DialogTitle>
                    <div className={styles.content}>
                        <Field label="Lot ID">
                            <Input value={lotId} onChange={(e, d) => setLotId(d.value)} />
                        </Field>
                        <Field label="Length (mm)">
                            <Input type="number" value={length} onChange={(e, d) => setLength(d.value)} />
                        </Field>
                        <Field label="Quantity At Hand">
                            <Input type="number" value={quantity} onChange={(e, d) => setQuantity(d.value)} />
                        </Field>
                        <Field label="Total Cost (€)">
                            <Input type="number" value={totalCost} onChange={(e, d) => setTotalCost(d.value)} />
                        </Field>
                        <Field label="Status">
                            <Dropdown
                                value={status}
                                onOptionSelect={(e, d) => setStatus(d.optionValue || status)}
                                placeholder="Select Status"
                            >
                                <Option value="ACTIVE">ACTIVE</Option>
                                <Option value="EXHAUSTED">EXHAUSTED</Option>
                            </Dropdown>
                        </Field>
                    </div>
                </DialogBody>
                <DialogActions>
                    <Button appearance="secondary" onClick={() => setOpen(false)}>Close</Button>
                    <Button appearance="primary" icon={<SaveRegular />} disabled={loading} onClick={handleSubmit}>
                        {loading ? 'Saving...' : 'Save Changes'}
                    </Button>
                </DialogActions>
            </DialogSurface>
        </Dialog>
    )
}
