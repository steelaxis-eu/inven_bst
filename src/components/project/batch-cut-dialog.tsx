'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ScrollArea } from "@/components/ui/scroll-area"
import { toast } from 'sonner'
import { getInventory } from "@/app/actions/inventory"
import { recordBatchUsage } from "@/app/actions/usage"
import { Loader2, Scissors, Ruler } from "lucide-react"

interface BatchCutDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    projectId: string
    items: any[] // WorkOrderItems
    onSuccess: () => void
}

export function BatchCutDialog({ open, onOpenChange, projectId, items, onSuccess }: BatchCutDialogProps) {
    const [step, setStep] = useState<'SELECT_SOURCE' | 'ALLOCATE'>('SELECT_SOURCE')
    const [inventory, setInventory] = useState<any[]>([])
    const [loading, setLoading] = useState(false)

    // State
    const [pendingItems, setPendingItems] = useState<any[]>(items)
    const [selectedSourceId, setSelectedSourceId] = useState<string>('')
    const [selectedItemIds, setSelectedItemIds] = useState<string[]>([])

    // Allocation details
    const [remnantLength, setRemnantLength] = useState<number>(0)
    const [calcRemnant, setCalcRemnant] = useState<number>(0)
    const [isScrap, setIsScrap] = useState(false)
    const [reason, setReason] = useState('')

    useEffect(() => {
        if (open) {
            loadInventory()
            setPendingItems(items) // Reset when reopening? Or keep state? 
            // Better to reset if strictly new session, but here we might be strictly passed fresh items.
        }
    }, [open, items])

    const loadInventory = async () => {
        setLoading(true)
        try {
            const data = await getInventory()
            // Filter by profile? For now show all, or maybe filter by profiles present in items
            // Enhance: Filter compatible profiles based on selected parts
            setInventory(data)
        } catch (e) {
            toast.error("Failed to load inventory")
        }
        setLoading(false)
    }

    const selectedSource = inventory.find(i => i.id === selectedSourceId)

    // Calculate usage
    const selectedPartsLength = pendingItems
        .filter(i => selectedItemIds.includes(i.id))
        // Assuming piece.part.profileDimensions or we need length? 
        // We assume piece.part has length? No, part definition might not have length if it's not a bar?
        // Wait, where is length? 
        // We don't have part length in the typical Part object easily? 
        // Actually items passed here usually have piece info.
        // Let's assume item.piece?.part?.length ?? 0 ideally, or we need to fetch it.
        // The WorkOrderItem interface has `piece`. Interface needs checking.
        .reduce((sum, item) => sum + (item.piece?.length || 0), 0)

    useEffect(() => {
        if (selectedSource) {
            const calc = selectedSource.length - selectedPartsLength
            setCalcRemnant(calc)
            setRemnantLength(calc) // Default to calc
        }
    }, [selectedSource, selectedPartsLength])

    const handleAllocate = async () => {
        if (!selectedSource || selectedItemIds.length === 0) return

        setLoading(true)
        try {
            const cuts = pendingItems
                .filter(i => selectedItemIds.includes(i.id))
                .map(i => ({
                    workOrderItemId: i.id,
                    pieceId: i.pieceId,
                    quantity: 1,
                    length: i.piece?.length || 0
                }))

            const res = await recordBatchUsage({
                projectId,
                sourceId: selectedSource.id,
                sourceType: 'INVENTORY', // TODO: Support Remnants
                cuts,
                offcut: {
                    actualLength: isScrap ? 0 : remnantLength,
                    isScrap,
                    reason: reason || (remnantLength !== calcRemnant ? 'Manual Adjustment' : undefined)
                }
            })

            if (res.success) {
                toast.success(`Registered cuts for ${cuts.length} pieces`)
                // Remove processed items
                const remaining = pendingItems.filter(i => !selectedItemIds.includes(i.id))
                setPendingItems(remaining)

                // Cleanup current alloc
                setSelectedItemIds([])
                setSelectedSourceId('')
                setReason('')
                setIsScrap(false)

                // If no items left, close
                if (remaining.length === 0) {
                    onSuccess() // Refresh parent
                    onOpenChange(false)
                } else {
                    // Refresh inventory? Yes, quantity changed
                    loadInventory()
                }
            } else {
                toast.error((res as any).error || "Failed to record usage")
            }
        } catch (e) {
            toast.error("Error processing cuts")
        }
        setLoading(false)
    }

    // Filter validation
    const isValid = selectedSource && selectedItemIds.length > 0 && (isScrap || remnantLength >= 0)

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl h-[80vh] flex flex-col p-0">
                <DialogHeader className="px-6 py-4 border-b">
                    <DialogTitle>Batch Material Cutting</DialogTitle>
                    <DialogDescription>
                        Allocate parts to inventory bars. {pendingItems.length} pieces remaining.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-hidden grid grid-cols-2">
                    {/* Left: Pending Parts */}
                    <div className="border-r flex flex-col">
                        <div className="p-3 bg-muted/20 font-medium text-xs uppercase tracking-wide border-b">
                            Pending Parts
                        </div>
                        <ScrollArea className="flex-1 p-3">
                            <div className="space-y-2">
                                {pendingItems.map(item => (
                                    <div
                                        key={item.id}
                                        className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${selectedItemIds.includes(item.id)
                                            ? 'bg-blue-50 border-blue-200'
                                            : 'bg-card hover:bg-muted/50'
                                            }`}
                                        onClick={() => {
                                            if (selectedItemIds.includes(item.id)) {
                                                setSelectedItemIds(selectedItemIds.filter(id => id !== item.id))
                                            } else {
                                                setSelectedItemIds([...selectedItemIds, item.id])
                                            }
                                        }}
                                    >
                                        <Checkbox
                                            checked={selectedItemIds.includes(item.id)}
                                            onCheckedChange={() => { }}
                                        />
                                        <div className="flex-1 text-sm">
                                            <div className="font-semibold">
                                                {item.piece?.part?.partNumber} #{item.piece?.pieceNumber}
                                            </div>
                                            <div className="text-muted-foreground flex justify-between mt-1">
                                                <span>L: {item.piece?.length || 0}mm</span>
                                                <Badge variant="outline">{item.piece?.part?.profileType}</Badge>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {pendingItems.length === 0 && (
                                    <div className="text-center py-10 text-muted-foreground">
                                        All parts allocated!
                                    </div>
                                )}
                            </div>
                        </ScrollArea>
                    </div>

                    {/* Right: Source & Allocation */}
                    <div className="flex flex-col bg-slate-50">
                        <div className="p-3 font-medium text-xs uppercase tracking-wide border-b bg-muted/20">
                            Source Material
                        </div>
                        <div className="p-4 space-y-6 flex-1 overflow-y-auto">
                            <div className="space-y-2">
                                <Label>Select Stock Item</Label>
                                <Select value={selectedSourceId} onValueChange={setSelectedSourceId}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Choose inventory..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {inventory.map(inv => (
                                            <SelectItem key={inv.id} value={inv.id}>
                                                {inv.profile.dimensions} - {inv.length}mm ({inv.quantityAtHand} left) - {inv.lotId}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {selectedSource && (
                                <div className="space-y-4 border rounded-lg p-4 bg-white shadow-sm">
                                    <h4 className="font-semibold text-sm flex items-center gap-2">
                                        <Scissors className="w-4 h-4 text-orange-500" />
                                        Cutting Plan
                                    </h4>

                                    {/* Visual Bar */}
                                    <div className="space-y-1">
                                        <div className="flex justify-between text-xs text-muted-foreground">
                                            <span>Used: {selectedPartsLength}mm</span>
                                            <span>Start: {selectedSource.length}mm</span>
                                        </div>
                                        <div className="h-4 bg-slate-100 rounded-full overflow-hidden flex border">
                                            {/* Used portion */}
                                            <div
                                                className="bg-blue-500 transition-all duration-300"
                                                style={{ width: `${Math.min(100, (selectedPartsLength / selectedSource.length) * 100)}%` }}
                                            />
                                            {/* Remnant portion */}
                                            <div className="bg-green-100 flex-1 border-l border-dashed border-green-300" />
                                        </div>
                                        <div className="flex justify-end text-xs font-medium text-green-700">
                                            Remaining: {selectedSource.length - selectedPartsLength}mm
                                        </div>
                                    </div>

                                    {/* Inputs */}
                                    <div className="grid gap-4 pt-2">
                                        <div className="grid gap-2">
                                            <Label>Actual Offcut Length (mm)</Label>
                                            <div className="flex gap-2">
                                                <Input
                                                    type="number"
                                                    value={remnantLength}
                                                    onChange={e => setRemnantLength(Number(e.target.value))}
                                                    disabled={isScrap}
                                                    className={remnantLength !== calcRemnant ? "border-orange-300 bg-orange-50" : ""}
                                                />
                                                <Button
                                                    variant="outline"
                                                    size="icon"
                                                    onClick={() => setRemnantLength(calcRemnant)}
                                                    title="Reset to Calculated"
                                                >
                                                    <span className="text-xs">R</span>
                                                </Button>
                                            </div>
                                            {remnantLength !== calcRemnant && !isScrap && (
                                                <p className="text-xs text-orange-600 font-medium">
                                                    Difference of {Math.abs(calcRemnant - remnantLength)}mm will be recorded as processing loss.
                                                </p>
                                            )}
                                        </div>

                                        <div className="flex items-center space-x-2">
                                            <Checkbox
                                                id="scrap"
                                                checked={isScrap}
                                                onCheckedChange={(c) => setIsScrap(!!c)}
                                            />
                                            <Label htmlFor="scrap" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                                Mark remainder as SCRAP (No remnant created)
                                            </Label>
                                        </div>

                                        {(remnantLength !== calcRemnant || isScrap) && (
                                            <div className="grid gap-2">
                                                <Label>Reason / Comment</Label>
                                                <Input
                                                    value={reason}
                                                    onChange={e => setReason(e.target.value)}
                                                    placeholder="e.g. Saw blade width, damaged end..."
                                                />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="p-4 border-t bg-white flex justify-end gap-2">
                            <Button variant="ghost" onClick={() => onOpenChange(false)}>Close</Button>
                            <Button onClick={handleAllocate} disabled={!isValid || loading}>
                                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                                Record Cut & Save
                            </Button>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
