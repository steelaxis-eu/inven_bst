'use client'

import { useState } from 'react'
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useRouter } from 'next/navigation'
import { createProject } from '@/app/actions/projects'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { format } from "date-fns"
import { Calendar as CalendarIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

interface CreateProjectDialogProps {
    customers?: any[]
}

export function CreateProjectDialog({ customers = [] }: CreateProjectDialogProps) {
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)

    // Form State
    const [projectNumber, setProjectNumber] = useState('')
    const [name, setName] = useState('')
    const [customerId, setCustomerId] = useState<string>('')
    const [coatingType, setCoatingType] = useState<string>('')
    const [corrosionCategory, setCorrosionCategory] = useState<string>('')
    const [corrosionComments, setCorrosionComments] = useState('')
    const [estimatedHours, setEstimatedHours] = useState('')
    const [contractDate, setContractDate] = useState<Date | undefined>()
    const [deliveryDate, setDeliveryDate] = useState<Date | undefined>()

    const router = useRouter()

    const handleSubmit = async () => {
        if (!projectNumber || !name) {
            toast.error("Project Number and Name are required")
            return
        }

        setLoading(true)
        try {
            const res = await createProject({
                number: projectNumber,
                name,
                customerId: customerId || undefined,
                coatingType: coatingType || undefined,
                corrosionCategory: corrosionCategory || undefined,
                corrosionComments: corrosionComments || undefined,
                contractDate: contractDate,
                estimatedHours: estimatedHours ? parseFloat(estimatedHours) : undefined,
                deliveryDate: deliveryDate
            })

            if (res.success) {
                toast.success("Project created successfully")
                setOpen(false)
                // Reset form
                setProjectNumber('')
                setName('')
                setCustomerId('')
                setCoatingType('')
                setCorrosionCategory('')
                setCorrosionComments('')
                setEstimatedHours('')
                setContractDate(undefined)
                setDeliveryDate(undefined)

                router.refresh()
            } else {
                toast.error(res.error || "Failed to create project")
            }
        } catch (e: any) {
            toast.error("An error occurred")
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button>+ New Project</Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Create New Project</DialogTitle>
                    <DialogDescription>Enter project details, technical specifications, and milestones.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-6 py-4">
                    {/* Basic Info */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label>Project Number *</Label>
                            <Input
                                value={projectNumber}
                                onChange={e => setProjectNumber(e.target.value)}
                                placeholder="e.g. P-1002"
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label>Project Name *</Label>
                            <Input
                                value={name}
                                onChange={e => setName(e.target.value)}
                                placeholder="e.g. Hangar Expansion"
                            />
                        </div>
                    </div>

                    {/* Customer & Contract */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label>Customer</Label>
                            <Select value={customerId} onValueChange={setCustomerId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select Customer" />
                                </SelectTrigger>
                                <SelectContent>
                                    {customers.length === 0 && <SelectItem value="none" disabled>No customers found</SelectItem>}
                                    {customers.map(c => (
                                        <SelectItem key={c.id} value={c.id}>{c.companyName}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid gap-2">
                            <Label>Contract Date</Label>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant={"outline"}
                                        className={cn(
                                            "w-full justify-start text-left font-normal",
                                            !contractDate && "text-muted-foreground"
                                        )}
                                    >
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {contractDate ? format(contractDate, "PPP") : <span>Pick a date</span>}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar
                                        mode="single"
                                        selected={contractDate}
                                        onSelect={setContractDate}
                                        initialFocus
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>
                    </div>

                    {/* Technical Specs */}
                    <div className="space-y-4 border rounded-lg p-4 bg-muted/20">
                        <h4 className="font-medium text-sm text-muted-foreground mb-2">Technical Specifications</h4>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label>Coating Type</Label>
                                <Select value={coatingType} onValueChange={setCoatingType}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select Type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Painted">Painted</SelectItem>
                                        <SelectItem value="HDG">Hot Dip Galvanized (HDG)</SelectItem>
                                        <SelectItem value="Duplex">Duplex (HDG + Paint)</SelectItem>
                                        <SelectItem value="Powder">Powder Coated</SelectItem>
                                        <SelectItem value="None">None / Raw</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="grid gap-2">
                                <Label>Corrosion Category</Label>
                                <Select value={corrosionCategory} onValueChange={setCorrosionCategory}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select Category" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="C1">C1</SelectItem>
                                        <SelectItem value="C2">C2</SelectItem>
                                        <SelectItem value="C3">C3</SelectItem>
                                        <SelectItem value="C4M">C4 Medium</SelectItem>
                                        <SelectItem value="C4H">C4 High</SelectItem>
                                        <SelectItem value="C5">C5</SelectItem>
                                        <SelectItem value="CX">CX</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="grid gap-2">
                            <Label>Corrosion/Coating Comments</Label>
                            <Textarea
                                value={corrosionComments}
                                onChange={e => setCorrosionComments(e.target.value)}
                                placeholder="Details about protection level or specific systems..."
                            />
                        </div>
                    </div>

                    {/* Schedule */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label>Requested Delivery</Label>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant={"outline"}
                                        className={cn(
                                            "w-full justify-start text-left font-normal",
                                            !deliveryDate && "text-muted-foreground"
                                        )}
                                    >
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {deliveryDate ? format(deliveryDate, "PPP") : <span>Pick a date</span>}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar
                                        mode="single"
                                        selected={deliveryDate}
                                        onSelect={setDeliveryDate}
                                        initialFocus
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>
                        <div className="grid gap-2">
                            <Label>Estimated Hours/Days</Label>
                            <Input
                                type="number"
                                value={estimatedHours}
                                onChange={e => setEstimatedHours(e.target.value)}
                                placeholder="Total Hours"
                            />
                        </div>
                    </div>

                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                    <Button onClick={handleSubmit} disabled={loading}>
                        {loading ? "Creating..." : "Create Project"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
