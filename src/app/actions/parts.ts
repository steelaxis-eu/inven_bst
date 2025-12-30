'use server'

import prisma from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { getCurrentUser } from '@/lib/auth'

// ============================================================================
// PART CRUD
// ============================================================================

export interface CreatePartInput {
    projectId: string
    partNumber: string
    description?: string
    profileId?: string
    gradeId?: string
    // Custom profile fields (when not selecting from existing profiles)
    profileType?: string          // e.g., "RHS", "CHS", "SHS", "HEA"
    profileDimensions?: string    // e.g., "100x50x4"
    profileStandard?: string      // e.g., "EN 10219"
    length?: number
    quantity: number
    requiresWelding?: boolean
    isOutsourcedCut?: boolean
    cutVendor?: string
    drawingRef?: string
    notes?: string
}

/**
 * Create a new part and auto-generate PartPiece records for each quantity
 */
export async function createPart(input: CreatePartInput) {
    try {
        const user = await getCurrentUser()
        if (!user?.id) {
            return { success: false, error: 'Unauthorized' }
        }

        const { projectId, partNumber, quantity, ...rest } = input

        if (!projectId || !partNumber || !quantity || quantity < 1) {
            return { success: false, error: 'Missing required fields' }
        }

        // Calculate unit weight if profile is provided
        let unitWeight = 0
        if (rest.profileId && rest.length) {
            const profile = await prisma.steelProfile.findUnique({
                where: { id: rest.profileId }
            })
            if (profile) {
                unitWeight = (rest.length / 1000) * profile.weightPerMeter
            }
        }

        const result = await prisma.$transaction(async (tx) => {
            // Create the Part
            const part = await tx.part.create({
                data: {
                    projectId,
                    partNumber,
                    quantity,
                    unitWeight,
                    ...rest
                }
            })

            // Auto-generate PartPiece records
            const pieces = Array.from({ length: quantity }, (_, i) => ({
                partId: part.id,
                pieceNumber: i + 1,
                status: 'PENDING'
            }))

            await tx.partPiece.createMany({ data: pieces })

            return part
        })

        revalidatePath(`/projects/${projectId}`)
        return { success: true, data: result }

    } catch (e: any) {
        if (e.code === 'P2002') {
            return { success: false, error: 'Part number already exists in this project' }
        }
        console.error('createPart error:', e)
        return { success: false, error: e.message }
    }
}

/**
 * Get all parts for a project with pieces and relations
 */
export async function getProjectParts(projectId: string) {
    return await prisma.part.findMany({
        where: { projectId },
        include: {
            profile: true,
            grade: true,
            pieces: {
                orderBy: { pieceNumber: 'asc' }
            },
            assemblyParts: {
                include: {
                    assembly: true
                }
            }
        },
        orderBy: { partNumber: 'asc' }
    })
}

/**
 * Get a single part with all details
 */
export async function getPart(partId: string) {
    return await prisma.part.findUnique({
        where: { id: partId },
        include: {
            profile: true,
            grade: true,
            pieces: {
                orderBy: { pieceNumber: 'asc' },
                include: {
                    inventory: true,
                    remnant: true
                }
            },
            assemblyParts: {
                include: {
                    assembly: true
                }
            }
        }
    })
}

/**
 * Update part quantity - adjusts pieces accordingly
 */
export async function updatePartQuantity(partId: string, newQuantity: number) {
    try {
        const part = await prisma.part.findUnique({
            where: { id: partId },
            include: { pieces: true }
        })

        if (!part) {
            return { success: false, error: 'Part not found' }
        }

        const currentQuantity = part.pieces.length

        await prisma.$transaction(async (tx) => {
            // Update part quantity
            await tx.part.update({
                where: { id: partId },
                data: { quantity: newQuantity }
            })

            if (newQuantity > currentQuantity) {
                // Add more pieces
                const newPieces = Array.from(
                    { length: newQuantity - currentQuantity },
                    (_, i) => ({
                        partId,
                        pieceNumber: currentQuantity + i + 1,
                        status: 'PENDING'
                    })
                )
                await tx.partPiece.createMany({ data: newPieces })
            } else if (newQuantity < currentQuantity) {
                // Remove excess pieces (only if PENDING)
                const piecesToRemove = part.pieces
                    .filter(p => p.pieceNumber > newQuantity && p.status === 'PENDING')
                    .map(p => p.id)

                if (piecesToRemove.length < currentQuantity - newQuantity) {
                    throw new Error('Cannot reduce quantity - some pieces are already in progress')
                }

                await tx.partPiece.deleteMany({
                    where: { id: { in: piecesToRemove } }
                })
            }
        })

        revalidatePath(`/projects/${part.projectId}`)
        return { success: true }

    } catch (e: any) {
        console.error('updatePartQuantity error:', e)
        return { success: false, error: e.message }
    }
}

/**
 * Delete a part and all its pieces (only if all pieces are PENDING)
 */
export async function deletePart(partId: string) {
    try {
        const part = await prisma.part.findUnique({
            where: { id: partId },
            include: { pieces: true }
        })

        if (!part) {
            return { success: false, error: 'Part not found' }
        }

        const hasNonPending = part.pieces.some(p => p.status !== 'PENDING')
        if (hasNonPending) {
            return { success: false, error: 'Cannot delete part with pieces already in production' }
        }

        await prisma.part.delete({ where: { id: partId } })

        revalidatePath(`/projects/${part.projectId}`)
        return { success: true }

    } catch (e: any) {
        console.error('deletePart error:', e)
        return { success: false, error: e.message }
    }
}

// ============================================================================
// PART PIECE STATUS UPDATES
// ============================================================================

type PieceStatus = 'PENDING' | 'CUT' | 'FABRICATED' | 'WELDED' | 'PAINTED' | 'READY'

/**
 * Update a single piece's status
 */
export async function updatePieceStatus(pieceId: string, newStatus: PieceStatus) {
    try {
        const user = await getCurrentUser()

        const piece = await prisma.partPiece.findUnique({
            where: { id: pieceId },
            include: { part: true }
        })

        if (!piece) {
            return { success: false, error: 'Piece not found' }
        }

        const now = new Date()
        const updateData: any = { status: newStatus }

        // Set timestamp based on status
        switch (newStatus) {
            case 'CUT':
                updateData.cutAt = now
                break
            case 'FABRICATED':
                updateData.fabricatedAt = now
                break
            case 'WELDED':
                updateData.weldedAt = now
                break
            case 'PAINTED':
                updateData.paintedAt = now
                break
            case 'READY':
                updateData.completedAt = now
                updateData.completedBy = user?.id || 'system'
                break
        }

        await prisma.partPiece.update({
            where: { id: pieceId },
            data: updateData
        })

        revalidatePath(`/projects/${piece.part.projectId}`)
        return { success: true }

    } catch (e: any) {
        console.error('updatePieceStatus error:', e)
        return { success: false, error: e.message }
    }
}

/**
 * Bulk update multiple pieces to a new status
 */
export async function bulkUpdatePieceStatus(pieceIds: string[], newStatus: PieceStatus) {
    try {
        const user = await getCurrentUser()
        const now = new Date()

        const updateData: any = { status: newStatus }

        switch (newStatus) {
            case 'CUT':
                updateData.cutAt = now
                break
            case 'FABRICATED':
                updateData.fabricatedAt = now
                break
            case 'WELDED':
                updateData.weldedAt = now
                break
            case 'PAINTED':
                updateData.paintedAt = now
                break
            case 'READY':
                updateData.completedAt = now
                updateData.completedBy = user?.id || 'system'
                break
        }

        await prisma.partPiece.updateMany({
            where: { id: { in: pieceIds } },
            data: updateData
        })

        revalidatePath('/projects')
        return { success: true, updated: pieceIds.length }

    } catch (e: any) {
        console.error('bulkUpdatePieceStatus error:', e)
        return { success: false, error: e.message }
    }
}

/**
 * Cut a piece and link to inventory/remnant (integrates with Usage system)
 * This creates a usage record to maintain material traceability
 */
export async function cutPieceWithMaterial(
    pieceId: string,
    materialType: 'INVENTORY' | 'REMNANT',
    materialId: string,
    lengthUsed: number,
    createRemnant: boolean = true
) {
    try {
        const user = await getCurrentUser()
        if (!user?.id) {
            return { success: false, error: 'Unauthorized' }
        }

        const piece = await prisma.partPiece.findUnique({
            where: { id: pieceId },
            include: { part: { include: { project: true } } }
        })

        if (!piece) {
            return { success: false, error: 'Piece not found' }
        }

        if (piece.status !== 'PENDING') {
            return { success: false, error: 'Piece has already been cut' }
        }

        const projectId = piece.part.projectId

        const result = await prisma.$transaction(async (tx) => {
            let rootLotId = ''
            let originalLength = 0
            let profileId = ''
            let gradeId = ''
            let costPerMeter = 0

            if (materialType === 'INVENTORY') {
                const inventory = await tx.inventory.findUnique({ where: { id: materialId } })
                if (!inventory) throw new Error('Inventory item not found')
                if (inventory.quantityAtHand <= 0) throw new Error('Inventory item is out of stock')

                rootLotId = inventory.lotId
                originalLength = inventory.length
                profileId = inventory.profileId
                gradeId = inventory.gradeId
                costPerMeter = inventory.costPerMeter || 0

                // Decrement inventory
                await tx.inventory.update({
                    where: { id: materialId },
                    data: { quantityAtHand: { decrement: 1 } }
                })

            } else {
                const remnant = await tx.remnant.findUnique({ where: { id: materialId } })
                if (!remnant) throw new Error('Remnant not found')
                if (remnant.status !== 'AVAILABLE') throw new Error('Remnant is not available')

                rootLotId = remnant.rootLotId
                originalLength = remnant.length
                profileId = remnant.profileId
                gradeId = remnant.gradeId
                costPerMeter = remnant.costPerMeter || 0

                // Mark remnant as used
                await tx.remnant.update({
                    where: { id: materialId },
                    data: { status: 'USED' }
                })
            }

            // Create Usage record for traceability
            const usage = await tx.usage.create({
                data: {
                    projectId,
                    userId: user.id,
                    userName: user.name,
                    createdBy: user.id,
                    modifiedBy: user.id
                }
            })

            const lineCost = (lengthUsed / 1000) * costPerMeter

            await tx.usageLine.create({
                data: {
                    usageId: usage.id,
                    inventoryId: materialType === 'INVENTORY' ? materialId : undefined,
                    remnantId: materialType === 'REMNANT' ? materialId : undefined,
                    quantityUsed: 1,
                    projectId,
                    cost: lineCost
                }
            })

            // Handle remnant creation from leftover
            const remainingLength = originalLength - lengthUsed
            if (remainingLength > 0) {
                const newRemnantId = `${rootLotId}-${Math.floor(remainingLength)}`
                const existing = await tx.remnant.findUnique({ where: { id: newRemnantId } })

                if (!existing) {
                    await tx.remnant.create({
                        data: {
                            id: newRemnantId,
                            rootLotId,
                            profileId,
                            gradeId,
                            length: remainingLength,
                            costPerMeter,
                            status: createRemnant ? 'AVAILABLE' : 'SCRAP',
                            projectId,
                            createdBy: user.id,
                            modifiedBy: user.id
                        }
                    })
                }
            }

            // Update piece status and link material
            await tx.partPiece.update({
                where: { id: pieceId },
                data: {
                    status: 'CUT',
                    cutAt: new Date(),
                    inventoryId: materialType === 'INVENTORY' ? materialId : undefined,
                    remnantId: materialType === 'REMNANT' ? materialId : undefined
                }
            })

            return usage
        })

        revalidatePath(`/projects/${projectId}`)
        revalidatePath('/usage/history')
        return { success: true, usageId: result.id }

    } catch (e: any) {
        console.error('cutPieceWithMaterial error:', e)
        return { success: false, error: e.message }
    }
}

// ============================================================================
// PROGRESS CALCULATIONS
// ============================================================================

/**
 * Calculate progress for a part based on its pieces
 */
export async function getPartProgress(partId: string) {
    const pieces = await prisma.partPiece.findMany({
        where: { partId }
    })

    const total = pieces.length
    const ready = pieces.filter(p => p.status === 'READY').length
    const cut = pieces.filter(p => ['CUT', 'FABRICATED', 'WELDED', 'PAINTED', 'READY'].includes(p.status)).length
    const inProgress = pieces.filter(p => !['PENDING', 'READY'].includes(p.status)).length

    return {
        total,
        ready,
        cut,
        inProgress,
        pending: total - cut,
        percentComplete: total > 0 ? Math.round((ready / total) * 100) : 0,
        percentCut: total > 0 ? Math.round((cut / total) * 100) : 0
    }
}

/**
 * Calculate overall project progress
 */
export async function getProjectProgress(projectId: string) {
    const parts = await prisma.part.findMany({
        where: { projectId },
        include: {
            pieces: true
        }
    })

    let totalPieces = 0
    let readyPieces = 0
    let totalWeight = 0
    let readyWeight = 0

    for (const part of parts) {
        const partWeight = part.unitWeight || 0

        for (const piece of part.pieces) {
            totalPieces++
            totalWeight += partWeight

            if (piece.status === 'READY') {
                readyPieces++
                readyWeight += partWeight
            }
        }
    }

    return {
        totalParts: parts.length,
        totalPieces,
        readyPieces,
        totalWeight,
        readyWeight,
        percentByCount: totalPieces > 0 ? Math.round((readyPieces / totalPieces) * 100) : 0,
        percentByWeight: totalWeight > 0 ? Math.round((readyWeight / totalWeight) * 100) : 0
    }
}

/**
 * Toggle part outsourcing status
 */
export async function togglePartSource(partId: string) {
    try {
        const part = await prisma.part.findUnique({
            where: { id: partId }
        })

        if (!part) {
            return { success: false, error: 'Part not found' }
        }

        // Toggle the boolean
        const newStatus = !part.isOutsourcedCut

        await prisma.part.update({
            where: { id: partId },
            data: { isOutsourcedCut: newStatus }
        })

        revalidatePath(`/projects/${part.projectId}`)
        return { success: true, isOutsourced: newStatus }

    } catch (e: any) {
        console.error('togglePartSource error:', e)
        return { success: false, error: e.message }
    }
}

/**
 * Finish a part (mark all pieces as READY)
 * Useful for outsourced parts or manual override
 */
export async function finishPart(partId: string) {
    try {
        const part = await prisma.part.findUnique({
            where: { id: partId },
            include: { pieces: true }
        })

        if (!part) {
            return { success: false, error: 'Part not found' }
        }

        const now = new Date()
        const user = await getCurrentUser()

        // Update all pieces to READY
        await prisma.partPiece.updateMany({
            where: { partId },
            data: {
                status: 'READY',
                completedAt: now,
                completedBy: user?.id || 'system'
            }
        })

        revalidatePath(`/projects/${part.projectId}`)
        return { success: true }

    } catch (e: any) {
        console.error('finishPart error:', e)
        return { success: false, error: e.message }
    }
}
