'use server'

import prisma from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { InventoryStatus } from '@prisma/client'
import { getCurrentUser } from '@/lib/auth'
import { generateNextId, reserveIds } from './settings'

export interface GetInventoryParams {
    page?: number
    limit?: number
    search?: string
}

export async function getInventory(params: GetInventoryParams = {}) {
    // Public read access allowed (or add auth check if needed, but usually read is open or handled by middleware)
    const page = params.page || 1
    const limit = params.limit || 50
    const search = params.search || ''

    const skip = (page - 1) * limit

    const where: any = {
        status: InventoryStatus.ACTIVE
    }

    if (search) {
        where.OR = [
            { lotId: { contains: search, mode: 'insensitive' } },
            { certificateFilename: { contains: search, mode: 'insensitive' } },
            { invoiceNumber: { contains: search, mode: 'insensitive' } },
            {
                profile: {
                    OR: [
                        { type: { contains: search, mode: 'insensitive' } },
                        { dimensions: { contains: search, mode: 'insensitive' } }
                    ]
                }
            },
            {
                grade: {
                    name: { contains: search, mode: 'insensitive' }
                }
            }
        ]
    }

    const [data, total] = await Promise.all([
        prisma.inventory.findMany({
            where,
            include: {
                profile: true,
                grade: true
            },
            orderBy: { lotId: 'asc' },
            skip,
            take: limit
        }),
        prisma.inventory.count({ where })
    ])

    return {
        data,
        total,
        page,
        totalPages: Math.ceil(total / limit)
    }
}


export async function getInventoryItemByLot(lotId: string) {
    return await prisma.inventory.findUnique({
        where: { lotId },
        include: {
            profile: true,
            grade: true
        }
    })
}

export async function getStandardProfiles() {
    return await prisma.standardProfile.findMany({
        orderBy: [{ type: 'asc' }, { dimensions: 'asc' }]
    })
}

export async function getProfileShapes() {
    return await prisma.profileShape.findMany({
        orderBy: { id: 'asc' }
    })
}

export async function getGrades() {
    return await prisma.materialGrade.findMany({
        orderBy: { name: 'asc' }
    })
}

export async function getSuppliers() {
    return await prisma.supplier.findMany({
        orderBy: { name: 'asc' }
    })
}

export async function getProfiles() {
    return await prisma.steelProfile.findMany({
        orderBy: { type: 'asc' }
    })
}

export async function updateProfileWeight(id: string, weight: number) {
    const user = await getCurrentUser()
    if (!user) return { success: false, error: 'Unauthorized' }

    await prisma.steelProfile.update({
        where: { id },
        data: { weightPerMeter: weight }
    })
    revalidatePath('/settings')
    return { success: true }
}

export async function createInventory(data: {
    lotId?: string,
    profileId: string,
    gradeId: string, // Required
    supplierId?: string,
    invoiceNumber?: string,
    length: number,
    quantity: number,
    certificate: string,
    totalCost: number
}) {
    const user = await getCurrentUser()
    if (!user) return { success: false, error: 'Unauthorized' }

    const totalLengthMeters = (data.length * data.quantity) / 1000
    const costPerMeter = totalLengthMeters > 0 ? data.totalCost / totalLengthMeters : 0

    const lotId = data.lotId || await generateNextId('LOT')

    await prisma.inventory.create({
        data: {
            lotId: lotId,
            profileId: data.profileId,
            gradeId: data.gradeId, // New field
            supplierId: data.supplierId || null,
            invoiceNumber: data.invoiceNumber || null,
            length: data.length,
            quantityReceived: data.quantity,
            quantityAtHand: data.quantity, // Initially same
            costPerMeter: costPerMeter,
            certificateFilename: data.certificate,
            status: InventoryStatus.ACTIVE,
            createdBy: user.name || 'System',
            modifiedBy: user.name || 'System'
        }
    })
    revalidatePath('/inventory')
    revalidatePath('/stock') // It affects stock search too
    return { success: true }
}

export async function updateInventoryCertificate(id: string, path: string) {
    const user = await getCurrentUser()
    if (!user) return { success: false, error: 'Unauthorized' }

    try {
        await prisma.inventory.update({
            where: { id },
            data: {
                certificateFilename: path,
                modifiedBy: user.name || 'System'
            }
        })
        return { success: true }
    } catch (e: any) {
        return { success: false, error: e.message }
    }
}

export async function deleteInventory(id: string) {
    const user = await getCurrentUser()
    if (!user) return { success: false, error: 'Unauthorized' }

    try {
        await prisma.inventory.delete({ where: { id } })
        revalidatePath('/inventory')
        revalidatePath('/stock')
        return { success: true }
    } catch (e) {
        return { success: false, error: "Cannot delete item (likely in use)" }
    }
}

export async function updateInventory(id: string, data: {
    lotId: string,
    length: number,
    quantityAtHand: number,
    status: InventoryStatus,
    totalCost?: number
}) {
    const user = await getCurrentUser()
    if (!user) return { success: false, error: 'Unauthorized' }

    try {
        const updateData: any = {
            lotId: data.lotId,
            length: data.length,
            quantityAtHand: data.quantityAtHand,
            status: data.status,
            modifiedBy: user.name || 'System'
        }

        // If total cost is provided, recalculate cost per meter
        if (data.totalCost !== undefined) {
            const totalLengthMeters = (data.length * data.quantityAtHand) / 1000
            const costPerMeter = totalLengthMeters > 0 ? data.totalCost / totalLengthMeters : 0
            updateData.costPerMeter = costPerMeter
        }

        await prisma.inventory.update({
            where: { id },
            data: updateData
        })
        revalidatePath('/inventory')
        revalidatePath('/stock')
        return { success: true }
    } catch (e: any) {
        return { success: false, error: e.message }
    }
}

export async function createProfile(data: { type: string, dimensions: string }) {
    const user = await getCurrentUser()
    if (!user) throw new Error('Unauthorized') // This function returns profile object, so throwing is better or need compatibility

    // Grade removed from profile creation
    const profile = await prisma.steelProfile.create({
        data: {
            type: data.type,
            dimensions: data.dimensions,
            weightPerMeter: 0
        }
    })
    revalidatePath('/inventory')
    return profile
}

// Ensure Profile (Shape) Only
export async function ensureProfile(data: { type: string, dimensions: string, weight?: number }) {
    // Check if exists
    let profile = await prisma.steelProfile.findFirst({
        where: {
            type: data.type,
            dimensions: data.dimensions
        }
    })

    if (!profile) {
        // Create
        profile = await prisma.steelProfile.create({
            data: {
                type: data.type,
                dimensions: data.dimensions,
                weightPerMeter: data.weight || 0
            }
        })
    } else if (data.weight && (!profile.weightPerMeter || profile.weightPerMeter === 0)) {
        // Update weight if it was 0 and we have a new value
        profile = await prisma.steelProfile.update({
            where: { id: profile.id },
            data: { weightPerMeter: data.weight }
        })
    }

    revalidatePath('/inventory')
    return profile
}

export async function createInventoryBatch(items: {
    lotId?: string,
    profileId: string,
    gradeName?: string, // If passed name, we resolve it
    gradeId?: string,   // Ideally passed ID
    supplierId?: string,
    invoiceNumber?: string,
    length: number,
    quantity: number,
    certificate: string,
    totalCost: number
}[]) {
    const user = await getCurrentUser()
    if (!user) return { success: false, error: 'Unauthorized' }

    // We can do a transaction for safety
    try {
        // 1. Resolve Grades in Bulk
        const gradesToResolve = new Set<string>()
        items.forEach(i => {
            if (!i.gradeId && i.gradeName) gradesToResolve.add(i.gradeName)
        })

        const gradeMap = new Map<string, string>()
        if (gradesToResolve.size > 0) {
            const grades = await prisma.materialGrade.findMany({
                where: { name: { in: Array.from(gradesToResolve) } }
            })
            grades.forEach(g => gradeMap.set(g.name, g.id))
        }

        // 2. Reserve IDs for items missing lotId
        const itemsNeedingIds = items.filter(i => !i.lotId)
        let idStartSeq: number = 0
        let idFormat: string = ''

        if (itemsNeedingIds.length > 0) {
            const reservation = await reserveIds('LOT', itemsNeedingIds.length)
            idStartSeq = reservation.startSeq
            idFormat = reservation.format
        }

        // 3. Prepare Data for Bulk Insert
        let idCounter = 0
        const now = new Date()
        const year = now.getFullYear().toString()
        const yy = year.slice(-2)
        const month = (now.getMonth() + 1).toString().padStart(2, '0')
        const day = now.getDate().toString().padStart(2, '0')

        const createData = items.map(data => {
            const totalLengthMeters = (data.length * data.quantity) / 1000
            const costPerMeter = totalLengthMeters > 0 ? data.totalCost / totalLengthMeters : 0

            // Resolve Grade
            let gradeId = data.gradeId
            if (!gradeId && data.gradeName) {
                gradeId = gradeMap.get(data.gradeName)
            }

            if (!gradeId) throw new Error(`Grade not found for item ${data.lotId || 'Unknown'}`)

            let lotId = data.lotId
            if (!lotId) {
                const seq = idStartSeq + idCounter
                idCounter++
                lotId = idFormat
                    .replace('{YYYY}', year)
                    .replace('{YY}', yy)
                    .replace('{MM}', month)
                    .replace('{DD}', day)
                    .replace('{SEQ}', seq.toString().padStart(3, '0'))
            }

            return {
                lotId: lotId,
                profileId: data.profileId,
                gradeId: gradeId,
                supplierId: data.supplierId || null,
                invoiceNumber: data.invoiceNumber || null,
                length: data.length,
                quantityReceived: data.quantity,
                quantityAtHand: data.quantity,
                costPerMeter: costPerMeter,
                certificateFilename: data.certificate,
                status: InventoryStatus.ACTIVE,
                createdBy: user.name || 'System',
                modifiedBy: user.name || 'System'
            }
        })

        await prisma.inventory.createMany({
            data: createData
        })

        revalidatePath('/inventory')
        revalidatePath('/stock')
        return { success: true }
    } catch (e: any) {
        return { success: false, error: e.message }
    }
}

export async function createStandardProfile(data: { type: string, dimensions: string, weight: number, area?: number }) {
    const user = await getCurrentUser()
    if (!user) return { success: false, error: 'Unauthorized' }

    try {
        await prisma.standardProfile.create({
            data: {
                type: data.type,
                dimensions: data.dimensions,
                weightPerMeter: data.weight,
                crossSectionArea: data.area
            }
        })
        revalidatePath('/settings')
        return { success: true }
    } catch (e: any) {
        return { success: false, error: e.message }
    }
}

export async function deleteStandardProfile(id: string) {
    const user = await getCurrentUser()
    if (!user) return { success: false, error: 'Unauthorized' }

    try {
        await prisma.standardProfile.delete({ where: { id } })
        revalidatePath('/settings')
        return { success: true }
    } catch (e: any) {
        return { success: false, error: e.message }
    }
}
