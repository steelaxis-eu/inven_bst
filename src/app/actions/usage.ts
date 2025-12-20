'use server'

import prisma from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

export async function getUsageItem(query: string) {
    if (!query) return null
    const q = query.trim().toUpperCase()

    // 1. Try Inventory
    const inv = await prisma.inventory.findUnique({
        where: { lotId: q },
        include: { profile: true, grade: true }
    })

    if (inv) {
        return {
            type: 'INVENTORY',
            id: inv.id,
            lotId: inv.lotId,
            profile: inv.profile,
            grade: inv.grade,
            length: inv.length,
            quantity: inv.quantityAtHand,
            costPerMeter: inv.costPerMeter
        }
    }

    // 2. Try Remnants
    const rem = await prisma.remnant.findUnique({
        where: { id: q },
        include: { profile: true, grade: true }
    })

    if (rem && rem.status === 'AVAILABLE') {
        return {
            type: 'REMNANT',
            id: rem.id,
            lotId: rem.id, // Remnant ID serves as Lot ID
            profile: rem.profile,
            grade: rem.grade,
            length: rem.length,
            quantity: 1, // Remnants are individual
            costPerMeter: rem.costPerMeter
        }
    }

    return null
}

export async function updateUsageLine(
    usageLineId: string,
    newLengthUsed: number,
    newStatus: 'SCRAP' | 'AVAILABLE' // Remnant or Scrap
) {
    try {
        return await prisma.$transaction(async (tx) => {
            // 1. Fetch Usage Line with Relations
            const usageLine = await tx.usageLine.findUnique({
                where: { id: usageLineId },
                include: {
                    inventory: true,
                    remnant: true,
                }
            })

            if (!usageLine) throw new Error('Usage line not found')

            // Identify Source and Logic
            const source = usageLine.inventory || usageLine.remnant
            if (!source) throw new Error('Source material not found')

            const isRemnantSource = !!usageLine.remnant
            const rootLotId = isRemnantSource ? usageLine.remnant!.rootLotId : usageLine.inventory!.lotId
            const originalLength = isRemnantSource ? usageLine.remnant!.length : usageLine.inventory!.length
            const costPerMeter = source.costPerMeter || 0

            // 2. Reverse Calculate Old State
            const oldCost = usageLine.cost
            // Avoid division by zero
            const oldLengthUsed = costPerMeter > 0 ? (oldCost / costPerMeter) * 1000 : 0
            const oldRemainingLength = originalLength - oldLengthUsed

            // 3. Find Old Remnant (Heuristic: ID = RootLotId-Length)
            const oldRemnantId = `${rootLotId}-${Math.floor(oldRemainingLength)}`
            const oldRemnant = await tx.remnant.findUnique({
                where: { id: oldRemnantId }
            })

            // Safety Check: If old remnant exists and is USED, allow no edits that affect geometry?
            // Actually per requirement: BLOCK if used.
            if (oldRemnant) {
                if (oldRemnant.status === 'USED') {
                    throw new Error('Cannot edit usage: The resulting remnant has already been used in another project.')
                }
            } else {
                // If Old Remnant not found, it might have been fully consumed (if remaining was 0) or manually deleted?
                // If remaining was > 0 and it's gone, data is inconsistent.
                // We will proceed but warn? For now strict.
                if (oldRemainingLength > 1) { // Tolerance
                    // It's possible the ID formula changed or something. 
                    // We can search strictly by rootLotId + approx length?
                    // For now, let's try to proceed only if we don't need to delete it (e.g. if we are creating one now?)
                    // But we need to cleanup old one.
                    console.warn(`Old remnant ${oldRemnantId} not found during edit.`)
                }
            }

            // 4. Update Usage Line
            const newCost = (newLengthUsed / 1000) * costPerMeter
            await tx.usageLine.update({
                where: { id: usageLineId },
                data: {
                    cost: newCost,
                    // We don't store lengthUsed explicitly on UsageLine, so rely on cost.
                }
            })

            // 5. Handle Old Remnant Cleanup
            if (oldRemnant) {
                await tx.remnant.delete({
                    where: { id: oldRemnantId }
                })
            }

            // 6. Create New Remnant (if applicable)
            const newRemainingLength = originalLength - newLengthUsed

            if (newRemainingLength > 0) {
                const newRemnantId = `${rootLotId}-${Math.floor(newRemainingLength)}`

                // Check collision (unlikely if logic is correct, but possible if switching back to an existing remnant state?)
                const collision = await tx.remnant.findUnique({ where: { id: newRemnantId } })
                if (collision) {
                    throw new Error(`Cannot update: A remnant with properties of the new result already exists (${newRemnantId}).`)
                }

                await tx.remnant.create({
                    data: {
                        id: newRemnantId,
                        rootLotId,
                        profileId: source.profileId,
                        length: newRemainingLength,
                        costPerMeter: costPerMeter,
                        status: newStatus, // SCRAP or AVAILABLE
                        gradeId: source.gradeId,
                        projectId: usageLine.projectId || undefined, // inherit project linkage? or null? 
                        // Original logic in route.ts used usage.projectId for scrap tracking.
                        // usageLine has optional projectId. 
                        // If we want to track scrap, we needs the project. 
                        // let's fetch usage to be sure if needed, but usageLine.projectId might be enough if set.
                    }
                })
            }

            revalidatePath('/usage/history')
            return { success: true }
        })
    } catch (error: any) {
        console.error('Update Usage Error:', error)
        return { success: false, error: error.message }
    }
}
// ... existing imports ...

// ... existing updateUsageLine ...

export async function createUsage(projectId: string, userId: string, lines: any[]) {
    try {
        if (!projectId || !lines || lines.length === 0) {
            throw new Error('Missing required fields')
        }

        const result = await prisma.$transaction(async (tx) => {
            // Create Usage Record
            const usage = await tx.usage.create({
                data: {
                    projectId,
                    userId: userId || 'system',
                    createdBy: userId || 'system',
                    modifiedBy: userId || 'system'
                }
            })

            const results = []

            for (const line of lines) {
                const { type, id, lengthUsed, createRemnant } = line
                let rootLotId = ''
                let originalLength = 0
                let profileId = ''
                let gradeId = ''
                let costPerMeter = 0
                let item = null

                if (type === 'INVENTORY') {
                    const inventory = await tx.inventory.findUnique({ where: { id } })
                    if (!inventory) throw new Error(`Inventory item ${id} not found`)
                    if (inventory.quantityAtHand <= 0) throw new Error(`Inventory item ${id} is out of stock`)

                    item = inventory
                    rootLotId = inventory.lotId
                    originalLength = inventory.length
                    profileId = inventory.profileId
                    gradeId = inventory.gradeId
                    costPerMeter = inventory.costPerMeter || 0

                    // Decrement quantity
                    await tx.inventory.update({
                        where: { id },
                        data: { quantityAtHand: { decrement: 1 } }
                    })

                } else if (type === 'REMNANT') {
                    const remnant = await tx.remnant.findUnique({ where: { id } })
                    if (!remnant) throw new Error(`Remnant item ${id} not found`)
                    if (remnant.status !== 'AVAILABLE') throw new Error(`Remnant item ${id} is not available`)

                    item = remnant
                    rootLotId = remnant.rootLotId
                    originalLength = remnant.length
                    profileId = remnant.profileId
                    gradeId = remnant.gradeId
                    costPerMeter = remnant.costPerMeter || 0

                    // Mark as USED
                    await tx.remnant.update({
                        where: { id },
                        data: { status: 'USED' }
                    })
                }

                if (!item) throw new Error(`Item ${line.id} has invalid type`)

                // Calculate Cost
                const lineCost = (lengthUsed / 1000) * costPerMeter

                // Create Usage Line
                await tx.usageLine.create({
                    data: {
                        usageId: usage.id,
                        inventoryId: type === 'INVENTORY' ? id : undefined,
                        remnantId: type === 'REMNANT' ? id : undefined,
                        quantityUsed: 1, // Logic assumes 1 item used partially or fully
                        projectId, // Optional override
                        cost: lineCost
                    }
                })

                // Handle Remnant Creation (or Scrap)
                const remainingLength = originalLength - lengthUsed

                // Ensure remaining length is positive and reasonable
                if (remainingLength > 0) {
                    const newRemnantId = `${rootLotId}-${Math.floor(remainingLength)}`

                    // Check if exists (idempotency safety)
                    const existing = await tx.remnant.findUnique({ where: { id: newRemnantId } })

                    if (!existing) {
                        await tx.remnant.create({
                            data: {
                                id: newRemnantId,
                                rootLotId,
                                profileId,
                                gradeId,
                                length: remainingLength,
                                costPerMeter: costPerMeter, // Propagate cost
                                status: createRemnant ? 'AVAILABLE' : 'SCRAP', // TRUE = Remnant, FALSE = Scrap
                                projectId, // Link to Origin Project for Scrap tracking
                                createdBy: userId || 'system',
                                modifiedBy: userId || 'system'
                            }
                        })
                    }
                }

                results.push({ id, status: 'processed' })
            }

            return usage
        })

        revalidatePath('/usage')
        revalidatePath('/usage/history')
        return { success: true, usageId: result.id }

    } catch (error: any) {
        console.error('Usage Error:', error)
        return { success: false, error: error.message }
    }
}
