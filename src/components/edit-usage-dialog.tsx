'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { updateUsageLine } from '@/app/actions/usage'
import { Pencil } from 'lucide-react'

interface EditUsageProps {
    usageId: string
    originalLength: number
    cost: number
    costPerMeter: number
    profile: string
}

export function EditUsageDialog({ usageId, originalLength, cost, costPerMeter, profile }: EditUsageProps) {
    const router = useRouter()
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)

    // Calculate initial values
    const initialLengthUsed = costPerMeter > 0 ? (cost / costPerMeter) * 1000 : 0
    const [lengthUsed, setLengthUsed] = useState(initialLengthUsed.toFixed(0))
    const [status, setStatus] = useState<'SCRAP' | 'AVAILABLE'>('SCRAP') // Default to Scrap if editing? Or check logic?
    // Actually, we don't know the current status of the generated remnant easily without fetching.
    // But we are regenerating it. Let's default to 'AVAILABLE' if length is significant, or let user choose.

    // Derived values
    const newUsed = parseFloat(lengthUsed)
    const remaining = originalLength - (isNaN(newUsed) ? 0 : newUsed)
    const isValid = !isNaN(newUsed) && newUsed > 0 && newUsed <= originalLength

    const handleSubmit = async () => {
        if (!isValid) return
        setLoading(true)
        try {
            const res = await updateUsageLine(usageId, newUsed, status)
            if (res.success) {
                setOpen(false)
                router.refresh()
            } else {
                // @ts-ignore
                alert(`Error: ${res.error}`)
            }
        } catch (e: any) {
            alert(e.message)
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
                    <DialogTitle>Edit Usage</DialogTitle>
                    <DialogDescription>
                        Modify length used for {profile}. This will regenerate the remnant/scrap.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label className="text-right">Total Item Length</Label>
                        <div className="col-span-3 font-mono">{originalLength}mm</div>
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="length" className="text-right">
                            Used Length
                        </Label>
                        <Input
                            id="length"
                            type="number"
                            value={lengthUsed}
                            onChange={e => setLengthUsed(e.target.value)}
                            max={originalLength}
                            className="col-span-3"
                        />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label className="text-right">Remaining</Label>
                        <div className={`col-span-3 font-mono ${remaining < 0 ? 'text-red-500' : ''}`}>
                            {remaining.toFixed(0)}mm
                        </div>
                    </div>

                    {remaining > 0 && (
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label className="text-right">Remaining Action</Label>
                            <div className="col-span-3 flex gap-4">
                                <label className="flex items-center space-x-2 text-sm cursor-pointer">
                                    <input type="radio" checked={status === 'AVAILABLE'} onChange={() => setStatus('AVAILABLE')} className="accent-blue-600" />
                                    <span>Remnant</span>
                                </label>
                                <label className="flex items-center space-x-2 text-sm cursor-pointer">
                                    <input type="radio" checked={status === 'SCRAP'} onChange={() => setStatus('SCRAP')} className="accent-red-600" />
                                    <span>Scrap</span>
                                </label>
                            </div>
                        </div>
                    )}
                </div>
                <DialogFooter>
                    <Button onClick={handleSubmit} disabled={!isValid || loading}>
                        {loading ? 'Saving...' : 'Save Changes'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
