'use server'

import { getCurrentUser } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { WorkOrderStatus, PartPieceStatus } from '@prisma/client'

// ============================================================================
// NEW BATCH LOGIC
// ============================================================================

export type CutItem = {
    workOrderItemId: string
    pieceId: string // Used to update piece status
    quantity: number // usually 1
    length: number // length used per piece (including kerf if needed? usually part length)
}

export type OffcutDetails = {
    actualLength: number
    valRemnantLength?: number
    isScrap: boolean
    reason?: string
}

/**
 * Record usage for a batch of items cut from a single inventory source (Inventory or Remnant)
 */
export async function recordBatchUsage({
    projectId,
    sourceId,
    sourceType,
    cuts,
    offcut,
    userId = 'system' // TODO: Get from auth
}: {
    projectId: string
    sourceId: string
    sourceType: 'INVENTORY' | 'REMNANT'
    cuts: CutItem[]
    offcut?: OffcutDetails
    userId?: string
}) {
    try {
        const user = await getCurrentUser()
        if (!user) return { success: false, error: 'Unauthorized' }

        return await prisma.$transaction(async (tx) => {
            // 1. Fetch Source
            let sourceItem: any = null
            let costPerMeter = 0

            if (sourceType === 'INVENTORY') {
                sourceItem = await tx.inventory.findUnique({
                    where: { id: sourceId },
                    include: { profile: true, grade: true }
                })
                if (!sourceItem) throw new Error('Inventory item not found')
                costPerMeter = sourceItem.costPerMeter
            } else {
                sourceItem = await tx.remnant.findUnique({
                    where: { id: sourceId },
                    include: { profile: true, grade: true }
                })
                if (!sourceItem) throw new Error('Remnant not found')
                costPerMeter = sourceItem.costPerMeter || 0
            }

            // 2. Create Usage Header
            const usage = await tx.usage.create({
                data: {
                    projectId,
                    userId, // NextAuth ID
                    createdBy: userId,
                    date: new Date()
                }
            })

            // 3. Process Cuts (Batch Operations)
            let totalLengthUsed = 0
            const usageLinesData: any[] = []
            const workOrderItemIds: string[] = []
            const pieceIds: string[] = []

            for (const cut of cuts) {
                totalLengthUsed += cut.length * cut.quantity

                usageLinesData.push({
                    usageId: usage.id,
                    [sourceType === 'INVENTORY' ? 'inventoryId' : 'remnantId']: sourceId,
                    quantityUsed: cut.quantity,
                    cost: (cut.length / 1000) * costPerMeter * cut.quantity,
                    usageType: 'PROJECT_WO',
                    workOrderItemId: cut.workOrderItemId,
                    projectId
                })

                if (cut.workOrderItemId) workOrderItemIds.push(cut.workOrderItemId)
                if (cut.pieceId) pieceIds.push(cut.pieceId)
            }

            if (usageLinesData.length > 0) {
                await tx.usageLine.createMany({ data: usageLinesData })
            }

            if (workOrderItemIds.length > 0) {
                await tx.workOrderItem.updateMany({
                    where: { id: { in: workOrderItemIds } },
                    data: {
                        status: WorkOrderStatus.COMPLETED,
                        completedAt: new Date()
                    }
                })
            }

            if (pieceIds.length > 0) {
                await tx.partPiece.updateMany({
                    where: { id: { in: pieceIds } },
                    data: {
                        status: PartPieceStatus.CUT,
                        cutAt: new Date()
                    }
                })
            }

            // 4. Handle Source Update & Offcut/Remnant

            const theoreticalRemnant = sourceItem.length - totalLengthUsed

            if (theoreticalRemnant < 0) {
                // Warning only? Or block? Block for safety.
                throw new Error(`Usage (${totalLengthUsed}mm) exceeds source length (${sourceItem.length}mm)`)
            }

            if (sourceType === 'INVENTORY') {
                if (sourceItem.quantityAtHand < 1) throw new Error('Insufficient inventory quantity')
                await tx.inventory.update({
                    where: { id: sourceId },
                    data: { quantityAtHand: { decrement: 1 } }
                })
            } else {
                // Remove used remnant
                await tx.remnant.delete({ where: { id: sourceId } })
            }

            // 5. Create NEW Remnant for the offcut (if valid)
            if (offcut) {
                const scrapLength = theoreticalRemnant - offcut.actualLength

                if (Math.abs(scrapLength) > 1) { // 1mm tolerance
                    // Record Scrap Line (Process Loss)
                    await tx.usageLine.create({
                        data: {
                            usageId: usage.id,
                            [sourceType === 'INVENTORY' ? 'inventoryId' : 'remnantId']: sourceId,
                            quantityUsed: 1, // It's part of the same bar
                            cost: (scrapLength / 1000) * costPerMeter,
                            usageType: 'PROCESS_LOSS',
                            projectId,
                            isScrap: true,
                            valRemnantLength: offcut.actualLength,
                            overrideReason: offcut.reason || 'Process Loss / Kerf'
                        }
                    })
                }

                if (!offcut.isScrap && offcut.actualLength > 100) {
                    // Create New Remnant
                    await tx.remnant.create({
                        data: {
                            id: `${sourceItem.lotId || sourceItem.rootLotId}-R${Math.floor(Math.random() * 1000)}`, // Generate ID
                            rootLotId: sourceItem.lotId || sourceItem.rootLotId, // Correctly link to root
                            length: offcut.actualLength,
                            profileId: sourceItem.profileId,
                            gradeId: sourceItem.gradeId,
                            costPerMeter: costPerMeter,
                            projectId: projectId // Link to project
                        }
                    })
                } else if (offcut.isScrap && offcut.actualLength > 0) {
                    // Record the main offcut as SCRAP usage
                    await tx.usageLine.create({
                        data: {
                            usageId: usage.id,
                            [sourceType === 'INVENTORY' ? 'inventoryId' : 'remnantId']: sourceId,
                            quantityUsed: 1,
                            cost: (offcut.actualLength / 1000) * costPerMeter,
                            usageType: 'SCRAP',
                            projectId,
                            isScrap: true,
                            overrideReason: 'Marked as Scrap by User'
                        }
                    })
                }
            }

            return { success: true }
        })
    } catch (e: any) {
        console.error('recordBatchUsage error:', e)
        return { success: false, error: e.message }
    }
}

// ============================================================================
// LEGACY / MANUAL USAGE SUPPORT
// ============================================================================

export async function getUsageItem(query: string) {
    // Search Inventory by lotId (exact)
    const inv = await prisma.inventory.findUnique({
        where: { lotId: query },
        include: { profile: true, grade: true }
    })

    if (inv) return { ...inv, type: 'INVENTORY' }

    // Search Remnant by ID
    const rem = await prisma.remnant.findUnique({
        where: { id: query },
        include: { profile: true, grade: true }
    })
    if (rem) return { ...rem, type: 'REMNANT' }

    return null
}

export async function createUsage(projectId: string, userIdArg: string, lines: any[]) {
    const userId = userIdArg || 'system'
    try {
        const user = await getCurrentUser()
        if (!user) return { success: false, error: 'Unauthorized' }

        return await prisma.$transaction(async (tx) => {
            const usage = await tx.usage.create({
                data: {
                    projectId,
                    userId,
                    createdBy: userId,
                    date: new Date()
                }
            })

            for (const line of lines) {
                const sourceType = line.type === 'REMNANT' ? 'REMNANT' : 'INVENTORY'
                let sourceItem: any
                let costPerMeter = 0

                if (sourceType === 'INVENTORY') {
                    sourceItem = await tx.inventory.findUnique({ where: { id: line.id } })
                    costPerMeter = sourceItem?.costPerMeter || 0
                    if (sourceItem) await tx.inventory.update({
                        where: { id: line.id },
                        data: { quantityAtHand: { decrement: 1 } }
                    })
                } else {
                    sourceItem = await tx.remnant.findUnique({ where: { id: line.id } })
                    costPerMeter = sourceItem?.costPerMeter || 0
                    if (sourceItem) await tx.remnant.delete({ where: { id: line.id } })
                }

                if (!sourceItem) continue

                // Create Usage Line
                await tx.usageLine.create({
                    data: {
                        usageId: usage.id,
                        [sourceType === 'INVENTORY' ? 'inventoryId' : 'remnantId']: line.id,
                        quantityUsed: 1,
                        cost: (line.lengthUsed / 1000) * costPerMeter,
                        projectId: line.projectId || projectId,
                        usageType: 'STANDALONE'
                    }
                })

                // Create Remnant if requested
                const remainder = sourceItem.length - line.lengthUsed
                if (line.createRemnant && remainder > 0) {
                    await tx.remnant.create({
                        data: {
                            id: `${sourceItem.lotId || sourceItem.rootLotId}-R${Math.floor(Math.random() * 1000)}`,
                            rootLotId: sourceItem.lotId || sourceItem.rootLotId,
                            length: remainder,
                            profileId: sourceItem.profileId,
                            gradeId: sourceItem.gradeId,
                            costPerMeter: costPerMeter,
                            projectId: line.projectId || projectId
                        }
                    })
                }
            }
            return { success: true }
        })
    } catch (e: any) {
        return { success: false, error: e.message }
    }
}

// Stub for now if edit dialog needs it, or implement empty if unused?
// edit-usage-dialog seemed to import updateUsageLine
export async function updateUsageLine(id: string, length: number, status: string) {
    // Placeholder implementation as specific requirements weren't in view
    return { success: false, error: "Not implemented" }
}

export async function deleteUsageLine(id: string) {
    try {
        const user = await getCurrentUser()
        if (!user) return { success: false, error: 'Unauthorized' }

        await prisma.usageLine.delete({ where: { id } })
        revalidatePath('/usage')
        return { success: true }
    } catch (e: any) {
        return { success: false, error: e.message }
    }
}

export async function deleteUsage(id: string) {
    try {
        const user = await getCurrentUser()
        if (!user) return { success: false, error: 'Unauthorized' }

        await prisma.usage.delete({ where: { id } })
        revalidatePath('/usage')
        return { success: true }
    } catch (e: any) {
        return { success: false, error: e.message }
    }
}
