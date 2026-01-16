'use client'

import { useState } from 'react'
import {
    Dialog,
    DialogTrigger,
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
    Divider,
    Table,
    TableHeader,
    TableRow,
    TableBody,
    TableHeaderCell,
    TableCell,
    Tag
} from '@fluentui/react-components'
import {
    AddRegular,
    BoxRegular,
    CutRegular,
    LayerDiagonalRegular,
    DeleteRegular,
    CheckmarkCircleRegular,
    WarningRegular,
    DismissRegular
} from '@fluentui/react-icons'
import { useRouter } from 'next/navigation'
import { createAssembly, addPartToAssembly, addPlatePartToAssembly } from '@/app/actions/assemblies'
import { createPart } from '@/app/actions/parts'
import { createPlatePart } from '@/app/actions/plateparts'
import { ensureProfile } from '@/app/actions/inventory'
import { toast } from 'sonner'

const useStyles = makeStyles({
    root: {
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
    },
    section: {
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        // Removed grey background/border for cleaner look
    },
    header: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        marginBottom: '8px',
        borderBottom: `2px solid ${tokens.colorNeutralStroke2}`,
        paddingBottom: '8px',
    },
    headerIcon: {
        color: tokens.colorBrandForeground1,
    },
    headerTitle: {
        fontWeight: 'bold',
        color: tokens.colorBrandForeground1,
        textTransform: 'uppercase',
        fontSize: '12px',
        letterSpacing: '0.05em',
    },
    gridTwo: {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '16px',
        '@media (max-width: 768px)': {
            display: 'flex',
            flexDirection: 'column',
        }
    },
    gridThree: {
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '16px',
        '@media (max-width: 768px)': {
            display: 'flex',
            flexDirection: 'column',
        }
    },
    partList: {
        maxHeight: '300px',
        overflowY: 'auto',
        ...shorthands.border('1px', 'solid', tokens.colorNeutralStroke2),
        ...shorthands.borderRadius(tokens.borderRadiusMedium),
    },
    addSubSection: {
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        padding: '16px',
        backgroundColor: tokens.colorNeutralBackgroundAlpha, // Keep slight bg for nested form or remove? Let's keep distinct sub-form
        ...shorthands.borderRadius(tokens.borderRadiusMedium),
        ...shorthands.border('1px', 'dashed', tokens.colorNeutralStroke2),
    },
    calcBox: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 12px',
        backgroundColor: tokens.colorPaletteGreenBackground1,
        ...shorthands.borderRadius(tokens.borderRadiusMedium),
    }
})

interface PartItem {
    id?: string
    partNumber: string
    description: string
    type: 'profile' | 'plate'
    profileType: string
    profileDimensions: string
    gradeId: string
    gradeName: string
    length: number
    quantity: number
    quantityInAssembly: number
    isOutsourcedCut: boolean
    cutVendor: string
    // Plate specific
    material: string
    thickness: number
    width: number
    plateLength: number
    unitWeight: number
    supplier: string
    isNew: boolean
}

interface CreateAssemblyDialogProps {
    projectId: string
    existingParts: { id: string; partNumber: string; description: string | null; profile?: { type: string; dimensions: string } | null }[]
    existingAssemblies: { id: string; assemblyNumber: string; name: string }[]
    profiles: { id: string; type: string; dimensions: string; weightPerMeter: number }[]
    standardProfiles: { type: string; dimensions: string; weightPerMeter: number }[]
    grades: { id: string; name: string }[]
    shapes: { id: string; params: string[]; formula: string | null }[]
}

export function CreateAssemblyDialog({
    projectId,
    existingParts,
    existingAssemblies,
    profiles,
    standardProfiles,
    grades,
    shapes
}: CreateAssemblyDialogProps) {
    const styles = useStyles();
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const router = useRouter()

    // Assembly fields
    const [assemblyNumber, setAssemblyNumber] = useState('')
    const [name, setName] = useState('')
    const [description, setDescription] = useState('')
    const [parentId, setParentId] = useState('')
    const [scheduledDate, setScheduledDate] = useState('')
    const [assemblyQuantity, setAssemblyQuantity] = useState('1')

    // Parts to add
    const [partItems, setPartItems] = useState<PartItem[]>([])

    // Part creation mode
    const [partMode, setPartMode] = useState<'existing' | 'new'>('existing')
    const [selectedPartId, setSelectedPartId] = useState('')
    const [qtyInAssembly, setQtyInAssembly] = useState('1')

    // New part type (profile or plate)
    const [newPartType, setNewPartType] = useState<'profile' | 'plate'>('profile')

    // New part common fields
    const [newPartNumber, setNewPartNumber] = useState('')
    const [newDescription, setNewDescription] = useState('')
    const [newGradeId, setNewGradeId] = useState('')
    const [newQuantity, setNewQuantity] = useState('1')

    // Profile fields
    const [selectedType, setSelectedType] = useState('')
    const [selectedDim, setSelectedDim] = useState('')
    const [customDim, setCustomDim] = useState('')
    const [newLength, setNewLength] = useState('')
    const [isOutsourcedCut, setIsOutsourcedCut] = useState(false)
    const [cutVendor, setCutVendor] = useState('')

    // Plate fields
    const [plateThickness, setPlateThickness] = useState('')
    const [plateWidth, setPlateWidth] = useState('')
    const [plateLength, setPlateLength] = useState('')
    const [plateWeight, setPlateWeight] = useState('')
    const [plateSupplier, setPlateSupplier] = useState('')
    const [isPlateOutsourced, setIsPlateOutsourced] = useState(true)

    // Derived values
    const uniqueTypes = Array.from(new Set(standardProfiles.map(p => p.type)))
    // Combine types
    const allTypes = [...new Set([...uniqueTypes, ...shapes.map(s => s.id)])]

    const activeDims = profiles
        .filter(p => p.type === selectedType)
        .map(p => p.dimensions)
        .sort()

    const catalogDims = standardProfiles
        .filter(p => p.type === selectedType)
        .map(p => p.dimensions)
        .filter(d => !activeDims.includes(d))
        .sort((a, b) => {
            const getVal = (s: string) => parseFloat(s.split(/[xX]/)[0]) || 0
            return getVal(a) - getVal(b)
        })

    const dimOptions = [...new Set([...activeDims, ...catalogDims])]

    const handleAddExistingPart = () => {
        if (!selectedPartId || !qtyInAssembly) return

        const part = existingParts.find(p => p.id === selectedPartId)
        if (!part) return

        if (partItems.some(p => p.id === selectedPartId)) {
            toast.warning('Part already added')
            return
        }

        setPartItems([...partItems, {
            id: part.id,
            partNumber: part.partNumber,
            description: part.description || '',
            type: 'profile',
            profileType: part.profile?.type || '',
            profileDimensions: part.profile?.dimensions || '',
            gradeId: '',
            gradeName: '',
            length: 0,
            quantity: 0,
            quantityInAssembly: parseInt(qtyInAssembly),
            isOutsourcedCut: false,
            cutVendor: '',
            material: '',
            thickness: 0,
            width: 0,
            plateLength: 0,
            unitWeight: 0,
            supplier: '',
            isNew: false
        }])

        setSelectedPartId('')
        setQtyInAssembly('1')
    }

    const handleAddNewPart = () => {
        if (!newPartNumber || !newQuantity) {
            toast.warning('Part number and quantity required')
            return
        }

        if (newPartType === 'profile' && (!selectedType || !(selectedDim || customDim))) {
            toast.warning('Profile type and dimensions required')
            return
        }

        if (newPartType === 'plate' && (!newGradeId || !plateThickness)) {
            toast.warning('Grade and thickness required for plate')
            return
        }

        if (existingParts.some(p => p.partNumber === newPartNumber) ||
            partItems.some(p => p.partNumber === newPartNumber)) {
            toast.warning('Part number already exists')
            return
        }

        const grade = grades.find(g => g.id === newGradeId)

        setPartItems([...partItems, {
            partNumber: newPartNumber,
            description: newDescription,
            type: newPartType,
            profileType: selectedType,
            profileDimensions: customDim || selectedDim,
            gradeId: newGradeId,
            gradeName: grade?.name || '',
            length: parseFloat(newLength) || 0,
            quantity: parseInt(newQuantity),
            quantityInAssembly: parseInt(newQuantity),
            isOutsourcedCut: newPartType === 'profile' ? isOutsourcedCut : isPlateOutsourced,
            cutVendor: newPartType === 'profile' ? cutVendor : (isPlateOutsourced ? plateSupplier : ''),
            material: grade?.name || '',
            thickness: parseFloat(plateThickness) || 0,
            width: parseFloat(plateWidth) || 0,
            plateLength: parseFloat(plateLength) || 0,
            unitWeight: parseFloat(plateWeight) || 0,
            supplier: isPlateOutsourced ? plateSupplier : '',
            isNew: true
        }])

        resetNewPartFields()
    }

    const resetNewPartFields = () => {
        setNewPartNumber('')
        setNewDescription('')
        setNewGradeId('')
        setNewQuantity('1')
        setSelectedType('')
        setSelectedDim('')
        setCustomDim('')
        setNewLength('')
        setIsOutsourcedCut(false)
        setCutVendor('')
        setPlateThickness('')
        setPlateWidth('')
        setPlateLength('')
        setPlateWeight('')
        setPlateSupplier('')
        setIsPlateOutsourced(true)
    }

    const removePart = (index: number) => {
        setPartItems(partItems.filter((_, i) => i !== index))
    }

    const handleSubmit = async () => {
        if (!assemblyNumber || !name || !assemblyQuantity) {
            toast.warning('Assembly number, name, and quantity required')
            return
        }

        setLoading(true)
        try {
            const assemblyRes = await createAssembly({
                projectId,
                assemblyNumber,
                name,
                quantity: parseInt(assemblyQuantity) || 1,
                description: description || undefined,
                parentId: parentId || undefined,
                scheduledDate: scheduledDate ? new Date(scheduledDate) : undefined
            })

            if (!assemblyRes.success || !assemblyRes.data) {
                toast.error(`Failed: ${assemblyRes.error}`)
                setLoading(false)
                return
            }

            const assemblyId = assemblyRes.data.id

            for (const item of partItems) {
                let partId = item.id

                if (item.isNew) {
                    if (item.type === 'profile') {
                        const profile = await ensureProfile({
                            type: item.profileType,
                            dimensions: item.profileDimensions,
                            weight: 0
                        })

                        const partRes = await createPart({
                            projectId,
                            partNumber: item.partNumber,
                            description: item.description || undefined,
                            profileId: profile.id,
                            gradeId: item.gradeId || undefined,
                            length: item.length || undefined,
                            quantity: item.quantity,
                            isOutsourcedCut: item.isOutsourcedCut,
                            cutVendor: item.cutVendor || undefined
                        })

                        if (!partRes.success || !partRes.data) {
                            toast.error(`Failed to create ${item.partNumber}`)
                            continue
                        }
                        partId = partRes.data.id
                    } else {
                        const plateRes = await createPlatePart({
                            projectId,
                            partNumber: item.partNumber,
                            description: item.description || undefined,
                            gradeId: item.gradeId || undefined,
                            material: item.material || undefined,
                            thickness: item.thickness || undefined,
                            width: item.width || undefined,
                            length: item.plateLength || undefined,
                            quantity: item.quantity,
                            unitWeight: item.unitWeight || undefined,
                            supplier: item.supplier || undefined,
                            isOutsourced: item.isOutsourcedCut
                        })

                        if (!plateRes.success) {
                            toast.error(`Failed to create plate ${item.partNumber}`)
                            continue
                        }
                        if (plateRes.data) {
                            await addPlatePartToAssembly(assemblyId, plateRes.data.id, item.quantityInAssembly)
                        }
                        continue
                    }
                }

                if (partId) {
                    await addPartToAssembly(assemblyId, partId, item.quantityInAssembly)
                }
            }

            toast.success('Assembly created')
            setOpen(false)
            resetForm()
            router.refresh()

        } catch (e) {
            toast.error('Failed to create assembly')
        } finally {
            setLoading(false)
        }
    }

    const resetForm = () => {
        setAssemblyNumber('')
        setName('')
        setDescription('')
        setParentId('')
        setScheduledDate('')
        setAssemblyQuantity('1')
        setPartItems([])
        setSelectedPartId('')
        setQtyInAssembly('1')
        resetNewPartFields()
    }

    return (
        <Dialog open={open} onOpenChange={(e, data) => setOpen(data.open)}>
            <DialogTrigger disableButtonEnhancement>
                <Button icon={<AddRegular />}>Add Assembly</Button>
            </DialogTrigger>
            <DialogSurface style={{ width: '95vw', maxWidth: '1000px', minWidth: '320px', minHeight: '600px' }}>
                <DialogBody>
                    <DialogTitle>Create New Assembly</DialogTitle>
                    <DialogContent className={styles.root}>
                        {/* Assembly Metadata */}
                        <div className={styles.section}>
                            <div className={styles.header}>
                                <div className={styles.headerIcon}><LayerDiagonalRegular /></div>
                                <Text className={styles.headerTitle}>Assembly Metadata</Text>
                            </div>
                            <div className={styles.gridTwo}>
                                <Field label="Assembly Number" required>
                                    <Input value={assemblyNumber} onChange={(e, d) => setAssemblyNumber(d.value)} placeholder="A-001" />
                                </Field>
                                <Field label="Name" required>
                                    <Input value={name} onChange={(e, d) => setName(d.value)} placeholder="Main Frame" />
                                </Field>
                            </div>
                            <div className={styles.gridThree}>
                                <Field label="Quantity" required>
                                    <Input type="number" min="1" value={assemblyQuantity} onChange={(e, d) => setAssemblyQuantity(d.value)} />
                                </Field>
                                <Field label="Parent Assembly">
                                    <Dropdown
                                        value={existingAssemblies.find(a => a.id === parentId)?.assemblyNumber || 'None (Top-level)'}
                                        selectedOptions={parentId ? [parentId] : ['_none']}
                                        onOptionSelect={(_, data) => setParentId(data.optionValue === '_none' ? '' : data.optionValue as string)}
                                    >
                                        <Option value="_none">None (Top-level)</Option>
                                        {existingAssemblies.map(a => (
                                            <Option key={a.id} value={a.id} text={`${a.assemblyNumber} - ${a.name}`}>
                                                {a.assemblyNumber} - {a.name}
                                            </Option>
                                        ))}
                                    </Dropdown>
                                </Field>
                                <Field label="Scheduled Date">
                                    <Input type="date" value={scheduledDate} onChange={(e, d) => setScheduledDate(d.value)} />
                                </Field>
                            </div>
                            <Field label="Description">
                                <Input value={description} onChange={(e, d) => setDescription(d.value)} placeholder="Assembly description..." />
                            </Field>
                        </div>

                        {/* Component Assignment */}
                        <div className={styles.section}>
                            <div className={styles.header}>
                                <div className={styles.headerIcon}><BoxRegular /></div>
                                <Text className={styles.headerTitle}>Component Assignment</Text>
                            </div>

                            <TabList
                                selectedValue={partMode}
                                onTabSelect={(_, data) => setPartMode(data.value as 'existing' | 'new')}
                                style={{ marginBottom: '16px' }}
                            >
                                <Tab value="existing">Select Existing</Tab>
                                <Tab value="new">Create New Part</Tab>
                            </TabList>

                            {/* Existing Part Flow */}
                            {partMode === 'existing' && (
                                <div className={styles.addSubSection}>
                                    <div className={styles.gridThree}>
                                        <Field label="Select Component" style={{ gridColumn: 'span 2' }}>
                                            <Combobox
                                                value={existingParts.find(p => p.id === selectedPartId)?.partNumber || ''}
                                                onOptionSelect={(_, data) => setSelectedPartId(data.optionValue || '')}
                                                placeholder="Choose part..."
                                                freeform={false}
                                            >
                                                {existingParts.map(p => (
                                                    <Option key={p.id} value={p.id} text={p.partNumber}>
                                                        {p.partNumber} - {p.description || `${p.profile?.type} ${p.profile?.dimensions}`}
                                                    </Option>
                                                ))}
                                            </Combobox>
                                        </Field>
                                        <Field label="Quantity">
                                            <Input type="number" min="1" value={qtyInAssembly} onChange={(e, d) => setQtyInAssembly(d.value)} />
                                        </Field>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                        <Button onClick={handleAddExistingPart} disabled={!selectedPartId} icon={<AddRegular />}>Assign Part</Button>
                                    </div>
                                </div>
                            )}

                            {/* New Part Flow */}
                            {partMode === 'new' && (
                                <div className={styles.addSubSection}>
                                    <TabList
                                        selectedValue={newPartType}
                                        onTabSelect={(_, data) => setNewPartType(data.value as 'profile' | 'plate')}
                                        size="small"
                                    >
                                        <Tab value="profile" icon={<BoxRegular />}>Profile</Tab>
                                        <Tab value="plate" icon={<CutRegular />}>Plate</Tab>
                                    </TabList>

                                    <div className={styles.gridThree}>
                                        <Field label="Part #" required>
                                            <Input value={newPartNumber} onChange={(e, d) => setNewPartNumber(d.value)} style={{ textTransform: 'uppercase' }} />
                                        </Field>
                                        <Field label="Quantity" required>
                                            <Input type="number" value={newQuantity} onChange={(e, d) => setNewQuantity(d.value)} />
                                        </Field>
                                        <Field label="Grade">
                                            <Dropdown
                                                value={grades.find(g => g.id === newGradeId)?.name || ''}
                                                selectedOptions={newGradeId ? [newGradeId] : []}
                                                onOptionSelect={(_, data) => setNewGradeId(data.optionValue as string)}
                                            >
                                                {grades.map(g => (
                                                    <Option key={g.id} value={g.id} text={g.name}>{g.name}</Option>
                                                ))}
                                            </Dropdown>
                                        </Field>
                                    </div>

                                    {newPartType === 'profile' && (
                                        <div className={styles.gridThree}>
                                            <Field label="Type" required>
                                                <Combobox
                                                    value={selectedType}
                                                    onOptionSelect={(_, data) => {
                                                        setSelectedType(data.optionValue || '')
                                                        setSelectedDim('')
                                                        setCustomDim('')
                                                    }}
                                                    placeholder="Profile Type"
                                                >
                                                    {allTypes.map(t => (
                                                        <Option key={t} value={t} text={t}>{t}</Option>
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
                                                    placeholder="Size"
                                                    disabled={!selectedType}
                                                >
                                                    {dimOptions.map(d => (
                                                        <Option key={d} value={d} text={d}>{d}</Option>
                                                    ))}
                                                </Combobox>
                                            </Field>
                                            <Field label="Length (mm)">
                                                <Input type="number" value={newLength} onChange={(e, d) => setNewLength(d.value)} />
                                            </Field>
                                        </div>
                                    )}

                                    {newPartType === 'plate' && (
                                        <div className={styles.gridThree}>
                                            <Field label="Thick (mm)" required>
                                                <Input type="number" value={plateThickness} onChange={(e, d) => setPlateThickness(d.value)} />
                                            </Field>
                                            <Field label="Width (mm)">
                                                <Input type="number" value={plateWidth} onChange={(e, d) => setPlateWidth(d.value)} />
                                            </Field>
                                            <Field label="Length (mm)">
                                                <Input type="number" value={plateLength} onChange={(e, d) => setPlateLength(d.value)} />
                                            </Field>
                                        </div>
                                    )}

                                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
                                        <Button onClick={handleAddNewPart} icon={<AddRegular />}>Add New Part</Button>
                                    </div>
                                </div>
                            )}

                            {/* Added Parts List */}
                            {partItems.length > 0 && (
                                <div className={styles.partList}>
                                    <Table size="small">
                                        <TableHeader>
                                            <TableRow>
                                                <TableHeaderCell>Part #</TableHeaderCell>
                                                <TableHeaderCell>Spec</TableHeaderCell>
                                                <TableHeaderCell>Qty</TableHeaderCell>
                                                <TableHeaderCell>Action</TableHeaderCell>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {partItems.map((item, idx) => (
                                                <TableRow key={idx}>
                                                    <TableCell>
                                                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                            <Text weight="semibold">{item.partNumber}</Text>
                                                            {item.isNew && <Tag size="extra-small" appearance="brand">NEW</Tag>}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        {item.type === 'profile'
                                                            ? `${item.profileType} ${item.profileDimensions} L=${item.length}`
                                                            : `PL ${item.thickness}mm`}
                                                    </TableCell>
                                                    <TableCell>{item.quantityInAssembly}</TableCell>
                                                    <TableCell>
                                                        <Button
                                                            icon={<DeleteRegular />}
                                                            appearance="subtle"
                                                            onClick={() => removePart(idx)}
                                                            aria-label="Remove part"
                                                        />
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            )}
                        </div>
                    </DialogContent>
                    <DialogActions>
                        <Button appearance="secondary" onClick={() => setOpen(false)} disabled={loading}>Cancel</Button>
                        <Button appearance="primary" onClick={handleSubmit} disabled={loading} icon={!loading ? <AddRegular /> : <Spinner size="tiny" />}>
                            {loading ? 'Creating...' : 'Create Assembly'}
                        </Button>
                    </DialogActions>
                </DialogBody>
            </DialogSurface>
        </Dialog>
    )
}
