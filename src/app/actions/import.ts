'use server'

import prisma from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { getCurrentUserId } from '@/lib/auth'

export interface ImportInventoryItem {
    lotId: string
    profileType: string
    dimensions: string
    grade: string
    lengthMm: number
    quantity: number
    totalCost: number
    certificate: string
    supplier?: string
    invoiceNumber?: string
}

export interface ImportResult {
    success: boolean
    created: number
    errors: string[]
}

export async function importInventoryBatch(items: ImportInventoryItem[]): Promise<ImportResult> {
    const errors: string[] = []
    let created = 0
    const userId = await getCurrentUserId()

    for (const item of items) {
        try {
            // Find or create profile
            let profile = await prisma.steelProfile.findFirst({
                where: { type: item.profileType, dimensions: item.dimensions }
            })

            if (!profile) {
                // Check if it exists in standard profiles and use weight from there
                const stdProfile = await prisma.standardProfile.findFirst({
                    where: { type: item.profileType, dimensions: item.dimensions }
                })

                profile = await prisma.steelProfile.create({
                    data: {
                        type: item.profileType,
                        dimensions: item.dimensions,
                        weightPerMeter: stdProfile?.weightPerMeter || 0
                    }
                })
            }

            // Find grade
            const grade = await prisma.materialGrade.findFirst({
                where: { name: { equals: item.grade, mode: 'insensitive' } }
            })

            if (!grade) {
                errors.push(`Row ${item.lotId}: Grade "${item.grade}" not found`)
                continue
            }

            // Find supplier if provided
            let supplierId: string | null = null
            if (item.supplier) {
                const supplier = await prisma.supplier.findFirst({
                    where: { name: { equals: item.supplier, mode: 'insensitive' } }
                })
                if (supplier) {
                    supplierId = supplier.id
                } else {
                    errors.push(`Row ${item.lotId}: Supplier "${item.supplier}" not found (row still imported without supplier)`)
                }
            }

            // Calculate cost per meter
            const totalLengthM = (item.lengthMm * item.quantity) / 1000
            const costPerMeter = totalLengthM > 0 ? item.totalCost / totalLengthM : 0

            // Check for duplicate lot ID
            const existing = await prisma.inventory.findUnique({
                where: { lotId: item.lotId }
            })

            if (existing) {
                errors.push(`Row ${item.lotId}: Lot ID already exists (skipped)`)
                continue
            }

            // Create inventory
            await prisma.inventory.create({
                data: {
                    lotId: item.lotId,
                    profileId: profile.id,
                    gradeId: grade.id,
                    supplierId,
                    invoiceNumber: item.invoiceNumber || null,
                    length: item.lengthMm,
                    quantityReceived: item.quantity,
                    quantityAtHand: item.quantity,
                    costPerMeter,
                    certificateFilename: item.certificate || null,
                    status: 'ACTIVE',
                    createdBy: userId,
                    modifiedBy: userId
                }
            })

            created++
        } catch (e: any) {
            errors.push(`Row ${item.lotId}: ${e.message}`)
        }
    }

    revalidatePath('/inventory')
    revalidatePath('/stock')

    return {
        success: created > 0 || errors.length === 0,
        created,
        errors
    }
}
