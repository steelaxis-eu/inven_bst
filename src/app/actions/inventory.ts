'use server'

import prisma from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

export async function getInventory() {
    return await prisma.inventory.findMany({
        where: { status: 'ACTIVE' },
        include: { profile: true },
        orderBy: { lotId: 'asc' }
    })
}

export async function getStandardProfiles() {
    return await prisma.standardProfile.findMany({
        orderBy: [{ type: 'asc' }, { dimensions: 'asc' }]
    })
}

export async function getGrades() {
    return await prisma.materialGrade.findMany({
        orderBy: { name: 'asc' }
    })
}

export async function getProfiles() {
    return await prisma.steelProfile.findMany({
        orderBy: { type: 'asc' }
    })
}

export async function updateProfileWeight(id: string, weight: number) {
    await prisma.steelProfile.update({
        where: { id },
        data: { weightPerMeter: weight }
    })
    revalidatePath('/settings')
}

export async function createInventory(data: {
    lotId: string,
    profileId: string,
    length: number,
    quantity: number,
    certificate: string,
    totalCost: number
}) {
    const totalLengthMeters = (data.length * data.quantity) / 1000
    const costPerMeter = totalLengthMeters > 0 ? data.totalCost / totalLengthMeters : 0

    await prisma.inventory.create({
        data: {
            lotId: data.lotId,
            profileId: data.profileId,
            length: data.length,
            quantityReceived: data.quantity,
            quantityAtHand: data.quantity, // Initially same
            costPerMeter: costPerMeter,
            certificateFilename: data.certificate,
            status: 'ACTIVE',
            createdBy: 'System', // TODO: Get real user
            modifiedBy: 'System'
        }
    })
    revalidatePath('/inventory')
    revalidatePath('/stock') // It affects stock search too
}

export async function updateInventoryCertificate(id: string, path: string) {
    try {
        await prisma.inventory.update({
            where: { id },
            data: { certificateFilename: path }
        })
        return { success: true }
    } catch (e: any) {
        return { success: false, error: e.message }
    }
}

export async function deleteInventory(id: string) {
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
    status: string
}) {
    try {
        await prisma.inventory.update({
            where: { id },
            data: {
                lotId: data.lotId,
                length: data.length,
                quantityAtHand: data.quantityAtHand,
                status: data.status
            }
        })
        revalidatePath('/inventory')
        revalidatePath('/stock')
        return { success: true }
    } catch (e: any) {
        return { success: false, error: e.message }
    }
}

export async function createProfile(data: { type: string, dimensions: string, grade: string }) {
    const profile = await prisma.steelProfile.create({
        data: {
            type: data.type,
            dimensions: data.dimensions,
            grade: data.grade,
            weightPerMeter: 0
        }
    })
    revalidatePath('/inventory')
    return profile
}

export async function ensureProfile(data: { type: string, dimensions: string, grade: string, weight?: number }) {
    // Check if exists
    let profile = await prisma.steelProfile.findFirst({
        where: {
            type: data.type,
            dimensions: data.dimensions,
            grade: data.grade
        }
    })

    if (!profile) {
        // Create
        profile = await prisma.steelProfile.create({
            data: {
                type: data.type,
                dimensions: data.dimensions,
                grade: data.grade,
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
    lotId: string,
    profileId: string,
    length: number,
    quantity: number,
    certificate: string,
    totalCost: number
}[]) {
    // We can do a transaction for safety
    try {
        await prisma.$transaction(async (tx) => {
            for (const data of items) {
                const totalLengthMeters = (data.length * data.quantity) / 1000
                const costPerMeter = totalLengthMeters > 0 ? data.totalCost / totalLengthMeters : 0

                await tx.inventory.create({
                    data: {
                        lotId: data.lotId,
                        profileId: data.profileId,
                        length: data.length,
                        quantityReceived: data.quantity,
                        quantityAtHand: data.quantity,
                        costPerMeter: costPerMeter,
                        certificateFilename: data.certificate,
                        status: 'ACTIVE',
                        createdBy: 'System',
                        modifiedBy: 'System'
                    }
                })
            }
        })

        revalidatePath('/inventory')
        revalidatePath('/stock')
        return { success: true }
    } catch (e: any) {
        return { success: false, error: e.message }
    }
}
