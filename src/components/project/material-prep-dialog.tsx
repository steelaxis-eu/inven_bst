'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { completeMaterialPrepWorkOrder } from '@/app/actions/workorders'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

interface MaterialPrepDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    workOrder: any // Using any for simplicity in linking, but ideally properly typed
    onSuccess: () => void
}

interface StockInputItem {
    id: string // aggregate key
    profileId: string
    gradeId: string
    profileType: string
    dimensions: string
    gradeName: string
    totalLengthNeeded: number
    quantityNeeded: number
    // Inputs
    lotId: string
    certificate: string
    supplierId: string
    totalCost: number
    receivedLength: number
    receivedQuantity: number
}

export function MaterialPrepDialog({ open, onOpenChange, workOrder, onSuccess }: MaterialPrepDialogProps) {
    const [loading, setLoading] = useState(false)
    const [items, setItems] = useState<StockInputItem[]>([])
    const [initialized, setInitialized] = useState(false)

    // Aggregate items on load
    if (open && !initialized && workOrder) {
        const aggregated: Record<string, StockInputItem> = {}

        workOrder.items.forEach((item: any) => {
            if (!item.piece || !item.piece.part.profile) return

            const profile = item.piece.part.profile
            const grade = item.piece.part.grade
            const key = `${profile.id}-${grade?.id || 'unknown'}`

            if (!aggregated[key]) {
                aggregated[key] = {
                    id: key,
                    profileId: profile.id,
                    gradeId: grade?.id || '',
                    profileType: profile.type,
                    dimensions: profile.dimensions,
                    gradeName: grade?.name || 'Unknown',
                    totalLengthNeeded: 0,
                    quantityNeeded: 0,
                    lotId: '',
                    certificate: '',
                    supplierId: '',
                    totalCost: 0,
                    receivedLength: 6000, // Default stock length
                    receivedQuantity: 1
                }
            }

            aggregated[key].totalLengthNeeded += (item.piece.part.length || 0)
            aggregated[key].quantityNeeded += 1
        })

        setItems(Object.values(aggregated))
        setInitialized(true)
    }

    if (!open && initialized) {
        setInitialized(false)
    }

    const updateItem = (id: string, field: keyof StockInputItem, value: any) => {
        setItems(prev => prev.map(item =>
            item.id === id ? { ...item, [field]: value } : item
        ))
    }

    const handleSubmit = async () => {
        setLoading(true)

        // Validate inputs
        const missingFields = items.some(i => !i.lotId || !i.certificate)
        if (missingFields) {
            toast.error("Please fill in Lot ID and Certificate for all items")
            setLoading(false)
            return
        }

        const stockItems = items.map(item => ({
            profileId: item.profileId,
            gradeId: item.gradeId,
            length: Number(item.receivedLength),
            quantity: Number(item.receivedQuantity),
            lotId: item.lotId,
            certificate: item.certificate,
            supplierId: item.supplierId || undefined,
            totalCost: Number(item.totalCost)
        }))

        const res = await completeMaterialPrepWorkOrder(workOrder.id, stockItems)

        if (res.success) {
            toast.success("Material received and Work Order completed")
            onOpenChange(false)
            onSuccess()
        } else {
            toast.error(res.error || "Failed to complete Work Order")
        }
        setLoading(false)
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Receive Material & Complete Prep</DialogTitle>
                    <DialogDescription>
                        Input details for the received stock. This will create inventory records and unblock the Cutting Work Order.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    {items.map((item, idx) => (
                        <div key={item.id} className="p-4 border rounded-lg bg-gray-50 space-y-4">
                            <div className="flex justify-between items-center border-b pb-2">
                                <h4 className="font-semibold text-sm">
                                    Item {idx + 1}: {item.profileType} {item.dimensions} - {item.gradeName}
                                </h4>
                                <div className="text-xs text-muted-foreground">
                                    Needed: {item.quantityNeeded} pieces ({item.totalLengthNeeded / 1000}m total)
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                <div className="space-y-2">
                                    <Label>Lot ID / Heat Number *</Label>
                                    <Input
                                        value={item.lotId}
                                        onChange={(e) => updateItem(item.id, 'lotId', e.target.value)}
                                        placeholder="e.g. HEAT-12345"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Certificate Filename *</Label>
                                    <Input
                                        value={item.certificate}
                                        onChange={(e) => updateItem(item.id, 'certificate', e.target.value)}
                                        placeholder="e.g. CERT-001.pdf"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Total Cost (€)</Label>
                                    <Input
                                        type="number"
                                        value={item.totalCost}
                                        onChange={(e) => updateItem(item.id, 'totalCost', e.target.value)}
                                        min="0"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Stock Length (mm)</Label>
                                    <Input
                                        type="number"
                                        value={item.receivedLength}
                                        onChange={(e) => updateItem(item.id, 'receivedLength', e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Quantity Received</Label>
                                    <Input
                                        type="number"
                                        value={item.receivedQuantity}
                                        onChange={(e) => updateItem(item.id, 'receivedQuantity', e.target.value)}
                                    />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={handleSubmit} disabled={loading}>
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Confirm Receipt & Complete WO
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
