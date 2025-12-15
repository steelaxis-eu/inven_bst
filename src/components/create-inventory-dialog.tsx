'use client'

import { useState } from 'react'
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ensureProfile, createInventoryBatch } from "@/app/actions/inventory"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { FileUploader } from "@/components/ui/file-uploader"
import { FileViewer } from "@/components/ui/file-viewer"
import { toast } from "sonner"

interface CreateInventoryProps {
    profiles: any[]
    standardProfiles: any[]
    grades: any[]
}

export function CreateInventoryDialog({ profiles: initialProfiles, standardProfiles, grades }: CreateInventoryProps) {
    const [open, setOpen] = useState(false)
    const [profileOpen, setProfileOpen] = useState(false)
    const [profiles, setProfiles] = useState(initialProfiles)
    const [loading, setLoading] = useState(false)

    // Items List State
    const [items, setItems] = useState<any[]>([])

    // Current Form State
    const [current, setCurrent] = useState({
        lotId: '',
        length: '',
        quantity: '1',
        certificate: '',
        totalCost: ''
    })

    // New Profile Selection State
    const [selectedType, setSelectedType] = useState('')
    const [selectedDim, setSelectedDim] = useState('')
    const [selectedGrade, setSelectedGrade] = useState('')
    const [manualWeight, setManualWeight] = useState('') // For overrides or custom

    // Derived
    const uniqueTypes = Array.from(new Set(standardProfiles.map(p => p.type)))
    const availableDims = standardProfiles
        .filter(p => p.type === selectedType)
        .map(p => p.dimensions)

    // Auto-fill weight logic
    // const calculatedWeight = ... (do inside render or effect?)


    // Profile Form State
    const [newProfile, setNewProfile] = useState({ type: '', dimensions: '', grade: '' })

    const handleCreateProfile = async () => {
        if (!newProfile.type || !newProfile.dimensions || !newProfile.grade) return
        setLoading(true)
        try {
            const { createProfile } = await import("@/app/actions/inventory")
            const p = await createProfile(newProfile)
            setProfiles([...profiles, p])
            setProfileOpen(false)
            setNewProfile({ type: '', dimensions: '', grade: '' })
            toast.success("Profile created")
        } catch (e) {
            toast.error("Failed to create profile (maybe duplicates?)")
        } finally {
            setLoading(false)
        }
    }

    const handleAddItem = async () => {
        if (!current.lotId || !selectedType || !selectedDim || !selectedGrade || !current.length || !current.quantity) {
            toast.warning("Please fill required fields (Lot ID, Type, Dim, Grade, Length, Qty)")
            return
        }

        setLoading(true)
        try {
            // 1. Resolve Profile ID
            // Find standard weight
            const std = standardProfiles.find(p => p.type === selectedType && p.dimensions === selectedDim)
            const weight = manualWeight ? parseFloat(manualWeight) : (std?.weightPerMeter || 0)

            const profile = await ensureProfile({
                type: selectedType,
                dimensions: selectedDim,
                grade: selectedGrade,
                weight: weight
            })

            setItems([...items, {
                ...current,
                profileId: profile.id,
                profileName: `${profile.type} ${profile.dimensions} (${profile.grade})`,
                _id: Math.random().toString()
            }])

            // Reset fields
            setCurrent({
                lotId: '',
                length: current.length,
                quantity: '1',
                certificate: current.certificate,
                totalCost: ''
            })
            // Keep Type/Dim/Grade? usually yes.
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
            toast.error("Unexpected error occurred.")
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button>Add Inventory</Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Add Inventory Batch</DialogTitle>
                    <DialogDescription>Add multiple items to your stock. You can calculate profile weights if needed.</DialogDescription>
                </DialogHeader>

                <div className="space-y-6">
                    {/* Form Section */}
                    <div className="grid gap-4 border p-4 rounded bg-muted/50">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label>Lot ID</Label>
                                <Input
                                    className="bg-background"
                                    value={current.lotId}
                                    onChange={e => setCurrent({ ...current, lotId: e.target.value })}
                                    placeholder="e.g. L-500"
                                />
                            </div>

                            {/* New Profile Selectors */}
                            <div className="grid gap-2 col-span-2 grid-cols-4">
                                <div>
                                    <Label>Type</Label>
                                    <Select value={selectedType} onValueChange={t => { setSelectedType(t); setSelectedDim('') }}>
                                        <SelectTrigger><SelectValue placeholder="Type" /></SelectTrigger>
                                        <SelectContent>
                                            {uniqueTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <Label>Dimensions</Label>
                                    <Select value={selectedDim} onValueChange={setSelectedDim} disabled={!selectedType}>
                                        <SelectTrigger><SelectValue placeholder="Dim" /></SelectTrigger>
                                        <SelectContent>
                                            {availableDims.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <Label>Grade</Label>
                                    <Select value={selectedGrade} onValueChange={setSelectedGrade}>
                                        <SelectTrigger><SelectValue placeholder="Grade" /></SelectTrigger>
                                        <SelectContent>
                                            {grades.map(g => <SelectItem key={g.id} value={g.name}>{g.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <Label>Weight (kg/m)</Label>
                                    {/* Show calculated or allow override */}
                                    <Input
                                        type="number"
                                        placeholder={(standardProfiles.find(p => p.type === selectedType && p.dimensions === selectedDim)?.weightPerMeter || 0).toString()}
                                        value={manualWeight}
                                        onChange={e => setManualWeight(e.target.value)}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                            <div className="grid gap-2">
                                <Label>Length (mm)</Label>
                                <Input className="bg-background" type="number" value={current.length} onChange={e => setCurrent({ ...current, length: e.target.value })} />
                            </div>
                            <div className="grid gap-2">
                                <Label>Quantity</Label>
                                <Input className="bg-background" type="number" value={current.quantity} onChange={e => setCurrent({ ...current, quantity: e.target.value })} />
                            </div>
                            <div className="grid gap-2">
                                <Label>Total Cost (€)</Label>
                                <Input className="bg-background" type="number" step="0.01" value={current.totalCost} onChange={e => setCurrent({ ...current, totalCost: e.target.value })} />
                            </div>
                        </div>

                        <div className="grid gap-2">
                            <Label>Certificate (PDF)</Label>
                            <FileUploader
                                bucketName="certificates"
                                currentValue={current.certificate}
                                onUploadComplete={(path) => setCurrent({ ...current, certificate: path })}
                            />
                            {current.certificate && (
                                <div className="mt-1">
                                    <FileViewer bucketName="certificates" path={current.certificate} fileName="Verify Upload" />
                                </div>
                            )}
                        </div>

                        <Button type="button" onClick={handleAddItem} variant="secondary">Add to Batch</Button>
                    </div>

                    {/* List Section */}
                    {items.length > 0 && (
                        <div>
                            <h4 className="font-semibold mb-2">Pending Items ({items.length})</h4>
                            <div className="border rounded max-h-40 overflow-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Lot</TableHead>
                                            <TableHead>Profile</TableHead>
                                            <TableHead>Len</TableHead>
                                            <TableHead>Qty</TableHead>
                                            <TableHead>Cost</TableHead>
                                            <TableHead></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {items.map((item, idx) => (
                                            <TableRow key={item._id}>
                                                <TableCell>{item.lotId}</TableCell>
                                                <TableCell>{item.profileName}</TableCell>
                                                <TableCell>{item.length}</TableCell>
                                                <TableCell>{item.quantity}</TableCell>
                                                <TableCell>{item.totalCost}</TableCell>
                                                <TableCell>
                                                    <Button size="sm" variant="ghost" onClick={() => setItems(items.filter((_, i) => i !== idx))}>x</Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                    )}

                    <Button onClick={handleSaveAll} className="w-full" disabled={loading || items.length === 0}>
                        {loading ? 'Saving...' : `Save ${items.length} Items`}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}
