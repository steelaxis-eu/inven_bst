'use server'

import prisma from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

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
