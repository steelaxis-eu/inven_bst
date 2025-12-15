'use server'

import prisma from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

export async function getInventory() {
    return await prisma.inventory.findMany({
        where: { status: 'ACTIVE' },
        include: {
            profile: true,
            grade: true
        },
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
    lotId: string,
    profileId: string,
    gradeName?: string, // If passed name, we resolve it
    gradeId?: string,   // Ideally passed ID
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

                // Resolve Grade
                let gradeId = data.gradeId
                if (!gradeId && data.gradeName) {
                    const g = await tx.materialGrade.findUnique({ where: { name: data.gradeName } })
                    if (g) gradeId = g.id
                }

                if (!gradeId) throw new Error(`Grade not found for item ${data.lotId}`)

                await tx.inventory.create({
                    data: {
                        lotId: data.lotId,
                        profileId: data.profileId,
                        gradeId: gradeId,
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
}    // We can do a transaction for safety
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
