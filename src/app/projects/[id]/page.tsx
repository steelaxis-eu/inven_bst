import { getProject } from "@/app/actions/projects"
import { getProjectParts } from "@/app/actions/parts"
import { getProjectAssemblies } from "@/app/actions/assemblies"
import { getProjectWorkOrders } from "@/app/actions/workorders"
import { getProjectQualityChecks } from "@/app/actions/quality"
import { getProjectPlateParts } from "@/app/actions/plateparts"
import { getProjectDeliverySchedules } from "@/app/actions/deliveries"
import prisma from "@/lib/prisma"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { DownloadCertificatesButton } from "@/components/download-certificates-button"

import { PartsTable } from "@/components/project/parts-table"
import { CreatePartDialog } from "@/components/project/create-part-dialog"
import { CreateAssemblyDialog } from "@/components/project/create-assembly-dialog"
import { EditProjectDialog } from "@/components/project/edit-project-dialog"
import { AssembliesTree, AssemblySummary } from "@/components/project/assemblies-tree"
import { WorkOrdersList, WorkOrderSummary } from "@/components/project/workorders-list"
import { QualityChecksList, QualitySummary } from "@/components/project/quality-checks-list"
import { PlatePartsTable, PlatePartsSummary } from "@/components/project/plate-parts-table"
import { DeliveriesList, DeliveriesSummary } from "@/components/project/deliveries-list"

import {
    Package, Layers, ClipboardList, Shield,
    Truck, FileWarning, BarChart3, Scissors
} from "lucide-react"

export default async function ProjectDashboard({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const cleanId = decodeURIComponent(id).trim()

    // Fetch all project data in parallel
    const [project, parts, assemblies, workOrders, qualityChecks, plateParts, deliveries, profiles, grades, inventoryStock, standardProfiles, shapes] =
        await Promise.all([
            getProject(cleanId),
            getProjectParts(cleanId),
            getProjectAssemblies(cleanId),
            getProjectWorkOrders(cleanId),
            getProjectQualityChecks(cleanId),
            getProjectPlateParts(cleanId),
            getProjectDeliverySchedules(cleanId),
            prisma.steelProfile.findMany({ orderBy: { type: 'asc' } }),
            prisma.materialGrade.findMany({ orderBy: { name: 'asc' } }),
            prisma.inventory.groupBy({
                by: ['profileId'],
                _sum: { quantityAtHand: true }
            }),
            prisma.standardProfile.findMany({ orderBy: [{ type: 'asc' }, { dimensions: 'asc' }] }),
            prisma.profileShape.findMany()
        ])

    if (!project) {
        return (
            <div className="p-8 text-center text-red-500">
                Project "{cleanId}" not found. Please check the URL.
            </div>
        )
    }

    // Calculate overall progress
    type PartData = { pieces: { status: string }[] }
    const totalPieces = parts.reduce((sum: number, p: PartData) => sum + p.pieces.length, 0)
    const readyPieces = parts.reduce((sum: number, p: PartData) => sum + p.pieces.filter((pc: { status: string }) => pc.status === 'READY').length, 0)
    const overallProgress = totalPieces > 0 ? Math.round((readyPieces / totalPieces) * 100) : 0

    // Map inventory stock for dialog
    const inventoryMap = inventoryStock.map((i: { profileId: string; _sum: { quantityAtHand: number | null } }) => ({
        profileId: i.profileId,
        quantity: i._sum.quantityAtHand || 0
    }))

    // Stats from existing project data
    const {
        missingCertCount = 0,
        totalProjectCost = 0,
        totalScrapValue = 0,
        netCost = 0,
    } = project.stats || {}

    return (
        <div className="container mx-auto py-6 space-y-6">
            {/* Header */}
            <div className="flex justify-between items-start">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <h1 className="text-3xl font-bold">{project.projectNumber}</h1>
                        <Badge variant="outline" className="text-sm">
                            {project.status}
                        </Badge>
                    </div>
                    <p className="text-xl text-muted-foreground">{project.name}</p>
                    {project.client && (
                        <p className="text-sm text-muted-foreground">Client: {project.client}</p>
                    )}
                    {project.coatingType && (
                        <p className="text-sm text-muted-foreground">
                            Coating: <span className="font-medium">{project.coatingType}</span>
                            {project.coatingSpec && ` - ${project.coatingSpec}`}
                        </p>
                    )}
                </div>
                <div className="flex gap-4 items-center">
                    {missingCertCount > 0 ? (
                        <div className="flex items-center gap-2 px-4 py-2 bg-destructive/10 text-destructive rounded-md border border-destructive/20">
                            <FileWarning className="h-4 w-4" />
                            <span>{missingCertCount} missing certs</span>
                        </div>
                    ) : (
                        <DownloadCertificatesButton projectId={project.id} projectNumber={project.projectNumber} />
                    )}
                    <EditProjectDialog project={{
                        id: project.id,
                        name: project.name,
                        client: project.client,
                        description: project.description,
                        priority: project.priority,
                        coatingType: project.coatingType,
                        coatingSpec: project.coatingSpec
                    }} />
                </div>
            </div>

            {/* Overview Cards */}
            <div className="grid grid-cols-6 gap-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                            <BarChart3 className="h-4 w-4" /> Progress
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{overallProgress}%</div>
                        <Progress value={overallProgress} className="h-2 mt-2" />
                        <p className="text-xs text-muted-foreground mt-1">{readyPieces}/{totalPieces} pieces</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                            <Package className="h-4 w-4" /> Parts
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{parts.length}</div>
                        <p className="text-xs text-muted-foreground">{totalPieces} total pieces</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                            <Layers className="h-4 w-4" /> Assemblies
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{assemblies.length}</div>
                        <p className="text-xs text-muted-foreground">
                            {(assemblies as { status: string }[]).filter((a: { status: string }) => a.status === 'SHIPPED').length} shipped
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                            <ClipboardList className="h-4 w-4" /> Work Orders
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {(workOrders as { status: string }[]).filter((w: { status: string }) => w.status === 'IN_PROGRESS').length}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            {(workOrders as { status: string }[]).filter((w: { status: string }) => w.status === 'PENDING').length} pending
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                            <Scissors className="h-4 w-4" /> Plates
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{plateParts.length}</div>
                        <p className="text-xs text-muted-foreground">
                            {(plateParts as { status: string }[]).filter((p: { status: string }) => p.status === 'RECEIVED' || p.status === 'QC_PASSED').length} received
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                            <Truck className="h-4 w-4" /> Deliveries
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {(deliveries as { status: string }[]).filter((d: { status: string }) => d.status === 'PENDING').length}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            {(deliveries as { status: string }[]).filter((d: { status: string }) => d.status === 'DELIVERED').length} completed
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Tabs */}
            <Tabs defaultValue="parts" className="w-full">
                <TabsList className="grid w-full grid-cols-7">
                    <TabsTrigger value="parts" className="gap-2">
                        <Package className="h-4 w-4" /> Parts
                    </TabsTrigger>
                    <TabsTrigger value="assemblies" className="gap-2">
                        <Layers className="h-4 w-4" /> Assemblies
                    </TabsTrigger>
                    <TabsTrigger value="workorders" className="gap-2">
                        <ClipboardList className="h-4 w-4" /> Work Orders
                    </TabsTrigger>
                    <TabsTrigger value="quality" className="gap-2">
                        <Shield className="h-4 w-4" /> Quality
                    </TabsTrigger>
                    <TabsTrigger value="plates" className="gap-2">
                        <Scissors className="h-4 w-4" /> Plates
                    </TabsTrigger>
                    <TabsTrigger value="deliveries" className="gap-2">
                        <Truck className="h-4 w-4" /> Deliveries
                    </TabsTrigger>
                    <TabsTrigger value="usage" className="gap-2">
                        <BarChart3 className="h-4 w-4" /> Usage
                    </TabsTrigger>
                </TabsList>

                {/* Parts Tab */}
                <TabsContent value="parts" className="mt-6">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-semibold">Bill of Materials</h2>
                        <CreatePartDialog
                            projectId={cleanId}
                            profiles={profiles.map((p: { id: string; type: string; dimensions: string; weightPerMeter: number }) => ({ id: p.id, type: p.type, dimensions: p.dimensions, weightPerMeter: p.weightPerMeter }))}
                            standardProfiles={standardProfiles.map((p: { type: string; dimensions: string; weightPerMeter: number }) => ({ type: p.type, dimensions: p.dimensions, weightPerMeter: p.weightPerMeter }))}
                            grades={grades.map((g: { id: string; name: string }) => ({ id: g.id, name: g.name }))}
                            shapes={shapes.map((s: { id: string; params: unknown; formula: string | null }) => ({ id: s.id, params: (s.params as string[]) || [], formula: s.formula }))}
                            inventory={inventoryMap}
                        />
                    </div>
                    <PartsTable parts={parts as any} projectId={cleanId} />
                </TabsContent>

                {/* Assemblies Tab */}
                <TabsContent value="assemblies" className="mt-6">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-semibold">Assemblies</h2>
                        <CreateAssemblyDialog
                            projectId={cleanId}
                            existingParts={(parts as { id: string; partNumber: string; description: string | null; profile?: { type: string; dimensions: string } | null }[])}
                            existingAssemblies={(assemblies as { id: string; assemblyNumber: string; name: string }[])}
                            profiles={profiles.map((p: { id: string; type: string; dimensions: string; weightPerMeter: number }) => ({ id: p.id, type: p.type, dimensions: p.dimensions, weightPerMeter: p.weightPerMeter }))}
                            standardProfiles={standardProfiles.map((p: { type: string; dimensions: string; weightPerMeter: number }) => ({ type: p.type, dimensions: p.dimensions, weightPerMeter: p.weightPerMeter }))}
                            grades={grades.map((g: { id: string; name: string }) => ({ id: g.id, name: g.name }))}
                            shapes={shapes.map((s: { id: string; params: unknown; formula: string | null }) => ({ id: s.id, params: (s.params as string[]) || [], formula: s.formula }))}
                        />
                    </div>
                    <AssemblySummary assemblies={assemblies as any} />
                    <AssembliesTree assemblies={assemblies as any} projectId={cleanId} />
                </TabsContent>

                {/* Work Orders Tab */}
                <TabsContent value="workorders" className="mt-6">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-semibold">Work Orders</h2>
                    </div>
                    <WorkOrderSummary workOrders={workOrders as any} />
                    <WorkOrdersList workOrders={workOrders as any} />
                </TabsContent>

                {/* Quality Tab */}
                <TabsContent value="quality" className="mt-6">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-semibold">Quality Checks</h2>
                    </div>
                    <QualitySummary checks={qualityChecks as any} />
                    <QualityChecksList checks={qualityChecks as any} />
                </TabsContent>

                {/* Plates Tab */}
                <TabsContent value="plates" className="mt-6">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-semibold">Plate Parts (Outsourced)</h2>
                    </div>
                    <PlatePartsSummary plateParts={plateParts as any} />
                    <PlatePartsTable plateParts={plateParts as any} />
                </TabsContent>

                {/* Deliveries Tab */}
                <TabsContent value="deliveries" className="mt-6">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-semibold">Delivery Schedule</h2>
                    </div>
                    <DeliveriesSummary deliveries={deliveries as any} />
                    <DeliveriesList deliveries={deliveries as any} />
                </TabsContent>

                {/* Usage Tab - Original content */}
                <TabsContent value="usage" className="mt-6">
                    <UsageTab project={project} />
                </TabsContent>
            </Tabs>
        </div>
    )
}

// Original Usage content as a separate component
function UsageTab({ project }: { project: any }) {
    const {
        totalProjectCost = 0,
        totalScrapValue = 0,
        totalScrapWeight = 0,
        netCost = 0,
        materialSummary = [],
        scrapPrice = 0
    } = project.stats || {}

    return (
        <div className="space-y-6">
            {/* Cost Summary */}
            <Card>
                <CardHeader>
                    <CardTitle>Cost Summary</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-4 gap-4">
                        <div>
                            <p className="text-sm text-muted-foreground">Total Material</p>
                            <p className="text-2xl font-bold">€{totalProjectCost.toFixed(2)}</p>
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Scrap Value</p>
                            <p className="text-2xl font-bold text-green-600">-€{totalScrapValue.toFixed(2)}</p>
                            <p className="text-xs text-muted-foreground">{totalScrapWeight.toFixed(1)}kg</p>
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Net Cost</p>
                            <p className="text-2xl font-bold text-blue-600">€{netCost.toFixed(2)}</p>
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Avg Scrap Price</p>
                            <p className="text-2xl font-bold">€{scrapPrice.toFixed(2)}/kg</p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Material Summary */}
            <Card>
                <CardHeader>
                    <CardTitle>Material Summary</CardTitle>
                </CardHeader>
                <CardContent>
                    {materialSummary.length === 0 ? (
                        <p className="text-center text-muted-foreground py-8">No materials used yet.</p>
                    ) : (
                        <div className="space-y-2">
                            {materialSummary.map((stat: any) => (
                                <div
                                    key={stat.profile}
                                    className="flex items-center justify-between p-3 rounded-lg bg-muted/30"
                                >
                                    <span className="font-medium">{stat.profile}</span>
                                    <div className="flex gap-8 text-sm">
                                        <span>{stat.count} items</span>
                                        <span>{stat.totalLength.toFixed(0)} mm</span>
                                        <span className="font-medium">€{stat.totalCost.toFixed(2)}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
