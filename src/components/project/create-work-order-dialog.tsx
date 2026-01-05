'use client'

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { toast } from "sonner"
import { CalendarIcon, Loader2, Scissors, Truck, Hammer, PaintBucket, ScanEye, Package } from "lucide-react"
import { format } from "date-fns"

import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Calendar } from "@/components/ui/calendar"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"

import { NestingVisualizer } from "./nesting-visualizer"
import { createSmartWorkOrder, getOptimizationPreview } from "@/app/actions/workorders" // Imports
// We need to export `getOptimizationPreview` from workorders.ts if not already

const formSchema = z.object({
    title: z.string().min(1, "Title is required"),
    type: z.string().min(1, "Type is required"),
    priority: z.string(),
    scheduledDate: z.date().optional(),
    vendor: z.string().optional(), // For Outsourced
    notes: z.string().optional(),
    isOutsourced: z.boolean(),
    supplyMaterial: z.boolean(), // For Outsourced
})

interface CreateWorkOrderDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    pieceIds: string[]
    projectedType?: string
    projectId: string
    onSuccess?: () => void
}

export function CreateWorkOrderDialog({
    open,
    onOpenChange,
    pieceIds,
    projectedType,
    projectId,
    onSuccess
}: CreateWorkOrderDialogProps) {
    const [step, setStep] = useState(1) // 1 = Config, 2 = Review/Optimize
    const [isLoading, setIsLoading] = useState(false)
    const [optimizationResult, setOptimizationResult] = useState<any>(null) // Store backend plan

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            title: "",
            type: projectedType || "CUTTING",
            priority: "MEDIUM",
            isOutsourced: false,
            supplyMaterial: false,
        },
    })

    const watchType = form.watch("type")
    const watchOutsourced = form.watch("isOutsourced")

    // Intelligent Title update
    // Update title when Type changes if not manually set? Simplified: User sets title.

    const handleNext = async () => {
        // Prepare for Review Step
        const data = form.getValues()
        if (!data.title) {
            form.setError("title", { message: "Title is required" })
            return
        }

        setIsLoading(true)

        try {
            // ONLY RUN OPTIMIZATION IF: Type is CUTTING OR (Outsourced + Supply Material) AND we have profiles
            // We'll run it for CUTTING default.
            if (data.type === 'CUTTING' || (data.isOutsourced && data.supplyMaterial)) {
                const res = await getOptimizationPreview(pieceIds)
                if (res.success) {
                    setOptimizationResult(res.plans)
                    setStep(2)
                } else {
                    toast.error("Optimization failed: " + res.error)
                }
            } else {
                // No optimization needed (e.g. Welding, or Outsourced Vendor Supply)
                // Just go to confirmation/create directly? 
                // Let's create directly
                await onSubmit(data)
            }
        } catch (error) {
            console.error(error)
            toast.error("Failed to prepare work order")
        } finally {
            setIsLoading(false)
        }
    }

    const onSubmit = async (values: z.infer<typeof formSchema>) => {
        setIsLoading(true)
        try {
            const res = await createSmartWorkOrder({
                projectId,
                pieceIds,
                type: values.type,
                title: values.title,
                priority: values.priority as any,
                scheduledDate: values.scheduledDate,
                notes: values.notes,
                isOutsourced: values.isOutsourced,
                supplyMaterial: values.supplyMaterial,
                vendor: values.vendor
            })

            if (res.success) {
                toast.success(res.message || "Work Order created successfully")
                onOpenChange(false)
                onSuccess?.()
                // Reset form
                form.reset()
                setStep(1)
                setOptimizationResult(null)
            } else {
                toast.error(res.error || "Failed to create Work Order")
            }
        } catch (error) {
            toast.error("An error occurred")
        } finally {
            setIsLoading(false)
        }
    }

    // Determine icon for type
    const getTypeIcon = (t: string) => {
        switch (t) {
            case 'CUTTING': return <Scissors className="h-4 w-4" />
            case 'WELDING': return <Hammer className="h-4 w-4" />
            case 'PAINTING': return <PaintBucket className="h-4 w-4" />
            case 'INSPECTION': return <ScanEye className="h-4 w-4" />
            default: return <Package className="h-4 w-4" />
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Create Work Order</DialogTitle>
                    <DialogDescription>
                        {pieceIds.length} items selected
                    </DialogDescription>
                </DialogHeader>

                {step === 1 && (
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(handleNext)} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <FormField
                                    control={form.control}
                                    name="title"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Title</FormLabel>
                                            <FormControl>
                                                <Input placeholder="e.g. Phase 1 Cutting" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="type"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Type</FormLabel>
                                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Select type" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    <SelectItem value="CUTTING">Cutting</SelectItem>
                                                    <SelectItem value="WELDING">Welding</SelectItem>
                                                    <SelectItem value="PAINTING">Painting / HDG</SelectItem>
                                                    <SelectItem value="MACHINING">Machining</SelectItem>
                                                    <SelectItem value="ASSEMBLY">Assembly</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <FormField
                                    control={form.control}
                                    name="priority"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Priority</FormLabel>
                                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Select priority" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    <SelectItem value="LOW">Low</SelectItem>
                                                    <SelectItem value="MEDIUM">Medium</SelectItem>
                                                    <SelectItem value="HIGH">High</SelectItem>
                                                    <SelectItem value="URGENT">Urgent</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="scheduledDate"
                                    render={({ field }) => (
                                        <FormItem className="flex flex-col">
                                            <FormLabel>Scheduled Date</FormLabel>
                                            <Popover>
                                                <PopoverTrigger asChild>
                                                    <FormControl>
                                                        <Button
                                                            variant={"outline"}
                                                            className={cn(
                                                                "w-full pl-3 text-left font-normal",
                                                                !field.value && "text-muted-foreground"
                                                            )}
                                                        >
                                                            {field.value ? (
                                                                format(field.value, "PPP")
                                                            ) : (
                                                                <span>Pick a date</span>
                                                            )}
                                                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                                        </Button>
                                                    </FormControl>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-auto p-0" align="start">
                                                    <Calendar
                                                        mode="single"
                                                        selected={field.value}
                                                        onSelect={field.onChange}
                                                        initialFocus
                                                    />
                                                </PopoverContent>
                                            </Popover>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>

                            {/* OUTSOURCING OPTIONS */}
                            <div className="p-4 border rounded-md bg-muted/20 space-y-4">
                                <FormField
                                    control={form.control}
                                    name="isOutsourced"
                                    render={({ field }) => (
                                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                                            <div className="space-y-0.5">
                                                <FormLabel>Outsource Work</FormLabel>
                                                <div className="text-[0.8rem] text-muted-foreground">
                                                    Is this work performed by an external vendor?
                                                </div>
                                            </div>
                                            <FormControl>
                                                <Switch
                                                    checked={field.value}
                                                    onCheckedChange={field.onChange}
                                                />
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />

                                {watchOutsourced && (
                                    <>
                                        <FormField
                                            control={form.control}
                                            name="vendor"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Vendor Name</FormLabel>
                                                    <FormControl>
                                                        <Input placeholder="e.g. Laser Co." {...field} />
                                                    </FormControl>
                                                </FormItem>
                                            )}
                                        />

                                        <FormField
                                            control={form.control}
                                            name="supplyMaterial"
                                            render={({ field }) => (
                                                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm bg-background">
                                                    <div className="space-y-0.5">
                                                        <FormLabel className="flex items-center gap-2">
                                                            <Truck className="h-4 w-4" />
                                                            Supply Material Internally?
                                                        </FormLabel>
                                                        <div className="text-[0.8rem] text-muted-foreground">
                                                            If checked, we will create a <strong>Material Prep WO</strong> to prepare stock for the vendor.
                                                            <br />
                                                            If unchecked, vendor supplies material.
                                                        </div>
                                                    </div>
                                                    <FormControl>
                                                        <Switch
                                                            checked={field.value}
                                                            onCheckedChange={field.onChange}
                                                        />
                                                    </FormControl>
                                                </FormItem>
                                            )}
                                        />
                                    </>
                                )}
                            </div>

                            <FormField
                                control={form.control}
                                name="notes"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Notes</FormLabel>
                                        <FormControl>
                                            <Textarea placeholder="Instructions..." {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <DialogFooter>
                                <Button type="submit" disabled={isLoading}>
                                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    {watchType === 'CUTTING' || (watchOutsourced && form.getValues().supplyMaterial) ? 'Next: Optimization' : 'Create Work Order'}
                                </Button>
                            </DialogFooter>
                        </form>
                    </Form>
                )}

                {step === 2 && optimizationResult && (
                    <div className="space-y-4">
                        <div className="bg-blue-50 dark:bg-blue-950/30 p-4 rounded-md border border-blue-200 dark:border-blue-900">
                            <h3 className="font-semibold text-blue-900 dark:text-blue-100 flex items-center gap-2">
                                <ScanEye className="h-5 w-5" />
                                Optimization Preview
                            </h3>
                            <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                                Review how we plan to cut these parts.
                                We will create <strong>Immediate Cutting WOs</strong> for available stock
                                and <strong>Material Prep WOs</strong> for what needs to be bought/prepped.
                            </p>
                        </div>

                        <div className="max-h-[60vh] overflow-y-auto pr-2">
                            {optimizationResult.map((plan: any, i: number) => (
                                plan.canOptimize ? (
                                    <NestingVisualizer key={i} plan={plan} />
                                ) : (
                                    <div key={i} className="p-4 border border-yellow-200 bg-yellow-50 dark:bg-yellow-900/10 rounded-md">
                                        <p className="font-semibold text-yellow-800 dark:text-yellow-200">{plan.materialKey}</p>
                                        <p className="text-sm text-yellow-700 dark:text-yellow-300">Cannot optimize (Missing Data). Will be added to manual block.</p>
                                    </div>
                                )
                            ))}
                        </div>

                        <DialogFooter className="gap-2">
                            <Button variant="outline" onClick={() => setStep(1)} disabled={isLoading}>
                                Back
                            </Button>
                            <Button onClick={() => onSubmit(form.getValues())} disabled={isLoading}>
                                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Confirm & Create WOs
                            </Button>
                        </DialogFooter>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    )
}
