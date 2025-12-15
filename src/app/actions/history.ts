'use server'

import prisma from '@/lib/prisma'

// ... imports
import { getSettings } from './settings'

export async function getGlobalUsageHistory() {
    const usageLines = await prisma.usageLine.findMany({
        include: {
            usage: { include: { project: true } },
            inventory: { include: { profile: true } },
            remnant: { include: { profile: true } },
            project: true
        },
        orderBy: { usage: { date: 'desc' } }
    })

    const settings = await getSettings()
    const scrapPrice = settings?.scrapPricePerKg || 0

    // Collect Root Lot IDs to fetch potential scraps
    const rootLotIds = new Set<string>()
    usageLines.forEach(l => {
        if (l.inventory?.lotId) rootLotIds.add(l.inventory.lotId)
        if (l.remnant?.rootLotId) rootLotIds.add(l.remnant.rootLotId)
    })

    // Fetch related Scrap Remnants
    const potentialScraps = await prisma.remnant.findMany({
        where: {
            status: 'SCRAP',
            rootLotId: { in: Array.from(rootLotIds) }
        },
        include: { profile: true }
    })

    return usageLines.map(line => {
        const item = line.inventory || line.remnant
        const project = line.project || line.usage.project
        const rootLotId = line.inventory?.lotId || line.remnant?.rootLotId

        // Attempt to find generated scrap
        // Heuristic: Created within 5 minutes of usage and matching rootLotId
        // This is imperfect but likely sufficient for single-user scenarios
        let scrapValue = 0
        if (rootLotId) {
            const match = potentialScraps.find(s => {
                const timeDiff = Math.abs(s.createdAt.getTime() - line.usage.date.getTime())
                return s.rootLotId === rootLotId && timeDiff < 1000 * 60 * 5 // 5 mins
            })
            if (match) {
                const weight = (match.length / 1000) * match.profile.weightPerMeter
                scrapValue = weight * scrapPrice
            }
        }

        return {
            id: line.id,
            date: line.usage.date,
            user: line.usage.userId,
            projectName: project ? `${project.projectNumber} ${project.name}` : 'Unknown',
            itemId: line.inventory?.lotId || line.remnant?.id || '?',
            profile: item ? `${item.profile.type} ${item.profile.dimensions}` : '?',
            source: line.inventory ? 'Inventory' : 'Remnant',
            quantityUsed: line.quantityUsed,
            createdBy: line.usage.createdBy,
            scrapValue, // New Field
            // For Editing
            cost: line.cost,
            costPerMeter: item?.costPerMeter || 0,
            originalLength: item?.length || 0,
        }
    })
}
