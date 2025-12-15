'use client'

import { useState } from 'react'
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { createInventoryBatch } from "@/app/actions/inventory"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ProfileCalculator } from "./profile-calculator"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { FileUploader } from "@/components/ui/file-uploader"
import { FileViewer } from "@/components/ui/file-viewer"
import { toast } from "sonner"

export function CreateInventoryDialog({ profiles: initialProfiles }: { profiles: any[] }) {
    const [open, setOpen] = useState(false)
    const [profileOpen, setProfileOpen] = useState(false)
    const [profiles, setProfiles] = useState(initialProfiles)
    const [loading, setLoading] = useState(false)

    // Items List State
    const [items, setItems] = useState<any[]>([])

    // Current Form State
    const [current, setCurrent] = useState({
        lotId: '',
        profileId: '',
        length: '',
        quantity: '1',
        certificate: '',
        totalCost: ''
    })

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

    const handleAddItem = () => {
        if (!current.lotId || !current.profileId || !current.length || !current.quantity) {
            toast.warning("Please fill required fields (Lot ID, Profile, Length, Qty)")
            return
        }

        // Find profile name for display
        const p = profiles.find(p => p.id === current.profileId)

        setItems([...items, {
            ...current,
            profileName: p ? `${p.type} ${p.dimensions}` : '?',
            _id: Math.random().toString() // temp id for list
        }])

        // Reset fields but keep some context? Maybe keep profile?
        // Resetting LotID usually increments? Let's just reset fields for now.
        setCurrent({
            lotId: '',
            profileId: current.profileId, // Keep profile logic?
            length: current.length,       // Keep length logic? Often similar items.
            quantity: '1',
            certificate: current.certificate, // Keep cert?
            totalCost: ''
        })
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
                            <div className="grid gap-2">
                                <Label>Profile</Label>
                                <div className="flex gap-2 min-w-0">
                                    <SearchableSelect
                                        className="flex-1 min-w-0" // Allow shrinking
                                        value={current.profileId}
                                        onValueChange={v => setCurrent({ ...current, profileId: v })}
                                        placeholder="Select Profile"
                                        searchPlaceholder="Search profile..."
                                        items={profiles.map(p => ({
                                            value: p.id,
                                            label: `${p.type} ${p.dimensions} (${p.grade}) [${p.weightPerMeter || 0} kg/m]`
                                        }))}
                                    />

                                    <ProfileCalculator
                                        trigger={
                                            <Button type="button" variant="outline" size="icon" title="Find/Calculate Profile" className="shrink-0">
                                                <span className="text-xl">+</span>
                                            </Button>
                                        }
                                        onSelect={async (calcResult) => {
                                            // User selected a profile from calculator. We need to Ensure it exists in DB.
                                            // We need a grade for it. Let's ask for it or default?
                                            // The calculator doesn't have Grade input.
                                            // For now, let's pop a prompt or small overlay? Or just default to S355?
                                            // Actually, best to let user select grade AFTER calculator? 
                                            // Let's add Grade to the Ensure call, but we need UI for it.
                                            // IMPROVEMENT: Add Grade input to the dialog state that triggered this?
                                            // OR: Just assume S355 for now or prompt.

                                            // Better UX: Show a mini-dialog to confirm Grade before saving?
                                            // Let's simplify: Default S355, user can edit later if needed? No, grade is key.
                                            // Let's prompt.
                                            const grade = prompt("Enter Material Grade (e.g. S355, S235, SS304):", "S355")
                                            if (!grade) return

                                            setLoading(true)
                                            try {
                                                const { ensureProfile } = await import("@/app/actions/inventory")
                                                const p = await ensureProfile({
                                                    type: calcResult.type,
                                                    dimensions: calcResult.dimensions,
                                                    weight: calcResult.weight,
                                                    grade: grade
                                                })

                                                // Update local list
                                                const exists = profiles.find(x => x.id === p.id)
                                                if (!exists) {
                                                    setProfiles([...profiles, p])
                                                }

                                                // Select it
                                                setCurrent({ ...current, profileId: p.id })
                                            } catch (e) {
                                                toast.error("Error creating profile")
                                            } finally {
                                                setLoading(false)
                                            }
                                        }}
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
