'use client'

import { useState } from 'react'
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
    makeStyles,
    tokens
} from "@fluentui/react-components"
import { SettingsRegular } from "@fluentui/react-icons"
import { useRouter } from 'next/navigation'
import { updateProject } from '@/app/actions/projects'

// Coating type options
const COATING_TYPES = [
    { value: 'NONE', text: 'None' },
    { value: 'HDG', text: 'Hot-Dip Galvanized' },
    { value: 'PAINTED', text: 'Painted' },
    { value: 'POWDER_COATED', text: 'Powder Coated' },
    { value: 'EPOXY', text: 'Epoxy Coated' },
    { value: 'ZINC_PRIMER', text: 'Zinc Primer' },
    { value: 'INTUMESCENT', text: 'Intumescent (Fire)' },
]

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
    sectionTitle: {
        fontWeight: tokens.fontWeightSemibold,
        marginTop: '16px',
        marginBottom: '8px',
        borderTop: `1px solid ${tokens.colorNeutralStroke2}`,
        paddingTop: '16px',
    }
})

interface EditProjectDialogProps {
    project: {
        id: string
        name: string
        client: string | null
        description: string | null
        priority: string
        coatingType: string | null
        coatingSpec: string | null
    }
}

export function EditProjectDialog({ project }: EditProjectDialogProps) {
    const styles = useStyles()
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const [name, setName] = useState(project.name)
    const [client, setClient] = useState(project.client || '')
    const [description, setDescription] = useState(project.description || '')
    const [priority, setPriority] = useState(project.priority)
    const [coatingType, setCoatingType] = useState(project.coatingType || 'NONE')
    const [coatingSpec, setCoatingSpec] = useState(project.coatingSpec || '')
    const router = useRouter()

    const handleSubmit = async () => {
        setLoading(true)
        try {
            const res = await updateProject(project.id, {
                name,
                client: client || undefined,
                description: description || undefined,
                priority: priority as any,
                coatingType: coatingType === 'NONE' ? undefined : coatingType,
                coatingSpec: coatingSpec || undefined
            })
            if (res.success) {
                setOpen(false)
                router.refresh()
            } else {
                alert(`Error: ${res.error}`)
            }
        } catch (e: any) {
            alert("Failed to update project")
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={(e, data) => setOpen(data.open)}>
            <DialogTrigger disableButtonEnhancement>
                <Button appearance="subtle" icon={<SettingsRegular />}>Settings</Button>
            </DialogTrigger>
            <DialogSurface>
                <DialogBody>
                    <DialogTitle>Project Settings</DialogTitle>
                    <DialogContent className={styles.content}>
                        <div>
                            <Label>Project Name</Label>
                            <Input
                                value={name}
                                onChange={(e, d) => setName(d.value)}
                                style={{ width: '100%' }}
                            />
                        </div>
                        <div className={styles.gridTwo}>
                            <div>
                                <Label>Client</Label>
                                <Input
                                    value={client}
                                    onChange={(e, d) => setClient(d.value)}
                                    placeholder="Customer name"
                                    style={{ width: '100%' }}
                                />
                            </div>
                            <div>
                                <Label>Priority</Label>
                                <Dropdown
                                    value={priority}
                                    selectedOptions={[priority]}
                                    onOptionSelect={(e, d) => setPriority(d.optionValue as string)}
                                    style={{ width: '100%' }}
                                >
                                    <Option value="LOW" text="Low">Low</Option>
                                    <Option value="MEDIUM" text="Medium">Medium</Option>
                                    <Option value="HIGH" text="High">High</Option>
                                    <Option value="CRITICAL" text="Critical">Critical</Option>
                                </Dropdown>
                            </div>
                        </div>
                        <div>
                            <Label>Description</Label>
                            <Input
                                value={description}
                                onChange={(e, d) => setDescription(d.value)}
                                placeholder="Project description"
                                style={{ width: '100%' }}
                            />
                        </div>

                        <div className={styles.sectionTitle}>Coating Specification</div>
                        <div className={styles.gridTwo}>
                            <div>
                                <Label>Coating Type</Label>
                                <Dropdown
                                    value={COATING_TYPES.find(c => c.value === coatingType)?.text || 'None'}
                                    selectedOptions={[coatingType]}
                                    onOptionSelect={(e, d) => setCoatingType(d.optionValue as string)}
                                    style={{ width: '100%' }}
                                >
                                    {COATING_TYPES.map(ct => (
                                        <Option key={ct.value} value={ct.value} text={ct.text}>
                                            {ct.text}
                                        </Option>
                                    ))}
                                </Dropdown>
                            </div>
                            <div>
                                <Label>Specification</Label>
                                <Input
                                    value={coatingSpec}
                                    onChange={(e, d) => setCoatingSpec(d.value)}
                                    placeholder="e.g. RAL 7016, 60μm"
                                    disabled={coatingType === 'NONE'}
                                    style={{ width: '100%' }}
                                />
                            </div>
                        </div>
                    </DialogContent>
                    <DialogActions>
                        <Button appearance="secondary" onClick={() => setOpen(false)}>Cancel</Button>
                        <Button appearance="primary" onClick={handleSubmit} disabled={loading || !name}>
                            {loading ? 'Saving...' : 'Save Changes'}
                        </Button>
                    </DialogActions>
                </DialogBody>
            </DialogSurface>
        </Dialog>
    )
}
