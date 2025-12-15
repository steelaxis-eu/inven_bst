'use client'

import { useState } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { updateSettings } from "@/app/actions/settings"
import { createStandardProfile, deleteStandardProfile } from "@/app/actions/inventory"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"

interface SettingsClientProps {
    initialScrapPrice: number
    initialShapes: any[]
    initialGrades: any[]
    initialStandardProfiles: any[]
}

export function SettingsClient({ initialScrapPrice, initialShapes, initialGrades, initialStandardProfiles }: SettingsClientProps) {
    const [scrapPrice, setScrapPrice] = useState(initialScrapPrice.toString())
    const [loadingPrice, setLoadingPrice] = useState(false)

    // Standard Profile State
    const [profileDialogOpen, setProfileDialogOpen] = useState(false)
    const [newProfile, setNewProfile] = useState({ type: '', dimensions: '', weight: '', area: '' })
    const [loadingProfile, setLoadingProfile] = useState(false)

    const handleAddProfile = async () => {
        if (!newProfile.type || !newProfile.dimensions || !newProfile.weight) {
            alert("Type, Dimensions and Weight are required")
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
        } catch (e) {
            alert("Failed to create profile")
        } finally {
            setLoadingProfile(false)
        }
    }

    const handleDeleteProfile = async (id: string) => {
        if (!confirm("Are you sure?")) return
        await deleteStandardProfile(id)
    }

    const handleSavePrice = async () => {
        setLoadingPrice(true)
        try {
            await updateSettings(parseFloat(scrapPrice))
            alert("Scrap price updated!")
        } catch (e) {
            alert("Failed to update price")
        } finally {
            setLoadingPrice(false)
        }
    }

    return (
        <Tabs defaultValue="general" className="space-y-4">
            <TabsList>
                <TabsTrigger value="general">General</TabsTrigger>
                <TabsTrigger value="grades">Grades & Materials</TabsTrigger>
                <TabsTrigger value="shapes">Shape Definitions</TabsTrigger>
                <TabsTrigger value="catalog">Standard Catalog</TabsTrigger>
            </TabsList>

            {/* General Tab */}
            <TabsContent value="general">
                <Card>
                    <CardHeader>
                        <CardTitle>Global Parameters</CardTitle>
                        <CardDescription>System-wide constants and default values.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-end gap-4 max-w-sm">
                            <div className="grid gap-2 w-full">
                                <label className="text-sm font-medium">Scrap Price (€/kg)</label>
                                <Input
                                    type="number"
                                    value={scrapPrice}
                                    onChange={e => setScrapPrice(e.target.value)}
                                    step="0.01"
                                />
                            </div>
                            <Button onClick={handleSavePrice} disabled={loadingPrice}>
                                {loadingPrice ? 'Saving...' : 'Save'}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </TabsContent>

            {/* Grades Tab */}
            <TabsContent value="grades">
                <Card>
                    <CardHeader>
                        <CardTitle>Material Grades</CardTitle>
                        <CardDescription>Define available steel grades and their density.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Grade Name</TableHead>
                                    <TableHead>Density (kg/dm³)</TableHead>
                                    <TableHead>Equivalent (kg/m³)</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {initialGrades.map(grade => (
                                    <TableRow key={grade.id}>
                                        <TableCell className="font-medium">{grade.name}</TableCell>
                                        <TableCell>{grade.density}</TableCell>
                                        <TableCell>{(grade.density * 1000).toLocaleString()}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </TabsContent>

            {/* Shapes Tab */}
            <TabsContent value="shapes">
                <Card>
                    <CardHeader>
                        <CardTitle>Profile Shapes</CardTitle>
                        <CardDescription>Dynamic shape definitions used for custom inventory items.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>ID</TableHead>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Parameters</TableHead>
                                    <TableHead>Formula</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {initialShapes.map(shape => (
                                    <TableRow key={shape.id}>
                                        <TableCell className="font-medium">{shape.id}</TableCell>
                                        <TableCell>{shape.name}</TableCell>
                                        <TableCell>
                                            <div className="flex gap-1">
                                                {(shape.params as string[]).map(p => (
                                                    <Badge key={p} variant="secondary" className="font-mono text-xs">{p}</Badge>
                                                ))}
                                            </div>
                                        </TableCell>
                                        <TableCell className="font-mono text-sm text-muted-foreground">{shape.formula || '-'}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </TabsContent>

            {/* Catalog Tab */}
            <TabsContent value="catalog">
                <Card>
                    <CardHeader>
                        <CardTitle>Standard Profile Catalog</CardTitle>
                        <CardDescription>Predefined dimensions and weights for standard shapes.</CardDescription>
                        <div className="flex justify-end">
                            <Dialog open={profileDialogOpen} onOpenChange={setProfileDialogOpen}>
                                <DialogTrigger asChild>
                                    <Button size="sm">Add Profile</Button>
                                </DialogTrigger>
                                <DialogContent>
                                    <DialogHeader>
                                        <DialogTitle>Add Standard Profile</DialogTitle>
                                    </DialogHeader>
                                    <div className="grid gap-4 py-4">
                                        <div className="grid gap-2">
                                            <Label>Type</Label>
                                            <Input placeholder="e.g. HEA" value={newProfile.type} onChange={e => setNewProfile({ ...newProfile, type: e.target.value })} />
                                        </div>
                                        <div className="grid gap-2">
                                            <Label>Dimensions</Label>
                                            <Input placeholder="e.g. 100" value={newProfile.dimensions} onChange={e => setNewProfile({ ...newProfile, dimensions: e.target.value })} />
                                        </div>
                                        <div className="grid gap-2">
                                            <Label>Weight (kg/m)</Label>
                                            <Input type="number" step="0.01" value={newProfile.weight} onChange={e => setNewProfile({ ...newProfile, weight: e.target.value })} />
                                        </div>
                                        <div className="grid gap-2">
                                            <Label>Cross Section Area (mm²)</Label>
                                            <Input type="number" placeholder="Optional" value={newProfile.area} onChange={e => setNewProfile({ ...newProfile, area: e.target.value })} />
                                            <p className="text-xs text-muted-foreground">Used for precise weight calculation with different material densities.</p>
                                        </div>
                                    </div>
                                    <DialogFooter>
                                        <Button onClick={handleAddProfile} disabled={loadingProfile}>{loadingProfile ? 'Saving...' : 'Add'}</Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="max-h-[600px] overflow-y-auto border rounded">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Type</TableHead>
                                        <TableHead>Dimensions</TableHead>
                                        <TableHead>Weight (kg/m)</TableHead>
                                        <TableHead>Area (mm²)</TableHead>
                                        <TableHead></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {initialStandardProfiles.map(p => (
                                        <TableRow key={p.id}>
                                            <TableCell>{p.type}</TableCell>
                                            <TableCell>{p.dimensions}</TableCell>
                                            <TableCell>{p.weightPerMeter}</TableCell>
                                            <TableCell>{p.crossSectionArea || '-'}</TableCell>
                                            <TableCell>
                                                <Button variant="ghost" size="sm" onClick={() => handleDeleteProfile(p.id)} className="text-red-500 h-8 w-8 p-0">
                                                    ×
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            </TabsContent>
        </Tabs>
    )
}
