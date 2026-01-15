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
    makeStyles,
    shorthands,
    tokens,
    TabList,
    Tab,
    Combobox,
    Option,
    Dropdown,
    useId,
    Text,
    Spinner,
    Switch,
    Field,
    Divider
} from '@fluentui/react-components'
import {
    AddRegular,
    BoxRegular,
    CutRegular,
    WarningRegular,
    CheckmarkCircleRegular,
    CalculatorRegular
} from '@fluentui/react-icons'
import { useRouter } from 'next/navigation'
import { createPart } from '@/app/actions/parts'
import { createPlatePart } from '@/app/actions/plateparts'
import { ensureProfile } from '@/app/actions/inventory'
import { calculateProfileWeight } from '@/app/actions/calculator'
import { toast } from 'sonner'

const useStyles = makeStyles({
    root: {
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
    },
    section: {
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        padding: '16px',
        backgroundColor: tokens.colorNeutralBackground1,
        ...shorthands.borderRadius(tokens.borderRadiusMedium),
        ...shorthands.border('1px', 'solid', tokens.colorNeutralStroke2),
    },
    gridThree: {
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '16px',
    },
    gridTwo: {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '16px',
    },
    gridFour: {
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '16px',
    },
    header: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        marginBottom: '8px',
        ...shorthands.borderBottom('1px', 'solid', tokens.colorNeutralStroke3),
        paddingBottom: '8px',
    },
    headerIcon: {
        color: tokens.colorBrandForeground1,
    },
    headerTitle: {
        fontWeight: 'bold',
        color: tokens.colorNeutralForeground2,
        textTransform: 'uppercase',
        fontSize: '11px',
        letterSpacing: '1px',
    },
    label: {
        marginBottom: '4px',
        display: 'block',
    },
    calcBox: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px',
        backgroundColor: tokens.colorPaletteGreenBackground1,
        ...shorthands.border('1px', 'solid', tokens.colorPaletteGreenBorder1),
        ...shorthands.borderRadius(tokens.borderRadiusMedium),
    },
    warningBox: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '12px',
        backgroundColor: tokens.colorPaletteRedBackground1,
        ...shorthands.border('1px', 'solid', tokens.colorPaletteRedBorder1),
        ...shorthands.borderRadius(tokens.borderRadiusMedium),
        marginTop: '8px',
    },
    successBox: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '12px',
        backgroundColor: tokens.colorPaletteGreenBackground1,
        ...shorthands.border('1px', 'solid', tokens.colorPaletteGreenBorder1),
        ...shorthands.borderRadius(tokens.borderRadiusMedium),
        marginTop: '8px',
    },
    paramGrid: {
        display: 'flex',
        gap: '12px',
        marginTop: '8px',
    }
})

interface CreatePartDialogProps {
    projectId: string
    profiles: { id: string; type: string; dimensions: string; weightPerMeter: number }[]
    standardProfiles?: { type: string; dimensions: string; weightPerMeter: number }[]
    grades: { id: string; name: string }[]
    shapes?: { id: string; params: string[]; formula: string | null }[]
    inventory?: { profileId: string; quantity: number }[]  // Available stock
}

export function CreatePartDialog({
    projectId,
    profiles,
    standardProfiles = [],
    grades,
    shapes = [],
    inventory = []
}: CreatePartDialogProps) {
    const styles = useStyles();
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const [tab, setTab] = useState<'profile' | 'plate'>('profile')
    const router = useRouter()
    const comboId = useId()

    // Shared fields
    const [partNumber, setPartNumber] = useState('')
    const [description, setDescription] = useState('')
    const [gradeId, setGradeId] = useState('')
    const [quantity, setQuantity] = useState('1')

    // Profile selection state
    const [selectedType, setSelectedType] = useState('')
    const [selectedDim, setSelectedDim] = useState('')
    const [customDim, setCustomDim] = useState('')
    const [shapeParams, setShapeParams] = useState<Record<string, string>>({})
    const [manualWeight, setManualWeight] = useState('')

    // Other profile fields
    const [length, setLength] = useState('')
    const [requiresWelding, setRequiresWelding] = useState(false)
    const [isOutsourcedCut, setIsOutsourcedCut] = useState(false)
    const [cutVendor, setCutVendor] = useState('')

    // Plate part fields
    const [material, setMaterial] = useState('')
    const [thickness, setThickness] = useState('')
    const [plateWidth, setPlateWidth] = useState('')
    const [plateLength, setPlateLength] = useState('')
    const [unitWeight, setUnitWeight] = useState('')
    const [supplier, setSupplier] = useState('')
    const [isPlateOutsourced, setIsPlateOutsourced] = useState(true)

    // Derived values
    const uniqueTypes = Array.from(new Set(standardProfiles.map(p => p.type)))
    // Combine standard types with shape IDs
    const allTypes = Array.from(new Set([...uniqueTypes, ...shapes.map(s => s.id)]))
    const isStandardType = uniqueTypes.includes(selectedType)
    const activeShape = shapes.find(s => s.id === selectedType)

    // Active dims (from profiles table)
    const activeDims = profiles
        .filter(p => p.type === selectedType)
        .map(p => p.dimensions)
        .sort()

    // Catalog dims (from standardProfiles, excluding active ones)
    const catalogDims = standardProfiles
        .filter(p => p.type === selectedType)
        .map(p => p.dimensions)
        .filter(d => !activeDims.includes(d))
        .sort((a, b) => {
            const getVal = (s: string) => parseFloat(s.split(/[xX]/)[0]) || 0
            return getVal(a) - getVal(b)
        })

    // Combine for combobox
    const dimOptions = [...new Set([...activeDims, ...catalogDims])]

    // Find matching standard profile for weight
    const standardMatch = standardProfiles.find(
        p => p.type === selectedType && p.dimensions === (customDim || selectedDim)
    )

    // Find active profile for inventory check
    const activeProfile = profiles.find(
        p => p.type === selectedType && p.dimensions === (customDim || selectedDim)
    )

    // Inventory check
    const stock = activeProfile ? inventory.find(i => i.profileId === activeProfile.id) : null
    const needed = parseInt(quantity) || 0
    const available = stock?.quantity || 0
    const inventoryStatus = activeProfile
        ? (available >= needed ? 'available' : available > 0 ? 'insufficient' : 'missing')
        : 'unknown'

    // Auto-parse dimension string for shape params
    useEffect(() => {
        if (!selectedDim || !activeShape) return

        const parts = selectedDim.toLowerCase().split(/[x* ]+/).map(s => parseFloat(s)).filter(n => !isNaN(n))
        const params = activeShape.params as string[]

        if (parts.length > 0 && params.length > 0) {
            const newParams: Record<string, string> = {}
            params.forEach((param, i) => {
                if (parts[i] !== undefined) {
                    newParams[param] = parts[i].toString()
                }
            })
            const isDiff = Object.entries(newParams).some(([k, v]) => shapeParams[k] !== v)
            if (isDiff) {
                setShapeParams(prev => ({ ...prev, ...newParams }))
            }
        }
    }, [selectedDim, activeShape])

    // Auto-set weight from standard profile
    useEffect(() => {
        if (standardMatch && !manualWeight) {
            setManualWeight(standardMatch.weightPerMeter.toFixed(2))
        } else if (activeProfile && !manualWeight) {
            setManualWeight(activeProfile.weightPerMeter.toFixed(2))
        }
    }, [standardMatch, activeProfile])

    const updateShapeParam = (param: string, val: string) => {
        const newParams = { ...shapeParams, [param]: val }
        setShapeParams(newParams)

        if (activeShape) {
            const dimStr = (activeShape.params as string[]).map(p => newParams[p] || '?').join('x')
            setCustomDim(dimStr)
        }
    }

    const handleCalculateWeight = async () => {
        if (!selectedType) return

        if (standardMatch) {
            setManualWeight(standardMatch.weightPerMeter.toFixed(2))
            return
        }

        if (activeShape) {
            const numericParams: Record<string, number> = {}
            for (const [k, v] of Object.entries(shapeParams)) {
                numericParams[k] = parseFloat(v)
            }

            const gradeObj = grades.find(g => g.id === gradeId)
            if (gradeObj) {
                (numericParams as any).gradeId = gradeObj.id
            }

            try {
                const w = await calculateProfileWeight(selectedType, numericParams)
                setManualWeight(w.toFixed(2))
            } catch (e) {
                toast.error('Weight calculation failed')
            }
        }
    }

    const handleSubmit = async () => {
        if (!partNumber || !quantity) return
        setLoading(true)

        try {
            if (tab === 'profile') {
                if (!selectedType || !(selectedDim || customDim)) {
                    toast.warning('Please select a profile type and dimensions')
                    setLoading(false)
                    return
                }

                const finalDim = customDim || selectedDim
                const weight = manualWeight ? parseFloat(manualWeight) : (standardMatch?.weightPerMeter || 0)

                const profile = await ensureProfile({
                    type: selectedType,
                    dimensions: finalDim,
                    weight: weight
                })

                const res = await createPart({
                    projectId,
                    partNumber,
                    description: description || undefined,
                    profileId: profile.id,
                    gradeId: gradeId || undefined,
                    length: length ? parseFloat(length) : undefined,
                    quantity: parseInt(quantity),
                    requiresWelding,
                    isOutsourcedCut,
                    cutVendor: isOutsourcedCut ? cutVendor : undefined
                })

                if (!res.success) {
                    toast.error(`Error: ${res.error}`)
                    setLoading(false)
                    return
                }
            } else {
                const res = await createPlatePart({
                    projectId,
                    partNumber,
                    description: description || undefined,
                    gradeId: gradeId || undefined,
                    material: material || undefined,
                    thickness: thickness ? parseFloat(thickness) : undefined,
                    width: plateWidth ? parseFloat(plateWidth) : undefined,
                    length: plateLength ? parseFloat(plateLength) : undefined,
                    quantity: parseInt(quantity),
                    unitWeight: unitWeight ? parseFloat(unitWeight) : undefined,
                    isOutsourced: isPlateOutsourced,
                    supplier: supplier || undefined
                })

                if (!res.success) {
                    toast.error(`Error: ${res.error}`)
                    setLoading(false)
                    return
                }
            }

            setOpen(false)
            resetForm()
            router.refresh()
            toast.success('Part created successfully')

        } catch (e: any) {
            toast.error('Failed to create part')
        } finally {
            setLoading(false)
        }
    }

    const resetForm = () => {
        setPartNumber('')
        setDescription('')
        setGradeId('')
        setQuantity('1')
        setSelectedType('')
        setSelectedDim('')
        setCustomDim('')
        setShapeParams({})
        setManualWeight('')
        setLength('')
        setRequiresWelding(false)
        setIsOutsourcedCut(false)
        setCutVendor('')
        setMaterial('')
        setThickness('')
        setPlateWidth('')
        setPlateLength('')
        setUnitWeight('')
        setSupplier('')
        setIsPlateOutsourced(true)
    }

    return (
        <Dialog open={open} onOpenChange={(e, data) => setOpen(data.open)}>
            <DialogSurface style={{ minWidth: '650px', maxWidth: '800px' }}>
                <DialogBody>
                    <DialogTitle>Add New Part</DialogTitle>

                    <div style={{ margin: '16px 0' }}>
                        <TabList
                            selectedValue={tab}
                            onTabSelect={(_, data) => setTab(data.value as 'profile' | 'plate')}
                        >
                            <Tab id="profile" value="profile" icon={<BoxRegular />}>Profile Part</Tab>
                            <Tab id="plate" value="plate" icon={<CutRegular />}>Plate Part</Tab>
                        </TabList>
                    </div>

                    <DialogContent className={styles.root}>
                        {/* Common Fields */}
                        <div className={styles.section}>
                            <div className={styles.header}>
                                <div className={styles.headerIcon}><BoxRegular /></div>
                                <Text className={styles.headerTitle}>General Information</Text>
                            </div>
                            <div className={styles.gridThree}>
                                <Field label="Part Number" required>
                                    <Input value={partNumber} onChange={(e, d) => setPartNumber(d.value)} placeholder={tab === 'profile' ? 'B-101' : 'PL-001'} />
                                </Field>
                                <Field label="Quantity" required>
                                    <Input type="number" min="1" value={quantity} onChange={(e, d) => setQuantity(d.value)} />
                                </Field>
                                <Field label="Grade">
                                    <Dropdown
                                        value={grades.find(g => g.id === gradeId)?.name || ''}
                                        selectedOptions={gradeId ? [gradeId] : []}
                                        onOptionSelect={(_, data) => setGradeId(data.optionValue as string)}
                                        placeholder="Select grade"
                                    >
                                        {grades.map(g => (
                                            <Option key={g.id} value={g.id}>{g.name}</Option>
                                        ))}
                                    </Dropdown>
                                </Field>
                            </div>
                            <Field label="Description">
                                <Input value={description} onChange={(e, d) => setDescription(d.value)} placeholder="e.g. Main beam section" />
                            </Field>
                        </div>

                        {tab === 'profile' && (
                            <>
                                <div className={styles.section}>
                                    <div className={styles.header}>
                                        <div className={styles.headerIcon}><BoxRegular /></div>
                                        <Text className={styles.headerTitle}>Profile Specification</Text>
                                    </div>
                                    <div className={styles.gridTwo}>
                                        <Field label="Type" required>
                                            <Combobox
                                                value={selectedType}
                                                onOptionSelect={(_, data) => {
                                                    setSelectedType(data.optionValue || '')
                                                    setSelectedDim('')
                                                    setCustomDim('')
                                                    setManualWeight('')
                                                    setShapeParams({})
                                                }}
                                                placeholder="Select type"
                                            >
                                                {allTypes.map(t => (
                                                    <Option key={t} value={t}>{t}</Option>
                                                ))}
                                            </Combobox>
                                        </Field>
                                        <Field label="Dimensions" required>
                                            <Combobox
                                                value={customDim || selectedDim}
                                                onOptionSelect={(_, data) => {
                                                    const val = data.optionValue
                                                    if (val) {
                                                        setSelectedDim(val)
                                                        setCustomDim('')
                                                    }
                                                }}
                                                onInput={(e) => setCustomDim(e.currentTarget.value)}
                                                freeform
                                                placeholder="Select or type custom"
                                                disabled={!selectedType}
                                            >
                                                {dimOptions.map(d => (
                                                    <Option key={d} value={d}>{d}</Option>
                                                ))}
                                            </Combobox>
                                        </Field>
                                    </div>

                                    {/* Parameters for custom shapes */}
                                    {!isStandardType && activeShape && (
                                        <div style={{ marginTop: '12px' }}>
                                            <Label weight="semibold">Parameters</Label>
                                            <div className={styles.paramGrid}>
                                                {(activeShape.params as string[]).map(param => (
                                                    <Field key={param} label={param} size="small">
                                                        <Input
                                                            value={shapeParams[param] || ''}
                                                            onChange={(e, d) => updateShapeParam(param, d.value)}
                                                            style={{ maxWidth: '80px', textAlign: 'center' }}
                                                        />
                                                    </Field>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    <div className={styles.gridThree} style={{ marginTop: '12px' }}>
                                        <Field label="Length (mm)">
                                            <Input type="number" value={length} onChange={(e, d) => setLength(d.value)} placeholder="6000" />
                                        </Field>
                                        <Field label="Weight (kg/m)">
                                            <Input
                                                value={manualWeight}
                                                onChange={(e, d) => setManualWeight(d.value)}
                                                contentAfter={
                                                    <Button
                                                        icon={<CalculatorRegular />}
                                                        appearance="subtle"
                                                        onClick={handleCalculateWeight}
                                                        disabled={!selectedType}
                                                        title="Calculate weight"
                                                    />
                                                }
                                                placeholder="Auto"
                                            />
                                        </Field>
                                        <Field label="Requires Welding">
                                            <Switch
                                                checked={requiresWelding}
                                                onChange={(e, d) => setRequiresWelding(d.checked)}
                                                label={requiresWelding ? "Yes" : "No"}
                                            />
                                        </Field>
                                    </div>
                                </div>

                                {/* Stock Status & Outsourcing */}
                                {inventoryStatus !== 'unknown' && (
                                    <div className={inventoryStatus === 'available' ? styles.successBox : styles.warningBox}>
                                        {inventoryStatus === 'available' ? <CheckmarkCircleRegular /> : <WarningRegular />}
                                        <Text>
                                            {inventoryStatus === 'available'
                                                ? `Full allocation possible: ${available} in stock`
                                                : inventoryStatus === 'insufficient'
                                                    ? `Insufficient stock: ${available} available (need {needed})`
                                                    : 'Material not in stock – Procure via RFQ'
                                            }
                                        </Text>
                                    </div>
                                )}

                                <div className={styles.section}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <Label weight="semibold">Outsourced Cutting?</Label>
                                        <Switch
                                            checked={isOutsourcedCut}
                                            onChange={(e, d) => setIsOutsourcedCut(d.checked)}
                                        />
                                    </div>
                                    {isOutsourcedCut && (
                                        <Field label="Cutting Vendor" style={{ marginTop: '8px' }}>
                                            <Input value={cutVendor} onChange={(e, d) => setCutVendor(d.value)} placeholder="Vendor Name" />
                                        </Field>
                                    )}
                                </div>
                            </>
                        )}

                        {tab === 'plate' && (
                            <div className={styles.section}>
                                <div className={styles.header}>
                                    <div className={styles.headerIcon}><CutRegular /></div>
                                    <Text className={styles.headerTitle}>Plate Specification</Text>
                                </div>
                                <div className={styles.gridFour}>
                                    <Field label="Material">
                                        <Input value={material} onChange={(e, d) => setMaterial(d.value)} placeholder="S355" />
                                    </Field>
                                    <Field label="Thick (mm)">
                                        <Input type="number" value={thickness} onChange={(e, d) => setThickness(d.value)} placeholder="10" />
                                    </Field>
                                    <Field label="Width (mm)">
                                        <Input type="number" value={plateWidth} onChange={(e, d) => setPlateWidth(d.value)} placeholder="200" />
                                    </Field>
                                    <Field label="Length (mm)">
                                        <Input type="number" value={plateLength} onChange={(e, d) => setPlateLength(d.value)} placeholder="400" />
                                    </Field>
                                </div>

                                {/* Calculated Weight Preview */}
                                {thickness && plateWidth && plateLength && (
                                    <div className={styles.calcBox}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <CalculatorRegular />
                                            <Text weight="semibold" style={{ color: tokens.colorPaletteGreenForeground1, textTransform: 'uppercase', fontSize: '11px' }}>Calculated Weight</Text>
                                        </div>
                                        <Text font="monospace" size={400} weight="bold" style={{ color: tokens.colorPaletteGreenForeground1 }}>
                                            {((parseFloat(thickness) / 1000) * (parseFloat(plateWidth) / 1000) * (parseFloat(plateLength) / 1000) * 7850).toFixed(3)} kg
                                        </Text>
                                    </div>
                                )}

                                <div className={styles.gridTwo}>
                                    <Field label="Weight Override (kg)">
                                        <Input type="number" value={unitWeight} onChange={(e, d) => setUnitWeight(d.value)} placeholder="Auto if blank" />
                                    </Field>
                                    <Field label="Preferred Supplier">
                                        <Input value={supplier} onChange={(e, d) => setSupplier(d.value)} placeholder="Vendor Name" />
                                    </Field>
                                </div>

                                <Divider />

                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                        <Label weight="semibold">Outsourced Process</Label>
                                        <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>Toggle between External and Internal production</Text>
                                    </div>
                                    <Switch
                                        checked={isPlateOutsourced}
                                        onChange={(e, d) => setIsPlateOutsourced(d.checked)}
                                    />
                                </div>
                            </div>
                        )}
                    </DialogContent>

                    <DialogActions>
                        <Button appearance="secondary" onClick={() => setOpen(false)} disabled={loading}>Cancel</Button>
                        <Button appearance="primary" onClick={handleSubmit} disabled={loading || !partNumber || !quantity} icon={!loading ? <AddRegular /> : <Spinner size="tiny" />}>
                            {loading ? 'Processing...' : tab === 'profile' ? 'Create Profile Part' : 'Create Plate Part'}
                        </Button>
                    </DialogActions>
                </DialogBody>
            </DialogSurface>
            <Button onClick={() => setOpen(true)} icon={<AddRegular />}>Add Part</Button>
        </Dialog>
    )
}
