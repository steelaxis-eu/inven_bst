'use client'

import { useState } from 'react'
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { toast } from "sonner"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

import { getInventoryItemByLot } from '@/app/actions/inventory'

export function CreateUsageDialog() {
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const [items, setItems] = useState<any[]>([])
    const [fetchedItem, setFetchedItem] = useState<any>(null)
    const [lotError, setLotError] = useState('')

    // Form State
    const [current, setCurrent] = useState({
        lotId: '',
        quantity: '1',
        usedLength: '', // New field
        project: '',
        date: new Date().toISOString().split('T')[0]
    })

    const handleLotBlur = async () => {
        if (!current.lotId) return
        setLoading(true)
        setLotError('')
        setFetchedItem(null)
        try {
            const item = await getInventoryItemByLot(current.lotId)
            if (item) {
                setFetchedItem(item)
                // Default used length to full length if empty
                if (!current.usedLength) setCurrent(prev => ({ ...prev, usedLength: item.length.toString() }))
            } else {
                setLotError('Lot not found')
            }
        } catch (e) {
            setLotError('Error fetching lot')
        }
        setLoading(false)
    }

    const handleAddItem = () => {
        if (!current.lotId || !current.quantity || !current.project || !current.usedLength) {
            toast.warning("Lot ID, Qty, Project, and Used Length required")
            return
        }

        // Validation
        if (fetchedItem) {
            if (Number(current.quantity) > fetchedItem.quantityAtHand) {
                toast.error(`Only ${fetchedItem.quantityAtHand} qty available`)
                return
            }
            if (Number(current.usedLength) > fetchedItem.length) {
                toast.error(`Max length is ${fetchedItem.length}mm`)
                return
            }
        } else {
            // If item strictly fetched...
            toast.error("Please verify Lot ID first")
            return
        }

        setItems([...items, { ...current, _id: Math.random().toString() }])
        // Reset Item specific fields but keep project/date
        setCurrent({ ...current, lotId: '', quantity: '1', usedLength: '' })
        setFetchedItem(null)
        setLotError('')
    }

    const handleSaveAll = async () => {
        toast.info("Usage saving logic to be implemented")
        setOpen(false)
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline">Register Usage</Button>
            </DialogTrigger>
            <DialogContent className="max-w-[95vw] w-auto min-w-[700px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Register Material Usage</DialogTitle>
                    <DialogDescription>Deduct items from stock and assign to projects.</DialogDescription>
                </DialogHeader>

                <div className="space-y-6">
                    {/* Inline Form for Desktop */}
                    <div className="gap-4 border p-4 rounded bg-muted/50">
                        <div className="flex flex-col xl:flex-row gap-4 items-start xl:items-end w-full">
                            <div className="grid gap-2 flex-1 min-w-[120px]">
                                <Label>Lot ID</Label>
                                <div className="relative">
                                    <Input
                                        placeholder="Scan/Type Lot"
                                        value={current.lotId}
                                        onChange={e => setCurrent({ ...current, lotId: e.target.value })}
                                        onBlur={handleLotBlur}
                                        className={`uppercase font-mono bg-card ${lotError ? 'border-red-500' : ''}`}
                                    />
                                    {loading && <span className="absolute right-2 top-2 text-xs text-muted-foreground">...</span>}
                                </div>
                                {fetchedItem && <span className="text-[10px] text-green-600 font-mono">Avail: {fetchedItem.quantityAtHand}x {fetchedItem.length}mm</span>}
                                {lotError && <span className="text-[10px] text-red-500">{lotError}</span>}
                            </div>

                            <div className="grid gap-2 w-24 shrink-0">
                                <Label>Qty</Label>
                                <Input
                                    type="number"
                                    value={current.quantity}
                                    onChange={e => setCurrent({ ...current, quantity: e.target.value })}
                                    className="bg-card"
                                />
                            </div>

                            <div className="grid gap-2 w-32 shrink-0">
                                <Label>Used L (mm)</Label>
                                <Input
                                    type="number"
                                    value={current.usedLength}
                                    onChange={e => setCurrent({ ...current, usedLength: e.target.value })}
                                    className="bg-card"
                                    placeholder={fetchedItem ? `${fetchedItem.length}` : "Length"}
                                />
                            </div>

                            <div className="grid gap-2 flex-1 min-w-[150px]">
                                <Label>Project</Label>
                                <Input
                                    placeholder="Project Name/No"
                                    value={current.project}
                                    onChange={e => setCurrent({ ...current, project: e.target.value })}
                                    className="bg-card"
                                />
                            </div>
                            <div className="grid gap-2 w-36 shrink-0">
                                <Label>Date</Label>
                                <Input
                                    type="date"
                                    value={current.date}
                                    onChange={e => setCurrent({ ...current, date: e.target.value })}
                                    className="bg-card"
                                />
                            </div>
                            <Button onClick={handleAddItem}>Add Line</Button>
                        </div>

                        {items.length > 0 && (
                            <div className="mt-4 border rounded bg-card">
                                <Table>
                                    <TableHeader><TableRow><TableHead>Lot</TableHead><TableHead>Qty</TableHead><TableHead>Used Length</TableHead><TableHead>Project</TableHead><TableHead>Date</TableHead><TableHead></TableHead></TableRow></TableHeader>
                                    <TableBody>
                                        {items.map((i, idx) => (
                                            <TableRow key={i._id}>
                                                <TableCell>{i.lotId}</TableCell>
                                                <TableCell>{i.quantity}</TableCell>
                                                <TableCell>{i.usedLength} mm</TableCell>
                                                <TableCell>{i.project}</TableCell>
                                                <TableCell>{i.date}</TableCell>
                                                <TableCell><Button variant="ghost" size="sm" onClick={() => setItems(items.filter((_, x) => x !== idx))}>x</Button></TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        )}

                        <Button onClick={handleSaveAll} disabled={items.length === 0} className="w-full mt-4">
                            Submit Usage
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
