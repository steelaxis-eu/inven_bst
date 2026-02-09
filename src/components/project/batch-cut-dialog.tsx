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
    Select, // Should use combobox or dropdown
    Checkbox,
    makeStyles,
    tokens,
    Text,
    Spinner,
    Combobox,
    Option,
    Badge,
    shorthands
} from "@fluentui/react-components"
import {
    CutRegular,
    RulerRegular,
    DeleteRegular,
    DismissRegular
} from "@fluentui/react-icons"
import { toast } from 'sonner'
import { getInventory } from "@/app/actions/inventory"
import { recordBatchUsage } from "@/app/actions/usage"

interface BatchCutDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    projectId: string
    items: any[] // WorkOrderItems
    onSuccess: () => void
}

const useStyles = makeStyles({
    dialogContent: {
        display: 'flex',
        flexDirection: 'column',
        height: '80vh',
        padding: 0,
    },
    header: {
        padding: '16px 24px',
        borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    },
    body: {
        flex: 1,
        display: 'grid',
        gridTemplateColumns: 'minmax(300px, 1fr) 1fr',
        overflow: 'hidden',
    },
    column: {
        display: 'flex',
        flexDirection: 'column',
    },
    columnHeader: {
        padding: '12px',
        backgroundColor: tokens.colorNeutralBackground2,
        borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
        fontWeight: tokens.fontWeightSemibold,
        fontSize: tokens.fontSizeBase200,
        textTransform: 'uppercase',
    },
    scrollArea: {
        flex: 1,
        overflowY: 'auto',
        padding: '16px',
    },
    listItem: {
        display: 'flex',
        alignItems: 'flex-start',
        gap: '12px',
        padding: '12px',
        borderRadius: tokens.borderRadiusMedium,
        border: `1px solid ${tokens.colorNeutralStroke1}`,
        cursor: 'pointer',
        marginBottom: '8px',
        transition: 'all 0.1s',
        ':hover': {
            backgroundColor: tokens.colorNeutralBackground1Hover,
        }
    },
    selectedItem: {
        backgroundColor: tokens.colorPaletteBlueBackground2,
        ...shorthands.borderColor(tokens.colorBrandStroke1),
    },
    cuttingPlanBox: {
        border: `1px solid ${tokens.colorNeutralStroke1}`,
        borderRadius: tokens.borderRadiusMedium,
        padding: '16px',
        backgroundColor: tokens.colorNeutralBackground1,
        marginTop: '16px',
    },
    barVisual: {
        height: '24px',
        backgroundColor: tokens.colorNeutralBackground3,
        borderRadius: tokens.borderRadiusMedium,
        overflow: 'hidden',
        display: 'flex',
        margin: '8px 0',
        border: `1px solid ${tokens.colorNeutralStroke1}`,
    },
    barUsed: {
        backgroundColor: tokens.colorPaletteBlueBackground2,
        transition: 'width 0.3s ease',
    },
    barRemnant: {
        backgroundColor: tokens.colorPaletteGreenBackground2,
        flex: 1,
        borderLeft: `1px dashed ${tokens.colorPaletteGreenBorder2}`,
    },
    controls: {
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        marginTop: '16px',
    },
    footer: {
        padding: '16px',
        borderTop: `1px solid ${tokens.colorNeutralStroke2}`,
        display: 'flex',
        justifyContent: 'flex-end',
        gap: '8px',
        backgroundColor: tokens.colorNeutralBackground1,
    }
})

export function BatchCutDialog({ open, onOpenChange, projectId, items, onSuccess }: BatchCutDialogProps) {
    const styles = useStyles()
    const [inventory, setInventory] = useState<any[]>([])
    const [loading, setLoading] = useState(false)

    // State
    const [pendingItems, setPendingItems] = useState<any[]>(items)
    const [selectedSourceId, setSelectedSourceId] = useState<string>('')
    const [selectedItemIds, setSelectedItemIds] = useState<string[]>([])

    // Allocation details
    const [remnantLength, setRemnantLength] = useState<number>(0)
    const [calcRemnant, setCalcRemnant] = useState<number>(0)
    const [isScrap, setIsScrap] = useState(false)
    const [reason, setReason] = useState('')

    useEffect(() => {
        if (open) {
            loadInventory()
            setPendingItems(items)
        }
    }, [open, items])

    const loadInventory = async () => {
        setLoading(true)
        try {
            const data = await getInventory()
            setInventory(data)
        } catch (e) {
            toast.error("Failed to load inventory")
        }
        setLoading(false)
    }

    const selectedSource = inventory.find(i => i.id === selectedSourceId)

    // Calculate usage
    const selectedPartsLength = pendingItems
        .filter(i => selectedItemIds.includes(i.id))
        .reduce((sum, item) => sum + (item.piece?.length || 0), 0)

    useEffect(() => {
        if (selectedSource) {
            const calc = selectedSource.length - selectedPartsLength
            setCalcRemnant(calc)
            setRemnantLength(calc)
        }
    }, [selectedSource, selectedPartsLength])

    const handleAllocate = async () => {
        if (!selectedSource || selectedItemIds.length === 0) return

        setLoading(true)
        try {
            const cuts = pendingItems
                .filter(i => selectedItemIds.includes(i.id))
                .map(i => ({
                    workOrderItemId: i.id,
                    pieceId: i.pieceId,
                    quantity: 1,
                    length: i.piece?.length || 0
                }))

            const res = await recordBatchUsage({
                projectId,
                sourceId: selectedSource.id,
                sourceType: 'INVENTORY',
                cuts,
                offcut: {
                    actualLength: isScrap ? 0 : remnantLength,
                    isScrap,
                    reason: reason || (remnantLength !== calcRemnant ? 'Manual Adjustment' : undefined)
                }
            })

            if (res.success) {
                toast.success(`Registered cuts for ${cuts.length} pieces`)
                // Remove processed items
                const remaining = pendingItems.filter(i => !selectedItemIds.includes(i.id))
                setPendingItems(remaining)

                // Cleanup
                setSelectedItemIds([])
                setSelectedSourceId('')
                setReason('')
                setIsScrap(false)

                // If no items left, close
                if (remaining.length === 0) {
                    onSuccess()
                    onOpenChange(false)
                } else {
                    loadInventory()
                }
            } else {
                toast.error((res as any).error || "Failed to record usage")
            }
        } catch (e) {
            toast.error("Error processing cuts")
        }
        setLoading(false)
    }

    const isValid = selectedSource && selectedItemIds.length > 0 && (isScrap || remnantLength >= 0)

    return (
        <Dialog open={open} onOpenChange={(e, data) => onOpenChange(data.open)}>
            <DialogSurface style={{ maxWidth: '900px', width: '90vw' }}>
                <div style={{ display: 'flex', flexDirection: 'column', height: '80vh' }}>
                    <div className={styles.header}>
                        <DialogTitle>Batch Material Cutting</DialogTitle>
                        <Text>Allocate parts to inventory bars. {pendingItems.length} pieces remaining.</Text>
                    </div>

                    <div className={styles.body}>
                        {/* LEFT: PENDING PARTS */}
                        <div className={styles.column} style={{ borderRight: `1px solid ${tokens.colorNeutralStroke2}` }}>
                            <div className={styles.columnHeader}>Pending Parts</div>
                            <div className={styles.scrollArea}>
                                {(() => {
                                    const grouped: Record<string, {
                                        partNumber: string,
                                        length: number,
                                        profileType: string,
                                        ids: string[]
                                    }> = {}

                                    pendingItems.forEach(item => {
                                        const key = `${item.piece?.part?.partNumber}-${item.piece?.length}`
                                        if (!grouped[key]) {
                                            grouped[key] = {
                                                partNumber: item.piece?.part?.partNumber || 'UNK',
                                                length: item.piece?.length || 0,
                                                profileType: item.piece?.part?.profileType || '',
                                                ids: []
                                            }
                                        }
                                        grouped[key].ids.push(item.id)
                                    })

                                    return Object.values(grouped).map(group => {
                                        const selectedCount = group.ids.filter(id => selectedItemIds.includes(id)).length
                                        const isAll = selectedCount === group.ids.length
                                        const isSome = selectedCount > 0 && selectedCount < group.ids.length

                                        return (
                                            <div
                                                key={`${group.partNumber}-${group.length}`}
                                                className={`${styles.listItem} ${selectedCount > 0 ? styles.selectedItem : ''}`}
                                            >
                                                <Checkbox
                                                    checked={isAll ? true : (isSome ? 'mixed' : false)}
                                                    onChange={(e, d) => {
                                                        if (d.checked) {
                                                            // Add all remaining from this group if checked, or toggle
                                                            const newIds = [...selectedItemIds, ...group.ids.filter(id => !selectedItemIds.includes(id))]
                                                            setSelectedItemIds(newIds)
                                                        } else {
                                                            setSelectedItemIds(selectedItemIds.filter(id => !group.ids.includes(id)))
                                                        }
                                                    }}
                                                />
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ fontWeight: 600, display: 'flex', justifyContent: 'space-between' }}>
                                                        <span>{group.partNumber}</span>
                                                        <Text size={200} weight="bold" color="brand">{selectedCount} / {group.ids.length}</Text>
                                                    </div>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: tokens.colorNeutralForeground3, marginTop: '4px' }}>
                                                        <span>L: {group.length}mm</span>
                                                        <Badge appearance="outline" size="small">{group.profileType}</Badge>
                                                    </div>

                                                    {group.ids.length > 1 && (
                                                        <div style={{ marginTop: '8px', display: 'flex', gap: '4px' }}>
                                                            <Input
                                                                type="number"
                                                                size="small"
                                                                value={selectedCount.toString()}
                                                                onChange={(e: any, d: any) => {
                                                                    const count = Math.min(group.ids.length, Math.max(0, parseInt(d.value) || 0))
                                                                    const otherIds = selectedItemIds.filter(id => !group.ids.includes(id))
                                                                    const groupSlice = group.ids.slice(0, count)
                                                                    setSelectedItemIds([...otherIds, ...groupSlice])
                                                                }}
                                                                style={{ width: '60px' }}
                                                            />
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )
                                    })
                                })()}

                                {pendingItems.length === 0 && (
                                    <div style={{ textAlign: 'center', padding: '40px', color: tokens.colorNeutralForeground3 }}>
                                        All parts allocated!
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* RIGHT: SOURCE & PLAN */}
                        <div className={styles.column} style={{ backgroundColor: tokens.colorNeutralBackground2 }}>
                            <div className={styles.columnHeader}>Source Material</div>
                            <div className={styles.scrollArea}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <Label>Select Stock Item</Label>
                                    <Combobox
                                        value={selectedSource ? `${selectedSource.profile.dimensions} - ${selectedSource.length}mm` : ''}
                                        selectedOptions={selectedSourceId ? [selectedSourceId] : []}
                                        onOptionSelect={(e, d) => setSelectedSourceId(d.optionValue as string)}
                                        placeholder="Choose inventory..."
                                    >
                                        {inventory.map(inv => (
                                            <Option key={inv.id} value={inv.id} text={`${inv.profile.dimensions} - ${inv.length}mm`}>
                                                {inv.profile.dimensions} - {inv.length}mm ({inv.quantityAtHand} left) - {inv.lotId}
                                            </Option>
                                        ))}
                                    </Combobox>
                                </div>

                                {selectedSource && (
                                    <div className={styles.cuttingPlanBox}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, marginBottom: '8px' }}>
                                            <CutRegular style={{ color: tokens.colorPaletteDarkOrangeForeground1 }} />
                                            Cutting Plan
                                        </div>

                                        <div style={{ fontSize: '12px', display: 'flex', justifyContent: 'space-between', color: tokens.colorNeutralForeground3 }}>
                                            <span>Used: {selectedPartsLength}mm</span>
                                            <span>Total: {selectedSource.length}mm</span>
                                        </div>

                                        <div className={styles.barVisual}>
                                            <div className={styles.barUsed} style={{ width: `${Math.min(100, (selectedPartsLength / selectedSource.length) * 100)}%` }} />
                                            <div className={styles.barRemnant} />
                                        </div>

                                        <div style={{ textAlign: 'right', fontSize: '12px', fontWeight: 600, color: tokens.colorPaletteGreenForeground1 }}>
                                            Remaining: {selectedSource.length - selectedPartsLength}mm
                                        </div>

                                        <div className={styles.controls}>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                <Label>Actual Offcut Length (mm)</Label>
                                                <div style={{ display: 'flex', gap: '8px' }}>
                                                    <Input
                                                        type="number"
                                                        value={remnantLength.toString()}
                                                        onChange={(e, d) => setRemnantLength(Number(d.value))}
                                                        disabled={isScrap}
                                                        style={{ borderColor: remnantLength !== calcRemnant ? tokens.colorPaletteDarkOrangeBorder1 : undefined }}
                                                    />
                                                    <Button
                                                        icon={<RulerRegular />}
                                                        onClick={() => setRemnantLength(calcRemnant)}
                                                        title="Reset to Calculated"
                                                    />
                                                </div>
                                                {remnantLength !== calcRemnant && !isScrap && (
                                                    <Text size={200} style={{ color: tokens.colorPaletteDarkOrangeForeground1, fontWeight: 500 }}>
                                                        Difference of {Math.abs(calcRemnant - remnantLength)}mm recorded as loss.
                                                    </Text>
                                                )}

                                            </div>

                                            <Checkbox
                                                label="Mark remainder as SCRAP (No remnant created)"
                                                checked={isScrap}
                                                onChange={(e, d) => setIsScrap(d.checked as boolean)}
                                            />

                                            {(remnantLength !== calcRemnant || isScrap) && (
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                    <Label>Reason / Comment</Label>
                                                    <Input
                                                        value={reason}
                                                        onChange={(e, d) => setReason(d.value)}
                                                        placeholder="e.g. Saw blade width, damaged end..."
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className={styles.footer}>
                                <Button appearance="subtle" onClick={() => onOpenChange(false)}>Close</Button>
                                <Button
                                    appearance="primary"
                                    onClick={handleAllocate}
                                    disabled={!isValid || loading}
                                    icon={loading ? <Spinner size="tiny" /> : undefined}
                                >
                                    Record Cut & Save
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            </DialogSurface>
        </Dialog>
    )
}
