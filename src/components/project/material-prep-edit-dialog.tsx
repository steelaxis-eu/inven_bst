'use client'

import { useState, useEffect } from 'react'
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
    Title3,
    Dropdown,
    Option,
    Checkbox,
    Divider
} from "@fluentui/react-components"
import { getMaterialPrepDetails, reoptimizeMaterialPrep } from '@/app/actions/workorders'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

interface MaterialPrepEditDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    workOrderId: string
    onSuccess: () => void
}

interface MaterialGroup {
    key: string // profileId#gradeId
    profileName: string
    gradeName: string
    originalProfileId?: string
    originalGradeId?: string
    totalLengthRaw: number // sum of piece lengths
    piecesCount: number
}

interface OverrideState {
    enabled: boolean
    gradeId: string
    length: number
    quantity: number // -1 for infinite
}

const useStyles = makeStyles({
    content: {
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        maxHeight: '80vh',
    },
    groupCard: {
        backgroundColor: tokens.colorNeutralBackground2,
        padding: '16px',
        borderRadius: tokens.borderRadiusMedium,
        border: `1px solid ${tokens.colorNeutralStroke2}`,
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
    },
    groupHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingBottom: '8px',
        borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    },
    overrideSection: {
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        padding: '12px',
        backgroundColor: tokens.colorNeutralBackground1,
        borderRadius: tokens.borderRadiusMedium,
        border: `1px dashed ${tokens.colorNeutralStroke1}`,
    },
    inputGrid: {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr',
        gap: '12px',
        alignItems: 'end'
    },
    field: {
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
    },
    summary: {
        display: 'flex',
        gap: '16px',
        color: tokens.colorNeutralForeground2,
        fontSize: tokens.fontSizeBase200
    }
})

export function MaterialPrepEditDialog({ open, onOpenChange, workOrderId, onSuccess }: MaterialPrepEditDialogProps) {
    const styles = useStyles()
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [details, setDetails] = useState<any>(null)
    const [groups, setGroups] = useState<MaterialGroup[]>([])
    const [overrides, setOverrides] = useState<Record<string, OverrideState>>({})

    useEffect(() => {
        if (open && workOrderId) {
            loadDetails()
        } else {
            setDetails(null)
            setGroups([])
            setOverrides({})
        }
    }, [open, workOrderId])

    async function loadDetails() {
        setLoading(true)
        try {
            const res = await getMaterialPrepDetails(workOrderId)
            if (res.success) {
                setDetails(res)
                processGroups(res.blockedWO)
            } else {
                toast.error(res.error)
                onOpenChange(false)
            }
        } catch (e) {
            toast.error('Failed to load details')
        } finally {
            setLoading(false)
        }
    }

    function processGroups(blockedWO: any) {
        if (!blockedWO || !blockedWO.items) return

        const grouped: Record<string, MaterialGroup> = {}
        const initialOverrides: Record<string, OverrideState> = {}

        blockedWO.items.forEach((item: any) => {
            if (!item.piece || !item.piece.part) return
            const p = item.piece.part

            // Replicate Backend Key Logic
            let profileKey = p.profileId
            if (!profileKey) {
                if (p.profileType && p.profileDimensions) {
                    profileKey = `${p.profileType}|${p.profileDimensions}`
                } else {
                    profileKey = 'unknown'
                }
            }
            const gradeKey = p.gradeId || 'unknown'
            const key = `${profileKey}#${gradeKey}`

            if (!grouped[key]) {
                const profileName = p.profile ? `${p.profile.type} ${p.profile.dimensions}` : `${p.profileType} ${p.profileDimensions}`
                grouped[key] = {
                    key,
                    profileName,
                    gradeName: p.grade?.name || 'Unknown',
                    originalProfileId: p.profileId,
                    originalGradeId: p.gradeId,
                    totalLengthRaw: 0,
                    piecesCount: 0
                }
                // Initialize override state
                initialOverrides[key] = {
                    enabled: false,
                    gradeId: p.gradeId || '',
                    length: 12000,
                    quantity: -1
                }
            }

            grouped[key].totalLengthRaw += (p.length || 0)
            grouped[key].piecesCount++
        })

        setGroups(Object.values(grouped))
        setOverrides(initialOverrides)
    }

    function handleOverrideChange(key: string, field: keyof OverrideState, value: any) {
        setOverrides(prev => ({
            ...prev,
            [key]: {
                ...prev[key],
                [field]: value
            }
        }))
    }

    async function handleReoptimize() {
        setSubmitting(true)
        try {
            // Construct overrides payload
            const activeOverrides = Object.entries(overrides)
                .filter(([_, idx]) => idx.enabled)
                .map(([key, val]) => ({
                    materialKey: key,
                    length: Number(val.length),
                    quantity: Number(val.quantity),
                    gradeId: val.gradeId || undefined
                }))

            const res = await reoptimizeMaterialPrep(workOrderId, activeOverrides)

            if (res.success) {
                toast.success('Material Prep Re-optimized!')
                onSuccess()
                onOpenChange(false)
                router.refresh()
            } else {
                toast.error(res.error || 'Optimization failed')
            }
        } catch (e) {
            toast.error('Error submitting re-optimization')
        } finally {
            setSubmitting(false)
        }
    }

    if (!open) return null

    return (
        <Dialog open={open} onOpenChange={(e, data) => onOpenChange(data.open)}>
            <DialogSurface style={{ maxWidth: '800px', width: '100%' }}>
                <DialogBody>
                    <DialogTitle>Re-optimize Material Prep</DialogTitle>

                    <DialogContent className={styles.content}>
                        {loading ? (
                            <Spinner label="Loading details..." />
                        ) : (
                            <>
                                <div style={{ padding: '12px', backgroundColor: tokens.colorStatusWarningBackground1, borderRadius: tokens.borderRadiusMedium }}>
                                    <Text>
                                        Adjusting material availability here will <b>re-run the cutting optimization</b> and update the linked Cutting Work Order instructions.
                                    </Text>
                                </div>

                                {groups.map(group => {
                                    const ov = overrides[group.key]
                                    if (!ov) return null

                                    return (
                                        <div key={group.key} className={styles.groupCard}>
                                            <div className={styles.groupHeader}>
                                                <div>
                                                    <Title3>{group.profileName}</Title3>
                                                    <div className={styles.summary}>
                                                        <span>Grade: {group.gradeName}</span>
                                                        <span>Required: {group.piecesCount} items ({(group.totalLengthRaw / 1000).toFixed(1)}m total)</span>
                                                    </div>
                                                </div>
                                                <Checkbox
                                                    label="Override Material"
                                                    checked={ov.enabled}
                                                    onChange={(_, d) => handleOverrideChange(group.key, 'enabled', !!d.checked)}
                                                />
                                            </div>

                                            {ov.enabled && (
                                                <div className={styles.overrideSection}>
                                                    <div className={styles.inputGrid}>
                                                        <div className={styles.field}>
                                                            <Label>Grade Substitution</Label>
                                                            <Dropdown
                                                                value={details?.grades?.find((g: any) => g.id === ov.gradeId)?.name || 'Select Grade'}
                                                                selectedOptions={[ov.gradeId]}
                                                                onOptionSelect={(_, d) => handleOverrideChange(group.key, 'gradeId', d.optionValue)}
                                                            >
                                                                {details?.grades?.map((g: any) => (
                                                                    <Option key={g.id} value={g.id} text={g.name}>{g.name}</Option>
                                                                ))}
                                                            </Dropdown>
                                                        </div>
                                                        <div className={styles.field}>
                                                            <Label>Available Length (mm)</Label>
                                                            <Input
                                                                type="number"
                                                                value={ov.length.toString()}
                                                                onChange={(e) => handleOverrideChange(group.key, 'length', Number(e.target.value))}
                                                            />
                                                        </div>
                                                        <div className={styles.field}>
                                                            <Label>Quantity (-1 for Unlimited)</Label>
                                                            <Input
                                                                type="number"
                                                                value={ov.quantity.toString()}
                                                                onChange={(e) => handleOverrideChange(group.key, 'quantity', Number(e.target.value))}
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )
                                })}
                            </>
                        )}
                    </DialogContent>

                    <DialogActions>
                        <Button appearance="secondary" onClick={() => onOpenChange(false)} disabled={submitting}>
                            Cancel
                        </Button>
                        <Button appearance="primary" onClick={handleReoptimize} disabled={loading || submitting}>
                            {submitting ? 'Optimizing...' : 'Re-optimize & Update'}
                        </Button>
                    </DialogActions>
                </DialogBody>
            </DialogSurface>
        </Dialog>
    )
}
