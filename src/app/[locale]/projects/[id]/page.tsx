import { getProjectWithStats } from "@/app/actions/projects"
import { getProjectParts } from "@/app/actions/parts"
import { getProjectAssemblies } from "@/app/actions/assemblies"
import { getProjectWorkOrders } from "@/app/actions/workorders"
import { getProjectQualityChecks } from "@/app/actions/quality"
import { getProjectPlateParts } from "@/app/actions/plateparts"
import { getProjectDeliverySchedules } from "@/app/actions/deliveries"
import prisma from "@/lib/prisma"

import { notFound } from "next/navigation"
import type { UnifiedPartItem } from "@/components/project/unified-parts-table"
import { ProjectDetailsView } from "./project-details-view"

export default async function ProjectDashboard({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const cleanId = decodeURIComponent(id).trim()

    const [project, parts, assemblies, workOrders, qualityChecks, plateParts, deliveries, profiles, grades, inventoryStock, standardProfiles, shapes] =
        await Promise.all([
            getProjectWithStats(cleanId),
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
        notFound()
    }

    type PartData = { pieces: { status: string }[] }
    const totalPieces = parts.reduce((sum: number, p: PartData) => sum + p.pieces.length, 0)
    const readyPieces = parts.reduce((sum: number, p: PartData) => sum + p.pieces.filter((pc: { status: string }) => pc.status === 'READY').length, 0)
    const overallProgress = totalPieces > 0 ? Math.round((readyPieces / totalPieces) * 100) : 0

    const inventoryMap = inventoryStock.map((i: { profileId: string; _sum: { quantityAtHand: number | null } }) => ({
        profileId: i.profileId,
        quantity: i._sum.quantityAtHand || 0
    }))

    const {
        missingCertCount = 0,
    } = project.stats || {}

    // Grouping
    const inHouseItems: UnifiedPartItem[] = [
        ...parts.filter((p: any) => !p.isOutsourcedCut).map((p: any) => ({ kind: 'part' as const, data: p })),
        ...plateParts.filter((p: any) => !p.isOutsourced).map((p: any) => ({ kind: 'plate' as const, data: p }))
    ].sort((a, b) => a.data.partNumber.localeCompare(b.data.partNumber, undefined, { numeric: true }))

    const outsourcedItems: UnifiedPartItem[] = [
        ...parts.filter((p: any) => p.isOutsourcedCut).map((p: any) => ({ kind: 'part' as const, data: p })),
        ...plateParts.filter((p: any) => p.isOutsourced).map((p: any) => ({ kind: 'plate' as const, data: p }))
    ].sort((a, b) => a.data.partNumber.localeCompare(b.data.partNumber, undefined, { numeric: true }))

    return (
        <ProjectDetailsView
            project={project}
            cleanId={cleanId}
            overallProgress={overallProgress}
            readyPieces={readyPieces}
            totalPieces={totalPieces}
            missingCertCount={missingCertCount}
            inHouseItems={inHouseItems}
            outsourcedItems={outsourcedItems}
            assemblies={assemblies}
            workOrders={workOrders}
            qualityChecks={qualityChecks}
            deliveries={deliveries}
            profiles={profiles}
            standardProfiles={standardProfiles}
            grades={grades}
            shapes={shapes}
            inventoryMap={inventoryMap}
            parts={parts}
        />
    )
}
