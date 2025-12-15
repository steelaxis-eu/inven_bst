'use client'

import { useState } from 'react'
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { toast } from "sonner"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export function CreateUsageDialog() {
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const [items, setItems] = useState<any[]>([])

    // Form State
    const [current, setCurrent] = useState({
        lotId: '',
        quantity: '1',
        project: '',
        date: new Date().toISOString().split('T')[0]
    })

    const handleAddItem = () => {
        if (!current.lotId || !current.quantity || !current.project) {
            toast.warning("Lot ID, Qty and Project required")
            return
        }
        setItems([...items, { ...current, _id: Math.random().toString() }])
        setCurrent({ ...current, lotId: '', quantity: '1' }) // Keep project/date
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
            <DialogContent className="max-w-[95vw] w-auto min-w-[600px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Register Material Usage</DialogTitle>
                    <DialogDescription>Deduct items from stock and assign to projects.</DialogDescription>
                </DialogHeader>

                <div className="space-y-6">
                    {/* Inline Form for Desktop */}
                    <div className="grid gap-4 border p-4 rounded bg-muted/50">
                        <div className="flex flex-col md:flex-row gap-4 items-end">
                            <div className="grid gap-2 flex-1 min-w-[120px]">
                                <Label>Lot ID</Label>
                                <Input
                                    placeholder="Scan/Type Lot"
                                    value={current.lotId}
                                    onChange={e => setCurrent({ ...current, lotId: e.target.value })}
                                    className="uppercase font-mono bg-card"
                                />
                            </div>
                            <div className="grid gap-2 w-24">
                                <Label>Qty</Label>
                                <Input
                                    type="number"
                                    value={current.quantity}
                                    onChange={e => setCurrent({ ...current, quantity: e.target.value })}
                                    className="bg-card"
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
                            <div className="grid gap-2 w-36">
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
                            <div className="border rounded bg-card">
                                <Table>
                                    <TableHeader><TableRow><TableHead>Lot</TableHead><TableHead>Qty</TableHead><TableHead>Project</TableHead><TableHead>Date</TableHead><TableHead></TableHead></TableRow></TableHeader>
                                    <TableBody>
                                        {items.map((i, idx) => (
                                            <TableRow key={i._id}>
                                                <TableCell>{i.lotId}</TableCell>
                                                <TableCell>{i.quantity}</TableCell>
                                                <TableCell>{i.project}</TableCell>
                                                <TableCell>{i.date}</TableCell>
                                                <TableCell><Button variant="ghost" size="sm" onClick={() => setItems(items.filter((_, x) => x !== idx))}>x</Button></TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        )}

                        <Button onClick={handleSaveAll} disabled={items.length === 0} className="w-full">
                            Submit Usage
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
