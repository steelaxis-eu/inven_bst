'use client'

import { useState } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { createStandardProfile, deleteStandardProfile } from "@/app/actions/inventory"
import { createSteelProfile, deleteSteelProfile } from "@/app/actions/profiles"
import { createProfileShape, deleteProfileShape } from "@/app/actions/shapes"
import { updateGrade } from "@/app/actions/grades"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { Pencil } from "lucide-react"

interface SettingsClientProps {
    initialShapes: any[]
    initialGrades: any[]
    initialStandardProfiles: any[]
    initialSteelProfiles: any[]
}

export function SettingsClient({ initialShapes, initialGrades, initialStandardProfiles, initialSteelProfiles }: SettingsClientProps) {
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

    return (
        <Tabs defaultValue="profiles" className="space-y-4">
            <TabsList className="flex w-full overflow-x-auto md:grid md:grid-cols-4 h-auto">
                <TabsTrigger value="profiles">Active Profiles</TabsTrigger>
                <TabsTrigger value="shapes">Shapes</TabsTrigger>
                <TabsTrigger value="catalog">Standard Catalog</TabsTrigger>
                <TabsTrigger value="grades">Grades</TabsTrigger>
            </TabsList>

            <TabsContent value="profiles">
                <Card>
                    <CardHeader>
                        <CardTitle>Active Profiles</CardTitle>
                        <CardDescription>Profiles currently used in your inventory.</CardDescription>
                        <div className="flex justify-end">
                            <Dialog open={steelProfileDialogOpen} onOpenChange={setSteelProfileDialogOpen}>
                                <DialogTrigger asChild><Button size="sm">Add Manual Profile</Button></DialogTrigger>
                                <DialogContent>
                                    <DialogHeader><DialogTitle>Add Manual Profile</DialogTitle></DialogHeader>
                                    <div className="grid gap-4 py-4">
                                        <div className="grid gap-2"><Label>Type</Label><Input placeholder="e.g. HEA" value={newSteelProfile.type} onChange={e => setNewSteelProfile({ ...newSteelProfile, type: e.target.value })} /></div>
                                        <div className="grid gap-2"><Label>Dimensions</Label><Input placeholder="e.g. 100" value={newSteelProfile.dimensions} onChange={e => setNewSteelProfile({ ...newSteelProfile, dimensions: e.target.value })} /></div>
                                        <div className="grid gap-2"><Label>Weight (kg/m)</Label><Input type="number" step="0.01" value={newSteelProfile.weight} onChange={e => setNewSteelProfile({ ...newSteelProfile, weight: e.target.value })} /></div>
                                    </div>
                                    <DialogFooter><Button onClick={handleAddSteelProfile} disabled={loadingSteelProfile}>{loadingSteelProfile ? 'Saving...' : 'Add'}</Button></DialogFooter>
                                </DialogContent>
                            </Dialog>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="max-h-[600px] overflow-y-auto border rounded">
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader><TableRow><TableHead>Type</TableHead><TableHead>Dimensions</TableHead><TableHead>Weight (kg/m)</TableHead><TableHead></TableHead></TableRow></TableHeader>
                                    <TableBody>
                                        {initialSteelProfiles.map(p => (
                                            <TableRow key={p.id}>
                                                <TableCell>{p.type}</TableCell><TableCell>{p.dimensions}</TableCell><TableCell>{p.weightPerMeter}</TableCell>
                                                <TableCell><Button variant="ghost" size="sm" onClick={() => handleDeleteSteelProfile(p.id)} className="text-red-500 h-8 w-8 p-0">×</Button></TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </TabsContent>

            <TabsContent value="shapes">
                <Card>
                    <CardHeader>
                        <CardTitle>Profile Shapes</CardTitle>
                        <CardDescription>Define custom shapes with variables.</CardDescription>
                        <div className="flex justify-end">
                            <Dialog open={shapeDialogOpen} onOpenChange={setShapeDialogOpen}>
                                <DialogTrigger asChild><Button size="sm">Add Shape</Button></DialogTrigger>
                                <DialogContent>
                                    <DialogHeader><DialogTitle>Add Custom Shape</DialogTitle></DialogHeader>
                                    <div className="grid gap-4 py-4">
                                        <div className="grid gap-2"><Label>ID (Unique)</Label><Input placeholder="TRIANGLE" value={newShape.id} onChange={e => setNewShape({ ...newShape, id: e.target.value.toUpperCase() })} /></div>
                                        <div className="grid gap-2"><Label>Name</Label><Input placeholder="Triangular Prism" value={newShape.name} onChange={e => setNewShape({ ...newShape, name: e.target.value })} /></div>
                                        <div className="grid gap-2"><Label>Params (comma sep)</Label><Input placeholder="b, h" value={newShape.params} onChange={e => setNewShape({ ...newShape, params: e.target.value })} /></div>
                                        <div className="grid gap-2"><Label>Formula</Label><Input placeholder="0.5 * b * h" value={newShape.formula} onChange={e => setNewShape({ ...newShape, formula: e.target.value })} /></div>
                                    </div>
                                    <DialogFooter><Button onClick={handleAddShape} disabled={loadingShape}>{loadingShape ? 'Saving...' : 'Add'}</Button></DialogFooter>
                                </DialogContent>
                            </Dialog>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader><TableRow><TableHead>ID</TableHead><TableHead>Name</TableHead><TableHead>Params</TableHead><TableHead>Formula</TableHead><TableHead></TableHead></TableRow></TableHeader>
                                <TableBody>
                                    {initialShapes.map(shape => (
                                        <TableRow key={shape.id}>
                                            <TableCell>{shape.id}</TableCell><TableCell>{shape.name}</TableCell>
                                            <TableCell><div className="flex gap-1 flex-wrap">{(shape.params as string[]).map(p => <Badge key={p} variant="secondary" className="font-mono text-xs">{p}</Badge>)}</div></TableCell>
                                            <TableCell className="font-mono text-sm">{shape.formula || '-'}</TableCell>
                                            <TableCell><Button variant="ghost" size="sm" onClick={() => handleDeleteShape(shape.id)} className="text-red-500 h-8 w-8 p-0">×</Button></TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            </TabsContent>

            <TabsContent value="catalog">
                <Card>
                    <CardHeader>
                        <CardTitle>Standard Profile Catalog</CardTitle>
                        <CardDescription>Predefined dimensions and weights.</CardDescription>
                        <div className="flex justify-end">
                            <Dialog open={profileDialogOpen} onOpenChange={setProfileDialogOpen}>
                                <DialogTrigger asChild><Button size="sm">Add Profile</Button></DialogTrigger>
                                <DialogContent>
                                    <DialogHeader><DialogTitle>Add Standard Profile</DialogTitle></DialogHeader>
                                    <div className="grid gap-4 py-4">
                                        <div className="grid gap-2"><Label>Type</Label><Input placeholder="HEA" value={newProfile.type} onChange={e => setNewProfile({ ...newProfile, type: e.target.value })} /></div>
                                        <div className="grid gap-2"><Label>Dimensions</Label><Input placeholder="e.g. 100" value={newProfile.dimensions} onChange={e => setNewProfile({ ...newProfile, dimensions: e.target.value })} /></div>
                                        <div className="grid gap-2"><Label>Weight (kg/m)</Label><Input type="number" step="0.01" value={newProfile.weight} onChange={e => setNewProfile({ ...newProfile, weight: e.target.value })} /></div>
                                        <div className="grid gap-2"><Label>Area (mm²)</Label><Input type="number" placeholder="Optional" value={newProfile.area} onChange={e => setNewProfile({ ...newProfile, area: e.target.value })} /></div>
                                    </div>
                                    <DialogFooter><Button onClick={handleAddProfile} disabled={loadingProfile}>{loadingProfile ? 'Saving...' : 'Add'}</Button></DialogFooter>
                                </DialogContent>
                            </Dialog>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="max-h-[600px] overflow-y-auto border rounded">
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader><TableRow><TableHead>Type</TableHead><TableHead>Dimensions</TableHead><TableHead>Weight</TableHead><TableHead>Area</TableHead><TableHead></TableHead></TableRow></TableHeader>
                                    <TableBody>
                                        {initialStandardProfiles.map(p => (
                                            <TableRow key={p.id}>
                                                <TableCell>{p.type}</TableCell><TableCell>{p.dimensions}</TableCell><TableCell>{p.weightPerMeter ? p.weightPerMeter.toFixed(2) : '-'}</TableCell><TableCell>{p.crossSectionArea ? p.crossSectionArea.toFixed(2) : '-'}</TableCell>
                                                <TableCell><Button variant="ghost" size="sm" onClick={() => handleDeleteProfile(p.id)} className="text-red-500 h-8 w-8 p-0">×</Button></TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </TabsContent>

            <TabsContent value="grades">
                <Card>
                    <CardHeader>
                        <CardTitle>Material Grades</CardTitle>
                        <CardDescription>Define grades, densities, and scrap prices.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Grade Name</TableHead>
                                        <TableHead>Density (kg/dm³)</TableHead>
                                        <TableHead>Scrap Price (€/kg)</TableHead>
                                        <TableHead>Action</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {initialGrades.map(grade => (
                                        <TableRow key={grade.id}>
                                            <TableCell className="font-medium">{grade.name}</TableCell>
                                            <TableCell>{grade.density}</TableCell>
                                            <TableCell>{grade.scrapPrice ? `€${grade.scrapPrice.toFixed(2)}` : '-'}</TableCell>
                                            <TableCell>
                                                <Button variant="ghost" size="sm" onClick={() => handleEditGrade(grade)}>
                                                    <Pencil className="h-4 w-4" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>

                        <Dialog open={gradeDialogOpen} onOpenChange={setGradeDialogOpen}>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>Edit Grade: {editingGrade?.name}</DialogTitle>
                                </DialogHeader>
                                <div className="grid gap-4 py-4">
                                    <div className="grid gap-2">
                                        <Label>Density (kg/dm³)</Label>
                                        <Input type="number" step="0.01" value={gradeForm.density} onChange={e => setGradeForm({ ...gradeForm, density: e.target.value })} />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label>Scrap Price (€/kg)</Label>
                                        <Input type="number" step="0.01" value={gradeForm.scrapPrice} onChange={e => setGradeForm({ ...gradeForm, scrapPrice: e.target.value })} />
                                    </div>
                                </div>
                                <DialogFooter>
                                    <Button onClick={handleSaveGrade} disabled={loadingGrade}>
                                        {loadingGrade ? 'Saving...' : 'Save Changes'}
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    </CardContent>
                </Card>
            </TabsContent>
        </Tabs>
    )
}
