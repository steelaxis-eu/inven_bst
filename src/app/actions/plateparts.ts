'use server'

import prisma from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { PlatePartStatus, PlatePieceStatus } from '@prisma/client'
import { getCurrentUser } from '@/lib/auth'

// ============================================================================
// PLATE PART CRUD (Outsourced Laser/Plasma Cut Parts)
// ============================================================================

export interface CreatePlatePartInput {
    projectId: string
    partNumber: string
    description?: string
    material?: string
    gradeId?: string
    thickness?: number
    width?: number       // mm
    length?: number      // mm
    quantity: number
    unitWeight?: number  // Auto-calculated if not provided
    isOutsourced?: boolean
    dxfFilename?: string
    dxfStoragePath?: string
    drawingRef?: string
    nestingSheet?: string
    supplier?: string
    notes?: string
}

/**
 * Create a new plate part
 * Weight is auto-calculated from width × length × thickness × steel density (7850 kg/m³)
 */
export async function createPlatePart(input: CreatePlatePartInput) {
    try {
        const { projectId, partNumber, quantity, unitWeight, thickness, width, length, gradeId, drawingRef, ...rest } = input

        if (!projectId || !partNumber || !quantity) {
            return { success: false, error: 'Missing required fields' }
        }

        // Auto-calculate weight if dimensions provided and unitWeight not set
        let calculatedWeight = unitWeight || 0
        if (!unitWeight && thickness && width && length) {
            // Get density from grade if available, otherwise use steel default 7850 kg/m³
            let density = 7850
            if (gradeId) {
                const grade = await prisma.materialGrade.findUnique({ where: { id: gradeId } })
                if (grade?.density) density = grade.density
            }
            // Convert mm to m: (t/1000) * (w/1000) * (l/1000) * density
            calculatedWeight = (thickness / 1000) * (width / 1000) * (length / 1000) * density
        }

        const result = await prisma.$transaction(async (tx) => {
            const part = await tx.platePart.create({
                data: {
                    projectId,
                    partNumber,
                    quantity,
                    thickness,
                    width,
                    length,
                    gradeId,
                    unitWeight: calculatedWeight,
                    ...rest
                }
            })

            // Link Drawing if provided
            if (drawingRef) {
                const filename = drawingRef.split('/').pop() || 'drawing.pdf'
                await tx.projectDocument.create({
                    data: {
                        projectId,
                        platePartId: part.id,
                        type: 'DRAWING',
                        filename,
                        storagePath: drawingRef,
                        uploadedBy: 'System',
                        description: 'Imported Plate Drawing'
                    }
                })
            }

            // Auto-generate PlatePiece records
            const pieces = Array.from({ length: quantity }, (_, i) => ({
                platePartId: part.id,
                pieceNumber: i + 1,
                status: PlatePieceStatus.PENDING
            }))

            await (tx as any).platePiece.createMany({ data: pieces })

            return part
        })

        revalidatePath(`/projects/${projectId}`)
        return { success: true, data: result }

    } catch (e: any) {
        if (e.code === 'P2002') {
            return { success: false, error: 'Part number already exists in this project' }
        }
        console.error('createPlatePart error:', e)
        return { success: false, error: e.message }
    }
}

/**
 * Update DXF file reference for a plate part
 * Call after uploading file to blob: projects/{projectId}/Plates/{filename}
 */
export async function updatePlatePartDxf(
    platePartId: string,
    dxfFilename: string,
    dxfStoragePath: string
) {
    try {
        const part = await prisma.platePart.update({
            where: { id: platePartId },
            data: { dxfFilename, dxfStoragePath }
        })

        revalidatePath(`/projects/${part.projectId}`)
        return { success: true }

    } catch (e: any) {
        console.error('updatePlatePartDxf error:', e)
        return { success: false, error: e.message }
    }
}

/**
 * Get all plate parts for a project
 */
export async function getProjectPlateParts(projectId: string) {
    return await prisma.platePart.findMany({
        where: { projectId },
        include: {
            grade: true,
            documents: true,
            assemblyParts: {
                include: { assembly: true }
            },
            pieces: {
                orderBy: { pieceNumber: 'asc' },
                include: { inventory: true }
            }
        },
        orderBy: { partNumber: 'asc' }
    })
}

/**
 * Get a single plate part with details
 */
export async function getPlatePart(platePartId: string) {
    return await prisma.platePart.findUnique({
        where: { id: platePartId },
        include: {
            grade: true,
            documents: true,
            assemblyParts: {
                include: { assembly: true }
            },
            pieces: {
                orderBy: { pieceNumber: 'asc' },
                include: { inventory: true }
            }
        }
    })
}

/**
 * Update plate part quantity
 */
export async function updatePlatePartQuantity(id: string, quantity: number) {
    try {
        if (quantity < 0) {
            return { success: false, error: 'Quantity must be positive' }
        }

        const part = await prisma.platePart.update({
            where: { id },
            data: { quantity }
        })

        revalidatePath(`/projects/${part.projectId}`)
        return { success: true, data: part }

    } catch (e: any) {
        console.error('updatePlatePartQuantity error:', e)
        return { success: false, error: e.message }
    }
}

/**
 * Update plate part
 */
export async function updatePlatePart(
    platePartId: string,
    data: Partial<Omit<CreatePlatePartInput, 'projectId' | 'partNumber'>>
) {
    try {
        const part = await prisma.platePart.update({
            where: { id: platePartId },
            data
        })

        revalidatePath(`/projects/${part.projectId}`)
        return { success: true, data: part }

    } catch (e: any) {
        console.error('updatePlatePart error:', e)
        return { success: false, error: e.message }
    }
}

/**
 * Update plate part status (ordering workflow)
 */
export async function updatePlatePartStatus(
    platePartId: string,
    status: PlatePartStatus,
    additionalData?: {
        poNumber?: string
        expectedDate?: Date
        receivedQty?: number
    }
) {
    try {
        const updateData: any = { status }

        switch (status) {
            case PlatePartStatus.ORDERED:
                updateData.orderedAt = new Date()
                if (additionalData?.poNumber) updateData.poNumber = additionalData.poNumber
                if (additionalData?.expectedDate) updateData.expectedDate = new Date(additionalData.expectedDate)
                break
            case PlatePartStatus.RECEIVED:
                updateData.receivedAt = new Date()
                if (additionalData?.receivedQty !== undefined) updateData.receivedQty = additionalData.receivedQty
                break
        }

        const part = await prisma.platePart.update({
            where: { id: platePartId },
            data: updateData
        })

        revalidatePath(`/projects/${part.projectId}`)
        return { success: true }

    } catch (e: any) {
        console.error('updatePlatePartStatus error:', e)
        return { success: false, error: e.message }
    }
}

/**
 * Delete a plate part (only if PENDING)
 */
export async function deletePlatePart(platePartId: string) {
    try {
        const part = await prisma.platePart.findUnique({ where: { id: platePartId } })

        if (!part) {
            return { success: false, error: 'Plate part not found' }
        }

        if (part.status !== PlatePartStatus.PENDING) {
            return { success: false, error: 'Cannot delete plate part that has been ordered' }
        }

        await prisma.platePart.delete({ where: { id: platePartId } })

        revalidatePath(`/projects/${part.projectId}`)
        return { success: true }

    } catch (e: any) {
        console.error('deletePlatePart error:', e)
        return { success: false, error: e.message }
    }
}

/**
 * Add plate part to assembly
 */
export async function addPlatePartToAssembly(
    assemblyId: string,
    platePartId: string,
    quantityInAssembly: number = 1
) {
    try {
        const [assembly, platePart] = await Promise.all([
            prisma.assembly.findUnique({ where: { id: assemblyId } }),
            prisma.platePart.findUnique({ where: { id: platePartId } })
        ])

        if (!assembly || !platePart) {
            return { success: false, error: 'Assembly or plate part not found' }
        }

        if (assembly.projectId !== platePart.projectId) {
            return { success: false, error: 'Assembly and plate part must be in the same project' }
        }

        await prisma.plateAssemblyPart.create({
            data: {
                assemblyId,
                platePartId,
                quantityInAssembly
            }
        })

        revalidatePath(`/projects/${assembly.projectId}`)
        return { success: true }

    } catch (e: any) {
        if (e.code === 'P2002') {
            return { success: false, error: 'Plate part is already in this assembly' }
        }
        console.error('addPlatePartToAssembly error:', e)
        return { success: false, error: e.message }
    }
}

/**
 * Get plate parts summary for project
 */
export async function getPlatePartsSummary(projectId: string) {
    const parts = await prisma.platePart.findMany({
        where: { projectId },
        select: {
            status: true,
            quantity: true,
            receivedQty: true,
            unitWeight: true
        }
    })

    const summary = {
        total: parts.length,
        totalQuantity: 0,
        receivedQuantity: 0,
        totalWeight: 0,
        byStatus: {
            PENDING: 0,
            ORDERED: 0,
            IN_PRODUCTION: 0,
            RECEIVED: 0,
            QC_PASSED: 0
        } as Record<string, number>
    }

    parts.forEach(p => {
        summary.totalQuantity += p.quantity
        summary.receivedQuantity += p.receivedQty
        summary.totalWeight += p.quantity * (p.unitWeight || 0)
        summary.byStatus[p.status] = (summary.byStatus[p.status] || 0) + 1
    })

    return summary
}
// ============================================================================
// PLATE PIECE STATUS & RECEIVING
// ============================================================================

export async function bulkUpdatePlatePieceStatus(pieceIds: string[], newStatus: string) {
    try {
        const user = await getCurrentUser()
        const now = new Date()

        // Map status to timestamp field
        const updateData: any = { status: newStatus }
        if (newStatus === 'RECEIVED') {
            updateData.receivedAt = now
            updateData.receivedBy = user?.id
        }

        await (prisma as any).platePiece.updateMany({
            where: { id: { in: pieceIds } },
            data: updateData
        })

        revalidatePath('/projects')
        return { success: true }
    } catch (e: any) {
        console.error('bulkUpdatePlatePieceStatus error:', e)
        return { success: false, error: e.message }
    }
}

export interface ReceivePlateBatchInput {
    projectId: string
    pieceIds: string[]
    supplier: string
    lotId: string
    certificatePath?: string
    certificateFilename?: string
}

export async function receivePlateBatch(input: ReceivePlateBatchInput) {
    try {
        const user = await getCurrentUser()
        if (!user?.id) return { success: false, error: 'Unauthorized' }

        const { projectId, pieceIds, supplier, lotId, certificatePath, certificateFilename } = input

        if (pieceIds.length === 0) return { success: false, error: 'No pieces selected' }

        const firstPiece = await (prisma as any).platePiece.findUnique({
            where: { id: pieceIds[0] },
            include: { platePart: true }
        })

        if (!firstPiece) return { success: false, error: 'Plate piece not found' }
        const part = firstPiece.platePart

        // Find/Create Supplier
        let supplierId = ''
        const existingSupplier = await prisma.supplier.findUnique({ where: { name: supplier } })
        if (existingSupplier) {
            supplierId = existingSupplier.id
        } else {
            const newSupplier = await prisma.supplier.create({ data: { name: supplier } })
            supplierId = newSupplier.id
        }

        // Create "Virtual" Inventory for Traceability
        // For plates, we might not have a "Profile" record.
        // We need to handle this. If gradeId is present, we rely on that.
        // For profileId, we might explicitly look for a "Plate" profile or leave it if schema allows (it doesn't, Inventory.profileId is required).
        // Strategy: Ensure a "PLATE" profile exists or create one dynamically?
        // Better Strategy: Look for specific Plate Profile "PL-{thickness}"

        if (!part.gradeId) {
            return { success: false, error: 'Plate Part must have a grade to receive.' }
        }

        // Find/Create Profile for this Plate Thickness
        const profileName = `PL ${part.thickness}mm`
        let profileId = ''
        const existingProfile = await prisma.steelProfile.findFirst({
            where: { type: 'PLATE', dimensions: `${part.thickness}` }
        })

        if (existingProfile) {
            profileId = existingProfile.id
        } else {
            // Create On-the-fly? Or fail?
            // Let's create it to be safe and robust
            const newProfile = await prisma.steelProfile.create({
                data: {
                    type: 'PLATE',
                    dimensions: `${part.thickness}`,
                    weightPerMeter: 0 // Calc logic is different for plates
                }
            })
            profileId = newProfile.id
        }

        // Check for existing Batch
        let inventoryId = ''
        const existingInventory = await prisma.inventory.findUnique({ where: { lotId } })

        if (existingInventory) {
            inventoryId = existingInventory.id
            await prisma.inventory.update({
                where: { id: inventoryId },
                data: { quantityReceived: { increment: pieceIds.length } }
            })
        } else {
            const inv = await prisma.inventory.create({
                data: {
                    lotId,
                    supplierId,
                    profileId,
                    gradeId: part.gradeId,
                    length: part.length || 0,
                    quantityReceived: pieceIds.length,
                    quantityAtHand: 0,
                    certificateFilename: certificatePath,
                    status: 'ACTIVE'
                }
            })
            inventoryId = inv.id
        }

        const now = new Date()

        await prisma.$transaction(async (tx) => {
            // 1. Update Pieces
            await (tx as any).platePiece.updateMany({
                where: { id: { in: pieceIds } },
                data: {
                    status: 'RECEIVED',
                    inventoryId,
                    receivedAt: now,
                    receivedBy: user.id
                }
            })

            // 2. Doc Link
            if (certificatePath) {
                await tx.projectDocument.create({
                    data: {
                        projectId,
                        type: 'CERTIFICATE',
                        filename: certificateFilename || 'Certificate.pdf',
                        storagePath: certificatePath,
                        uploadedBy: user.id,
                        description: `Batch ${lotId} Receipt (Plates)`
                    }
                })
            }
        })

        revalidatePath(`/projects/${projectId}`)
        return { success: true }

    } catch (e: any) {
        console.error('receivePlateBatch error:', e)
        return { success: false, error: e.message }
    }
}

/**
 * Toggle plate part outsourcing status
 */
export async function togglePlatePartSource(platePartId: string) {
    try {
        const part = await prisma.platePart.findUnique({
            where: { id: platePartId }
        })

        if (!part) {
            return { success: false, error: 'Plate part not found' }
        }

        // Toggle the boolean
        const newStatus = !part.isOutsourced

        await prisma.platePart.update({
            where: { id: platePartId },
            data: { isOutsourced: newStatus }
        })

        revalidatePath(`/projects/${part.projectId}`)
        return { success: true, isOutsourced: newStatus }

    } catch (e: any) {
        console.error('togglePlatePartSource error:', e)
        return { success: false, error: e.message }
    }
}

// ============================================================================
// IN-HOUSE PLATE PROCESSING (CUTTING FROM STOCK)
// ============================================================================

/**
 * Cut a plate piece from Inventory/Remnant (In-House Production)
 */
export async function cutPlatePieceWithMaterial(
    pieceId: string,
    materialType: 'INVENTORY' | 'REMNANT',
    materialId: string,
    quantityUsed: number = 1
) {
    try {
        const user = await getCurrentUser()
        if (!user?.id) return { success: false, error: 'Unauthorized' }

        const piece = await prisma.platePiece.findUnique({
            where: { id: pieceId },
            include: { platePart: { include: { project: true } } }
        })

        if (!piece) return { success: false, error: 'Piece not found' }
        if (piece.status !== 'PENDING') return { success: false, error: 'Piece already processed' }

        const projectId = piece.platePart.projectId

        const result = await prisma.$transaction(async (tx) => {
            // 1. Consume Material
            if (materialType === 'INVENTORY') {
                const inv = await tx.inventory.findUnique({ where: { id: materialId } })
                if (!inv || inv.quantityAtHand < quantityUsed) throw new Error('Insufficient inventory')

                await tx.inventory.update({
                    where: { id: materialId },
                    data: { quantityAtHand: { decrement: quantityUsed } }
                })
            } else {
                await tx.remnant.update({
                    where: { id: materialId },
                    data: { status: 'USED' }
                })
            }

            // 2. Create Usage Record
            const usage = await tx.usage.create({
                data: {
                    projectId,
                    userId: user.id,
                    createdBy: user.id
                }
            })

            await tx.usageLine.create({
                data: {
                    usageId: usage.id,
                    inventoryId: materialType === 'INVENTORY' ? materialId : undefined,
                    remnantId: materialType === 'REMNANT' ? materialId : undefined,
                    quantityUsed,
                    projectId,
                    cost: 0
                }
            })

            // 3. Update Piece
            await (tx as any).platePiece.update({
                where: { id: pieceId },
                data: {
                    status: PlatePieceStatus.CUT,
                    inventoryId: materialType === 'INVENTORY' ? materialId : undefined,
                    notes: `Cut from ${materialType} ${materialId}`
                }
            })

            return usage
        })

        revalidatePath(`/projects/${projectId}`)
        return { success: true }

    } catch (e: any) {
        console.error('cutPlatePieceWithMaterial error:', e)
        return { success: false, error: e.message }
    }
}

/**
 * Generate missing pieces for a plate part (Fix for legacy data)
 */
export async function generatePlatePieces(platePartId: string) {
    try {
        const part = await prisma.platePart.findUnique({
            where: { id: platePartId },
            include: { pieces: true }
        }) as any

        if (!part) {
            return { success: false, error: 'Plate Part not found' }
        }

        const currentCount = part.pieces.length
        if (currentCount >= part.quantity) {
            return { success: true, message: 'Pieces already exist', pieces: part.pieces }
        }

        const missingCount = part.quantity - currentCount
        if (missingCount <= 0) return { success: true, pieces: part.pieces }

        // Determine starting number
        const maxNum = part.pieces.reduce((max: number, p: any) => p.pieceNumber > max ? p.pieceNumber : max, 0)

        const newPieces = Array.from({ length: missingCount }, (_, i) => ({
            platePartId: part.id,
            pieceNumber: maxNum + i + 1,
            status: PlatePieceStatus.PENDING
        }))

        // Transaction not strictly needed but good practice
        await (prisma as any).platePiece.createMany({ data: newPieces })

        revalidatePath(`/projects/${part.projectId}`)

        // Return refreshed list
        const updatedPieces = await (prisma as any).platePiece.findMany({
            where: { platePartId },
            orderBy: { pieceNumber: 'asc' }
        })

        return { success: true, message: `Generated ${missingCount} pieces`, pieces: updatedPieces }

    } catch (e: any) {
        console.error('generatePlatePieces error:', e)
        return { success: false, error: e.message }
    }
}
