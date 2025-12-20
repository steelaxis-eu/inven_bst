import { getProject } from "@/app/actions/projects"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { InventoryCertActions } from "@/components/inventory-cert-actions"
import { FileViewer } from "@/components/ui/file-viewer"
import { AlertTriangle, FileWarning, CheckCircle } from "lucide-react"
import { DownloadCertificatesButton } from "@/components/download-certificates-button"

export default async function ProjectDashboard({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const cleanId = decodeURIComponent(id).trim()

    let project: any = null
    try {
        project = await getProject(cleanId)
    } catch (e) { }

    if (!project) return <div className="p-8 text-center text-red-500">Project "{cleanId}" not found. Please check the URL.</div>

    // Consume Backend Stats
    const {
        missingCertCount = 0,
        totalProjectCost = 0,
        totalScrapValue = 0,
        totalScrapWeight = 0,
        netCost = 0,
        materialSummary = [],
        scrapPrice = 0
    } = project.stats || {}

    return (
        <div className="container mx-auto py-8 space-y-8">
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-3xl font-bold mb-2">{project.projectNumber} - {project.name}</h1>
                    <div className="text-muted-foreground space-y-1">
                        <div>Status: {project.status}</div>
                        <div>Total Material: <span className="font-bold">€{totalProjectCost.toFixed(2)}</span></div>
                        {totalScrapValue > 0 && (
                            <div className="text-sm text-muted-foreground/80">
                                Less Scrap ({totalScrapWeight.toFixed(1)}kg @ ~€{typeof scrapPrice === 'number' ? scrapPrice.toFixed(2) : '0.00'}/kg): <span className="text-green-600">-€{totalScrapValue.toFixed(2)}</span>
                            </div>
                        )}
                        <div className="text-xl mt-2 font-bold border-t pt-2 w-fit">
                            Net Project Cost: <span className="text-blue-600">€{netCost.toFixed(2)}</span>
                        </div>
                    </div>
                </div>
                <div className="flex gap-4 items-center">
                    {missingCertCount > 0 ? (
                        <div className="group relative flex items-center gap-2 px-4 py-2 bg-destructive/10 text-destructive rounded-md cursor-not-allowed border border-destructive/20 select-none">
                            <FileWarning className="h-4 w-4" />
                            <span>Download Disabled</span>
                            <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-64 p-2 bg-black text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                                Missing {missingCertCount} certificate(s). Please upload them to enable download.
                            </div>
                        </div>
                    ) : (
                        <DownloadCertificatesButton projectId={project.id} projectNumber={project.projectNumber} />
                    )}
                </div>
            </div>

            {/* Summary Section */}
            <Card>
                <CardHeader><CardTitle>Material Summary</CardTitle></CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Material Profile</TableHead>
                                <TableHead>Total Items Used</TableHead>
                                <TableHead>Total Length (approx)</TableHead>
                                <TableHead>Total Cost</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {materialSummary.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={4} className="text-center text-muted-foreground">No materials used.</TableCell>
                                </TableRow>
                            ) : (
                                materialSummary.map((stat: any) => (
                                    <TableRow key={stat.profile}>
                                        <TableCell className="font-medium">{stat.profile}</TableCell>
                                        <TableCell>{stat.count}</TableCell>
                                        <TableCell>{stat.totalLength.toFixed(0)} mm</TableCell>
                                        <TableCell>€{stat.totalCost.toFixed(2)}</TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* Detailed Log Section */}
            <Card>
                <CardHeader><CardTitle>Usage Log</CardTitle></CardHeader>
                <CardContent>
                    <div className="border rounded-md">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Date</TableHead>
                                    <TableHead>User</TableHead>
                                    <TableHead>Item ID</TableHead>
                                    <TableHead>Material</TableHead>
                                    <TableHead>Length Used</TableHead>
                                    <TableHead>Cost</TableHead>
                                    <TableHead>Certificate</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {project.usages.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="text-center py-8">No usage recorded yet.</TableCell>
                                    </TableRow>
                                ) : (
                                    project.usages.map((usage: any) => (
                                        usage.lines.map((line: any) => (
                                            <TableRow key={line.id}>
                                                <TableCell>{new Date(usage.date).toLocaleDateString()}</TableCell>
                                                <TableCell>{usage.createdBy || usage.userId}</TableCell>
                                                <TableCell className="font-mono">
                                                    {line.inventory?.lotId || line.remnant?.id || 'N/A'}
                                                </TableCell>
                                                <TableCell>
                                                    {line.inventory?.profile ?
                                                        `${line.inventory.profile.type} ${line.inventory.profile.dimensions}` :
                                                        (line.remnant?.profile ? `${line.remnant.profile.type} ${line.remnant.profile.dimensions}` : 'Unknown')}
                                                </TableCell>
                                                <TableCell>
                                                    {line.quantityUsed} x {(line.cost > 0 && (line.inventory?.costPerMeter || line.remnant?.costPerMeter)) ?
                                                        Math.round((line.cost / (line.inventory?.costPerMeter || line.remnant?.costPerMeter || 1)) * 1000 / line.quantityUsed) + 'mm'
                                                        : '?'}
                                                </TableCell>
                                                <TableCell>€{line.cost.toFixed(2)}</TableCell>
                                                <TableCell>
                                                    {line.inventory ? (
                                                        <div className="flex items-center gap-2">
                                                            <InventoryCertActions id={line.inventory.id} certificate={line.certificate} />
                                                            {line.isMissingCertificate && (
                                                                <span className="inline-flex items-center rounded-full border border-red-200 bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-800">
                                                                    Missing
                                                                </span>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        // Remnant Logic
                                                        !line.isMissingCertificate && line.certificate ? (
                                                            <div className="flex items-center gap-2">
                                                                <FileViewer bucketName="certificates" path={line.certificate} fileName="View Cert" />
                                                                <span className="inline-flex items-center rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-[10px] font-medium text-green-700">
                                                                    Linked
                                                                </span>
                                                            </div>
                                                        ) : (
                                                            <div className="flex items-center gap-1 text-red-500 text-xs font-medium">
                                                                <AlertTriangle className="h-3 w-3" />
                                                                <span>Missing (Main Lot)</span>
                                                            </div>
                                                        )
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
