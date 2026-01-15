'use client'

import { useState } from 'react'
import {
    Button,
    Input,
    Card,
    CardHeader,
    CardPreview,
    Text,
    Title3,
    makeStyles,
    tokens,
    TabList,
    Tab,
    Dialog,
    DialogTrigger,
    DialogSurface,
    DialogBody,
    DialogTitle,
    DialogContent,
    DialogActions,
    Table,
    TableHeader,
    TableRow,
    TableHeaderCell,
    TableBody,
    TableCell,
    Field,
    Badge,
    SelectTabEventHandler,
    TabValue
} from "@fluentui/react-components"
import {
    AddRegular,
    DeleteRegular,
    EditRegular,
    SaveRegular
} from "@fluentui/react-icons"
import { createStandardProfile, deleteStandardProfile } from "@/app/actions/inventory"
import { createSteelProfile, deleteSteelProfile } from "@/app/actions/profiles"
import { createProfileShape, deleteProfileShape } from "@/app/actions/shapes"
import { updateGrade } from "@/app/actions/grades"
import { createSupplier, updateSupplier, deleteSupplier } from "@/app/actions/suppliers"
import { updateGlobalSettings } from "@/app/actions/settings"
import { toast } from "sonner"

const useStyles = makeStyles({
    root: {
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
        padding: '24px',
    },
    card: {
        height: 'fit-content',
    },
    tableContainer: {
        overflowX: 'auto',
    },
    actions: {
        display: 'flex',
        justifyContent: 'flex-end',
        gap: '8px',
        paddingTop: '16px',
    },
    dialogContent: {
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
    },
    gridTwo: {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '16px',
    },
    codeSnippet: {
        backgroundColor: tokens.colorNeutralBackground3,
        padding: '2px 6px',
        borderRadius: tokens.borderRadiusSmall,
        fontFamily: 'monospace',
    },
    tabList: {
        overflowX: 'auto',
        paddingBottom: '4px',
    }
})

interface SettingsClientProps {
    initialShapes: any[]
    initialGrades: any[]
    initialStandardProfiles: any[]
    initialSteelProfiles: any[]
    initialSuppliers: any[]
    initialGlobalSettings: any
}

export function SettingsClient({ initialShapes, initialGrades, initialStandardProfiles, initialSteelProfiles, initialSuppliers, initialGlobalSettings }: SettingsClientProps) {
    const styles = useStyles()
    const [selectedTab, setSelectedTab] = useState<TabValue>("profiles")

    // Standard Profile State
    const [profileDialogOpen, setProfileDialogOpen] = useState(false)
    const [newProfile, setNewProfile] = useState({ type: '', dimensions: '', weight: '', area: '' })
    const [loadingProfile, setLoadingProfile] = useState(false)

    // Steel Profile (Active) State
    const [steelProfileDialogOpen, setSteelProfileDialogOpen] = useState(false)
    const [newSteelProfile, setNewSteelProfile] = useState({ type: '', dimensions: '', weight: '' })
    const [loadingSteelProfile, setLoadingSteelProfile] = useState(false)

    // Shape State
    const [shapeDialogOpen, setShapeDialogOpen] = useState(false)
    const [newShape, setNewShape] = useState({ id: '', name: '', params: '', formula: '' })
    const [loadingShape, setLoadingShape] = useState(false)

    // Grade Edit State
    const [editingGrade, setEditingGrade] = useState<any>(null)
    const [gradeForm, setGradeForm] = useState({ density: '', scrapPrice: '' })
    const [gradeDialogOpen, setGradeDialogOpen] = useState(false)
    const [loadingGrade, setLoadingGrade] = useState(false)

    // Supplier State
    const [supplierDialogOpen, setSupplierDialogOpen] = useState(false)
    const [editingSupplier, setEditingSupplier] = useState<any>(null)
    const [supplierForm, setSupplierForm] = useState({ name: '', code: '', contact: '', email: '', phone: '', notes: '' })
    const [loadingSupplier, setLoadingSupplier] = useState(false)

    // Global Settings State
    const [settings, setSettings] = useState(initialGlobalSettings || {})
    const [savingSettings, setSavingSettings] = useState(false)

    const handleTabSelect: SelectTabEventHandler = (e, data) => {
        setSelectedTab(data.value)
    }

    const handleSaveGlobalSettings = async () => {
        setSavingSettings(true)
        try {
            const result = await updateGlobalSettings({
                ncrFormat: settings.ncrFormat,
                ncrNextSeq: parseInt(settings.ncrNextSeq),
                lotFormat: settings.lotFormat,
                lotNextSeq: parseInt(settings.lotNextSeq),
                projectFormat: settings.projectFormat,
                projectNextSeq: parseInt(settings.projectNextSeq),
                scrapPricePerKg: settings.scrapPricePerKg ? parseFloat(settings.scrapPricePerKg) : undefined
            })
            if (result.success) {
                toast.success("System settings updated")
            } else {
                toast.error("Failed to update settings")
            }
        } catch (e) {
            toast.error("An error occurred")
        } finally {
            setSavingSettings(false)
        }
    }

    // Handlers
    const handleAddProfile = async () => {
        if (!newProfile.type || !newProfile.dimensions || !newProfile.weight) {
            toast.error("Type, Dimensions and Weight are required")
            return
        }
        setLoadingProfile(true)
        try {
            await createStandardProfile({
                type: newProfile.type,
                dimensions: newProfile.dimensions,
                weight: parseFloat(newProfile.weight),
                area: newProfile.area ? parseFloat(newProfile.area) : undefined
            })
            setProfileDialogOpen(false)
            setNewProfile({ type: '', dimensions: '', weight: '', area: '' })
            toast.success("Standard profile added")
        } catch (e) {
            toast.error("Failed to create profile")
        } finally {
            setLoadingProfile(false)
        }
    }

    const handleDeleteProfile = async (id: string) => {
        if (!confirm("Are you sure?")) return
        await deleteStandardProfile(id)
        toast.success("Standard profile deleted")
    }

    const handleAddSteelProfile = async () => {
        if (!newSteelProfile.type || !newSteelProfile.dimensions || !newSteelProfile.weight) {
            toast.error("All fields required")
            return
        }
        setLoadingSteelProfile(true)
        try {
            await createSteelProfile({
                type: newSteelProfile.type,
                dimensions: newSteelProfile.dimensions,
                weightPerMeter: parseFloat(newSteelProfile.weight)
            })
            setSteelProfileDialogOpen(false)
            setNewSteelProfile({ type: '', dimensions: '', weight: '' })
            toast.success("Active profile added")
        } catch (e) {
            toast.error("Failed to create profile")
        } finally {
            setLoadingSteelProfile(false)
        }
    }

    const handleDeleteSteelProfile = async (id: string) => {
        if (!confirm("Are you sure?")) return
        await deleteSteelProfile(id)
        toast.success("Active profile deleted")
    }

    const handleAddShape = async () => {
        if (!newShape.id || !newShape.name || !newShape.params) {
            toast.error("ID, Name and Params are required")
            return
        }
        setLoadingShape(true)
        try {
            const paramsList = newShape.params.split(',').map(p => p.trim()).filter(p => p)
            await createProfileShape({
                id: newShape.id,
                name: newShape.name,
                params: paramsList,
                formula: newShape.formula
            })
            setShapeDialogOpen(false)
            setNewShape({ id: '', name: '', params: '', formula: '' })
            toast.success("Shape definition added")
        } catch (e) {
            toast.error("Failed to create shape")
        } finally {
            setLoadingShape(false)
        }
    }

    const handleDeleteShape = async (id: string) => {
        if (!confirm("Are you sure?")) return
        await deleteProfileShape(id)
        toast.success("Shape deleted")
    }

    const handleEditGrade = (grade: any) => {
        setEditingGrade(grade)
        setGradeForm({
            density: grade.density.toString(),
            scrapPrice: (grade.scrapPrice || 0).toString()
        })
        setGradeDialogOpen(true)
    }

    const handleSaveGrade = async () => {
        if (!editingGrade) return
        setLoadingGrade(true)
        try {
            await updateGrade(editingGrade.id, {
                density: parseFloat(gradeForm.density),
                scrapPrice: parseFloat(gradeForm.scrapPrice)
            })
            setGradeDialogOpen(false)
            setEditingGrade(null)
            toast.success("Grade updated")
        } catch (e) {
            toast.error("Failed to update grade")
        } finally {
            setLoadingGrade(false)
        }
    }

    // Supplier Handlers
    const handleOpenSupplierDialog = (supplier?: any) => {
        if (supplier) {
            setEditingSupplier(supplier)
            setSupplierForm({
                name: supplier.name,
                code: supplier.code || '',
                contact: supplier.contact || '',
                email: supplier.email || '',
                phone: supplier.phone || '',
                notes: supplier.notes || ''
            })
        } else {
            setEditingSupplier(null)
            setSupplierForm({ name: '', code: '', contact: '', email: '', phone: '', notes: '' })
        }
        setSupplierDialogOpen(true)
    }

    const handleSaveSupplier = async () => {
        if (!supplierForm.name.trim()) {
            toast.error("Supplier name is required")
            return
        }
        setLoadingSupplier(true)
        try {
            const result = editingSupplier
                ? await updateSupplier(editingSupplier.id, supplierForm)
                : await createSupplier(supplierForm)

            if (!result.success) throw new Error(result.error)

            setSupplierDialogOpen(false)
            setEditingSupplier(null)
            toast.success(editingSupplier ? "Supplier updated" : "Supplier created")
        } catch (e: any) {
            toast.error(e.message || "Failed to save supplier")
        } finally {
            setLoadingSupplier(false)
        }
    }

    const handleDeleteSupplier = async (id: string) => {
        if (!confirm("Delete this supplier?")) return
        const result = await deleteSupplier(id)
        if (result.success) {
            toast.success("Supplier deleted")
        } else {
            toast.error(result.error || "Failed to delete")
        }
    }

    return (
        <div className={styles.root}>
            <TabList
                selectedValue={selectedTab}
                onTabSelect={handleTabSelect}
                className={styles.tabList}
            >
                <Tab value="profiles">Active Profiles</Tab>
                <Tab value="shapes">Shapes</Tab>
                <Tab value="catalog">Standard Catalog</Tab>
                <Tab value="grades">Grades</Tab>
                <Tab value="suppliers">Suppliers</Tab>
                <Tab value="system">Numbering & System</Tab>
            </TabList>

            {selectedTab === "profiles" && (
                <Card className={styles.card}>
                    <CardHeader
                        header={<Title3>Active Profiles</Title3>}
                        description={<Text>Profiles currently used in your inventory.</Text>}
                        action={
                            <Dialog open={steelProfileDialogOpen} onOpenChange={(e, data) => setSteelProfileDialogOpen(data.open)}>
                                <DialogTrigger disableButtonEnhancement>
                                    <Button appearance="primary" icon={<AddRegular />}>Add Manual Profile</Button>
                                </DialogTrigger>
                                <DialogSurface>
                                    <DialogBody>
                                        <DialogTitle>Add Manual Profile</DialogTitle>
                                        <DialogContent className={styles.dialogContent}>
                                            <Field label="Type">
                                                <Input placeholder="e.g. HEA" value={newSteelProfile.type} onChange={(e, d) => setNewSteelProfile({ ...newSteelProfile, type: d.value })} />
                                            </Field>
                                            <Field label="Dimensions">
                                                <Input placeholder="e.g. 100" value={newSteelProfile.dimensions} onChange={(e, d) => setNewSteelProfile({ ...newSteelProfile, dimensions: d.value })} />
                                            </Field>
                                            <Field label="Weight (kg/m)">
                                                <Input type="number" step="0.01" value={newSteelProfile.weight} onChange={(e, d) => setNewSteelProfile({ ...newSteelProfile, weight: d.value })} />
                                            </Field>
                                        </DialogContent>
                                        <DialogActions>
                                            <Button appearance="secondary" onClick={() => setSteelProfileDialogOpen(false)}>Cancel</Button>
                                            <Button appearance="primary" onClick={handleAddSteelProfile} disabled={loadingSteelProfile}>
                                                {loadingSteelProfile ? 'Saving...' : 'Add'}
                                            </Button>
                                        </DialogActions>
                                    </DialogBody>
                                </DialogSurface>
                            </Dialog>
                        }
                    />

                    <div className={styles.tableContainer}>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHeaderCell>Type</TableHeaderCell>
                                    <TableHeaderCell>Dimensions</TableHeaderCell>
                                    <TableHeaderCell>Weight (kg/m)</TableHeaderCell>
                                    <TableHeaderCell>Action</TableHeaderCell>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {initialSteelProfiles.map(p => (
                                    <TableRow key={p.id}>
                                        <TableCell>{p.type}</TableCell>
                                        <TableCell>{p.dimensions}</TableCell>
                                        <TableCell>{p.weightPerMeter}</TableCell>
                                        <TableCell>
                                            <Button
                                                appearance="subtle"
                                                icon={<DeleteRegular />}
                                                onClick={() => handleDeleteSteelProfile(p.id)}
                                                style={{ color: tokens.colorPaletteRedForeground1 }}
                                            />
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </Card>
            )}

            {selectedTab === "shapes" && (
                <Card className={styles.card}>
                    <CardHeader
                        header={<Title3>Profile Shapes</Title3>}
                        description={<Text>Define custom shapes with variables.</Text>}
                        action={
                            <Dialog open={shapeDialogOpen} onOpenChange={(e, data) => setShapeDialogOpen(data.open)}>
                                <DialogTrigger disableButtonEnhancement>
                                    <Button appearance="primary" icon={<AddRegular />}>Add Shape</Button>
                                </DialogTrigger>
                                <DialogSurface>
                                    <DialogBody>
                                        <DialogTitle>Add Custom Shape</DialogTitle>
                                        <DialogContent className={styles.dialogContent}>
                                            <Field label="ID (Unique)">
                                                <Input placeholder="TRIANGLE" value={newShape.id} onChange={(e, d) => setNewShape({ ...newShape, id: d.value.toUpperCase() })} />
                                            </Field>
                                            <Field label="Name">
                                                <Input placeholder="Triangular Prism" value={newShape.name} onChange={(e, d) => setNewShape({ ...newShape, name: d.value })} />
                                            </Field>
                                            <Field label="Params (comma sep)">
                                                <Input placeholder="b, h" value={newShape.params} onChange={(e, d) => setNewShape({ ...newShape, params: d.value })} />
                                            </Field>
                                            <Field label="Formula">
                                                <Input placeholder="0.5 * b * h" value={newShape.formula} onChange={(e, d) => setNewShape({ ...newShape, formula: d.value })} />
                                            </Field>
                                        </DialogContent>
                                        <DialogActions>
                                            <Button appearance="secondary" onClick={() => setShapeDialogOpen(false)}>Cancel</Button>
                                            <Button appearance="primary" onClick={handleAddShape} disabled={loadingShape}>
                                                {loadingShape ? 'Saving...' : 'Add'}
                                            </Button>
                                        </DialogActions>
                                    </DialogBody>
                                </DialogSurface>
                            </Dialog>
                        }
                    />

                    <div className={styles.tableContainer}>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHeaderCell>ID</TableHeaderCell>
                                    <TableHeaderCell>Name</TableHeaderCell>
                                    <TableHeaderCell>Params</TableHeaderCell>
                                    <TableHeaderCell>Formula</TableHeaderCell>
                                    <TableHeaderCell>Action</TableHeaderCell>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {initialShapes
                                    .filter(s => !['RHS', 'SHS', 'CHS'].some(prefix => s.id.startsWith(prefix)))
                                    .map(shape => (
                                        <TableRow key={shape.id}>
                                            <TableCell>{shape.id}</TableCell>
                                            <TableCell>{shape.name}</TableCell>
                                            <TableCell>
                                                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                                    {(shape.params as string[]).map(p => (
                                                        <Badge key={p} appearance="filled" color="brand">{p}</Badge>
                                                    ))}
                                                </div>
                                            </TableCell>
                                            <TableCell style={{ fontFamily: 'monospace' }}>{shape.formula || '-'}</TableCell>
                                            <TableCell>
                                                <Button
                                                    appearance="subtle"
                                                    icon={<DeleteRegular />}
                                                    onClick={() => handleDeleteShape(shape.id)}
                                                    style={{ color: tokens.colorPaletteRedForeground1 }}
                                                />
                                            </TableCell>
                                        </TableRow>
                                    ))}
                            </TableBody>
                        </Table>
                    </div>
                </Card>
            )}

            {selectedTab === "catalog" && (
                <Card className={styles.card}>
                    <CardHeader
                        header={<Title3>Standard Profile Catalog</Title3>}
                        description={<Text>Predefined dimensions and weights.</Text>}
                        action={
                            <Dialog open={profileDialogOpen} onOpenChange={(e, data) => setProfileDialogOpen(data.open)}>
                                <DialogTrigger disableButtonEnhancement>
                                    <Button appearance="primary" icon={<AddRegular />}>Add Profile</Button>
                                </DialogTrigger>
                                <DialogSurface>
                                    <DialogBody>
                                        <DialogTitle>Add Standard Profile</DialogTitle>
                                        <DialogContent className={styles.dialogContent}>
                                            <Field label="Type">
                                                <Input placeholder="HEA" value={newProfile.type} onChange={(e, d) => setNewProfile({ ...newProfile, type: d.value })} />
                                            </Field>
                                            <Field label="Dimensions">
                                                <Input placeholder="e.g. 100" value={newProfile.dimensions} onChange={(e, d) => setNewProfile({ ...newProfile, dimensions: d.value })} />
                                            </Field>
                                            <Field label="Weight (kg/m)">
                                                <Input type="number" step="0.01" value={newProfile.weight} onChange={(e, d) => setNewProfile({ ...newProfile, weight: d.value })} />
                                            </Field>
                                            <Field label="Area (mm²)">
                                                <Input type="number" placeholder="Optional" value={newProfile.area} onChange={(e, d) => setNewProfile({ ...newProfile, area: d.value })} />
                                            </Field>
                                        </DialogContent>
                                        <DialogActions>
                                            <Button appearance="secondary" onClick={() => setProfileDialogOpen(false)}>Cancel</Button>
                                            <Button appearance="primary" onClick={handleAddProfile} disabled={loadingProfile}>
                                                {loadingProfile ? 'Saving...' : 'Add'}
                                            </Button>
                                        </DialogActions>
                                    </DialogBody>
                                </DialogSurface>
                            </Dialog>
                        }
                    />

                    <div className={styles.tableContainer}>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHeaderCell>Type</TableHeaderCell>
                                    <TableHeaderCell>Dimensions</TableHeaderCell>
                                    <TableHeaderCell>Weight</TableHeaderCell>
                                    <TableHeaderCell>Area</TableHeaderCell>
                                    <TableHeaderCell>Action</TableHeaderCell>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {initialStandardProfiles.map(p => (
                                    <TableRow key={p.id}>
                                        <TableCell>{p.type}</TableCell>
                                        <TableCell>{p.dimensions}</TableCell>
                                        <TableCell>{p.weightPerMeter ? p.weightPerMeter.toFixed(2) : '-'}</TableCell>
                                        <TableCell>{p.crossSectionArea ? p.crossSectionArea.toFixed(2) : '-'}</TableCell>
                                        <TableCell>
                                            <Button
                                                appearance="subtle"
                                                icon={<DeleteRegular />}
                                                onClick={() => handleDeleteProfile(p.id)}
                                                style={{ color: tokens.colorPaletteRedForeground1 }}
                                            />
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </Card>
            )}

            {selectedTab === "grades" && (
                <Card className={styles.card}>
                    <CardHeader
                        header={<Title3>Material Grades</Title3>}
                        description={<Text>Define grades, densities, and scrap prices.</Text>}
                    />
                    <div className={styles.tableContainer}>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHeaderCell>Grade Name</TableHeaderCell>
                                    <TableHeaderCell>Density (kg/dm³)</TableHeaderCell>
                                    <TableHeaderCell>Scrap Price (€/kg)</TableHeaderCell>
                                    <TableHeaderCell>Action</TableHeaderCell>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {initialGrades.map(grade => (
                                    <TableRow key={grade.id}>
                                        <TableCell>{grade.name}</TableCell>
                                        <TableCell>{grade.density}</TableCell>
                                        <TableCell>{grade.scrapPrice ? `€${grade.scrapPrice.toFixed(2)}` : '-'}</TableCell>
                                        <TableCell>
                                            <Button appearance="subtle" icon={<EditRegular />} onClick={() => handleEditGrade(grade)} />
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>

                    <Dialog open={gradeDialogOpen} onOpenChange={(e, data) => setGradeDialogOpen(data.open)}>
                        <DialogSurface>
                            <DialogBody>
                                <DialogTitle>Edit Grade: {editingGrade?.name}</DialogTitle>
                                <DialogContent className={styles.dialogContent}>
                                    <Field label="Density (kg/dm³)">
                                        <Input type="number" step="0.01" value={gradeForm.density} onChange={(e, d) => setGradeForm({ ...gradeForm, density: d.value })} />
                                    </Field>
                                    <Field label="Scrap Price (€/kg)">
                                        <Input type="number" step="0.01" value={gradeForm.scrapPrice} onChange={(e, d) => setGradeForm({ ...gradeForm, scrapPrice: d.value })} />
                                    </Field>
                                </DialogContent>
                                <DialogActions>
                                    <Button appearance="secondary" onClick={() => setGradeDialogOpen(false)}>Cancel</Button>
                                    <Button appearance="primary" onClick={handleSaveGrade} disabled={loadingGrade}>
                                        {loadingGrade ? 'Saving...' : 'Save Changes'}
                                    </Button>
                                </DialogActions>
                            </DialogBody>
                        </DialogSurface>
                    </Dialog>
                </Card>
            )}

            {selectedTab === "suppliers" && (
                <Card className={styles.card}>
                    <CardHeader
                        header={<Title3>Suppliers</Title3>}
                        description={<Text>Manage material suppliers for inventory tracking.</Text>}
                        action={
                            <Button appearance="primary" icon={<AddRegular />} onClick={() => handleOpenSupplierDialog()}>Add Supplier</Button>
                        }
                    />
                    <div className={styles.tableContainer}>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHeaderCell>Name</TableHeaderCell>
                                    <TableHeaderCell>Code</TableHeaderCell>
                                    <TableHeaderCell>Contact</TableHeaderCell>
                                    <TableHeaderCell>Email</TableHeaderCell>
                                    <TableHeaderCell>Phone</TableHeaderCell>
                                    <TableHeaderCell>Action</TableHeaderCell>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {initialSuppliers.map(supplier => (
                                    <TableRow key={supplier.id}>
                                        <TableCell>{supplier.name}</TableCell>
                                        <TableCell>{supplier.code || '-'}</TableCell>
                                        <TableCell>{supplier.contact || '-'}</TableCell>
                                        <TableCell>{supplier.email || '-'}</TableCell>
                                        <TableCell>{supplier.phone || '-'}</TableCell>
                                        <TableCell>
                                            <div style={{ display: 'flex', gap: '4px' }}>
                                                <Button appearance="subtle" icon={<EditRegular />} onClick={() => handleOpenSupplierDialog(supplier)} />
                                                <Button appearance="subtle" icon={<DeleteRegular />} onClick={() => handleDeleteSupplier(supplier.id)} style={{ color: tokens.colorPaletteRedForeground1 }} />
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {initialSuppliers.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={6} style={{ textAlign: 'center', padding: '32px' }}>
                                            No suppliers configured. Add one to get started.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    <Dialog open={supplierDialogOpen} onOpenChange={(e, data) => setSupplierDialogOpen(data.open)}>
                        <DialogSurface>
                            <DialogBody>
                                <DialogTitle>{editingSupplier ? 'Edit Supplier' : 'Add Supplier'}</DialogTitle>
                                <DialogContent className={styles.dialogContent}>
                                    <Field label="Name *" required>
                                        <Input placeholder="Supplier name" value={supplierForm.name} onChange={(e, d) => setSupplierForm({ ...supplierForm, name: d.value })} />
                                    </Field>
                                    <div className={styles.gridTwo}>
                                        <Field label="Code">
                                            <Input placeholder="SUP001" value={supplierForm.code} onChange={(e, d) => setSupplierForm({ ...supplierForm, code: d.value })} />
                                        </Field>
                                        <Field label="Contact">
                                            <Input placeholder="Contact name" value={supplierForm.contact} onChange={(e, d) => setSupplierForm({ ...supplierForm, contact: d.value })} />
                                        </Field>
                                    </div>
                                    <div className={styles.gridTwo}>
                                        <Field label="Email">
                                            <Input type="email" placeholder="email@example.com" value={supplierForm.email} onChange={(e, d) => setSupplierForm({ ...supplierForm, email: d.value })} />
                                        </Field>
                                        <Field label="Phone">
                                            <Input placeholder="+371..." value={supplierForm.phone} onChange={(e, d) => setSupplierForm({ ...supplierForm, phone: d.value })} />
                                        </Field>
                                    </div>
                                    <Field label="Notes">
                                        <Input placeholder="Optional notes" value={supplierForm.notes} onChange={(e, d) => setSupplierForm({ ...supplierForm, notes: d.value })} />
                                    </Field>
                                </DialogContent>
                                <DialogActions>
                                    <Button appearance="secondary" onClick={() => setSupplierDialogOpen(false)}>Cancel</Button>
                                    <Button appearance="primary" onClick={handleSaveSupplier} disabled={loadingSupplier}>
                                        {loadingSupplier ? 'Saving...' : (editingSupplier ? 'Update' : 'Create')}
                                    </Button>
                                </DialogActions>
                            </DialogBody>
                        </DialogSurface>
                    </Dialog>
                </Card>
            )}

            {selectedTab === "system" && (
                <Card className={styles.card}>
                    <CardHeader
                        header={<Title3>Auto-Numbering & System Configuration</Title3>}
                        description={
                            <Text>
                                Define formats for auto-generated IDs and global parameters. Use placeholders:
                                <span className={styles.codeSnippet}>{'{YYYY}'}</span>
                                <span className={styles.codeSnippet}>{'{YY}'}</span>
                                <span className={styles.codeSnippet}>{'{MM}'}</span>
                                <span className={styles.codeSnippet}>{'{DD}'}</span>
                                <span className={styles.codeSnippet}>{'{SEQ}'}</span>
                            </Text>
                        }
                    />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', paddingTop: '16px' }}>
                        {/* NCR Settings */}
                        <div style={{ paddingBottom: '16px', borderBottom: `1px solid ${tokens.colorNeutralStroke2}` }}>
                            <Title3>NCR Numbers</Title3>
                            <Text size={200} style={{ display: 'block', marginBottom: '8px' }}>For Quality issues.</Text>
                            <div className={styles.gridTwo}>
                                <Field label="Format">
                                    <Input
                                        value={settings.ncrFormat || ''}
                                        onChange={(e, d) => setSettings({ ...settings, ncrFormat: d.value })}
                                        placeholder="NCR-{YYYY}-{SEQ}"
                                    />
                                </Field>
                                <Field label="Next Sequence Number">
                                    <Input
                                        type="number"
                                        value={settings.ncrNextSeq || 1}
                                        onChange={(e, d) => setSettings({ ...settings, ncrNextSeq: d.value })}
                                    />
                                </Field>
                            </div>
                        </div>

                        {/* Lot Settings */}
                        <div style={{ paddingBottom: '16px', borderBottom: `1px solid ${tokens.colorNeutralStroke2}` }}>
                            <Title3>Lot IDs</Title3>
                            <Text size={200} style={{ display: 'block', marginBottom: '8px' }}>For Inventory batches.</Text>
                            <div className={styles.gridTwo}>
                                <Field label="Format">
                                    <Input
                                        value={settings.lotFormat || ''}
                                        onChange={(e, d) => setSettings({ ...settings, lotFormat: d.value })}
                                        placeholder="LOT-{YY}{MM}-{SEQ}"
                                    />
                                </Field>
                                <Field label="Next Sequence Number">
                                    <Input
                                        type="number"
                                        value={settings.lotNextSeq || 1}
                                        onChange={(e, d) => setSettings({ ...settings, lotNextSeq: d.value })}
                                    />
                                </Field>
                            </div>
                        </div>

                        {/* Project Settings */}
                        <div style={{ paddingBottom: '16px', borderBottom: `1px solid ${tokens.colorNeutralStroke2}` }}>
                            <Title3>Project Numbers</Title3>
                            <Text size={200} style={{ display: 'block', marginBottom: '8px' }}>For new Projects.</Text>
                            <div className={styles.gridTwo}>
                                <Field label="Format">
                                    <Input
                                        value={settings.projectFormat || ''}
                                        onChange={(e, d) => setSettings({ ...settings, projectFormat: d.value })}
                                        placeholder="P-{YY}-{SEQ}"
                                    />
                                </Field>
                                <Field label="Next Sequence Number">
                                    <Input
                                        type="number"
                                        value={settings.projectNextSeq || 1}
                                        onChange={(e, d) => setSettings({ ...settings, projectNextSeq: d.value })}
                                    />
                                </Field>
                            </div>
                        </div>

                        <div className={styles.actions}>
                            <Button appearance="primary" icon={<SaveRegular />} onClick={handleSaveGlobalSettings} disabled={savingSettings}>
                                {savingSettings ? 'Saving...' : 'Save Configuration'}
                            </Button>
                        </div>
                    </div>
                </Card>
            )}
        </div>
    )
}
