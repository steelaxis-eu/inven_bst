'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ScrollArea } from "@/components/ui/scroll-area"
import { FileText, Package, Layers, History, ArrowRight, Download, Printer } from 'lucide-react'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { updatePartQuantity } from '@/app/actions/parts'

interface PartDetailsDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    part: any // We use any here because the type is complex (Part + includes), but we technically know the shape
    projectId: string
    onUpdate?: () => void
}

export function PartDetailsDialog({ open, onOpenChange, part, projectId, onUpdate }: PartDetailsDialogProps) {
    const [activeTab, setActiveTab] = useState('general')
    const [editing, setEditing] = useState(false)
    const [saving, setSaving] = useState(false)

    // Edit states
    const [quantity, setQuantity] = useState(part?.quantity || 0)

    if (!part) return null

    const handleSave = async () => {
        setSaving(true)
        try {
            if (part.quantity !== quantity) {
                const res = await updatePartQuantity(part.id, quantity)
                if (!res.success) throw new Error(res.error)
                toast.success("Quantity updated")
                if (onUpdate) onUpdate()
            }
            setEditing(false)
        } catch (e: any) {
            toast.error(e.message || "Failed to save")
        } finally {
            setSaving(false)
        }
    }

    const isProfile = part.profileId || part.profileType
    const drawingUrl = part.drawingRef
        ? `/api/certificates/view?path=${encodeURIComponent(part.drawingRef)}&bucket=projects`
        : null

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl h-[85vh] flex flex-col p-0 gap-0">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col h-full">
                    <div className="p-6 pb-2 border-b">
                        <div className="flex justify-between items-start">
                            <div>
                                <div className="flex items-center gap-3">
                                    <DialogTitle className="text-2xl font-mono">{part.partNumber}</DialogTitle>
                                    <Badge variant={part.isOutsourcedCut ? "secondary" : "default"}>
                                        {part.isOutsourcedCut ? "Outsourced" : "In-House"}
                                    </Badge>
                                </div>
                                <DialogDescription className="mt-1 text-base">
                                    {part.description || "No description"}
                                </DialogDescription>
                            </div>
                            <div className="flex gap-2">
                                {/* Actions like Print Label could go here */}
                                <Button variant="outline" size="sm" onClick={() => setEditing(!editing)}>
                                    {editing ? "Cancel" : "Edit"}
                                </Button>
                            </div>
                        </div>

                        <div className="mt-6">
                            <TabsList>
                                <TabsTrigger value="general" className="gap-2"><Package className="h-4 w-4" /> General</TabsTrigger>
                                <TabsTrigger value="production" className="gap-2"><History className="h-4 w-4" /> Production & Traceability</TabsTrigger>
                                <TabsTrigger value="assemblies" className="gap-2"><Layers className="h-4 w-4" /> Assemblies ({part.assemblyParts?.length || 0})</TabsTrigger>
                                {drawingUrl && (
                                    <TabsTrigger value="drawing" className="gap-2"><FileText className="h-4 w-4" /> Drawing</TabsTrigger>
                                )}
                            </TabsList>
                        </div>
                    </div>

                    <div className="flex-1 overflow-hidden bg-muted/5">
                        <ScrollArea className="h-full">
                            <div className="p-6">

                                {/* GENERAL TAB */}
                                <TabsContent value="general" className="mt-0 space-y-6">
                                    <div className="grid grid-cols-2 gap-8">
                                        <div className="space-y-4">
                                            <h3 className="font-semibold text-lg border-b pb-2">Dimensions & Specs</h3>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <Label className="text-muted-foreground">Type</Label>
                                                    <div className="font-medium">{part.profile?.type || part.profileType || '-'}</div>
                                                </div>
                                                <div>
                                                    <Label className="text-muted-foreground">Dimensions</Label>
                                                    <div className="font-medium">{part.profile?.dimensions || part.profileDimensions || '-'}</div>
                                                </div>
                                                <div>
                                                    <Label className="text-muted-foreground">Length</Label>
                                                    <div className="font-medium text-lg">{part.length} mm</div>
                                                </div>
                                                <div>
                                                    <Label className="text-muted-foreground">Grade</Label>
                                                    <div className="font-medium">{part.grade?.name || '-'}</div>
                                                </div>
                                                <div>
                                                    <Label className="text-muted-foreground">Unit Weight</Label>
                                                    <div className="font-medium text-muted-foreground">{part.unitWeight?.toFixed(2)} kg</div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-4">
                                            <h3 className="font-semibold text-lg border-b pb-2">Inventory Control</h3>
                                            <div className="space-y-4">
                                                <div>
                                                    <Label>Quantity Required</Label>
                                                    {editing ? (
                                                        <Input
                                                            type="number"
                                                            value={quantity}
                                                            onChange={(e) => setQuantity(parseInt(e.target.value) || 0)}
                                                            className="w-32"
                                                        />
                                                    ) : (
                                                        <div className="text-3xl font-bold text-primary">{part.quantity} <span className="text-sm font-normal text-muted-foreground">pcs</span></div>
                                                    )}
                                                </div>

                                                {editing && (
                                                    <div className="flex gap-2">
                                                        <Button onClick={handleSave} disabled={saving}>
                                                            {saving ? "Saving..." : "Save Changes"}
                                                        </Button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </TabsContent>

                                {/* PRODUCTION TAB */}
                                <TabsContent value="production" className="mt-0">
                                    <div className="rounded-md border bg-background">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead className="w-20">Piece #</TableHead>
                                                    <TableHead>Status</TableHead>
                                                    <TableHead>Material / Lot ID<br /><span className="text-[10px] text-muted-foreground font-normal">(Heating No.)</span></TableHead>
                                                    <TableHead>Timestamps</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {part.pieces?.length > 0 ? (
                                                    part.pieces.map((piece: any) => (
                                                        <TableRow key={piece.id}>
                                                            <TableCell className="font-medium">#{piece.pieceNumber}</TableCell>
                                                            <TableCell>
                                                                <Badge variant={piece.status === 'READY' ? 'default' : 'outline'}>
                                                                    {piece.status}
                                                                </Badge>
                                                            </TableCell>
                                                            <TableCell>
                                                                {piece.inventory ? (
                                                                    <div className="flex flex-col gap-1">
                                                                        <div className="flex items-center gap-2">
                                                                            <span className="font-mono font-medium text-blue-700">{piece.inventory.lotId}</span>
                                                                            {piece.inventory.certificateFilename && (
                                                                                <Button variant="ghost" size="icon" className="h-5 w-5" title="View Certificate" asChild>
                                                                                    <a
                                                                                        href={`/api/certificates/view?path=${encodeURIComponent(piece.inventory.certificateFilename)}&bucket=projects`}
                                                                                        target="_blank"
                                                                                        rel="noopener noreferrer"
                                                                                    >
                                                                                        <FileText className="h-3 w-3 text-blue-600" />
                                                                                    </a>
                                                                                </Button>
                                                                            )}
                                                                        </div>
                                                                        <span className="text-xs text-muted-foreground">
                                                                            {piece.inventory.supplier?.name ? piece.inventory.supplier.name : 'Stock Material'}
                                                                        </span>
                                                                    </div>
                                                                ) : (
                                                                    <span className="text-muted-foreground italic text-sm">Not allocated</span>
                                                                )}
                                                            </TableCell>
                                                            <TableCell className="text-xs text-muted-foreground">
                                                                {piece.cutAt && <div>Cut: {format(new Date(piece.cutAt), 'dd/MM HH:mm')}</div>}
                                                                {piece.completedAt && <div className="text-green-600 font-medium">Ready: {format(new Date(piece.completedAt), 'dd/MM HH:mm')}</div>}
                                                            </TableCell>
                                                        </TableRow>
                                                    ))
                                                ) : (
                                                    <TableRow>
                                                        <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                                                            No pieces generated.
                                                        </TableCell>
                                                    </TableRow>
                                                )}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </TabsContent>

                                {/* ASSEMBLIES TAB */}
                                <TabsContent value="assemblies" className="mt-0">
                                    <div className="rounded-md border bg-background">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Assembly #</TableHead>
                                                    <TableHead>Assembly Name</TableHead>
                                                    <TableHead>Qty Used</TableHead>
                                                    <TableHead></TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {part.assemblyParts?.length > 0 ? (
                                                    part.assemblyParts.map((ap: any) => (
                                                        <TableRow key={ap.id}>
                                                            <TableCell className="font-mono font-medium">{ap.assembly.assemblyNumber}</TableCell>
                                                            <TableCell>{ap.assembly.name}</TableCell>
                                                            <TableCell>{ap.quantityInAssembly} pcs</TableCell>
                                                            <TableCell>
                                                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                                                    <ArrowRight className="h-4 w-4" />
                                                                </Button>
                                                            </TableCell>
                                                        </TableRow>
                                                    ))
                                                ) : (
                                                    <TableRow>
                                                        <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                                                            Not used in any assemblies yet.
                                                        </TableCell>
                                                    </TableRow>
                                                )}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </TabsContent>

                                {/* DRAWING TAB */}
                                {drawingUrl && (
                                    <TabsContent value="drawing" className="mt-0 h-full min-h-[500px] flex flex-col">
                                        <div className="flex justify-end mb-2">
                                            <Button variant="outline" size="sm" asChild>
                                                <a href={drawingUrl} download>
                                                    <Download className="mr-2 h-4 w-4" /> Download PDF
                                                </a>
                                            </Button>
                                        </div>
                                        <iframe
                                            src={drawingUrl + "#toolbar=0"}
                                            className="w-full flex-1 border rounded-md bg-white min-h-[500px]"
                                            title="Drawing Preview"
                                        />
                                    </TabsContent>
                                )}

                            </div>
                        </ScrollArea>
                    </div>
                </Tabs>
            </DialogContent>
        </Dialog>
    )
}
