'use server'

import prisma from '@/lib/prisma'

export async function getActiveProjects() {
    return await prisma.project.findMany({
        where: { status: 'ACTIVE' },
        orderBy: { projectNumber: 'asc' }
    })
}



export async function createProject(data: { number: string, name: string }) {
    if (!data.number || !data.name) return { success: false, error: 'Missing fields' }

    try {
        await prisma.project.create({
            data: {
                projectNumber: data.number,
                name: data.name,
                status: 'ACTIVE',
                createdBy: 'System', // Replace with session user if auth enabled
                modifiedBy: 'System'
            }
        })
        return { success: true }
    } catch (e: any) {
        if (e.code === 'P2002') return { success: false, error: 'Project Number already exists' }
        return { success: false, error: e.message }
    }
}

export async function archiveProject(id: string) {
    try {
        await prisma.project.update({
            where: { id },
            data: { status: 'ARCHIVED' }
        })
        return { success: true }
    } catch (e: any) {
        return { success: false, error: e.message }
    }
}

export async function getProject(id: string) {
    console.log(`[getProject] Fetching project with ID: "${id}"`) // Server log for debug

    // Try exact match first
    let project = await prisma.project.findUnique({
        where: { id },
        include: {
            usages: {
                include: {
                    lines: {
                        include: {
                            inventory: { include: { profile: true } },
                            remnant: { include: { profile: true } }
                        }
                    }
                }
            },
            remnants: {
                include: {
                    profile: true,
                    grade: true
                }
            }
        }
    })

    // If not found, try robust fallback (trim, first)
    if (!project) {
        console.log(`[getProject] Exact match failed for "${id}". Trying robust search...`)
        const cleanId = id.trim()
        project = await prisma.project.findFirst({
            where: { id: cleanId },
            include: {
                usages: {
                    include: {
                        lines: {
                            include: {
                                inventory: { include: { profile: true } },
                                remnant: { include: { profile: true } }
                            }
                        }
                    }
                },
                remnants: {
                    include: {
                        profile: true,
                        grade: true
                    }
                }
            }
        })
    }

    if (!project) return null

    // Fetch settings - REMOVED (Scrap price is now per grade)
    // const settings = await prisma.globalSettings.findUnique({ where: { id: 'settings' } })
    // const scrapPrice = settings?.scrapPricePerKg || 0

    // --- Business Logic: Calculations & Cert Resolution ---

    // 1. Collect all Remnant Root IDs
    const remnantRootLotIds = new Set<string>()
    let totalProjectCost = 0
    const summaryMap = new Map<string, { profile: string, totalLength: number, totalCost: number, count: number }>()

    project.usages.forEach(u => {
        u.lines.forEach(l => {
            // Cost Calc
            const cost = l.cost || 0
            totalProjectCost += cost

            // Remnant Cert ID Collection
            if (l.remnant && l.remnant.rootLotId) {
                remnantRootLotIds.add(l.remnant.rootLotId)
            }

            // Summary Calc
            const item = l.inventory || l.remnant
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

    // 2. Fetch Parent Inventories
    const parentMap = new Map<string, string | null>()
    if (remnantRootLotIds.size > 0) {
        const parents = await prisma.inventory.findMany({
            where: { lotId: { in: Array.from(remnantRootLotIds) } },
            select: { lotId: true, certificateFilename: true }
        })
        parents.forEach(p => parentMap.set(p.lotId, p.certificateFilename))
    }

    // 3. Enhance Usages and Calc Stats
    let missingCertCount = 0
    const enrichedUsages = project.usages.map(u => ({
        ...u,
        lines: u.lines.map(l => {
            let certificate = null
            let isMissing = false

            if (l.inventory) {
                certificate = l.inventory.certificateFilename
                if (!certificate) isMissing = true
            } else if (l.remnant) {
                certificate = parentMap.get(l.remnant.rootLotId) || null
                if (!certificate) isMissing = true
            }

            if (isMissing) missingCertCount++

            return {
                ...l,
                certificate,
                isMissingCertificate: isMissing
            }
        })
    }))

    // 4. Scrap Calc
    let totalScrapValue = 0
    let totalScrapWeight = 0
    const scraps = project.remnants?.filter(r => r.status === 'SCRAP') || []
    scraps.forEach(scrap => {
        if (scrap.profile && scrap.profile.weightPerMeter) {
            const weight = (scrap.length / 1000) * scrap.profile.weightPerMeter
            totalScrapWeight += weight

            // Use grade-specific scrap price if available, otherwise 0
            const price = (scrap as any).grade?.scrapPrice || 0
            totalScrapValue += weight * price
        }
    })

    const netCost = totalProjectCost - totalScrapValue

    return {
        ...project,
        usages: enrichedUsages,
        stats: {
            missingCertCount,
            totalProjectCost,
            totalScrapValue,
            totalScrapWeight,
            netCost,
            materialSummary: Array.from(summaryMap.values()),
            scrapPrice: 0 // No single global price anymore
        }
    }
}
