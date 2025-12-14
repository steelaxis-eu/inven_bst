import { getProject } from "@/app/actions/projects"
import { getSettings } from "@/app/actions/settings"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import Link from "next/link"

export default async function ProjectDashboard({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const cleanId = decodeURIComponent(id).trim() // Handle potential %20 or spaces

    let project = null
    let settings = null
    try {
        project = await getProject(cleanId)
        settings = await getSettings()
    } catch (e) { }

    if (!project) return <div className="p-8 text-center text-red-500">Project "{cleanId}" not found. Please check the URL.</div>

    // Calculate Totals
    let totalProjectCost = 0
    const summaryMap = new Map<string, { profile: string, totalLength: number, totalCost: number, count: number }>()

    project.usages.forEach((usage: any) => {
        usage.lines.forEach((line: any) => {
            const cost = line.cost || 0
            totalProjectCost += cost

            // Identify Profile (Existing logic)
            const item = line.inventory || line.remnant
            const profileName = item?.profile ? `${item.profile.type} ${item.profile.dimensions}` : 'Unknown'
            const costPerMeter = item?.costPerMeter || 0
            const estimatedLength = costPerMeter > 0 ? (cost / costPerMeter) * 1000 : 0

            const existing = summaryMap.get(profileName) || { profile: profileName, totalLength: 0, totalCost: 0, count: 0 }
            summaryMap.set(profileName, {
                ...existing,
                totalLength: existing.totalLength + estimatedLength,
                totalCost: existing.totalCost + cost,
                count: existing.count + 1
            })
        })
    })

    // Calculate Scrap Recovery
    let totalScrapValue = 0
    let totalScrapWeight = 0
    const scrapPrice = settings?.scrapPricePerKg || 0

    // Check remnants produced by this project
    // Note: getProject now includes 'remnants' relation
    const scraps = project.remnants?.filter((r: any) => r.status === 'SCRAP') || []

    scraps.forEach((scrap: any) => {
        if (scrap.profile && scrap.profile.weightPerMeter) {
            const weight = (scrap.length / 1000) * scrap.profile.weightPerMeter
            totalScrapWeight += weight
            totalScrapValue += weight * scrapPrice
        }
    })

    const netCost = totalProjectCost - totalScrapValue

    return (
        <div className="container mx-auto py-8 space-y-8">
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-3xl font-bold mb-2">{project.projectNumber} - {project.name}</h1>
                    <div className="text-gray-500 space-y-1">
                        <div>Status: {project.status}</div>
                        <div>Total Material: <span className="font-bold">€{totalProjectCost.toFixed(2)}</span></div>
                        {totalScrapValue > 0 && (
                            <div className="text-sm text-gray-400">
                                Less Scrap ({totalScrapWeight.toFixed(1)}kg @ €{scrapPrice}/kg): <span className="text-green-600">-€{totalScrapValue.toFixed(2)}</span>
                            </div>
                        )}
                        <div className="text-xl mt-2 font-bold border-t pt-2 w-fit">
                            Net Project Cost: <span className="text-blue-600">€{netCost.toFixed(2)}</span>
                        </div>
                    </div>
                </div>
                <div className="flex gap-4">
                    <a href={`/api/projects/${project.id}/certificates/zip`} download>
                        <Button>Download Certs (ZIP)</Button>
                    </a>
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
                            {summaryMap.size === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={4} className="text-center text-gray-400">No materials used.</TableCell>
                                </TableRow>
                            ) : (
                                Array.from(summaryMap.values()).map((stat) => (
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
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {project.usages.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center py-8">No usage recorded yet.</TableCell>
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
