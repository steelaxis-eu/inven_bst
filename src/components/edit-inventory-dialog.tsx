'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { updateInventory } from '@/app/actions/inventory'
import { Pencil } from 'lucide-react'
import { toast } from "sonner"

interface EditInventoryProps {
    item: {
        id: string
        lotId: string
        length: number
        quantityAtHand: number
        status: string
        certificateFilename?: string | null
    }
}

export function EditInventoryDialog({ item }: EditInventoryProps) {
    const router = useRouter()
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)

    const [lotId, setLotId] = useState(item.lotId)
    const [length, setLength] = useState(item.length.toString())
    const [quantity, setQuantity] = useState(item.quantityAtHand.toString())
    const [status, setStatus] = useState(item.status)

    const handleSubmit = async () => {
        setLoading(true)
        try {
            const res = await updateInventory(item.id, {
                lotId,
                length: parseFloat(length),
                quantityAtHand: parseInt(quantity),
                status
            })
            if (res.success) {
                setOpen(false)
                toast.success("Inventory updated")
                router.refresh()
            } else {
                toast.error(`Error: ${res.error}`)
            }
        } catch (e: any) {
            toast.error(e.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6">
                    <Pencil className="h-4 w-4" />
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Edit Inventory Item</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <Label>Lot ID</Label>
                        <Input value={lotId} onChange={e => setLotId(e.target.value)} />
                    </div>
                    <div className="grid gap-2">
                        <Label>Length (mm)</Label>
                        <Input type="number" value={length} onChange={e => setLength(e.target.value)} />
                    </div>
                    <div className="grid gap-2">
                        <Label>Quantity At Hand</Label>
                        <Input type="number" value={quantity} onChange={e => setQuantity(e.target.value)} />
                    </div>
                    <div className="grid gap-2">
                        <Label>Status</Label>
                        <Select value={status} onValueChange={setStatus}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ACTIVE">ACTIVE</SelectItem>
                                <SelectItem value="EXHAUSTED">EXHAUSTED</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                <DialogFooter>
                    <Button onClick={handleSubmit} disabled={loading}>
                        {loading ? 'Saving...' : 'Save Changes'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
