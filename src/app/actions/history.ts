'use server'

import prisma from '@/lib/prisma'

export async function getGlobalUsageHistory() {
    const usageLines = await prisma.usageLine.findMany({
        include: {
            usage: { include: { project: true } },
            inventory: { include: { profile: true } },
            remnant: { include: { profile: true } },
            project: true // Override project
        },
        orderBy: { usage: { date: 'desc' } }
    })

    return usageLines.map(line => {
        const item = line.inventory || line.remnant
        // Determine effective project
        const project = line.project || line.usage.project

        return {
            id: line.id,
            date: line.usage.date,
            user: line.usage.userId,
            projectName: project ? `${project.projectNumber} ${project.name}` : 'Unknown',
            itemId: line.inventory?.lotId || line.remnant?.id || '?',
            profile: item ? `${item.profile.type} ${item.profile.dimensions}` : '?',
            source: line.inventory ? 'Inventory' : 'Remnant',
            quantityUsed: line.quantityUsed,
            createdBy: line.usage.createdBy // From usage model
        }
    })
}
