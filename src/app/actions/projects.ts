'use server'

import prisma from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { ProjectStatus, RemnantStatus, ProjectPriority } from '@prisma/client'

export interface GetProjectsParams {
    page?: number
    limit?: number
    search?: string
}

export async function getActiveProjects(params: GetProjectsParams = {}) {
    const page = params.page || 1
    const limit = params.limit || 50
    const search = params.search || ''

    const skip = (page - 1) * limit

    const where: any = {
        status: ProjectStatus.ACTIVE
    }

    if (search) {
        where.OR = [
            { name: { contains: search, mode: 'insensitive' } },
            { projectNumber: { contains: search, mode: 'insensitive' } },
            { customer: { companyName: { contains: search, mode: 'insensitive' } } }
        ]
    }

    const [data, total] = await Promise.all([
        prisma.project.findMany({
            where,
            orderBy: { projectNumber: 'asc' },
            include: { customer: true },
            skip,
            take: limit
        }),
        prisma.project.count({ where })
    ])

    return {
        data,
        total,
        page,
        totalPages: Math.ceil(total / limit)
    }
}



export interface CreateProjectInput {
    number?: string
    name: string
    customerId?: string
    coatingType?: string
    corrosionCategory?: string
    corrosionDurability?: string
    corrosionComments?: string
    contractDate?: Date
    estimatedHours?: number
    deliveryDate?: Date
}

import { generateNextId } from './settings'

export async function createProject(data: CreateProjectInput) {
    const user = await getCurrentUser()
    if (!user) return { success: false, error: 'Unauthorized' }
    if (!data.name) return { success: false, error: 'Project name is required' }

    try {
        const projectNumber = data.number || await generateNextId('PROJECT')

        await prisma.project.create({
            data: {
                projectNumber: projectNumber,
                name: data.name,
                customerId: data.customerId || null,
                coatingType: data.coatingType,
                corrosionCategory: data.corrosionCategory,
                corrosionDurability: data.corrosionDurability,
                corrosionComments: data.corrosionComments,
                contractDate: data.contractDate,
                estimatedHours: data.estimatedHours ? parseFloat(data.estimatedHours.toString()) : null,
                deliveryDate: data.deliveryDate,
                status: ProjectStatus.ACTIVE,
                createdBy: user.name || 'System',
                modifiedBy: user.name || 'System'
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
        const user = await getCurrentUser()
        if (!user) return { success: false, error: 'Unauthorized' }

        await prisma.project.update({
            where: { id },
            data: { status: ProjectStatus.ARCHIVED, modifiedBy: user.name || 'System' }
        })
        return { success: true }
    } catch (e: any) {
        return { success: false, error: e.message }
    }
}

export interface UpdateProjectInput {
    name?: string
    client?: string
    customerId?: string
    description?: string
    priority?: ProjectPriority
    coatingType?: string
    coatingSpec?: string
    corrosionCategory?: string
    corrosionDurability?: string
    corrosionComments?: string
    contractDate?: Date | null
    estimatedHours?: number | null
    deliveryDate?: Date | null
    scheduledStart?: Date | null
    scheduledEnd?: Date | null
}

export async function updateProject(id: string, data: UpdateProjectInput) {
    try {
        const user = await getCurrentUser()
        if (!user) return { success: false, error: 'Unauthorized' }

        await prisma.project.update({
            where: { id },
            data: {
                ...(data as any),
                modifiedBy: user.name || 'System'
            }
        })
        return { success: true }
    } catch (e: any) {
        return { success: false, error: e.message }
    }
}

export async function getProject(id: string) {
    const cleanId = id.trim()
    return await prisma.project.findFirst({
        where: { OR: [{ id: cleanId }, { id }] },
        include: { customer: true }
    })
}

export async function getProjectWithStats(id: string) {
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
    const scraps = project.remnants?.filter(r => r.status === RemnantStatus.SCRAP) || []
    scraps.forEach(scrap => {
        if (scrap.profile && scrap.profile.weightPerMeter) {
            const weight = (scrap.length / 1000) * scrap.profile.weightPerMeter
            totalScrapWeight += weight

            // Use grade-specific scrap price if available, otherwise 0
            const price = (scrap as any).grade?.scrapPrice || 0
            totalScrapValue += weight * price
        }
    })

    const averageScrapPrice = totalScrapWeight > 0 ? (totalScrapValue / totalScrapWeight) : 0

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
            scrapPrice: averageScrapPrice
        }
    }
}
