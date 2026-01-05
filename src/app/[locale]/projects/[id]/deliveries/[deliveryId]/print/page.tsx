
import { getDeliverySchedule } from "@/app/actions/deliveries"
import { notFound } from "next/navigation"
import { Package, Truck, Calendar, MapPin } from "lucide-react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { PrintButton } from "./print-button"

export default async function PackingListPage({ params }: { params: Promise<{ id: string, deliveryId: string }> }) {
    const { id, deliveryId } = await params
    const delivery = await getDeliverySchedule(deliveryId)

    if (!delivery) {
        notFound()
    }

    return (
        <div className="container mx-auto py-8 max-w-4xl print:p-0 print:max-w-none">
            {/* Print Controls - Hidden when printing */}
            <div className="flex justify-between items-center mb-8 print:hidden">
                <Button variant="outline" asChild>
                    <a href={`/projects/${id}`}>&larr; Back to Project</a>
                </Button>
                <PrintButton />
            </div>

            {/* Header */}
            <div className="border-b pb-6 mb-6">
                <div className="flex justify-between items-start">
                    <div>
                        <h1 className="text-3xl font-bold mb-2">Packing List</h1>
                        <p className="text-muted-foreground text-lg">{delivery.name}</p>
                    </div>
                    <div className="text-right">
                        <div className="flex items-center justify-end gap-2 text-muted-foreground mb-1">
                            <Calendar className="h-4 w-4" />
                            <span>Scheduled: {new Date(delivery.scheduledDate).toLocaleDateString()}</span>
                        </div>
                        <div className="flex items-center justify-end gap-2 font-mono text-sm">
                            <span className="bg-slate-100 px-2 py-1 rounded">ID: {delivery.id.slice(-8)}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Project / Client Info (Placeholder) */}
            <div className="grid grid-cols-2 gap-8 mb-8 text-sm">
                <div className="p-4 bg-slate-50 rounded-lg border print:border-gray-300">
                    <h3 className="font-semibold text-gray-900 mb-2">From:</h3>
                    <div className="space-y-1 text-gray-600">
                        <p className="font-medium">SteelAxis Fab</p>
                        <p>123 Industrial Park</p>
                        <p>Fabrication City, FC 90210</p>
                    </div>
                </div>
                <div className="p-4 bg-slate-50 rounded-lg border print:border-gray-300">
                    <h3 className="font-semibold text-gray-900 mb-2">To Project:</h3>
                    <div className="space-y-1 text-gray-600">
                        <p className="font-medium">Project #{id.slice(0, 8)}</p>
                        {/* We could fetch project details to show client info here */}
                    </div>
                </div>
            </div>

            {/* Items Table */}
            <div className="mb-8">
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                    <Package className="h-5 w-5" />
                    Items
                </h2>
                <div className="border rounded-lg overflow-hidden print:border-gray-300">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-slate-50 print:bg-gray-100">
                                <TableHead className="w-16">#</TableHead>
                                <TableHead>Assembly Number</TableHead>
                                <TableHead>Description</TableHead>
                                <TableHead className="text-right">Qty</TableHead>
                                <TableHead className="w-24">Check</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {delivery.items.map((item, index) => (
                                <TableRow key={item.id} className="print:border-b-gray-300">
                                    <TableCell className="font-mono text-xs">{index + 1}</TableCell>
                                    <TableCell className="font-semibold">{item.assembly.assemblyNumber}</TableCell>
                                    <TableCell>{item.assembly.name}</TableCell>
                                    <TableCell className="text-right">1</TableCell>
                                    <TableCell>
                                        <div className="w-6 h-6 border-2 border-gray-300 rounded"></div>
                                    </TableCell>
                                </TableRow>
                            ))}
                            {delivery.items.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                        No items in this shipment.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>

            {/* Notes Section */}
            {delivery.notes && (
                <div className="mb-8 p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 print:bg-white print:border-gray-300">
                    <h3 className="font-semibold mb-1">Notes:</h3>
                    <p>{delivery.notes}</p>
                </div>
            )}

            {/* Footer Signatures */}
            <div className="grid grid-cols-2 gap-12 mt-16 pt-8 border-t print:break-inside-avoid">
                <div>
                    <p className="mb-8 font-medium">Checked By:</p>
                    <div className="border-b border-black h-8"></div>
                </div>
                <div>
                    <p className="mb-8 font-medium">Received By:</p>
                    <div className="border-b border-black h-8"></div>
                </div>
            </div>

            <div className="mt-8 text-center text-xs text-muted-foreground print:text-gray-400">
                Generated by SteelAxis on {new Date().toLocaleString()}
            </div>
        </div>
    )
}
