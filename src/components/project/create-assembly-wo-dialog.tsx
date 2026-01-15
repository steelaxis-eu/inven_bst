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
    Dropdown,
    Option,
    Table,
    TableHeader,
    TableRow,
    TableHeaderCell,
    TableBody,
    TableCell,
    Spinner,
    makeStyles,
    tokens,
    Text,
    Badge,
    shorthands
} from "@fluentui/react-components"
import {
    WrenchRegular,
    CheckmarkCircleRegular,
    WarningRegular,
    BoxRegular,
    ChevronLeftRegular
} from "@fluentui/react-icons"
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
    checkAssemblyReadiness,
    createAssemblyWorkOrder,
    createPartPrepWorkOrder,
    type AssemblyReadiness
} from '@/app/actions/workorders'
import { startNestingJob, getJobStatus } from '@/app/actions/optimization'

interface CreateAssemblyWODialogProps {
    projectId: string
    selectedAssemblyIds: string[]
    open: boolean
    onOpenChange: (open: boolean) => void
}

const useStyles = makeStyles({
    content: {
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
    },
    statusBox: {
        padding: '16px',
        borderRadius: tokens.borderRadiusMedium,
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        border: `1px solid transparent`,
    },
    readyBox: {
        backgroundColor: tokens.colorPaletteGreenBackground1,
        ...shorthands.borderColor(tokens.colorPaletteGreenBorder1),
    },
    notReadyBox: {
        backgroundColor: tokens.colorPaletteYellowBackground1,
        ...shorthands.borderColor(tokens.colorPaletteYellowBorder1),
    },
    planningHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '16px',
        backgroundColor: tokens.colorNeutralBackground2,
        borderRadius: tokens.borderRadiusMedium,
        marginBottom: '16px',
    },
    resultCard: {
        border: `1px solid ${tokens.colorNeutralStroke1}`,
        borderRadius: tokens.borderRadiusMedium,
        padding: '16px',
        marginBottom: '12px',
    },
    list: {
        listStyle: 'none',
        padding: 0,
        margin: 0,
    },
    listItem: {
        fontSize: tokens.fontSizeBase200,
        display: 'flex',
        justifyContent: 'space-between',
        padding: '4px 0',
    },
    purchaseItem: {
        backgroundColor: tokens.colorPaletteBlueBackground2,
        color: tokens.colorPaletteBlueForeground2,
        padding: '4px 8px',
        borderRadius: tokens.borderRadiusSmall,
        fontWeight: tokens.fontWeightSemibold,
    }
})

export function CreateAssemblyWODialog({
    projectId,
    selectedAssemblyIds,
    open,
    onOpenChange
}: CreateAssemblyWODialogProps) {
    const styles = useStyles()
    const [loading, setLoading] = useState(false)
    const [checking, setChecking] = useState(false)
    const [calculating, setCalculating] = useState(false)
    const [readiness, setReadiness] = useState<AssemblyReadiness[]>([])

    // Workflow State
    const [step, setStep] = useState<'READINESS' | 'PLANNING'>('READINESS')
    const [planningResults, setPlanningResults] = useState<any[]>([])
    const [stockLength, setStockLength] = useState(12000)

    // Form inputs
    const [createPartPrepWO, setCreatePartPrepWO] = useState(true)
    const [title, setTitle] = useState('')
    const [priority, setPriority] = useState('MEDIUM')
    const [scheduledDate, setScheduledDate] = useState('')
    const router = useRouter()

    useEffect(() => {
        if (open && selectedAssemblyIds.length > 0) {
            checkReadiness()
            setStep('READINESS')
        }
    }, [open, selectedAssemblyIds])

    const checkReadiness = async () => {
        setChecking(true)
        const result = await checkAssemblyReadiness(selectedAssemblyIds)
        if (result.success && result.data) {
            setReadiness(result.data)
        } else {
            toast.error('Failed to check readiness')
        }
        setChecking(false)
    }

    const allReady = readiness.every(a => a.isReady)
    const notReadyParts = readiness.flatMap(a => a.parts).filter(p => !p.isReady)
    const notReadyPieceIds = notReadyParts.flatMap(p =>
        p.pieces.filter(pc => pc.status !== 'READY').map(pc => pc.id)
    )

    const calculatePlan = async (length: number) => {
        setCalculating(true)
        try {
            const res = await startNestingJob(projectId, notReadyPieceIds, length)
            if (res.success && res.jobId) {
                const pollInterval = setInterval(async () => {
                    const statusRes = await getJobStatus(res.jobId!)
                    if (statusRes.success && statusRes.job) {
                        if (statusRes.job.status === 'COMPLETED') {
                            setPlanningResults(statusRes.job.result as any[])
                            setCalculating(false)
                            clearInterval(pollInterval)
                        } else if (statusRes.job.status === 'FAILED') {
                            toast.error(`Optimization failed: ${statusRes.job.error}`)
                            setCalculating(false)
                            clearInterval(pollInterval)
                        }
                    } else {
                        toast.error("Error polling job status")
                        setCalculating(false)
                        clearInterval(pollInterval)
                    }
                }, 2000)
            } else {
                toast.error(res.error || "Failed to start optimization")
                setCalculating(false)
            }
        } catch (e) {
            toast.error("Error starting background job")
            setCalculating(false)
        }
    }

    useEffect(() => {
        if (step === 'PLANNING' && notReadyPieceIds.length > 0) {
            calculatePlan(stockLength)
        }
    }, [step, stockLength])

    const handleNext = async () => {
        if (allReady) {
            await handleSubmit()
        } else {
            setStep('PLANNING')
        }
    }

    const handleSubmit = async () => {
        setLoading(true)

        try {
            if (!allReady && createPartPrepWO && notReadyPieceIds.length > 0) {
                const purchaseNote = planningResults.flatMap(r =>
                    r.newStockNeeded.map((n: any) => `${n.quantity}x ${n.length / 1000}m ${r.profileType} ${r.dimensions} (${r.grade})`)
                ).join('\n')

                const prepRes = await createPartPrepWorkOrder({
                    projectId,
                    pieceIds: notReadyPieceIds,
                    title: `Part Prep for Assembly`,
                    priority,
                    scheduledDate: scheduledDate ? new Date(scheduledDate) : undefined,
                    notes: purchaseNote ? `Recommended Purchase:\n${purchaseNote}` : undefined
                })

                if (!prepRes.success) {
                    toast.error(`Part Prep WO Error: ${prepRes.error}`)
                } else {
                    toast.success(`Part Prep & Cutting WOs created`)
                }
            }

            const res = await createAssemblyWorkOrder({
                projectId,
                assemblyIds: selectedAssemblyIds,
                title: title || undefined,
                priority,
                scheduledDate: scheduledDate ? new Date(scheduledDate) : undefined,
                forceCreate: true
            })

            if (!res.success) {
                toast.error(`Assembly WO Error: ${res.error}`)
            } else {
                toast.success(`Assembly WO created`)
            }

            onOpenChange(false)
            router.refresh()

        } catch (e: any) {
            toast.error('Failed to create work orders')
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={(e, data) => onOpenChange(data.open)}>
            <DialogSurface style={{ maxWidth: step === 'PLANNING' ? '800px' : '600px' }}>
                <DialogBody>
                    <DialogTitle>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <WrenchRegular />
                            {step === 'READINESS' ? 'Check Readiness' : 'Plan Material'}
                        </div>
                    </DialogTitle>

                    {checking ? (
                        <div style={{ padding: '40px', textAlign: 'center' }}>
                            <Spinner label="Checking readiness..." />
                        </div>
                    ) : step === 'READINESS' ? (
                        <DialogContent className={styles.content}>
                            <div className={`${styles.statusBox} ${allReady ? styles.readyBox : styles.notReadyBox}`}>
                                {allReady ? (
                                    <>
                                        <CheckmarkCircleRegular style={{ color: tokens.colorPaletteGreenForeground1 }} />
                                        <Text weight="medium">All parts ready! Welding WO will be created.</Text>
                                    </>
                                ) : (
                                    <>
                                        <WarningRegular style={{ color: tokens.colorPaletteDarkOrangeForeground1 }} />
                                        <Text weight="medium">{notReadyParts.length} part(s) missing. Material Prep & Cutting WOs needed.</Text>
                                    </>
                                )}
                            </div>

                            {!allReady && notReadyParts.length > 0 && (
                                <div style={{ border: `1px solid ${tokens.colorNeutralStroke1}`, borderRadius: tokens.borderRadiusMedium, overflow: 'hidden' }}>
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHeaderCell>Missing Part</TableHeaderCell>
                                                <TableHeaderCell>Profile</TableHeaderCell>
                                                <TableHeaderCell style={{ textAlign: 'center' }}>Count</TableHeaderCell>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {notReadyParts.map(part => (
                                                <TableRow key={part.partId}>
                                                    <TableCell style={{ fontFamily: 'monospace' }}>{part.partNumber}</TableCell>
                                                    <TableCell>{part.profileType} {part.profileDimensions}</TableCell>
                                                    <TableCell style={{ textAlign: 'center', color: tokens.colorPaletteRedForeground1, fontWeight: 'bold' }}>
                                                        {part.notStarted}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            )}

                            <div style={{ display: 'grid', gap: '16px' }}>
                                <Label>Priority</Label>
                                <Dropdown
                                    value={priority}
                                    selectedOptions={[priority]}
                                    onOptionSelect={(e, d) => setPriority(d.optionValue as string)}
                                >
                                    {['MEDIUM', 'HIGH', 'URGENT'].map(p => (
                                        <Option key={p} value={p} text={p}>{p}</Option>
                                    ))}
                                </Dropdown>
                            </div>
                        </DialogContent>
                    ) : (
                        <DialogContent className={styles.content}>
                            <div className={styles.planningHeader}>
                                <div>
                                    <Text weight="semibold">Material Optimization</Text>
                                    <div style={{ fontSize: '12px', color: tokens.colorNeutralForeground3 }}>Select preferred stock length for new orders</div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Label>Stock Length:</Label>
                                    <Dropdown
                                        value={stockLength === 6000 ? "6 meters" : "12 meters"}
                                        selectedOptions={[stockLength.toString()]}
                                        onOptionSelect={(e, d) => setStockLength(Number(d.optionValue))}
                                    >
                                        <Option value="6000" text="6 meters">6 meters</Option>
                                        <Option value="12000" text="12 meters">12 meters</Option>
                                    </Dropdown>
                                </div>
                            </div>

                            {calculating ? (
                                <div style={{ padding: '40px', textAlign: 'center' }}>
                                    <Spinner label="Optimizing plan..." />
                                </div>
                            ) : (
                                <div>
                                    {planningResults.map((res: any, idx: number) => (
                                        <div key={idx} className={styles.resultCard}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                                <BoxRegular />
                                                <Text weight="bold">{res.profileType} {res.dimensions}</Text>
                                                <Badge appearance="outline">{res.grade}</Badge>
                                            </div>

                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                                                <div>
                                                    <div style={{ fontSize: '10px', textTransform: 'uppercase', color: tokens.colorNeutralForeground3, marginBottom: '4px' }}>From Stock</div>
                                                    {res.stockUsed.length === 0 ? <Text italic size={200} style={{ color: tokens.colorNeutralForeground3 }}>None used</Text> : (
                                                        <ul className={styles.list}>
                                                            {res.stockUsed.map((s: any, i: number) => (
                                                                <li key={i} className={styles.listItem}>
                                                                    <span>Lot {s.lotId.substring(0, 8)}...</span>
                                                                    <span style={{ color: tokens.colorPaletteGreenForeground1 }}>{s.length / 1000}m</span>
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    )}
                                                </div>
                                                <div>
                                                    <div style={{ fontSize: '10px', textTransform: 'uppercase', color: tokens.colorNeutralForeground3, marginBottom: '4px' }}>To Order / Buy</div>
                                                    {res.newStockNeeded.length === 0 ? <Text italic size={200} style={{ color: tokens.colorNeutralForeground3 }}>No purchase needed</Text> : (
                                                        <ul className={styles.list}>
                                                            {res.newStockNeeded.map((n: any, i: number) => (
                                                                <li key={i} className={styles.listItem}>
                                                                    <div className={styles.purchaseItem}>
                                                                        <span>{n.quantity}x bars ({n.length / 1000}m)</span>
                                                                    </div>
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </DialogContent>
                    )}

                    <DialogActions>
                        {step === 'PLANNING' && (
                            <Button appearance="subtle" icon={<ChevronLeftRegular />} onClick={() => setStep('READINESS')}>Back</Button>
                        )}
                        <Button appearance="secondary" onClick={() => onOpenChange(false)}>Cancel</Button>

                        {step === 'READINESS' ? (
                            <Button appearance="primary" onClick={handleNext}>
                                {allReady ? 'Create Welding WO' : 'Plan Material & Cutting'}
                            </Button>
                        ) : (
                            <Button appearance="primary" onClick={handleSubmit} disabled={loading || calculating}>
                                {loading && <Spinner size="tiny" />} Confirm Plan & Create WOs
                            </Button>
                        )}
                    </DialogActions>
                </DialogBody>
            </DialogSurface>
        </Dialog>
    )
}
