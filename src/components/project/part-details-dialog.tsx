'use client'

import { useState, useEffect } from 'react'
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
import { cn } from "@/lib/utils"

import { PartWithRelations } from '@/types'

const TABS = {
    GENERAL: 'general',
    PRODUCTION: 'production',
    ASSEMBLIES: 'assemblies',
    DRAWING: 'drawing'
} as const;

type TabValue = typeof TABS[keyof typeof TABS];

interface PartDetailsDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    part: PartWithRelations
    projectId: string
    onUpdate?: () => void
    onOpenAssembly?: (assemblyId: string) => void
}

export function PartDetailsDialog({ open, onOpenChange, part, projectId, onUpdate, onOpenAssembly }: PartDetailsDialogProps) {
    const [activeTab, setActiveTab] = useState<string>(TABS.GENERAL)
    const [editing, setEditing] = useState(false)
    const [saving, setSaving] = useState(false)

    // Edit states
    const [quantity, setQuantity] = useState(part?.quantity || 0)

    // Sync state with props when part changes or dialog opens
    useEffect(() => {
        if (part) {
            setQuantity(part.quantity)
        }
    }, [part, open])

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
            <DialogContent className="max-w-4xl h-[85vh] flex flex-col p-0 gap-0 border-none shadow-2xl overflow-hidden">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col h-full">
                    <div className="p-6 pb-0 border-b border-border/50 bg-card/30 backdrop-blur-sm">
                        <div className="flex justify-between items-start mb-6">
                            <div className="space-y-1">
                                <div className="flex items-center gap-3">
                                    <DialogTitle className="text-3xl font-mono font-bold tracking-tight">{part.partNumber}</DialogTitle>
                                    <Badge variant={part.isOutsourcedCut ? "secondary" : "default"} className="px-2.5 py-0.5">
                                        {part.isOutsourcedCut ? "Outsourced" : "In-House"}
                                    </Badge>
                                </div>
                                <DialogDescription className="text-base text-muted-foreground/80">
                                    {part.description || "No description provided"}
                                </DialogDescription>
                            </div>
                            <div className="flex gap-2">
                                <Button variant="outline" size="sm" onClick={() => setEditing(!editing)} className="transition-premium hover:bg-primary/5">
                                    {editing ? "Cancel" : "Edit Part"}
                                </Button>
                            </div>
                        </div>

                        <TabsList className="bg-transparent gap-6 h-12 p-0">
                            <TabsTrigger value={TABS.GENERAL} className="gap-2 data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-12 px-0 transition-premium">
                                <Package className="h-4 w-4" /> General
                            </TabsTrigger>
                            <TabsTrigger value={TABS.PRODUCTION} className="gap-2 data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-12 px-0 transition-premium">
                                <History className="h-4 w-4" /> Production
                            </TabsTrigger>
                            <TabsTrigger value={TABS.ASSEMBLIES} className="gap-2 data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-12 px-0 transition-premium">
                                <Layers className="h-4 w-4" /> Assemblies <Badge variant="secondary" className="ml-1 h-5 min-w-5 justify-center px-1 font-mono text-[10px]">{part.assemblyParts?.length || 0}</Badge>
                            </TabsTrigger>
                            {drawingUrl && (
                                <TabsTrigger value={TABS.DRAWING} className="gap-2 data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-12 px-0 transition-premium">
                                    <FileText className="h-4 w-4" /> Drawing
                                </TabsTrigger>
                            )}
                        </TabsList>
                    </div>

                    <div className="flex-1 overflow-hidden bg-muted/5">
                        <ScrollArea className="h-full">
                            <div className="p-6">

                                {/* GENERAL TAB */}
                                <TabsContent value={TABS.GENERAL} className="mt-0 space-y-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                        <div className="glass p-6 rounded-xl space-y-6">
                                            <div className="flex items-center gap-3 pb-2 border-b border-border/30">
                                                <div className="h-4 w-1 bg-primary rounded-full" />
                                                <h3 className="font-bold text-sm uppercase tracking-wider text-muted-foreground">Dimensions & Specs</h3>
                                            </div>
                                            <div className="grid grid-cols-2 gap-y-6 gap-x-4">
                                                <div className="space-y-1">
                                                    <Label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Type</Label>
                                                    <div className="font-semibold text-base">{part.profile?.type || part.profileType || '-'}</div>
                                                </div>
                                                <div className="space-y-1">
                                                    <Label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Dimensions</Label>
                                                    <div className="font-semibold text-base">{part.profile?.dimensions || part.profileDimensions || '-'}</div>
                                                </div>
                                                <div className="space-y-1">
                                                    <Label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Length</Label>
                                                    <div className="font-mono text-xl font-bold text-primary">{part.length} <span className="text-xs font-normal text-muted-foreground">mm</span></div>
                                                </div>
                                                <div className="space-y-1">
                                                    <Label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Grade</Label>
                                                    <div className="font-semibold text-base">{part.grade?.name || '-'}</div>
                                                </div>
                                                <div className="space-y-1 col-span-2">
                                                    <Label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Unit Weight</Label>
                                                    <div className="font-medium text-muted-foreground italic">{(part.unitWeight || part.profile?.weightPerMeter || 0).toFixed(3)} kg/m</div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="glass p-6 rounded-xl space-y-6 flex flex-col">
                                            <div className="flex items-center gap-3 pb-2 border-b border-border/30">
                                                <div className="h-4 w-1 bg-primary rounded-full" />
                                                <h3 className="font-bold text-sm uppercase tracking-wider text-muted-foreground">Project Requirement</h3>
                                            </div>
                                            <div className="flex-1 flex flex-col justify-center items-center py-8">
                                                <Label className="text-xs uppercase tracking-widest text-muted-foreground font-bold mb-4">Total Pieces Required</Label>
                                                {editing ? (
                                                    <div className="flex flex-col items-center gap-4">
                                                        <Input
                                                            type="number"
                                                            value={quantity}
                                                            onChange={(e) => setQuantity(parseInt(e.target.value) || 0)}
                                                            className="w-32 h-12 text-2xl font-bold text-center bg-background"
                                                        />
                                                        <Button onClick={handleSave} disabled={saving} className="w-full shadow-lg shadow-primary/20 transition-premium active:scale-95">
                                                            {saving ? "Saving..." : "Update Quantity"}
                                                        </Button>
                                                    </div>
                                                ) : (
                                                    <div className="text-6xl font-black tracking-tight text-primary drop-shadow-sm">
                                                        {part.quantity}
                                                        <span className="text-xl font-medium text-muted-foreground ml-2">pcs</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </TabsContent>

                                {/* PRODUCTION TAB */}
                                <TabsContent value={TABS.PRODUCTION} className="mt-0">
                                    <div className="rounded-xl border border-border/50 bg-card/20 backdrop-blur-sm overflow-hidden shadow-lg">
                                        <Table>
                                            <TableHeader>
                                                <TableRow className="bg-muted/30 border-b border-border/50">
                                                    <TableHead className="w-24 font-bold">Piece #</TableHead>
                                                    <TableHead className="font-bold">Status</TableHead>
                                                    <TableHead className="font-bold">Material / Lot ID <span className="text-[10px] text-muted-foreground font-normal">(Heating No.)</span></TableHead>
                                                    <TableHead className="font-bold">Timestamps</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {part.pieces && part.pieces.length > 0 ? (
                                                    part.pieces.map((piece: any) => (
                                                        <TableRow key={piece.id} className="transition-premium hover:bg-muted/40">
                                                            <TableCell className="font-mono font-bold text-primary">#{piece.pieceNumber}</TableCell>
                                                            <TableCell>
                                                                <Badge variant={piece.status === 'READY' ? 'default' : 'outline'} className={cn(
                                                                    piece.status === 'READY' ? "bg-green-600/90 hover:bg-green-600" : ""
                                                                )}>
                                                                    {piece.status}
                                                                </Badge>
                                                            </TableCell>
                                                            <TableCell>
                                                                {piece.inventory ? (
                                                                    <div className="flex flex-col gap-1">
                                                                        <div className="flex items-center gap-2">
                                                                            <span className="font-mono font-bold text-blue-600 dark:text-blue-400">{piece.inventory.lotId}</span>
                                                                            {piece.inventory.certificateFilename && (
                                                                                <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full hover:bg-blue-50 dark:hover:bg-blue-900/20" title="View Certificate" asChild>
                                                                                    <a
                                                                                        href={`/api/certificates/view?path=${encodeURIComponent(piece.inventory.certificateFilename)}&bucket=projects`}
                                                                                        target="_blank"
                                                                                        rel="noopener noreferrer"
                                                                                    >
                                                                                        <FileText className="h-3.5 w-3.5 text-blue-500" />
                                                                                    </a>
                                                                                </Button>
                                                                            )}
                                                                        </div>
                                                                        <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground/60">
                                                                            {piece.inventory.supplier?.name ? piece.inventory.supplier.name : 'Stock Material'}
                                                                        </span>
                                                                    </div>
                                                                ) : (
                                                                    <span className="text-muted-foreground italic text-sm">Not allocated</span>
                                                                )}
                                                            </TableCell>
                                                            <TableCell className="text-[11px] text-muted-foreground">
                                                                {piece.cutAt && <div className="flex items-center gap-1.5"><div className="w-1 h-1 rounded-full bg-blue-400" /> Cut: {format(new Date(piece.cutAt), 'dd/MM HH:mm')}</div>}
                                                                {piece.completedAt && <div className="flex items-center gap-1.5 text-green-600 dark:text-green-500 font-bold"><div className="w-1 h-1 rounded-full bg-green-500" /> Ready: {format(new Date(piece.completedAt), 'dd/MM HH:mm')}</div>}
                                                            </TableCell>
                                                        </TableRow>
                                                    ))
                                                ) : (
                                                    <TableRow>
                                                        <TableCell colSpan={4} className="text-center py-12 text-muted-foreground italic">
                                                            No production pieces generated yet.
                                                        </TableCell>
                                                    </TableRow>
                                                )}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </TabsContent>

                                {/* ASSEMBLIES TAB */}
                                <TabsContent value={TABS.ASSEMBLIES} className="mt-0">
                                    <div className="rounded-xl border border-border/50 bg-card/20 backdrop-blur-sm overflow-hidden shadow-lg">
                                        <Table>
                                            <TableHeader>
                                                <TableRow className="bg-muted/30 border-b border-border/50">
                                                    <TableHead className="font-bold">Assembly #</TableHead>
                                                    <TableHead className="font-bold">Assembly Name</TableHead>
                                                    <TableHead className="font-bold">Qty Used</TableHead>
                                                    <TableHead className="w-12"></TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {part.assemblyParts?.length > 0 ? (
                                                    part.assemblyParts.map((ap: any) => (
                                                        <TableRow key={ap.id} className="transition-premium hover:bg-muted/40 group">
                                                            <TableCell className="font-mono font-bold text-primary">{ap.assembly.assemblyNumber}</TableCell>
                                                            <TableCell className="font-medium">{ap.assembly.name}</TableCell>
                                                            <TableCell className="font-bold">{ap.quantityInAssembly} <span className="text-xs font-normal text-muted-foreground">pcs</span></TableCell>
                                                            <TableCell>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-premium"
                                                                    onClick={() => onOpenAssembly && onOpenAssembly(ap.assemblyId)}
                                                                >
                                                                    <ArrowRight className="h-4 w-4" />
                                                                </Button>
                                                            </TableCell>
                                                        </TableRow>
                                                    ))
                                                ) : (
                                                    <TableRow>
                                                        <TableCell colSpan={4} className="text-center py-12 text-muted-foreground italic">
                                                            Not used in any assemblies yet.
                                                        </TableCell>
                                                    </TableRow>
                                                )}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </TabsContent>

                                {/* DRAWING TAB */}
                                {drawingUrl && activeTab === TABS.DRAWING && (
                                    <TabsContent value={TABS.DRAWING} className="mt-0 h-full min-h-[500px] flex flex-col">
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
