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
    Label,
    makeStyles,
    tokens,
    RadioGroup,
    Radio,
    Text,
    Spinner
} from "@fluentui/react-components";
import { EditRegular, SaveRegular } from "@fluentui/react-icons";
import { updateUsageLine } from '@/app/actions/usage'
import { toast } from "sonner"

const useStyles = makeStyles({
    content: {
        display: "flex",
        flexDirection: "column",
        gap: "16px",
    },
    infoRow: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "8px",
        backgroundColor: tokens.colorNeutralBackground2,
        borderRadius: tokens.borderRadiusMedium,
    },
    value: {
        fontFamily: tokens.fontFamilyMonospace,
        fontWeight: "bold",
    },
    remainingBad: {
        color: tokens.colorPaletteRedForeground1,
    }
});

interface EditUsageProps {
    usageId: string
    originalLength: number
    cost: number
    costPerMeter: number
    profile: string
    initialStatus?: 'SCRAP' | 'AVAILABLE'
}

export function EditUsageDialog({ usageId, originalLength, cost, costPerMeter, profile, initialStatus }: EditUsageProps) {
    const styles = useStyles();
    const router = useRouter()
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)

    // Calculate initial values
    const initialLengthUsed = costPerMeter > 0 ? (cost / costPerMeter) * 1000 : 0
    const [lengthUsed, setLengthUsed] = useState(initialLengthUsed.toFixed(0))
    const [status, setStatus] = useState<'SCRAP' | 'AVAILABLE'>(initialStatus || 'SCRAP')

    // Derived values
    const newUsed = parseFloat(lengthUsed)
    const remaining = originalLength - (isNaN(newUsed) ? 0 : newUsed)
    const isValid = !isNaN(newUsed) && newUsed > 0 && newUsed <= originalLength

    const handleSubmit = async () => {
        if (!isValid) return
        setLoading(true)
        try {
            const res = await updateUsageLine(usageId, newUsed, status)
            if (res.success) {
                setOpen(false)
                router.refresh()
                toast.success("Usage updated")
            } else {
                toast.error(`Error: ${(res as any).error}`)
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
                <Button appearance="subtle" icon={<EditRegular />} size="small" />
            </DialogTrigger>
            <DialogSurface>
                <DialogBody>
                    <DialogTitle>Edit Usage</DialogTitle>
                    <DialogContent className={styles.content}>
                        <div style={{ marginBottom: "16px" }}>
                            <Text size={200} style={{ color: tokens.colorNeutralForeground2 }}>
                                Modify length used for <strong>{profile}</strong>. This will regenerate the remnant/scrap.
                            </Text>
                        </div>

                        <div className={styles.infoRow}>
                            <Text>Total Item Length</Text>
                            <Text className={styles.value}>{originalLength}mm</Text>
                        </div>

                        <div>
                            <Label required>Used Length (mm)</Label>
                            <Input
                                type="number"
                                value={lengthUsed}
                                onChange={(e, d) => setLengthUsed(d.value)}
                                min={0}
                                max={originalLength}
                                style={{ width: '100%' }}
                            />
                            {!isValid && lengthUsed && (
                                <Text size={200} style={{ color: tokens.colorPaletteRedForeground1 }}>Invalid length</Text>
                            )}
                        </div>

                        <div className={styles.infoRow}>
                            <Text>Remaining</Text>
                            <Text className={`${styles.value} ${remaining < 0 ? styles.remainingBad : ''}`}>
                                {remaining.toFixed(0)}mm
                            </Text>
                        </div>

                        {remaining > 0 && (
                            <div>
                                <Label>Remaining Action</Label>
                                <RadioGroup value={status} onChange={(e, d) => setStatus(d.value as any)} layout="horizontal">
                                    <Radio value="AVAILABLE" label="Remnant (Keep)" />
                                    <Radio value="SCRAP" label="Scrap (Discard)" />
                                </RadioGroup>
                            </div>
                        )}
                    </DialogContent>
                    <DialogActions>
                        <Button appearance="secondary" onClick={() => setOpen(false)}>Cancel</Button>
                        <Button appearance="primary" icon={loading ? <Spinner size="tiny" /> : <SaveRegular />} disabled={!isValid || loading} onClick={handleSubmit}>
                            {loading ? 'Saving...' : 'Save Changes'}
                        </Button>
                    </DialogActions>
                </DialogBody>
            </DialogSurface>
        </Dialog>
    )
}
