'use client'

import { useState } from "react"
import {
    Button,
    Dialog,
    DialogTrigger,
    DialogSurface,
    DialogTitle,
    DialogBody,
    DialogContent,
    DialogActions,
    Input,
    Label,
    Dropdown,
    Option,
    Textarea,
    makeStyles,
    tokens,
    Spinner
} from "@fluentui/react-components"
import { AddRegular } from "@fluentui/react-icons"
import { createQualityCheck } from "@/app/actions/quality"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

const useStyles = makeStyles({
    content: {
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
    },
    gridTwo: {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '16px',
    },
    resultBox: {
        backgroundColor: tokens.colorNeutralBackground2,
        padding: '16px',
        borderRadius: tokens.borderRadiusMedium,
        border: `1px solid ${tokens.colorNeutralStroke2}`,
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        marginTop: '8px',
    },
    resultLabel: {
        color: tokens.colorBrandForeground1,
        fontWeight: tokens.fontWeightSemibold,
    },
    passedBox: {
        backgroundColor: tokens.colorPaletteGreenBackground1,
        color: tokens.colorPaletteGreenForeground1,
        padding: '8px 12px',
        borderRadius: tokens.borderRadiusMedium,
        fontSize: '12px',
        border: `1px solid ${tokens.colorPaletteGreenBorder1}`,
    }
})

interface CreateQualityCheckDialogProps {
    projectId: string
    assemblyOptions?: { id: string, name: string, assemblyNumber: string }[]
}

const PROCESS_STAGES = [
    'FABRICATION',
    'WELDING',
    'PAINTING',
    'FINAL'
]

const CHECK_TYPES = [
    'VISUAL',
    'DIMENSIONAL',
    'NDT',
    'COATING'
]

export function CreateQualityCheckDialog({ projectId, assemblyOptions = [] }: CreateQualityCheckDialogProps) {
    const styles = useStyles()
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const router = useRouter()

    const [formData, setFormData] = useState({
        assemblyId: 'PROJECT_LEVEL',
        processStage: '',
        type: '',
        dueDate: '',
        notes: '',
        status: 'PENDING',
        findings: '',
        ncr: ''
    })

    const handleSubmit = async () => {
        if (!formData.processStage || !formData.type) {
            toast.error("Please fill in required fields")
            return
        }

        if (formData.status === 'FAILED' && !formData.findings) {
            toast.error("Please provide findings for failed inspection")
            return
        }

        setLoading(true)
        try {
            const result = await createQualityCheck({
                projectId,
                assemblyId: formData.assemblyId === 'PROJECT_LEVEL' ? undefined : formData.assemblyId,
                processStage: formData.processStage as any,
                type: formData.type as any,
                dueDate: formData.dueDate ? new Date(formData.dueDate) : undefined,
                notes: formData.notes,
                status: formData.status as any,
                findings: formData.findings,
                ncr: formData.ncr
            })

            if (result.success) {
                toast.success("Quality check created")
                setOpen(false)
                setFormData({
                    assemblyId: 'PROJECT_LEVEL',
                    processStage: '',
                    type: '',
                    dueDate: '',
                    notes: '',
                    status: 'PENDING',
                    findings: '',
                    ncr: ''
                })
                router.refresh()
            } else {
                toast.error(result.error || "Failed to create quality check")
            }
        } catch (error) {
            toast.error("An unexpected error occurred")
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={(e, data) => setOpen(data.open)}>
            <DialogTrigger disableButtonEnhancement>
                <Button icon={<AddRegular />}>New Inspection</Button>
            </DialogTrigger>
            <DialogSurface>
                <DialogBody>
                    <DialogTitle>Create Quality Inspection</DialogTitle>
                    <DialogContent className={styles.content}>

                        {/* Assembly Selection */}
                        <div>
                            <Label>Assembly (Optional)</Label>
                            <Dropdown
                                value={formData.assemblyId === 'PROJECT_LEVEL' ? 'Project Level (General)' : assemblyOptions.find(a => a.id === formData.assemblyId)?.assemblyNumber || ''}
                                selectedOptions={[formData.assemblyId]}
                                onOptionSelect={(e, d) => setFormData({ ...formData, assemblyId: d.optionValue as string })}
                                style={{ width: '100%' }}
                            >
                                <Option value="PROJECT_LEVEL" text="Project Level (General)">Project Level (General)</Option>
                                {assemblyOptions.map(a => (
                                    <Option key={a.id} value={a.id} text={`${a.assemblyNumber} - ${a.name}`}>
                                        {a.assemblyNumber} - {a.name}
                                    </Option>
                                ))}
                            </Dropdown>
                        </div>

                        <div className={styles.gridTwo}>
                            {/* Process Stage */}
                            <div>
                                <Label required>Process Stage</Label>
                                <Dropdown
                                    value={formData.processStage}
                                    selectedOptions={[formData.processStage]}
                                    onOptionSelect={(e, d) => setFormData({ ...formData, processStage: d.optionValue as string })}
                                    style={{ width: '100%' }}
                                    placeholder="Select stage"
                                >
                                    {PROCESS_STAGES.map(s => (
                                        <Option key={s} value={s} text={s}>{s}</Option>
                                    ))}
                                </Dropdown>
                            </div>

                            {/* Type */}
                            <div>
                                <Label required>Inspection Type</Label>
                                <Dropdown
                                    value={formData.type}
                                    selectedOptions={[formData.type]}
                                    onOptionSelect={(e, d) => setFormData({ ...formData, type: d.optionValue as string })}
                                    style={{ width: '100%' }}
                                    placeholder="Select type"
                                >
                                    {CHECK_TYPES.map(t => (
                                        <Option key={t} value={t} text={t}>{t}</Option>
                                    ))}
                                </Dropdown>
                            </div>
                        </div>

                        {/* Due Date */}
                        <div>
                            <Label>Due Date</Label>
                            <Input
                                type="date"
                                value={formData.dueDate}
                                onChange={(e, d) => setFormData({ ...formData, dueDate: d.value })}
                                style={{ width: '100%' }}
                            />
                        </div>

                        {/* Notes */}
                        <div>
                            <Label>Notes / Instructions</Label>
                            <Textarea
                                placeholder="Specific instructions for inspector..."
                                value={formData.notes}
                                onChange={(e, d) => setFormData({ ...formData, notes: d.value })}
                                style={{ width: '100%' }}
                            />
                        </div>

                        <div className={styles.resultBox}>
                            <Label className={styles.resultLabel}>Result Recording (Optional)</Label>
                            <div>
                                <Label>Status</Label>
                                <Dropdown
                                    value={formData.status}
                                    selectedOptions={[formData.status]}
                                    onOptionSelect={(e, d) => setFormData({ ...formData, status: d.optionValue as string })}
                                    style={{ width: '100%' }}
                                >
                                    <Option value="PENDING" text="Pending (Schedule)">Pending (Schedule)</Option>
                                    <Option value="PASSED" text="PASSED">PASSED</Option>
                                    <Option value="FAILED" text="FAILED (Create NCR)">FAILED (Create NCR)</Option>
                                    <Option value="WAIVED" text="WAIVED">WAIVED</Option>
                                </Dropdown>
                            </div>

                            {formData.status === 'FAILED' && (
                                <>
                                    <div>
                                        <Label style={{ color: tokens.colorPaletteRedForeground1 }}>Discrepancies / Findings</Label>
                                        <Textarea
                                            placeholder="Describe the defect..."
                                            value={formData.findings}
                                            onChange={(e, d) => setFormData({ ...formData, findings: d.value })}
                                            style={{ width: '100%', borderColor: tokens.colorPaletteRedBorder1 }}
                                        />
                                    </div>
                                    <div>
                                        <Label style={{ color: tokens.colorPaletteRedForeground1 }}>NCR Number (Optional)</Label>
                                        <Input
                                            placeholder="(Auto-generated if empty)"
                                            value={formData.ncr}
                                            onChange={(e, d) => setFormData({ ...formData, ncr: d.value })}
                                            style={{ width: '100%', borderColor: tokens.colorPaletteRedBorder1 }}
                                        />
                                        <p style={{ fontSize: '11px', color: tokens.colorNeutralForeground3 }}>
                                            Leave empty to auto-generate from Settings.
                                        </p>
                                    </div>
                                </>
                            )}

                            {formData.status === 'PASSED' && (
                                <div className={styles.passedBox}>
                                    Inspection will be marked as passed immediately.
                                </div>
                            )}
                        </div>
                    </DialogContent>
                    <DialogActions>
                        <Button appearance="secondary" onClick={() => setOpen(false)}>Cancel</Button>
                        <Button appearance="primary" onClick={handleSubmit} disabled={loading}>
                            {loading ? <Spinner size="tiny" /> : "Create Inspection"}
                        </Button>
                    </DialogActions>
                </DialogBody>
            </DialogSurface>
        </Dialog>
    )
}
