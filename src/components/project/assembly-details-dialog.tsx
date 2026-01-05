'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ScrollArea } from "@/components/ui/scroll-area"
import { FileText, Package, Layers, History, Download, ChevronRight, ChevronDown } from 'lucide-react'
import { format } from 'date-fns'
import { Card, CardContent } from "@/components/ui/card"

interface AssemblyDetailsDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    assembly: any
    projectId: string
    onUpdate?: () => void
}

export function AssemblyDetailsDialog({ open, onOpenChange, assembly, projectId, onUpdate }: AssemblyDetailsDialogProps) {
    const [activeTab, setActiveTab] = useState('production')
    const [expandedPieceId, setExpandedPieceId] = useState<string | null>(null)

    if (!assembly) return null

    // Determine Drawing URL (assuming drawings are stored similarly to parts or linked)
    // Currently Assembly doesn't have a drawingRef in the schema snippets I saw, but maybe it should?
    // User requirement mentioned parsing Assembly PDFs. We probably store them.
    // Let's assume assembly might have 'drawingRef' or we look it up.
    // For now, if schema doesn't have it, we skip.
    // Note: Schema definition didn't explicitly show drawingRef on Assembly.
    // But ParseAssemblyZip implies we have a file.
    // Let's check schema later. If missing, I'll add it or ignore for now.
    const drawingUrl = null

    const toggleExpand = (pieceId: string) => {
        setExpandedPieceId(expandedPieceId === pieceId ? null : pieceId)
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-5xl h-[90vh] flex flex-col p-0 gap-0">
                <div className="p-6 pb-2 border-b">
                    <div className="flex justify-between items-start">
                        <div>
                            <div className="flex items-center gap-3">
                                <DialogTitle className="text-2xl font-mono">{assembly.assemblyNumber}</DialogTitle>
                                <Badge variant={assembly.status === 'SHIPPED' ? "default" : "outline"}>
                                    {assembly.status}
                                </Badge>
                            </div>
                            <DialogDescription className="mt-1 text-base">
                                {assembly.name}
                            </DialogDescription>
                        </div>
                        <div className="flex gap-2">
                            {/* Future actions */}
                        </div>
                    </div>

                    <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-6">
                        <TabsList>
                            <TabsTrigger value="production" className="gap-2"><History className="h-4 w-4" /> Production (Instances)</TabsTrigger>
                            <TabsTrigger value="design" className="gap-2"><Layers className="h-4 w-4" /> Design BOM</TabsTrigger>
                            {/* <TabsTrigger value="drawing" className="gap-2"><FileText className="h-4 w-4" /> Drawing</TabsTrigger> */}
                        </TabsList>
                    </Tabs>
                </div>

                <div className="flex-1 overflow-hidden bg-muted/5">
                    <ScrollArea className="h-full">
                        <div className="p-6">

                            {/* PRODUCTION TAB (AS-BUILT) */}
                            <TabsContent value="production" className="mt-0 space-y-4">
                                <div className="flex justify-between items-center">
                                    <h3 className="font-semibold text-lg">Assembly Instances</h3>
                                    <Badge variant="secondary">{assembly.pieces?.length || 0} Total</Badge>
                                </div>
                                <div className="rounded-md border bg-background">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead className="w-10"></TableHead>
                                                <TableHead>Instance #</TableHead>
                                                <TableHead>Status</TableHead>
                                                <TableHead>Assembled At</TableHead>
                                                <TableHead>Traceability</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {assembly.pieces?.length > 0 ? (
                                                assembly.pieces.map((piece: any) => (
                                                    <>
                                                        <TableRow key={piece.id} className={expandedPieceId === piece.id ? "bg-muted/50" : ""}>
                                                            <TableCell>
                                                                <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => toggleExpand(piece.id)}>
                                                                    {expandedPieceId === piece.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                                                </Button>
                                                            </TableCell>
                                                            <TableCell className="font-medium">#{piece.pieceNumber}</TableCell>
                                                            <TableCell><Badge variant="outline">{piece.status}</Badge></TableCell>
                                                            <TableCell>{piece.assembledAt ? format(new Date(piece.assembledAt), 'dd/MM/yyyy') : '-'}</TableCell>
                                                            <TableCell>
                                                                {piece.childPieces?.length > 0 ? (
                                                                    <span className="text-green-600 text-xs font-medium flex items-center gap-1">
                                                                        <Layers className="h-3 w-3" />
                                                                        {piece.childPieces.length} parts linked
                                                                    </span>
                                                                ) : (
                                                                    <span className="text-muted-foreground text-xs italic">No parts linked</span>
                                                                )}
                                                            </TableCell>
                                                        </TableRow>
                                                        {expandedPieceId === piece.id && (
                                                            <TableRow className="bg-muted/50 hover:bg-muted/50">
                                                                <TableCell colSpan={5} className="p-4 pt-0">
                                                                    <Card className="ml-8 border-l-4 border-l-primary shadow-sm">
                                                                        <CardContent className="p-4">
                                                                            <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                                                                                <History className="h-4 w-4" />
                                                                                As-Built Traceability (Frame #{piece.pieceNumber})
                                                                            </h4>
                                                                            <Table>
                                                                                <TableHeader>
                                                                                    <TableRow className="h-8">
                                                                                        <TableHead className="h-8 text-xs">Part #</TableHead>
                                                                                        <TableHead className="h-8 text-xs">Piece #</TableHead>
                                                                                        <TableHead className="h-8 text-xs">Lot ID / Heat No.</TableHead>
                                                                                    </TableRow>
                                                                                </TableHeader>
                                                                                <TableBody>
                                                                                    {piece.childPieces?.map((cp: any) => (
                                                                                        <TableRow key={cp.id} className="h-8">
                                                                                            <TableCell className="h-8 py-1">{cp.part?.partNumber}</TableCell>
                                                                                            <TableCell className="h-8 py-1">#{cp.pieceNumber}</TableCell>
                                                                                            <TableCell className="h-8 py-1 font-mono text-blue-700">
                                                                                                {cp.inventory?.lotId || '-'}
                                                                                            </TableCell>
                                                                                        </TableRow>
                                                                                    ))}
                                                                                    {!piece.childPieces?.length && (
                                                                                        <TableRow>
                                                                                            <TableCell colSpan={3} className="text-center py-4 text-xs text-muted-foreground">
                                                                                                No parts have been assigned to this assembly instance yet.
                                                                                            </TableCell>
                                                                                        </TableRow>
                                                                                    )}
                                                                                </TableBody>
                                                                            </Table>
                                                                        </CardContent>
                                                                    </Card>
                                                                </TableCell>
                                                            </TableRow>
                                                        )}
                                                    </>
                                                ))
                                            ) : (
                                                <TableRow>
                                                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                                        No assembly instances generated. (Qty: {assembly.quantity})
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                            </TabsContent>

                            {/* DESIGN BOM TAB */}
                            <TabsContent value="design" className="mt-0">
                                <div className="rounded-md border bg-background">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Part #</TableHead>
                                                <TableHead>Description</TableHead>
                                                <TableHead>Qty / Assy</TableHead>
                                                <TableHead>Total Qty</TableHead>
                                                <TableHead>Profile / Specs</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {/* Standard Parts */}
                                            {assembly.assemblyParts?.map((ap: any) => (
                                                <TableRow key={ap.id}>
                                                    <TableCell className="font-mono font-medium">{ap.part.partNumber}</TableCell>
                                                    <TableCell>{ap.part.description}</TableCell>
                                                    <TableCell>{ap.quantityInAssembly}</TableCell>
                                                    <TableCell>{ap.quantityInAssembly * (assembly.quantity || 1)}</TableCell>
                                                    <TableCell className="text-sm text-muted-foreground">
                                                        {ap.part.profile?.dimensions || ap.part.profileDimensions}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                            {/* Plate Parts */}
                                            {assembly.plateAssemblyParts?.map((pap: any) => (
                                                <TableRow key={pap.id}>
                                                    <TableCell className="font-mono font-medium">{pap.platePart.partNumber}</TableCell>
                                                    <TableCell>{pap.platePart.description}</TableCell>
                                                    <TableCell>{pap.quantityInAssembly}</TableCell>
                                                    <TableCell>{pap.quantityInAssembly * (assembly.quantity || 1)}</TableCell>
                                                    <TableCell className="text-sm text-muted-foreground">
                                                        PL {pap.platePart.thickness} x {pap.platePart.width}
                                                    </TableCell>
                                                </TableRow>
                                            ))}

                                            {(!assembly.assemblyParts?.length && !assembly.plateAssemblyParts?.length) && (
                                                <TableRow>
                                                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                                        Design BOM is empty. Import BOM from drawings to populate.
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                            </TabsContent>

                        </div>
                    </ScrollArea>
                </div>
            </DialogContent>
        </Dialog>
    )
}
