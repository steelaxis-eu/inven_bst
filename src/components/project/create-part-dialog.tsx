'use client'

import { useState, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { useRouter } from 'next/navigation'
import { createPart } from '@/app/actions/parts'
import { createPlatePart } from '@/app/actions/plateparts'
import { Plus, Package, Scissors, AlertTriangle, Check } from 'lucide-react'

// Profile type definitions with standards
const PROFILE_TYPES = [
    { type: 'HEA', name: 'HE A (Wide Flange)', standard: 'EN 10025' },
    { type: 'HEB', name: 'HE B (Wide Flange)', standard: 'EN 10025' },
    { type: 'HEM', name: 'HE M (Wide Flange)', standard: 'EN 10025' },
    { type: 'IPE', name: 'IPE (I-Beam)', standard: 'EN 10025' },
    { type: 'UPN', name: 'UPN (Channel)', standard: 'EN 10025' },
    { type: 'UPE', name: 'UPE (Channel)', standard: 'EN 10025' },
    { type: 'RHS', name: 'RHS (Rectangular Hollow)', standard: 'EN 10219' },
    { type: 'SHS', name: 'SHS (Square Hollow)', standard: 'EN 10219' },
    { type: 'CHS', name: 'CHS (Circular Hollow)', standard: 'EN 10219' },
    { type: 'L', name: 'L (Angle)', standard: 'EN 10056' },
    { type: 'T', name: 'T (Tee)', standard: 'EN 10055' },
    { type: 'FB', name: 'Flat Bar', standard: 'EN 10058' },
    { type: 'RB', name: 'Round Bar', standard: 'EN 10060' },
]

interface CreatePartDialogProps {
    projectId: string
    profiles: { id: string; type: string; dimensions: string; weightPerMeter: number }[]
    grades: { id: string; name: string }[]
    inventory?: { profileId: string; quantity: number }[]  // Available stock
}

export function CreatePartDialog({ projectId, profiles, grades, inventory = [] }: CreatePartDialogProps) {
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const [tab, setTab] = useState<'profile' | 'plate'>('profile')
    const router = useRouter()

    // Shared fields
    const [partNumber, setPartNumber] = useState('')
    const [description, setDescription] = useState('')
    const [gradeId, setGradeId] = useState('')
    const [quantity, setQuantity] = useState('1')

    // Profile part fields
    const [profileSource, setProfileSource] = useState<'existing' | 'custom'>('existing')
    const [profileId, setProfileId] = useState('')
    const [profileType, setProfileType] = useState('')
    const [profileDimensions, setProfileDimensions] = useState('')
    const [profileStandard, setProfileStandard] = useState('')
    const [length, setLength] = useState('')
    const [requiresWelding, setRequiresWelding] = useState(false)
    const [isOutsourcedCut, setIsOutsourcedCut] = useState(false)
    const [cutVendor, setCutVendor] = useState('')

    // Plate part fields
    const [material, setMaterial] = useState('')
    const [thickness, setThickness] = useState('')
    const [unitWeight, setUnitWeight] = useState('')
    const [supplier, setSupplier] = useState('')

    // Inventory check
    const [inventoryStatus, setInventoryStatus] = useState<'unknown' | 'available' | 'insufficient' | 'missing'>('unknown')
    const [availableQty, setAvailableQty] = useState(0)

    // Check inventory availability when profile changes
    useEffect(() => {
        if (tab === 'profile' && profileId && quantity) {
            const stock = inventory.find(i => i.profileId === profileId)
            const needed = parseInt(quantity) || 0
            const available = stock?.quantity || 0
            setAvailableQty(available)

            if (available >= needed) {
                setInventoryStatus('available')
            } else if (available > 0) {
                setInventoryStatus('insufficient')
            } else {
                setInventoryStatus('missing')
            }
        } else {
            setInventoryStatus('unknown')
        }
    }, [profileId, quantity, inventory, tab])

    // Set standard when profile type changes
    useEffect(() => {
        const pt = PROFILE_TYPES.find(p => p.type === profileType)
        if (pt) {
            setProfileStandard(pt.standard)
        }
    }, [profileType])

    const handleSubmit = async () => {
        if (!partNumber || !quantity) return
        setLoading(true)

        try {
            if (tab === 'profile') {
                const res = await createPart({
                    projectId,
                    partNumber,
                    description: description || undefined,
                    profileId: profileSource === 'existing' ? profileId : undefined,
                    gradeId: gradeId || undefined,
                    profileType: profileSource === 'custom' ? profileType : undefined,
                    profileDimensions: profileSource === 'custom' ? profileDimensions : undefined,
                    profileStandard: profileSource === 'custom' ? profileStandard : undefined,
                    length: length ? parseFloat(length) : undefined,
                    quantity: parseInt(quantity),
                    requiresWelding,
                    isOutsourcedCut,
                    cutVendor: isOutsourcedCut ? cutVendor : undefined
                })
                if (!res.success) {
                    alert(`Error: ${res.error}`)
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
                    quantity: parseInt(quantity),
                    unitWeight: unitWeight ? parseFloat(unitWeight) : undefined,
                    supplier: supplier || undefined
                })
                if (!res.success) {
                    alert(`Error: ${res.error}`)
                    setLoading(false)
                    return
                }
            }

            setOpen(false)
            resetForm()
            router.refresh()

        } catch (e: any) {
            alert("Failed to create part")
        } finally {
            setLoading(false)
        }
    }

    const resetForm = () => {
        setPartNumber('')
        setDescription('')
        setGradeId('')
        setQuantity('1')
        setProfileSource('existing')
        setProfileId('')
        setProfileType('')
        setProfileDimensions('')
        setProfileStandard('')
        setLength('')
        setRequiresWelding(false)
        setIsOutsourcedCut(false)
        setCutVendor('')
        setMaterial('')
        setThickness('')
        setUnitWeight('')
        setSupplier('')
    }

    // Group existing profiles by type
    const profilesByType = profiles.reduce((acc, p) => {
        if (!acc[p.type]) acc[p.type] = []
        acc[p.type].push(p)
        return acc
    }, {} as Record<string, typeof profiles>)

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button size="sm" className="gap-1">
                    <Plus className="h-4 w-4" /> Add Part
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Add New Part</DialogTitle>
                    <DialogDescription>
                        Add a profile part (in-house/outsourced cutting) or a plate part (outsourced laser/plasma).
                    </DialogDescription>
                </DialogHeader>

                <Tabs value={tab} onValueChange={(v) => setTab(v as 'profile' | 'plate')}>
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="profile" className="gap-2">
                            <Package className="h-4 w-4" /> Profile Part
                        </TabsTrigger>
                        <TabsTrigger value="plate" className="gap-2">
                            <Scissors className="h-4 w-4" /> Plate Part
                        </TabsTrigger>
                    </TabsList>

                    {/* Common Fields */}
                    <div className="grid gap-4 py-4 border-b mb-4">
                        <div className="grid grid-cols-3 gap-4">
                            <div className="grid gap-2">
                                <Label>Part Number *</Label>
                                <Input
                                    value={partNumber}
                                    onChange={e => setPartNumber(e.target.value)}
                                    placeholder={tab === 'profile' ? 'B-101' : 'PL-001'}
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label>Quantity *</Label>
                                <Input
                                    type="number"
                                    min="1"
                                    value={quantity}
                                    onChange={e => setQuantity(e.target.value)}
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label>Grade</Label>
                                <Select value={gradeId} onValueChange={setGradeId}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select grade" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {grades.map(g => (
                                            <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="grid gap-2">
                            <Label>Description</Label>
                            <Input
                                value={description}
                                onChange={e => setDescription(e.target.value)}
                                placeholder="e.g. Main beam section"
                            />
                        </div>
                    </div>

                    {/* Profile Part Tab */}
                    <TabsContent value="profile" className="space-y-4 mt-0">
                        <div className="grid gap-2">
                            <Label>Profile Source</Label>
                            <Select value={profileSource} onValueChange={(v) => setProfileSource(v as 'existing' | 'custom')}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="existing">From Active Profiles</SelectItem>
                                    <SelectItem value="custom">Custom Profile (New)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {profileSource === 'existing' ? (
                            <div className="grid gap-2">
                                <Label>Select Profile</Label>
                                <Select value={profileId} onValueChange={setProfileId}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select profile" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {Object.entries(profilesByType).map(([type, profs]) => (
                                            <div key={type}>
                                                <div className="px-2 py-1 text-xs font-semibold text-muted-foreground bg-muted">{type}</div>
                                                {profs.map(p => (
                                                    <SelectItem key={p.id} value={p.id}>
                                                        {p.type} {p.dimensions} ({p.weightPerMeter.toFixed(2)} kg/m)
                                                    </SelectItem>
                                                ))}
                                            </div>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {inventoryStatus !== 'unknown' && (
                                    <div className={`flex items-center gap-2 text-sm mt-1 ${inventoryStatus === 'available' ? 'text-green-600' :
                                            inventoryStatus === 'insufficient' ? 'text-orange-600' : 'text-red-600'
                                        }`}>
                                        {inventoryStatus === 'available' ? (
                                            <><Check className="h-4 w-4" /> {availableQty} in stock</>
                                        ) : inventoryStatus === 'insufficient' ? (
                                            <><AlertTriangle className="h-4 w-4" /> Only {availableQty} in stock (need {quantity})</>
                                        ) : (
                                            <><AlertTriangle className="h-4 w-4" /> Not in stock - will need RFQ</>
                                        )}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="grid grid-cols-3 gap-4">
                                <div className="grid gap-2">
                                    <Label>Profile Type *</Label>
                                    <Select value={profileType} onValueChange={setProfileType}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select type" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {PROFILE_TYPES.map(pt => (
                                                <SelectItem key={pt.type} value={pt.type}>
                                                    {pt.type} - {pt.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="grid gap-2">
                                    <Label>Dimensions *</Label>
                                    <Input
                                        value={profileDimensions}
                                        onChange={e => setProfileDimensions(e.target.value)}
                                        placeholder={profileType === 'CHS' ? '139.7x6.3' : '100x50x4'}
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label>Standard</Label>
                                    <Input
                                        value={profileStandard}
                                        onChange={e => setProfileStandard(e.target.value)}
                                        placeholder="EN 10219"
                                    />
                                </div>
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label>Length (mm)</Label>
                                <Input
                                    type="number"
                                    value={length}
                                    onChange={e => setLength(e.target.value)}
                                    placeholder="e.g. 6000"
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label>Requires Welding</Label>
                                <Select
                                    value={requiresWelding ? 'yes' : 'no'}
                                    onValueChange={v => setRequiresWelding(v === 'yes')}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="no">No</SelectItem>
                                        <SelectItem value="yes">Yes</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="p-4 border rounded-lg bg-muted/30 space-y-3">
                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    id="outsourcedCut"
                                    checked={isOutsourcedCut}
                                    onChange={e => setIsOutsourcedCut(e.target.checked)}
                                    className="rounded"
                                />
                                <Label htmlFor="outsourcedCut" className="cursor-pointer">
                                    Outsourced Cutting (Laser/Plasma)
                                </Label>
                            </div>
                            {isOutsourcedCut && (
                                <div className="grid gap-2">
                                    <Label>Cutting Vendor</Label>
                                    <Input
                                        value={cutVendor}
                                        onChange={e => setCutVendor(e.target.value)}
                                        placeholder="e.g. LaserCut Ltd"
                                    />
                                </div>
                            )}
                        </div>
                    </TabsContent>

                    {/* Plate Part Tab */}
                    <TabsContent value="plate" className="space-y-4 mt-0">
                        <div className="p-3 bg-blue-50 text-blue-800 rounded-lg text-sm flex items-center gap-2">
                            <Scissors className="h-4 w-4" />
                            Plate parts are tracked separately for outsourced laser/plasma cutting.
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label>Material</Label>
                                <Input
                                    value={material}
                                    onChange={e => setMaterial(e.target.value)}
                                    placeholder="e.g. S355 Plate"
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label>Thickness (mm)</Label>
                                <Input
                                    type="number"
                                    value={thickness}
                                    onChange={e => setThickness(e.target.value)}
                                    placeholder="e.g. 10"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label>Unit Weight (kg)</Label>
                                <Input
                                    type="number"
                                    value={unitWeight}
                                    onChange={e => setUnitWeight(e.target.value)}
                                    placeholder="e.g. 12.5"
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label>Supplier</Label>
                                <Input
                                    value={supplier}
                                    onChange={e => setSupplier(e.target.value)}
                                    placeholder="e.g. LaserParts Co"
                                />
                            </div>
                        </div>
                    </TabsContent>
                </Tabs>

                <DialogFooter className="mt-4">
                    <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                    <Button onClick={handleSubmit} disabled={loading || !partNumber || !quantity}>
                        {loading ? 'Creating...' : tab === 'profile' ? 'Create Profile Part' : 'Create Plate Part'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
