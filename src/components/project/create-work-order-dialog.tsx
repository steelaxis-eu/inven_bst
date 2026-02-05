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
    Dropdown,
    Option,
    Textarea,
    makeStyles,
    tokens,
    Field,
    Spinner,
    Combobox,
    Switch,
    Text
} from "@fluentui/react-components";
import {
    ClipboardTaskRegular,
    DismissRegular,
    SaveRegular,
    CalendarRegular,
    ScanRegular,
    ArrowLeftRegular,
    CheckmarkRegular
} from "@fluentui/react-icons";
import { toast } from 'sonner'
import { createSmartWorkOrder, getOptimizationPreview } from '@/app/actions/workorders' // Use smart actions
import { NestingVisualizer } from './nesting-visualizer'

const useStyles = makeStyles({
    dialogContent: {
        display: "flex",
        flexDirection: "column",
        gap: "20px",
        minWidth: "600px",
        height: '80vh', // Fixed height for scrolling
    },
    section: {
        display: "flex",
        flexDirection: "column",
        gap: "12px",
    },
    grid2: {
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "16px",
    },
    switchRow: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "12px",
        borderRadius: tokens.borderRadiusMedium,
        border: `1px solid ${tokens.colorNeutralStroke2}`,
        backgroundColor: tokens.colorNeutralBackgroundAlpha
    }
});

const WO_TYPES = [
    { id: 'CUTTING', label: 'Material Cutting' },
    { id: 'WELDING', label: 'Welding / Assembly' },
    { id: 'FABRICATION', label: 'Fabrication' },
    { id: 'PAINTING', label: 'Surface Treatment' },
    { id: 'LOGISTICS', label: 'Transport / Delivery' },
    { id: 'MACHINING', label: 'Machining' },
    { id: 'INSPECTION', label: 'Inspection / QC' }
]

const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

interface CreateWorkOrderDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    projectId: string
    selectedParts?: string[] // IDs of parts to include
    selectedPlates?: string[] // IDs of plate pieces to include
    onSuccess?: () => void
}

export function CreateWorkOrderDialog({ open, onOpenChange, projectId, selectedParts = [], selectedPlates = [], onSuccess }: CreateWorkOrderDialogProps) {
    const styles = useStyles();
    const [step, setStep] = useState(1); // 1 = Config, 2 = Optimization/Review
    const [submitting, setSubmitting] = useState(false)
    const [optimizationResult, setOptimizationResult] = useState<any>(null)
    const [customOverrides, setCustomOverrides] = useState<Record<string, number>>({})
    const [calculating, setCalculating] = useState(false)

    // Form State
    const [type, setType] = useState<string>('CUTTING')
    const [title, setTitle] = useState('')
    const [priority, setPriority] = useState('MEDIUM')
    const [isOutsourced, setIsOutsourced] = useState(false)
    const [supplyMaterial, setSupplyMaterial] = useState(false)
    const [vendor, setVendor] = useState('')
    const [notes, setNotes] = useState('')
    const [dueDate, setDueDate] = useState('')

    const handleNext = async () => {
        if (!title) {
            toast.error("Please enter a title for the order")
            return
        }

        // Logic check: optimizing only makes sense for CUTTING or Outsourced+Supply
        if (type === 'CUTTING' || (isOutsourced && supplyMaterial)) {
            setSubmitting(true)
            try {
                // Combine IDs
                const pieceIds = [...selectedParts, ...selectedPlates];
                const res = await getOptimizationPreview(pieceIds, customOverrides)

                if (res.success) {
                    setOptimizationResult(res.plans)
                    setStep(2)
                } else {
                    toast.error(res.error || "Optimization failed")
                }
            } catch (e) {
                toast.error("Failed to run optimization")
            } finally {
                setSubmitting(false)
            }
        } else {
            // Direct Submit
            await handleSubmit()
        }
    }

    const handleSubmit = async () => {
        setSubmitting(true)
        try {
            const pieceIds = [...selectedParts, ...selectedPlates];
            const res = await createSmartWorkOrder({
                projectId,
                type,
                title,
                priority: priority as any,
                isOutsourced,
                supplyMaterial,
                vendor: vendor || undefined,
                notes,
                scheduledDate: dueDate ? new Date(dueDate) : undefined,
                pieceIds
            })

            if (res.success) {
                toast.success("Work Order created successfully")
                if (onSuccess) onSuccess()
                onOpenChange(false)
                // Reset
                setStep(1)
                setOptimizationResult(null)
            } else {
                toast.error(res.error || "Failed to create work order")
            }
        } catch (e: any) {
            toast.error(e.message || "An error occurred")
        } finally {
            setSubmitting(false)
        }
    }

    const handleOverrideChange = async (profileKey: string, val: string) => {
        // Optimistic update
        const num = parseInt(val)
        let newOverrides = { ...customOverrides }

        if (!val) {
            delete newOverrides[profileKey]
        } else if (!isNaN(num) && num > 0) {
            newOverrides[profileKey] = num
        }

        setCustomOverrides(newOverrides)

        // Trigger recalc
        setCalculating(true)
        try {
            const pieceIds = [...selectedParts, ...selectedPlates];
            const res = await getOptimizationPreview(pieceIds, newOverrides)
            if (res.success) {
                setOptimizationResult(res.plans)
            }
        } catch (e) {
            toast.error("Failed to recalculate")
        } finally {
            setCalculating(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={(e, data) => onOpenChange(data.open)}>
            <DialogSurface style={{ maxWidth: '900px', width: '100%' }}>
                <DialogBody>
                    <DialogTitle>{step === 1 ? "Create Work Order" : "Review Optimization Plan"}</DialogTitle>
                    <DialogContent className={styles.dialogContent}>
                        {step === 1 ? (
                            // STEP 1: CONFIGURATION
                            <div className={styles.section}>
                                <div className={styles.grid2}>
                                    <Field label="Order Type" required>
                                        <Dropdown
                                            value={WO_TYPES.find(t => t.id === type)?.label}
                                            selectedOptions={[type]}
                                            onOptionSelect={(e, d) => setType(d.optionValue as string)}
                                        >
                                            {WO_TYPES.map(t => (
                                                <Option key={t.id} value={t.id} text={t.label}>{t.label}</Option>
                                            ))}
                                        </Dropdown>
                                    </Field>
                                    <Field label="Priority" required>
                                        <Dropdown
                                            value={priority}
                                            selectedOptions={[priority]}
                                            onOptionSelect={(e, d) => setPriority(d.optionValue as string)}
                                        >
                                            {PRIORITIES.map(p => <Option key={p} value={p}>{p}</Option>)}
                                        </Dropdown>
                                    </Field>
                                </div>

                                <Field label="Order Title" required>
                                    <Input
                                        value={title}
                                        onChange={(e, d) => setTitle(d.value)}
                                        placeholder="e.g. Phase 1 Cutting"
                                    />
                                </Field>

                                <Field label="Due Date">
                                    <Input
                                        type="date"
                                        value={dueDate}
                                        onChange={(e, d) => setDueDate(d.value)}
                                        contentAfter={<CalendarRegular />}
                                    />
                                </Field>

                                {/* Outsourcing Section */}
                                <div style={{ border: `1px solid ${tokens.colorNeutralStroke2}`, borderRadius: tokens.borderRadiusMedium, padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    <div className={styles.switchRow}>
                                        <div>
                                            <div style={{ fontWeight: 'bold' }}>Outsource Work</div>
                                            <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>Is this work performed by an external vendor?</Text>
                                        </div>
                                        <Switch checked={isOutsourced} onChange={(e, d) => setIsOutsourced(d.checked)} />
                                    </div>

                                    {isOutsourced && (
                                        <>
                                            <Field label="Vendor Name">
                                                <Input value={vendor} onChange={(e, d) => setVendor(d.value)} placeholder="e.g. Laser Co." />
                                            </Field>

                                            <div className={styles.switchRow}>
                                                <div>
                                                    <div style={{ fontWeight: 'bold' }}>Supply Material Internally?</div>
                                                    <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>If checked, we will create a Material Prep WO.</Text>
                                                </div>
                                                <Switch checked={supplyMaterial} onChange={(e, d) => setSupplyMaterial(d.checked)} />
                                            </div>
                                        </>
                                    )}
                                </div>

                                <Field label="Notes">
                                    <Textarea value={notes} onChange={(e, d) => setNotes(d.value)} rows={3} />
                                </Field>
                            </div>
                        ) : (
                            // STEP 2: VISUALIZATION
                            <div className={styles.section}>
                                <div style={{ padding: '16px', backgroundColor: tokens.colorBrandBackground2, borderRadius: tokens.borderRadiusMedium, color: tokens.colorBrandForeground2 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold', marginBottom: '4px' }}>
                                        <ScanRegular /> Optimization Preview
                                    </div>
                                    <Text>
                                        Review how we plan to cut these parts. We will create <strong>Immediate Cutting WOs</strong> for available stock and <strong>Material Prep WOs</strong> for what needs to be bought.
                                    </Text>
                                </div>

                                <div style={{ overflowY: 'auto', flex: 1, paddingRight: '8px' }}>
                                    {optimizationResult && optimizationResult.map((plan: any, i: number) => {
                                        if (plan.type === 'profile' && plan.canOptimize) {
                                            return (
                                                <NestingVisualizer
                                                    key={i}
                                                    plan={plan}
                                                    extraHeaderContent={
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                            <Combobox
                                                                style={{ width: '100px' }}
                                                                size="small"
                                                                freeform
                                                                placeholder="Length"
                                                                disabled={calculating}
                                                                value={(customOverrides[plan.materialKey] || 12000).toString()}
                                                                onOptionSelect={(e, d) => {
                                                                    if (d.optionValue) {
                                                                        handleOverrideChange(plan.materialKey, d.optionValue)
                                                                    }
                                                                }}
                                                                onChange={(e) => {
                                                                    handleOverrideChange(plan.materialKey, e.target.value)
                                                                }}
                                                            >
                                                                <Option value="6000">6000 (6m)</Option>
                                                                <Option value="12000">12000 (12m)</Option>
                                                            </Combobox>
                                                            {calculating && <Spinner size="tiny" />}
                                                        </div>
                                                    }
                                                />
                                            )
                                        } else if (plan.type === 'plate') {
                                            return (
                                                <div key={i} style={{ padding: '12px', marginBottom: '8px', border: `1px solid ${tokens.colorNeutralStroke2}`, borderRadius: tokens.borderRadiusMedium }}>
                                                    <div style={{ fontWeight: 'bold' }}>{plan.profile} ({plan.grade})</div>
                                                    <div style={{ fontSize: '12px', color: tokens.colorNeutralForeground3 }}>
                                                        {plan.summary.count} Pieces &bull; {plan.summary.totalAreaM2}m² Total
                                                    </div>
                                                </div>
                                            )
                                        } else {
                                            return (
                                                <div key={i} style={{ padding: '12px', marginBottom: '8px', backgroundColor: tokens.colorPaletteYellowBackground1, borderRadius: tokens.borderRadiusMedium }}>
                                                    <strong>{plan.materialKey}</strong>: {plan.error || "Cannot optimize."}
                                                </div>
                                            )
                                        }
                                    })}
                                </div>
                            </div>
                        )}
                    </DialogContent>
                    <DialogActions>
                        {step === 2 && (
                            <Button appearance="subtle" icon={<ArrowLeftRegular />} onClick={() => setStep(1)} disabled={submitting}>Back</Button>
                        )}
                        <Button
                            appearance={step === 1 ? "secondary" : "subtle"} // If step 1, cancel button style. If step 2, we have back button so this can be hidden/changed. 
                            onClick={() => onOpenChange(false)}
                            disabled={submitting}
                        >
                            Cancel
                        </Button>

                        {step === 1 ? (
                            <Button appearance="primary" onClick={handleNext} disabled={submitting} icon={submitting ? <Spinner size="small" /> : <ScanRegular />}>
                                {(type === 'CUTTING' || (isOutsourced && supplyMaterial)) ? "Next: Optimization" : "Create Order"}
                            </Button>
                        ) : (
                            <Button appearance="primary" onClick={handleSubmit} disabled={submitting} icon={submitting ? <Spinner size="small" /> : <CheckmarkRegular />}>
                                {submitting ? "Creating..." : "Confirm & Create"}
                            </Button>
                        )}
                    </DialogActions>
                </DialogBody>
            </DialogSurface>
        </Dialog>
    )
}
