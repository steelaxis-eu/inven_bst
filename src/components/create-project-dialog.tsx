'use client'

import { useState } from 'react'
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
    Textarea,
    tokens,
    shorthands
} from "@fluentui/react-components";
import { AddRegular, SaveRegular } from "@fluentui/react-icons";
import { useRouter } from 'next/navigation'
import { createProject } from '@/app/actions/projects'
import { toast } from "sonner"
import { format } from "date-fns"

const useStyles = makeStyles({
    dialogContent: {
        display: "flex",
        flexDirection: "column",
        gap: "16px",
        width: "90vw",
        maxWidth: "800px",
        minWidth: "320px",
    },
    section: {
        display: "flex",
        flexDirection: "column",
        gap: "12px",
        padding: "16px",
        backgroundColor: tokens.colorNeutralBackground2,
        ...shorthands.borderRadius(tokens.borderRadiusMedium),
    },
    sectionTitle: {
        fontWeight: "bold",
        color: tokens.colorNeutralForeground2,
        textTransform: "uppercase",
        fontSize: "12px",
        borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
        paddingBottom: "8px",
        marginBottom: "8px",
    },
    row: {
        display: "flex",
        gap: "16px",
        flexWrap: "wrap", // Allow wrapping on small screens
    },
    field: {
        display: "flex",
        flexDirection: "column",
        flex: 1,
        gap: "4px"
    }
});

interface CreateProjectDialogProps {
    customers?: any[]
}

export function CreateProjectDialog({ customers = [] }: CreateProjectDialogProps) {
    const styles = useStyles();
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)

    // Form State
    const [projectNumber, setProjectNumber] = useState('')
    const [name, setName] = useState('')
    const [customerId, setCustomerId] = useState<string>('')
    const [coatingType, setCoatingType] = useState<string>('')
    const [corrosionCategory, setCorrosionCategory] = useState<string>('')
    const [corrosionDurability, setCorrosionDurability] = useState<string>('')
    const [corrosionComments, setCorrosionComments] = useState('')
    const [estimatedHours, setEstimatedHours] = useState('')

    // Dates as strings YYYY-MM-DD for input type="date"
    const [contractDateStr, setContractDateStr] = useState('')
    const [deliveryDateStr, setDeliveryDateStr] = useState('')

    const router = useRouter()

    const handleSubmit = async () => {
        if (!name) {
            toast.error("Project Name is required")
            return
        }

        setLoading(true)
        try {
            const res = await createProject({
                number: projectNumber,
                name,
                customerId: customerId || undefined,
                coatingType: coatingType || undefined,
                corrosionCategory: corrosionCategory || undefined,
                corrosionDurability: corrosionDurability || undefined,
                corrosionComments: corrosionComments || undefined,
                contractDate: contractDateStr ? new Date(contractDateStr) : undefined,
                estimatedHours: estimatedHours ? parseFloat(estimatedHours) : undefined,
                deliveryDate: deliveryDateStr ? new Date(deliveryDateStr) : undefined
            })

            if (res.success) {
                toast.success("Project created successfully")
                setOpen(false)
                // Reset form
                setProjectNumber('')
                setName('')
                setCustomerId('')
                setCoatingType('')
                setCorrosionCategory('')
                setCorrosionDurability('')
                setCorrosionComments('')
                setEstimatedHours('')
                setContractDateStr('')
                setDeliveryDateStr('')

                router.refresh()
            } else {
                toast.error(res.error || "Failed to create project")
            }
        } catch (e: any) {
            toast.error("An error occurred")
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={(e, data) => setOpen(data.open)}>
            <DialogTrigger disableButtonEnhancement>
                <Button icon={<AddRegular />}>New Project</Button>
            </DialogTrigger>
            <DialogSurface className={styles.dialogContent}>
                <DialogBody>
                    <DialogTitle>Create New Project</DialogTitle>

                    <div className={styles.section}>
                        <div className={styles.sectionTitle}>Basic Info</div>
                        <div className={styles.row}>
                            <Field label="Project Number" className={styles.field}>
                                <Input
                                    value={projectNumber}
                                    onChange={(e, d) => setProjectNumber(d.value)}
                                    placeholder="(Auto-generated)"
                                />
                            </Field>
                            <Field label="Project Name" required className={styles.field}>
                                <Input
                                    value={name}
                                    onChange={(e, d) => setName(d.value)}
                                    placeholder="e.g. Hangar Expansion"
                                />
                            </Field>
                        </div>
                    </div>

                    <div className={styles.section}>
                        <div className={styles.sectionTitle}>Customer & Schedule</div>
                        <div className={styles.row}>
                            <Field label="Customer" className={styles.field}>
                                <Dropdown
                                    value={customers.find(c => c.id === customerId)?.companyName || (customerId ? "Selected" : "")}
                                    onOptionSelect={(e, d) => setCustomerId(d.optionValue || '')}
                                    placeholder="Select Customer"
                                >
                                    {customers.length === 0 && <Option text="">No customers found</Option>}
                                    {customers.map(c => (
                                        <Option key={c.id} value={c.id} text={c.companyName}>{c.companyName}</Option>
                                    ))}
                                </Dropdown>
                            </Field>
                            <Field label="Contract Date" className={styles.field}>
                                <Input type="date" value={contractDateStr} onChange={(e, d) => setContractDateStr(d.value)} />
                            </Field>
                        </div>
                        <div className={styles.row}>
                            <Field label="Est. Delivery Date" className={styles.field}>
                                <Input type="date" value={deliveryDateStr} onChange={(e, d) => setDeliveryDateStr(d.value)} />
                            </Field>
                            <Field label="Est. Hours" className={styles.field}>
                                <Input type="number" value={estimatedHours} onChange={(e, d) => setEstimatedHours(d.value)} placeholder="Total" />
                            </Field>
                        </div>
                    </div>

                    <div className={styles.section}>
                        <div className={styles.sectionTitle}>Specs</div>
                        <div className={styles.row}>
                            <Field label="Coating" className={styles.field}>
                                <Dropdown
                                    value={coatingType}
                                    onOptionSelect={(e, d) => setCoatingType(d.optionValue || '')}
                                    placeholder="Select"
                                >
                                    <Option value="Painted">Painted</Option>
                                    <Option value="HDG">Hot Dip Galvanized (HDG)</Option>
                                    <Option value="Duplex">Duplex (HDG + Paint)</Option>
                                    <Option value="Powder">Powder Coated</Option>
                                    <Option value="None">None / Raw</Option>
                                </Dropdown>
                            </Field>
                            <Field label="Category" className={styles.field}>
                                <Dropdown
                                    value={corrosionCategory}
                                    onOptionSelect={(e, d) => setCorrosionCategory(d.optionValue || '')}
                                    placeholder="C1-CX"
                                >
                                    {["C1", "C2", "C3", "C4", "C5", "CX"].map(c => <Option key={c}>{c}</Option>)}
                                </Dropdown>
                            </Field>
                            <Field label="Durability" className={styles.field}>
                                <Dropdown
                                    value={corrosionDurability}
                                    onOptionSelect={(e, d) => setCorrosionDurability(d.optionValue || '')}
                                    placeholder="L-VH"
                                >
                                    <Option value="L">Low (L)</Option>
                                    <Option value="M">Medium (M)</Option>
                                    <Option value="H">High (H)</Option>
                                    <Option value="VH">Very High (VH)</Option>
                                </Dropdown>
                            </Field>
                        </div>
                        <Field label="Comments" className={styles.field}>
                            <Textarea value={corrosionComments} onChange={(e, d) => setCorrosionComments(d.value)} />
                        </Field>
                    </div>

                </DialogBody>
                <DialogActions>
                    <Button appearance="secondary" onClick={() => setOpen(false)}>Cancel</Button>
                    <Button appearance="primary" icon={<SaveRegular />} disabled={loading} onClick={handleSubmit}>
                        {loading ? "Creating..." : "Create Project"}
                    </Button>
                </DialogActions>
            </DialogSurface>
        </Dialog>
    )
}
