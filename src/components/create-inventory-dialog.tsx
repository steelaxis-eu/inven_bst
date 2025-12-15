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
    const [customDim, setCustomDim] = useState('') // For custom dimensions input
    const [selectedGrade, setSelectedGrade] = useState('')
    const [manualWeight, setManualWeight] = useState('')

    // Derived
    const uniqueTypes = Array.from(new Set(standardProfiles.map(p => p.type)))
    // Add custom types if not present
    const allTypes = Array.from(new Set([...uniqueTypes, 'PL', 'RHS', 'SHS', 'CHS', 'FB', 'R', 'SQB']))

    const availableDims = standardProfiles
        .filter(p => p.type === selectedType)
        .map(p => p.dimensions)

    // Auto-fill weight logic
    // When Type/Dim matches standard, use it. Else empty.
    const standardMatch = standardProfiles.find(p => p.type === selectedType && p.dimensions === (customDim || selectedDim))

    const handleAddItem = async () => {
        if (!current.lotId || !selectedType || !(selectedDim || customDim) || !selectedGrade || !current.length || !current.quantity) {
            toast.warning("Please fill required fields (Lot ID, Type, Dim, Grade, Length, Qty)")
            return
        }

        setLoading(true)
        try {
            // 1. Resolve Profile (Shape)
            const finalDim = customDim || selectedDim
            const weight = manualWeight ? parseFloat(manualWeight) : (standardMatch?.weightPerMeter || 0)

            const profile = await ensureProfile({
                type: selectedType,
                dimensions: finalDim,
                weight: weight
            })

            setItems([...items, {
                ...current,
                profileId: profile.id,
                gradeName: selectedGrade, // Pass name to batch creator to resolve ID
                profileName: `${profile.type} ${profile.dimensions} (${selectedGrade})`,
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
                gradeName: i.gradeName, // Pass grade name
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
                                    <Select value={selectedType} onValueChange={t => { setSelectedType(t); setSelectedDim(''); setCustomDim('') }}>
                                        <SelectTrigger><SelectValue placeholder="Type" /></SelectTrigger>
                                        <SelectContent>
                                            {allTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1">
                                    <Label>Dimensions</Label>
                                    {availableDims.length > 0 ? (
                                        <div className="flex gap-1">
                                            <Select value={selectedDim} onValueChange={d => { setSelectedDim(d); setCustomDim('') }}>
                                                <SelectTrigger className="w-full"><SelectValue placeholder="Select" /></SelectTrigger>
                                                <SelectContent>
                                                    {availableDims.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                                                    <SelectItem value="CUSTOM">Custom...</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    ) : (
                                        <Input
                                            placeholder="e.g. 10x100"
                                            value={customDim}
                                            onChange={e => setCustomDim(e.target.value)}
                                            disabled={!selectedType}
                                        />
                                    )}
                                    {/* If Custom selected in dropdown, show input */}
                                    {selectedDim === 'CUSTOM' && (
                                        <Input
                                            className="mt-1"
                                            placeholder="Enter dimensions..."
                                            value={customDim}
                                            onChange={e => setCustomDim(e.target.value)}
                                        />
                                    )}
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
                                    <Input
                                        type="number"
                                        placeholder={standardMatch ? standardMatch.weightPerMeter.toString() : "0"}
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
