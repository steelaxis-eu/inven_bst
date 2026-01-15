'use client'

import React, { useState, useEffect } from 'react'
import {
    Dialog,
    DialogTrigger,
    DialogSurface,
    DialogTitle,
    DialogBody,
    DialogContent,
    Button,
    Input,
    Label,
    makeStyles,
    TabList,
    Tab,
    Combobox,
    Option,
    Field,
    Text,
    Spinner,
    tokens,
    shorthands
} from "@fluentui/react-components";
import {
    CalculatorRegular,
    CheckmarkCircleRegular,
    DismissCircleRegular
} from "@fluentui/react-icons";
import { getStandardProfileTypes, getStandardProfileDimensions, calculateProfileWeight, getProfileShapes, getMaterialGrades } from "@/app/actions/calculator"

const useStyles = makeStyles({
    dialogContent: {
        display: "flex",
        flexDirection: "column",
        gap: "16px",
        minWidth: "400px",
        maxWidth: "500px",
    },
    resultBox: {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
        backgroundColor: tokens.colorNeutralBackground2,
        ...shorthands.borderRadius(tokens.borderRadiusMedium),
        marginTop: "16px"
    },
    weightValue: {
        fontSize: "32px",
        fontWeight: "bold",
        color: tokens.colorBrandForeground1,
    },
    grid2: {
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "12px",
    }
});

interface ProfileCalculatorProps {
    onSelect: (profile: { type: string, dimensions: string, weight: number, gradeId?: string }) => void
    trigger?: React.ReactNode
}

export function ProfileCalculator({ onSelect, trigger }: ProfileCalculatorProps) {
    const styles = useStyles();
    const [open, setOpen] = useState(false)
    const [mode, setMode] = useState<'STANDARD' | 'CUSTOM'>('STANDARD')

    // Standard Headers
    const [stdTypes, setStdTypes] = useState<string[]>([])
    const [stdDims, setStdDims] = useState<string[]>([])

    // Standard Selection
    const [type, setType] = useState('')
    const [dim, setDim] = useState('')

    // Data Sources
    const [shapes, setShapes] = useState<{ id: string, name: string }[]>([])
    const [grades, setGrades] = useState<{ id: string, name: string }[]>([])

    // Custom
    const [customType, setCustomType] = useState('RHS')
    const [selectedGradeId, setSelectedGradeId] = useState<string>('')
    const [w, setW] = useState('')
    const [h, setH] = useState('')
    const [t, setT] = useState('')
    const [d, setD] = useState('')
    const [s, setS] = useState('') // For square bar

    // Result
    const [calculatedWeight, setCalculatedWeight] = useState<number | null>(null)
    const [calculating, setCalculating] = useState(false)

    // Initial Fetch for standard types and metadata
    useEffect(() => {
        getStandardProfileTypes().then(types => {
            setStdTypes(types)
            if (types.length > 0) {
                setType(types[0])
            }
        })
        getProfileShapes().then(data => {
            setShapes(data)
        })
        getMaterialGrades().then(data => {
            setGrades(data)
            if (data.length > 0) setSelectedGradeId(data[0].id)
        })
    }, [])

    // Fetch Dims when Type changes (for standard mode)
    useEffect(() => {
        if (mode === 'STANDARD' && type) {
            setCalculating(true)
            getStandardProfileDimensions(type).then(dims => {
                setStdDims(dims)
                setDim('')
                setCalculatedWeight(null)
                setCalculating(false)
            }).catch(() => {
                setStdDims([])
                setDim('')
                setCalculatedWeight(null)
                setCalculating(false)
            })
        } else if (mode === 'CUSTOM') {
            setStdDims([])
            setDim('')
        }
    }, [mode, type])

    // Calculate 
    useEffect(() => {
        const fetchWeight = async () => {
            setCalculating(true)
            try {
                let weight = 0
                if (mode === 'STANDARD') {
                    if (type && dim) {
                        weight = await calculateProfileWeight(type, { dimensions: dim, gradeId: selectedGradeId })
                    }
                } else {
                    // Custom
                    const params: any = {
                        w: parseFloat(w),
                        h: parseFloat(h),
                        t: parseFloat(t),
                        d: parseFloat(d),
                        s: parseFloat(s),
                        gradeId: selectedGradeId
                    }
                    const hasValidDimension = !isNaN(params.w) || !isNaN(params.h) || !isNaN(params.t) || !isNaN(params.d) || !isNaN(params.s);

                    if (hasValidDimension) {
                        weight = await calculateProfileWeight(customType, params)
                    }
                }
                setCalculatedWeight(weight > 0 ? weight : null)
            } catch (e) {
                console.error("Calc error", e)
                setCalculatedWeight(null)
            } finally {
                setCalculating(false)
            }
        }

        const timer = setTimeout(fetchWeight, 300)
        return () => clearTimeout(timer)
    }, [mode, type, dim, customType, w, h, t, d, s, selectedGradeId])


    const handleUseCheck = () => {
        if (!calculatedWeight) return

        let finalType = mode === 'STANDARD' ? type : customType
        let finalDim = ''

        if (mode === 'STANDARD') {
            finalDim = dim
        } else {
            if (customType.includes('RHS')) finalDim = `${w}x${h}x${t}`
            else if (customType.includes('SHS')) finalDim = `${w || s}x${w || s}x${t}`
            else if (customType.includes('CHS')) finalDim = `${d}x${t}`
            else if (['FB', 'PL', 'Plate'].includes(customType)) finalDim = `${w}x${t}`
            else if (['R', 'Round', 'Round Bar'].includes(customType)) finalDim = `D${d}`
            else if (['SQB', 'Square Bar'].includes(customType)) finalDim = `${s || w}`
            else finalDim = `${w}x${h}x${t}` // Fallback
        }

        onSelect({
            type: finalType,
            dimensions: finalDim,
            weight: calculatedWeight,
            gradeId: selectedGradeId
        })
        setOpen(false)
    }

    // Helper to determine inputs based on shape ID
    const showW = (id: string) => ['RHS', 'SHS', 'FB', 'PL', 'Plate', 'SQB'].some(k => id.includes(k))
    const showH = (id: string) => ['RHS'].some(k => id.includes(k)) && !id.includes('SHS')
    const showT = (id: string) => ['RHS', 'SHS', 'CHS', 'FB', 'PL', 'Plate'].some(k => id.includes(k))
    const showD = (id: string) => ['CHS', 'R', 'Round'].some(k => id.includes(k))
    const showS = (id: string) => ['SHS', 'SQB'].some(k => id.includes(k))

    return (
        <Dialog open={open} onOpenChange={(e, data) => setOpen(data.open)}>
            <DialogTrigger disableButtonEnhancement>
                {React.isValidElement(trigger) ? trigger : <Button icon={<CalculatorRegular />}>{trigger as React.ReactNode || "Calculator"}</Button>}
            </DialogTrigger>
            <DialogSurface className={styles.dialogContent}>
                <DialogBody>
                    <DialogTitle>Find or Calculate Profile</DialogTitle>

                    <TabList
                        selectedValue={mode}
                        onTabSelect={(e, d) => setMode(d.value as any)}
                        style={{ marginBottom: '16px' }}
                    >
                        <Tab value="STANDARD">Standard Catalog</Tab>
                        <Tab value="CUSTOM">Custom Calculator</Tab>
                    </TabList>

                    <Field label="Material Grade">
                        <Combobox
                            value={grades.find(g => g.id === selectedGradeId)?.name || "Select Grade"}
                            onOptionSelect={(e, d) => setSelectedGradeId(d.optionValue || '')}
                            placeholder="Select Grade"
                        >
                            {grades.map(g => <Option key={g.id} value={g.id} text={g.name}>{g.name}</Option>)}
                        </Combobox>
                    </Field>

                    {mode === 'STANDARD' ? (
                        <div className="flex flex-col gap-4 mt-4">
                            <div className={styles.grid2}>
                                <Field label="Profile Type">
                                    <Combobox
                                        value={type}
                                        onOptionSelect={(e, d) => setType(d.optionValue || '')}
                                        placeholder="Select Type"
                                    >
                                        {stdTypes.map(t => <Option key={t} value={t} text={t}>{t}</Option>)}
                                    </Combobox>
                                </Field>
                                <Field label="Dimension">
                                    <Combobox
                                        value={dim}
                                        onOptionSelect={(e, d) => setDim(d.optionValue || '')}
                                        placeholder="Select Size"
                                        disabled={stdDims.length === 0}
                                    >
                                        {stdDims.map(d => <Option key={d} value={d} text={d}>{d}</Option>)}
                                    </Combobox>
                                </Field>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-4 mt-4">
                            <Field label="Shape Type">
                                <Combobox
                                    value={shapes.find(s => s.id === customType)?.name || customType}
                                    onOptionSelect={(e, d) => setCustomType(d.optionValue || '')}
                                    placeholder="Select Shape"
                                >
                                    {shapes.map(s => <Option key={s.id} value={s.id} text={s.name || s.id}>{s.name || s.id}</Option>)}
                                </Combobox>
                            </Field>
                            <div className={styles.grid2}>
                                {(showW(customType) || showS(customType)) && (
                                    <Field label={showS(customType) ? 'Side (S) mm' : 'Width (W) mm'}>
                                        <Input type="number" value={w || s} onChange={(e, d) => { setW(d.value); setS(d.value) }} />
                                    </Field>
                                )}
                                {showH(customType) && (
                                    <Field label="Height (H) mm">
                                        <Input type="number" value={h} onChange={(e, d) => setH(d.value)} />
                                    </Field>
                                )}
                                {showD(customType) && (
                                    <Field label="Diameter (D) mm">
                                        <Input type="number" value={d} onChange={(e, d) => setD(d.value)} />
                                    </Field>
                                )}
                                {showT(customType) && (
                                    <Field label="Thickness (t) mm">
                                        <Input type="number" value={t} onChange={(e, d) => setT(d.value)} />
                                    </Field>
                                )}
                            </div>
                        </div>
                    )}

                    <div className={styles.resultBox}>
                        <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>Theoretical Weight</Text>
                        <div className={styles.weightValue}>
                            {calculating ? <Spinner size="small" /> : (calculatedWeight ? calculatedWeight.toFixed(2) : '---')}
                        </div>
                        <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>kg/m</Text>
                    </div>

                    <Button
                        appearance="primary"
                        onClick={handleUseCheck}
                        disabled={!calculatedWeight || calculating}
                        style={{ marginTop: '16px', width: '100%' }}
                        icon={<CheckmarkCircleRegular />}
                    >
                        Use This Profile
                    </Button>
                </DialogBody>
            </DialogSurface>
        </Dialog>
    )
}
