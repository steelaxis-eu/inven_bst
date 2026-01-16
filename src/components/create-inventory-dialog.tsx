'use client'

import { useState, useEffect } from 'react'
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
    Combobox,
    Option,
    useId,
    Text,
    Spinner,
    Table,
    TableHeader,
    TableRow,
    TableHeaderCell,
    TableBody,
    TableCell,
    Field,
    shorthands
} from "@fluentui/react-components";
import {
    AddRegular,
    CalculatorRegular,
    DeleteRegular,
    SaveRegular,
    DismissRegular
} from "@fluentui/react-icons";
import { ensureProfile, createInventoryBatch } from "@/app/actions/inventory"
import { calculateProfileWeight } from "@/app/actions/calculator"
import { FluentFileUploader } from "@/components/common/fluent-file-uploader";
import { toast } from "sonner";

const useStyles = makeStyles({
    dialogContent: {
        display: "flex",
        flexDirection: "column",
        gap: "16px",
        height: "80vh",
        // Remove fixed widths to allow fluid resizing within viewport limits if needed, 
        // but keep a reasonable min/max.
        // Remove fixed widths to allow fluid resizing within viewport limits
        width: "95vw", // Occupy almost full width on small screens
        maxWidth: "1000px", // Cap at 1000px (reduced from 1400px)
        minWidth: "320px", // Minimum for very small phones
    },
    section: {
        display: "flex",
        flexDirection: "column",
        gap: "16px",
        padding: "24px",
        // Removed grey background and shadow for a cleaner, flatter look
        marginBottom: "16px",
    },
    sectionTitle: {
        fontWeight: "bold",
        color: tokens.colorBrandForeground1, // Use brand color for hierarchy
        textTransform: "uppercase",
        fontSize: "12px",
        borderBottom: `2px solid ${tokens.colorNeutralStroke2}`, // Thicker divider
        paddingBottom: "12px",
        marginBottom: "16px",
        display: "flex",
        alignItems: "center",
        gap: "8px",
        letterSpacing: "0.05em" // Slight letter spacing for uppercase header
    },
    // Replace generic 'row' with responsive grid/flex layouts
    gridRowMain: {
        display: "grid",
        gridTemplateColumns: "1fr 1fr 2fr 1fr", // Desktop: Balanced
        gap: "24px",
        alignItems: "end",
        marginBottom: "24px",
        "@media (max-width: 768px)": {
            display: "flex",
            flexDirection: "column",
            gap: "16px",
            alignItems: "stretch",
        },
    },
    gridRowSecondary: {
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr) auto", // Desktop: 4 fields + Supplier
        gap: "24px",
        alignItems: "end",
        "@media (max-width: 768px)": {
            display: "flex",
            flexDirection: "column",
            gap: "16px",
            alignItems: "stretch",
        },
    },
    gridRowActions: {
        display: "grid",
        gridTemplateColumns: "1fr auto",
        gap: "24px",
        alignItems: "end",
        marginTop: "24px",
        "@media (max-width: 768px)": {
            display: "flex",
            flexDirection: "column",
            gap: "16px",
        },
    },
    field: {
        display: "flex",
        flexDirection: "column",
        gap: "8px", // More breathing room
        width: "100%",
    },
    weightContainer: {
        position: "relative",
        width: "100%",
    },
    actions: {
        marginTop: "auto",
        paddingTop: "24px",
        borderTop: `1px solid ${tokens.colorNeutralStroke1}`,
    },
    addItemBtn: {
        width: '150px',
        "@media (max-width: 768px)": {
            width: '100%', // Full width on mobile
        },
    }
});

interface CreateInventoryProps {
    profiles: any[]
    standardProfiles: any[]
    grades: any[]
    shapes: any[]
    suppliers: any[]
}

export function CreateInventoryDialog({ profiles: initialProfiles, standardProfiles, grades, shapes, suppliers }: CreateInventoryProps) {
    const styles = useStyles();
    const [open, setOpen] = useState(false)
    const [items, setItems] = useState<any[]>([])
    const [loading, setLoading] = useState(false)

    // Form State
    const [current, setCurrent] = useState({
        lotId: '',
        length: '',
        quantity: '1',
        certificate: '',
        totalCost: '',
        invoiceNumber: ''
    })

    const [selectedSupplier, setSelectedSupplier] = useState('')
    const [selectedType, setSelectedType] = useState('')
    const [selectedDim, setSelectedDim] = useState('')
    const [customDim, setCustomDim] = useState('')
    const [selectedGrade, setSelectedGrade] = useState('')
    const [manualWeight, setManualWeight] = useState('')

    const [shapeParams, setShapeParams] = useState<Record<string, string>>({})
    const [calcedWeight, setCalcedWeight] = useState(0)

    // IDs for accessibility
    const comboTypeId = useId('combo-type');
    const comboDimId = useId('combo-dim');

    // Derived Logic
    const uniqueTypes = Array.from(new Set(standardProfiles.map(p => p.type)))
    // const allTypes = Array.from(new Set([...uniqueTypes, ...shapes.map(s => s.id)]))
    const isStandardType = uniqueTypes.includes(selectedType)
    const activeShape = shapes.find(s => s.id === selectedType)

    const activeDims = initialProfiles
        .filter(p => p.type === selectedType)
        .map(p => p.dimensions)
        .sort()

    const catalogDims = standardProfiles
        .filter(p => p.type === selectedType)
        .map(p => p.dimensions)
        .filter(d => !activeDims.includes(d))
        .sort((a: string, b: string) => {
            const getVal = (s: string) => parseFloat(s.split(/[xX]/)[0]) || 0
            return getVal(a) - getVal(b)
        })

    const standardMatch = standardProfiles.find(p => p.type === selectedType && p.dimensions === (customDim || selectedDim))

    // Shape Param Parsing Effect
    useEffect(() => {
        if (!selectedDim || !activeShape) return
        const parts = selectedDim.toLowerCase().split(/[x* ]+/).map(s => parseFloat(s)).filter(n => !isNaN(n))
        const params = activeShape.params as string[]

        if (parts.length > 0 && params.length > 0) {
            const newParams: Record<string, string> = {}
            params.forEach((param, i) => {
                if (parts[i] !== undefined) newParams[param] = parts[i].toString()
            })
            const isDiff = Object.entries(newParams).some(([k, v]) => shapeParams[k] !== v)
            if (isDiff) setShapeParams(prev => ({ ...prev, ...newParams }))
        }
    }, [selectedDim, activeShape, shapeParams]) // Added shapeParams to dep to satisfy exhaustive-deps, though logic handles loop

    // Formula Calculation Effect
    useEffect(() => {
        if (!activeShape || !selectedGrade || !activeShape.formula) return
        const gradeObj = grades.find(g => g.name === selectedGrade)
        if (!gradeObj) return

        const numeric: Record<string, number> = {}
        const neededParams = activeShape.params as string[]
        let allValid = true
        for (const p of neededParams) {
            const val = parseFloat(shapeParams[p])
            if (isNaN(val)) {
                allValid = false
                break
            }
            numeric[p] = val
        }

        if (allValid) {
            import('@/lib/formula').then(({ evaluateFormula }) => {
                const areaMm2 = evaluateFormula(activeShape.formula!, numeric)
                const weight = (areaMm2 / 1000) * gradeObj.density
                setManualWeight(weight.toFixed(2))
            })
        }
    }, [activeShape, shapeParams, selectedGrade, grades])


    const handleTypeSelect = (e: any, data: any) => {
        const val = data.optionValue || data.value
        if (val) {
            setSelectedType(val)
            setSelectedDim('')
            setCustomDim('')
            setManualWeight('')
            setShapeParams({})
        }
    }

    // For Dimensions, we handle both select and change (custom)
    const handleDimSelect = (e: any, data: any) => {
        // data.optionValue is set when selecting an option
        // data.value is the text content
        const val = data.optionValue || data.value
        setSelectedDim(val || '')
        setCustomDim(val || '') // Assume custom might be same if typed
    }

    const updateShapeParam = (param: string, val: string) => {
        const newParams = { ...shapeParams, [param]: val }
        setShapeParams(newParams)
        if (activeShape) {
            const dimStr = (activeShape.params as string[]).map(p => newParams[p] || '?').join('x')
            setCustomDim(dimStr)
            setSelectedDim(dimStr) // Keep consistent
        }
    }

    const handleCalculateWeight = async () => {
        if (!selectedType) return
        if (isStandardType && standardMatch) {
            setManualWeight(standardMatch.weightPerMeter.toString())
            return
        }

        const numericParams: any = {}
        for (const [k, v] of Object.entries(shapeParams)) {
            numericParams[k] = parseFloat(v)
        }
        const gradeObj = grades.find(g => g.name === selectedGrade)
        if (gradeObj) numericParams.gradeId = gradeObj.id

        try {
            const w = await calculateProfileWeight(selectedType, numericParams)
            setCalcedWeight(w)
            setManualWeight(w.toFixed(2))
        } catch (e) {
            toast.error("Calculation failed")
        }
    }

    const handleAddItem = async () => {
        if (!selectedType || !(selectedDim || customDim) || !selectedGrade || !current.length || !current.quantity) {
            toast.warning("Please fill required fields")
            return
        }
        setLoading(true)
        try {
            const finalDim = customDim || selectedDim
            const weight = manualWeight ? parseFloat(manualWeight) : (standardMatch?.weightPerMeter || 0)
            const profile = await ensureProfile({ type: selectedType, dimensions: finalDim, weight })

            setItems([...items, {
                ...current,
                profileId: profile.id,
                gradeName: selectedGrade,
                supplierId: selectedSupplier || null,
                profileName: `${profile.type} ${profile.dimensions} (${selectedGrade})`,
                _id: Math.random().toString()
            }])
            // Reset
            setCurrent(prev => ({ ...prev, lotId: '', totalCost: '' }))
        } catch (e) {
            toast.error("Failed to resolve profile")
        } finally {
            setLoading(false)
        }
    }

    const handleSaveAll = async () => {
        if (items.length === 0) return
        setLoading(true)
        try {
            const res = await createInventoryBatch(items.map(i => ({
                lotId: i.lotId,
                profileId: i.profileId,
                gradeName: i.gradeName,
                supplierId: i.supplierId || null,
                invoiceNumber: i.invoiceNumber || null,
                length: parseFloat(i.length),
                quantity: parseInt(i.quantity),
                certificate: i.certificate,
                totalCost: parseFloat(i.totalCost || '0')
            })))
            if (res.success) {
                setOpen(false)
                setItems([])
                toast.success("Inventory batch saved")
            } else {
                toast.error(`Error: ${res.error}`)
            }
        } catch (err) {
            toast.error("Unexpected error")
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={(e, data) => setOpen(data.open)}>
            <DialogTrigger disableButtonEnhancement>
                <Button icon={<AddRegular />}>Add Inventory</Button>
            </DialogTrigger>
            <DialogSurface className={styles.dialogContent}>
                <DialogBody>
                    <DialogTitle>Add Inventory Batch</DialogTitle>

                    {/* New Item Form */}
                    <div className={styles.section}>
                        <div className={styles.sectionTitle}>
                            <AddRegular /> New Item Definition
                        </div>

                        {/* Row 1: Definition */}
                        <div className={styles.gridRowMain}>
                            <Field label="Lot ID" className={styles.field}>
                                <Input
                                    value={current.lotId}
                                    onChange={(e, d) => setCurrent({ ...current, lotId: d.value })}
                                    placeholder="[Auto]"
                                    style={{ width: '100%', textTransform: 'uppercase' }}
                                />
                            </Field>

                            <Field label="Type" className={styles.field}>
                                <Combobox
                                    value={selectedType}
                                    onOptionSelect={handleTypeSelect}
                                    placeholder="Select Type"
                                    style={{ width: '100%' }}
                                >
                                    {uniqueTypes.map(t => <Option key={t} text={t}>{t}</Option>)}
                                    {activeShape && !isStandardType && <Option text={activeShape.id}>{activeShape.id}</Option>}
                                    {shapes.filter(s => !uniqueTypes.includes(s.id)).map(s => <Option key={s.id} text={s.id}>{s.id}</Option>)}
                                </Combobox>
                            </Field>

                            <Field label="Dimensions" className={styles.field}>
                                <Combobox
                                    value={selectedDim}
                                    onOptionSelect={handleDimSelect}
                                    onInput={(e: any) => { setSelectedDim(e.target.value); setCustomDim(e.target.value); }}
                                    freeform
                                    placeholder="Dims"
                                    style={{ width: '100%' }}
                                >
                                    {activeDims.map(d => <Option key={d}>{d}</Option>)}
                                    {isStandardType && catalogDims.map(d => <Option key={d}>{d}</Option>)}
                                </Combobox>
                            </Field>

                            {/* Custom Shape Params Inline - If visible, they might break grid alignment unless handled. 
                                For now, let's keep them here but they might wrap weirdly if many. 
                                Ideally they merge into dimensions line or separate line. 
                                Given current rigorous grid, let's put them in a flex container if present or allow grid to break.
                                actually, the Layout design assumes standard mainly. 
                                If custom params appear, we might want a separate dynamic row.
                            */}

                            <Field label="Grade" className={styles.field}>
                                <Combobox
                                    value={selectedGrade}
                                    onOptionSelect={(e, d) => setSelectedGrade(d.optionValue || '')}
                                    placeholder="Select Grade"
                                    style={{ width: '100%' }}
                                >
                                    {grades.map(g => <Option key={g.id} value={g.name}>{g.name}</Option>)}
                                </Combobox>
                            </Field>
                        </div>

                        {/* Custom Params Row (Conditional) */}
                        {!isStandardType && activeShape && (activeShape.params as string[]).length > 0 && (
                            <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
                                {(activeShape.params as string[]).map(param => (
                                    <Field key={param} label={param} className={styles.field} style={{ maxWidth: '100px' }}>
                                        <Input
                                            value={shapeParams[param] || ''}
                                            onChange={(e, d) => updateShapeParam(param, d.value)}
                                        />
                                    </Field>
                                ))}
                            </div>
                        )}

                        {/* Row 2: Metrics */}
                        <div className={styles.gridRowSecondary}>
                            <Field label="Length (mm)" required className={styles.field}>
                                <Input type="number" value={current.length} onChange={(e, d) => setCurrent({ ...current, length: d.value })} style={{ width: '100%' }} />
                            </Field>
                            <Field label="Qty" required className={styles.field}>
                                <Input type="number" value={current.quantity} onChange={(e, d) => setCurrent({ ...current, quantity: d.value })} style={{ width: '100%' }} />
                            </Field>
                            <Field label="Cost (€)" className={styles.field}>
                                <Input type="number" value={current.totalCost} onChange={(e, d) => setCurrent({ ...current, totalCost: d.value })} style={{ width: '100%' }} />
                            </Field>

                            <div className={styles.weightContainer}>
                                <Field label="Weight (kg/m)" className={styles.field}>
                                    <Input
                                        value={manualWeight}
                                        onChange={(e, d) => setManualWeight(d.value)}
                                        style={{ width: '100%' }}
                                        contentAfter={
                                            <Button
                                                appearance="transparent"
                                                icon={<CalculatorRegular />}
                                                onClick={handleCalculateWeight}
                                                size="small"
                                                disabled={!selectedType}
                                            />
                                        }
                                    />
                                </Field>
                            </div>

                            <Field label="Supplier" className={styles.field}>
                                <Combobox
                                    value={suppliers.find(s => s.id === selectedSupplier)?.name || (selectedSupplier === '' ? 'None' : selectedSupplier)}
                                    onOptionSelect={(e, d) => setSelectedSupplier(d.optionValue || '')}
                                    placeholder="Optional"
                                    style={{ width: '100%' }}
                                >
                                    <Option value="">None</Option>
                                    {suppliers.map(s => <Option key={s.id} value={s.id}>{s.name}</Option>)}
                                </Combobox>
                            </Field>
                        </div>

                        {/* Row 3: Actions */}
                        <div className={styles.gridRowActions}>
                            <Field label="Cert" className={styles.field}>
                                <FluentFileUploader
                                    bucketName="certificates"
                                    onUploadComplete={(path) => setCurrent({ ...current, certificate: path })}
                                    currentValue={current.certificate}
                                    minimal
                                />
                            </Field>

                            <Button appearance="primary" size="large" icon={<AddRegular />} onClick={handleAddItem} className={styles.addItemBtn}>
                                Add Item
                            </Button>
                        </div>
                    </div>

                    {/* Pending Items Table */}
                    {items.length > 0 && (
                        <div className={styles.section}>
                            <div className={styles.sectionTitle}>Pending Batch ({items.length})</div>
                            <div style={{ maxHeight: "300px", overflowY: "auto" }}>
                                <Table size="small">
                                    <TableHeader>
                                        <TableRow>
                                            <TableHeaderCell>Lot</TableHeaderCell>
                                            <TableHeaderCell>Desc</TableHeaderCell>
                                            <TableHeaderCell>L (mm)</TableHeaderCell>
                                            <TableHeaderCell>Qty</TableHeaderCell>
                                            <TableHeaderCell>Cost</TableHeaderCell>
                                            <TableHeaderCell />
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {items.map((item, i) => (
                                            <TableRow key={item._id}>
                                                <TableCell>{item.lotId || "[Auto]"}</TableCell>
                                                <TableCell>{item.profileName}</TableCell>
                                                <TableCell>{item.length}</TableCell>
                                                <TableCell>{item.quantity}</TableCell>
                                                <TableCell>{item.totalCost}</TableCell>
                                                <TableCell>
                                                    <Button icon={<DeleteRegular />} appearance="subtle" onClick={() => setItems(items.filter((_, idx) => idx !== i))} />
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                    )}

                </DialogBody>
                <DialogActions>
                    <Button appearance="secondary" onClick={() => setOpen(false)}>Close</Button>
                    <Button appearance="primary" icon={<SaveRegular />} disabled={items.length === 0 || loading} onClick={handleSaveAll}>
                        {loading ? "Saving..." : "Save Batch"}
                    </Button>
                </DialogActions>
            </DialogSurface>
        </Dialog>
    )
}
