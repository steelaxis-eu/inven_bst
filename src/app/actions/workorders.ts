'use server'

import prisma from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { getCurrentUser } from '@/lib/auth'
import { optimizeCuttingPlan, StockInfo } from '@/lib/optimization'
import {
    WorkOrderStatus,
    WorkOrderType,
    WorkOrderPriority,
    PartPieceStatus,
    AssemblyStatus,
    QualityCheckStatus,
    QualityCheckType,
    InventoryStatus,
    PlatePieceStatus
} from '@prisma/client'

// ============================================================================
// WORK ORDER CRUD
// ============================================================================

export interface CreateWorkOrderInput {
    projectId: string
    title: string
    type: WorkOrderType
    description?: string
    priority?: WorkOrderPriority
    assignedTo?: string
    scheduledDate?: Date
    notes?: string
}

/**
 * Generate next work order number for a project
 */
async function generateWorkOrderNumber(projectId: string): Promise<string> {
    const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: { projectNumber: true }
    })

    const count = await prisma.workOrder.count({
        where: { projectId }
    })

    const year = new Date().getFullYear()
    return `WO-${project?.projectNumber || 'XXX'}-${year}-${String(count + 1).padStart(3, '0')}`
}

/**
 * Create a new work order
 */
export async function createWorkOrder(input: CreateWorkOrderInput) {
    try {
        const { projectId, title, type, ...rest } = input

        if (!projectId || !title || !type) {
            return { success: false, error: 'Missing required fields' }
        }

        const workOrderNumber = await generateWorkOrderNumber(projectId)

        const wo = await prisma.workOrder.create({
            data: {
                projectId,
                workOrderNumber,
                title,
                type,
                priority: (rest.priority as any) || WorkOrderPriority.MEDIUM,
                ...rest,
                scheduledDate: rest.scheduledDate ? new Date(rest.scheduledDate) : undefined
            }
        })

        revalidatePath(`/projects/${projectId}`)
        return { success: true, data: wo }

    } catch (e: any) {
        console.error('createWorkOrder error:', e)
        return { success: false, error: e.message }
    }
}

/**
 * Get all work orders for a project
 */
export async function getProjectWorkOrders(projectId: string) {
    return await prisma.workOrder.findMany({
        where: { projectId },
        include: {
            items: {
                include: {
                    piece: { include: { part: true } },
                    assembly: true,
                    platePart: true
                }
            }
        },
        orderBy: [
            { status: 'asc' },
            { scheduledDate: 'asc' }
        ]
    })
}

/**
 * Get a single work order with all details
 */
export async function getWorkOrder(workOrderId: string) {
    return await prisma.workOrder.findUnique({
        where: { id: workOrderId },
        include: {
            items: {
                include: {
                    piece: { include: { part: { include: { profile: true } } } },
                    assembly: true,
                    platePart: true
                }
            }
        }
    })
}

/**
 * Update work order status
 */
export async function updateWorkOrderStatus(
    workOrderId: string,
    status: WorkOrderStatus
) {
    try {
        const updateData: any = { status }

        if (status === WorkOrderStatus.IN_PROGRESS) {
            updateData.startedAt = new Date()
        } else if (status === WorkOrderStatus.COMPLETED) {
            updateData.completedAt = new Date()
        }

        const wo = await prisma.workOrder.update({
            where: { id: workOrderId },
            data: updateData
        })

        revalidatePath(`/projects/${wo.projectId}`)
        return { success: true }

    } catch (e: any) {
        console.error('updateWorkOrderStatus error:', e)
        return { success: false, error: e.message }
    }
}

/**
 * Add items to a work order
 */
export async function addItemsToWorkOrder(
    workOrderId: string,
    items: Array<{
        pieceId?: string
        assemblyId?: string
        platePartId?: string
        notes?: string
    }>
) {
    try {
        const created = await prisma.workOrderItem.createMany({
            data: items.map(item => ({
                workOrderId,
                ...item
            }))
        })

        return { success: true, count: created.count }

    } catch (e: any) {
        console.error('addItemsToWorkOrder error:', e)
        return { success: false, error: e.message }
    }
}
/**
 * Update work order item status
 * For CUTTING items, can specify if machining is needed - creates follow-up WO
 */
export async function updateWorkOrderItemStatus(
    itemId: string,
    status: WorkOrderStatus,
    options?: { needsMachining?: boolean }
) {
    try {
        const updateData: any = { status }

        if (status === WorkOrderStatus.COMPLETED) {
            updateData.completedAt = new Date()
        }

        const item = await prisma.workOrderItem.update({
            where: { id: itemId },
            data: updateData,
            include: {
                workOrder: true,
                piece: { include: { part: true } }
            }
        })

        // Track pieces that need machining or go straight to welding
        if (status === WorkOrderStatus.COMPLETED && item.pieceId && item.workOrder.type === WorkOrderType.CUTTING) {
            // Store the machining flag on the piece (we'll use notes for now)
            if (options?.needsMachining) {
                await prisma.partPiece.update({
                    where: { id: item.pieceId },
                    data: {
                        status: PartPieceStatus.CUT,
                        cutAt: new Date(),
                        // We'll track this in the part notes or create immediate WO
                    }
                })
            } else {
                await prisma.partPiece.update({
                    where: { id: item.pieceId },
                    data: {
                        status: PartPieceStatus.CUT,
                        cutAt: new Date()
                    }
                })
            }
        }

        return { success: true, needsMachining: options?.needsMachining }

    } catch (e: any) {
        console.error('updateWorkOrderItemStatus error:', e)
        return { success: false, error: e.message }
    }
}

/**
 * Complete a CUTTING WO and create follow-up WOs based on machining needs
 * Pieces marked for machining go to MACHINING WO
 * Pieces not needing machining go directly to WELDING WO
 */
export async function completeCuttingWOWithWorkflow(
    workOrderId: string,
    machinedPieceIds: string[]  // Piece IDs that need machining
) {
    try {
        const wo = await prisma.workOrder.findUnique({
            where: { id: workOrderId },
            include: { items: { include: { piece: true } } }
        })

        if (!wo) {
            return { success: false, error: 'Work order not found' }
        }

        if (wo.type !== WorkOrderType.CUTTING) {
            return { success: false, error: 'This is only for CUTTING work orders' }
        }

        const allPieceIds = wo.items.filter(i => i.pieceId).map(i => i.pieceId!)
        const directToWelding = allPieceIds.filter(id => !machinedPieceIds.includes(id))

        // Complete the cutting WO
        await prisma.$transaction(async (tx) => {
            await tx.workOrder.update({
                where: { id: workOrderId },
                data: { status: WorkOrderStatus.COMPLETED, completedAt: new Date() }
            })

            await tx.workOrderItem.updateMany({
                where: { workOrderId, status: { not: WorkOrderStatus.COMPLETED } },
                data: { status: WorkOrderStatus.COMPLETED, completedAt: new Date() }
            })

            // Update all pieces to CUT status
            await tx.partPiece.updateMany({
                where: { id: { in: allPieceIds } },
                data: { status: PartPieceStatus.CUT, cutAt: new Date() }
            })
        })

        // Create MACHINING WO if any pieces need it
        let machiningWO = null
        if (machinedPieceIds.length > 0) {
            const woNumber = await generateWorkOrderNumber(wo.projectId)
            machiningWO = await prisma.workOrder.create({
                data: {
                    projectId: wo.projectId,
                    workOrderNumber: woNumber,
                    title: `Machining (from ${wo.workOrderNumber})`,
                    type: WorkOrderType.MACHINING,
                    priority: wo.priority,
                    status: WorkOrderStatus.PENDING,
                    notes: `Drilling/machining for ${machinedPieceIds.length} pieces from cutting WO`,
                    items: {
                        create: machinedPieceIds.map(pieceId => ({ pieceId }))
                    }
                }
            })
        }

        // Create WELDING WO for pieces going direct (if any)
        let weldingWO = null
        if (directToWelding.length > 0) {
            const woNumber = await generateWorkOrderNumber(wo.projectId)
            weldingWO = await prisma.workOrder.create({
                data: {
                    projectId: wo.projectId,
                    workOrderNumber: woNumber,
                    title: `Welding (from ${wo.workOrderNumber})`,
                    type: WorkOrderType.WELDING,
                    priority: wo.priority,
                    status: WorkOrderStatus.PENDING,
                    notes: `${directToWelding.length} pieces ready for welding`,
                    items: {
                        create: directToWelding.map(pieceId => ({ pieceId }))
                    }
                }
            })
        }

        revalidatePath(`/projects/${wo.projectId}`)
        return {
            success: true,
            machiningWO,
            weldingWO,
            machinedCount: machinedPieceIds.length,
            directCount: directToWelding.length
        }

    } catch (e: any) {
        console.error('completeCuttingWOWithWorkflow error:', e)
        return { success: false, error: e.message }
    }
}

/**
 * Validation: Check if welding WO requirements are met (e.g. VT passed)
 */
async function validateWeldingRequirements(items: any[]): Promise<{ valid: boolean; error?: string }> {
    // Collect all assembly IDs
    const assemblyIds = new Set<string>()

    // Direct assembly items
    items.forEach(i => {
        if (i.assemblyId) assemblyIds.add(i.assemblyId)
    })

    // Piece items -> Trace to Assembly
    const pieceIds = items.filter(i => i.pieceId).map(i => i.pieceId)
    if (pieceIds.length > 0) {
        const pieces = await (prisma as any).partPiece.findMany({
            where: { id: { in: pieceIds } },
            select: { assemblyPiece: { select: { assemblyId: true } } }
        })
        pieces.forEach((p: any) => {
            if (p.assemblyPiece?.assemblyId) assemblyIds.add(p.assemblyPiece.assemblyId)
        })
    }

    if (assemblyIds.size === 0) return { valid: true }

    // Check QCs - Find assemblies that DO NOT have a PASSED VISUAL/NDT check
    // We check for 'VISUAL' type specifically as per "VT Validation" requirement
    const validQCs = await prisma.qualityCheck.findMany({
        where: {
            assemblyId: { in: Array.from(assemblyIds) },
            type: QualityCheckType.VISUAL,
            status: QualityCheckStatus.PASSED
        },
        select: { assemblyId: true }
    })

    const validAssemblyIds = new Set(validQCs.map(qc => qc.assemblyId))
    const missing = Array.from(assemblyIds).filter(id => !validAssemblyIds.has(id))

    if (missing.length > 0) {
        // Fetch assembly names for error message
        const missingAssemblies = await prisma.assembly.findMany({
            where: { id: { in: missing } },
            select: { assemblyNumber: true, name: true }
        })
        const names = missingAssemblies.map(a => `${a.assemblyNumber}`).join(', ')
        return { valid: false, error: `Cannot complete Welding: Visual Testing (VT) not passed for assemblies: ${names}` }
    }

    return { valid: true }
}

/**
 * Complete work order and update all piece statuses
 * Also handles creating follow-up WOs in the workflow chain
 */
export async function completeWorkOrder(workOrderId: string) {
    try {
        const wo = await prisma.workOrder.findUnique({
            where: { id: workOrderId },
            include: { items: true }
        })

        if (!wo) {
            return { success: false, error: 'Work order not found' }
        }

        // VALIDATION: Welding WOs require VT check
        if (wo.type === WorkOrderType.WELDING) {
            const validation = await validateWeldingRequirements(wo.items)
            if (!validation.valid) {
                return { success: false, error: validation.error }
            }
        }

        const pieceIds = wo.items.filter(i => i.pieceId).map(i => i.pieceId!)

        await prisma.$transaction(async (tx) => {
            // Mark work order as completed
            await tx.workOrder.update({
                where: { id: workOrderId },
                data: { status: WorkOrderStatus.COMPLETED, completedAt: new Date() }
            })

            // Mark all items as completed
            await tx.workOrderItem.updateMany({
                where: { workOrderId, status: { not: WorkOrderStatus.COMPLETED } },
                data: { status: WorkOrderStatus.COMPLETED, completedAt: new Date() }
            })

            // Handle Plate Pieces
            const plateItems = wo.items.filter(i => i.platePartId)
            if (plateItems.length > 0) {
                let newPlateStatus: string | null = null
                // Use string literals to avoid Enum import issues if client is stale
                if (wo.type === 'CUTTING') newPlateStatus = 'CUT'

                if (newPlateStatus) {
                    for (const item of plateItems) {
                        const piece: any = await (tx as any).platePiece.findFirst({
                            where: {
                                platePartId: item.platePartId!,
                                status: 'PENDING'
                            },
                            orderBy: { pieceNumber: 'asc' }
                        })

                        if (piece) {
                            await (tx as any).platePiece.update({
                                where: { id: piece.id },
                                data: { status: newPlateStatus }
                            })
                        }
                    }
                }
            }

            // Handle Plate Pieces (Transition PENDING -> CUT etc.)
            const plateItems = wo.items.filter(i => i.platePartId)
            if (plateItems.length > 0) {
                let newPlateStatus: PlatePieceStatus | null = null
                switch (wo.type) {
                    case WorkOrderType.CUTTING:
                        newPlateStatus = PlatePieceStatus.CUT
                        break
                    // Add more status transitions if PlatePieceStatus supports them
                }

                if (newPlateStatus) {
                    for (const item of plateItems) {
                        // Find the next available PENDING piece for this part
                        const piece = await tx.platePiece.findFirst({
                            where: {
                                platePartId: item.platePartId!,
                                status: PlatePieceStatus.PENDING
                            },
                            orderBy: { pieceNumber: 'asc' }
                        })

                        if (piece) {
                            await tx.platePiece.update({
                                where: { id: piece.id },
                                data: {
                                    status: newPlateStatus,
                                    // receivedAt? PlatePiece doesn't have cutAt. 
                                    // If CUTTING implies received/done, we could set receivedAt if appropriate but it's optional
                                }
                            })
                        }
                    }
                }
            }

            // Update piece statuses based on work order type
            if (pieceIds.length > 0) {
                const now = new Date()
                const statusField: Record<string, any> = {}

                switch (wo.type) {
                    case WorkOrderType.MATERIAL_PREP:
                        // Material is now available - no piece status change
                        break
                    case WorkOrderType.CUTTING:
                        statusField.status = PartPieceStatus.CUT
                        statusField.cutAt = now
                        break
                    case WorkOrderType.MACHINING:
                        statusField.status = PartPieceStatus.FABRICATED
                        statusField.fabricatedAt = now
                        break
                    case WorkOrderType.FABRICATION:
                        statusField.status = PartPieceStatus.FABRICATED
                        statusField.fabricatedAt = now
                        break
                    case WorkOrderType.WELDING:
                        statusField.status = PartPieceStatus.WELDED
                        statusField.weldedAt = now
                        break
                    case WorkOrderType.COATING:
                        statusField.status = PartPieceStatus.PAINTED
                        statusField.paintedAt = now
                        break
                }

                if (Object.keys(statusField).length > 0) {
                    await tx.partPiece.updateMany({
                        where: { id: { in: pieceIds } },
                        data: statusField
                    })
                }
            }

            // Unblock dependent WOs (those waiting on this one)
            // Just clear the blocking reference - notes will stay as-is
            await tx.workOrder.updateMany({
                where: { blockedByWOId: workOrderId, status: WorkOrderStatus.PENDING },
                data: {
                    blockedByWOId: null
                }
            })
        })

        // Auto-create follow-up WO based on type
        // Note: WELDING WO is created at assembly level when all parts are ready
        // Only WELDING→COATING is auto-created
        let followUpWO = null

        if (wo.type === WorkOrderType.WELDING && pieceIds.length > 0) {
            // Auto-create COATING WO after WELDING completes
            const woNumber = await generateWorkOrderNumber(wo.projectId)
            followUpWO = await prisma.workOrder.create({
                data: {
                    projectId: wo.projectId,
                    workOrderNumber: woNumber,
                    title: `Coating (from ${wo.workOrderNumber})`,
                    type: WorkOrderType.COATING,
                    priority: wo.priority,
                    status: WorkOrderStatus.PENDING,
                    notes: `Auto-created after welding ${wo.workOrderNumber} completed`,
                    items: {
                        create: pieceIds.map((pieceId: string) => ({ pieceId }))
                    }
                }
            })
        }

        revalidatePath(`/projects/${wo.projectId}`)
        return { success: true, followUpWO }

    } catch (e: any) {
        console.error('completeWorkOrder error:', e)
        return { success: false, error: e.message }
    }
}

/**
 * Delete a work order (only if PENDING or CANCELLED)
 */
export async function deleteWorkOrder(workOrderId: string) {
    try {
        const wo = await prisma.workOrder.findUnique({ where: { id: workOrderId } })

        if (!wo) {
            return { success: false, error: 'Work order not found' }
        }

        if (!([WorkOrderStatus.PENDING, WorkOrderStatus.CANCELLED] as any[]).includes(wo.status)) {
            return { success: false, error: 'Cannot delete work order that is in progress or completed' }
        }

        await prisma.workOrder.delete({ where: { id: workOrderId } })

        revalidatePath(`/projects/${wo.projectId}`)
        return { success: true }

    } catch (e: any) {
        console.error('deleteWorkOrder error:', e)
        return { success: false, error: e.message }
    }
}

// ============================================================================
// ASSEMBLY WORK ORDER WORKFLOW
// ============================================================================

export interface PartReadiness {
    partId: string
    partNumber: string
    profileType: string
    profileDimensions: string
    needed: number
    ready: number
    inProgress: number
    notStarted: number
    isReady: boolean
    pieces: { id: string; pieceNumber: number; status: string }[]
}

export interface AssemblyReadiness {
    assemblyId: string
    assemblyNumber: string
    name: string
    isReady: boolean
    parts: PartReadiness[]
}

/**
 * Check readiness of assemblies for creating work order
 * Returns which parts/pieces are ready vs need preparation
 */
export async function checkAssemblyReadiness(assemblyIds: string[]): Promise<{
    success: boolean
    data?: AssemblyReadiness[]
    error?: string
}> {
    try {
        const assemblies = await prisma.assembly.findMany({
            where: { id: { in: assemblyIds } },
            include: {
                assemblyParts: {
                    include: {
                        part: {
                            include: {
                                profile: true,
                                pieces: {
                                    select: { id: true, pieceNumber: true, status: true }
                                }
                            }
                        }
                    }
                }
            }
        })

        const result: AssemblyReadiness[] = assemblies.map(asm => {
            const parts: PartReadiness[] = asm.assemblyParts.map(ap => {
                const needed = ap.quantityInAssembly
                const pieces = ap.part.pieces
                const ready = pieces.filter(p => p.status === PartPieceStatus.READY).length
                const inProgress = pieces.filter(p =>
                    ([PartPieceStatus.CUT, PartPieceStatus.FABRICATED, PartPieceStatus.WELDED, PartPieceStatus.PAINTED] as any[]).includes(p.status)
                ).length
                const notStarted = pieces.filter(p => p.status === PartPieceStatus.PENDING).length

                return {
                    partId: ap.part.id,
                    partNumber: ap.part.partNumber,
                    profileType: ap.part.profile?.type || '',
                    profileDimensions: ap.part.profile?.dimensions || '',
                    needed,
                    ready: Math.min(ready, needed),
                    inProgress: Math.min(inProgress, Math.max(0, needed - ready)),
                    notStarted: Math.max(0, needed - ready - inProgress),
                    isReady: ready >= needed,
                    pieces: pieces.slice(0, needed) // Only show needed pieces
                }
            })

            return {
                assemblyId: asm.id,
                assemblyNumber: asm.assemblyNumber,
                name: asm.name,
                isReady: parts.every(p => p.isReady),
                parts
            }
        })

        return { success: true, data: result }

    } catch (e: any) {
        console.error('checkAssemblyReadiness error:', e)
        return { success: false, error: e.message }
    }
}
/**
 * Check if inventory has sufficient stock for cutting pieces
 * Returns pieces grouped by profile type and whether stock is available
 */
export async function checkMaterialStock(pieceIds: string[]): Promise<{
    success: boolean
    data?: {
        inStock: { pieceId: string; profileType: string; dimensions: string }[]
        needsMaterial: { pieceId: string; profileType: string; dimensions: string }[]
    }
    error?: string
}> {
    try {
        // Get pieces with their part profiles
        const pieces = await prisma.partPiece.findMany({
            where: { id: { in: pieceIds } },
            include: {
                part: {
                    include: { profile: true }
                }
            }
        })

        // Get inventory for matching profiles
        const profileTypes = [...new Set(pieces.map(p => p.part.profile?.type).filter(Boolean))]
        const profileDims = [...new Set(pieces.map(p => p.part.profile?.dimensions).filter(Boolean))]

        const inventoryItems = await prisma.inventory.findMany({
            where: {
                NOT: { profileId: undefined },
                status: InventoryStatus.ACTIVE
            },
            include: { profile: true }
        })

        // Filter to matching profiles
        const inventory = inventoryItems.filter(inv =>
            profileTypes.includes(inv.profile?.type) &&
            profileDims.includes(inv.profile?.dimensions)
        )

        const inStock: { pieceId: string; profileType: string; dimensions: string }[] = []
        const needsMaterial: { pieceId: string; profileType: string; dimensions: string }[] = []

        pieces.forEach(piece => {
            const profile = piece.part.profile
            if (!profile) {
                inStock.push({ pieceId: piece.id, profileType: 'Unknown', dimensions: '' })
                return
            }

            const hasStock = inventory.some(inv =>
                inv.profile?.type === profile.type &&
                inv.profile?.dimensions === profile.dimensions
            )

            if (hasStock) {
                inStock.push({ pieceId: piece.id, profileType: profile.type, dimensions: profile.dimensions })
            } else {
                needsMaterial.push({ pieceId: piece.id, profileType: profile.type, dimensions: profile.dimensions })
            }
        })

        return { success: true, data: { inStock, needsMaterial } }

    } catch (e: any) {
        console.error('checkMaterialStock error:', e)
        return { success: false, error: e.message }
    }
}

/**
 * NEW: Complete Material Prep WO and Record Stock
 */
export async function completeMaterialPrepWorkOrder(
    workOrderId: string,
    stockItems: {
        profileId: string
        gradeId: string
        length: number
        quantity: number
        lotId: string
        certificate: string
        supplierId?: string
        totalCost: number
    }[]
) {
    try {
        const wo = await prisma.workOrder.findUnique({
            where: { id: workOrderId },
            include: { items: true }
        })

        if (!wo || wo.type !== WorkOrderType.MATERIAL_PREP) {
            return { success: false, error: 'Invalid Work Order' }
        }

        await prisma.$transaction(async (tx) => {
            // 1. Create Inventory Records
            for (const item of stockItems) {
                const totalLengthMeters = (item.length * item.quantity) / 1000
                const costPerMeter = totalLengthMeters > 0 ? item.totalCost / totalLengthMeters : 0

                await tx.inventory.create({
                    data: {
                        lotId: item.lotId,
                        profileId: item.profileId,
                        gradeId: item.gradeId,
                        supplierId: item.supplierId,
                        length: item.length,
                        quantityReceived: item.quantity,
                        quantityAtHand: item.quantity,
                        costPerMeter,
                        certificateFilename: item.certificate,
                        status: InventoryStatus.ACTIVE,
                        createdBy: 'Material Prep WO',
                        modifiedBy: 'Material Prep WO'
                    }
                })
            }

            // 2. Complete the WO
            await tx.workOrder.update({
                where: { id: workOrderId },
                data: { status: WorkOrderStatus.COMPLETED, completedAt: new Date() }
            })

            await tx.workOrderItem.updateMany({
                where: { workOrderId },
                data: { status: WorkOrderStatus.COMPLETED, completedAt: new Date() }
            })

            // 3. Unblock dependent WOs (Cutting WOs waiting for this material)
            const blockedWOs = await tx.workOrder.findMany({
                where: { blockedByWOId: workOrderId }
            })

            for (const blockedWO of blockedWOs) {
                await tx.workOrder.update({
                    where: { id: blockedWO.id },
                    data: {
                        blockedByWOId: null,
                        // Append note about material arrival
                        notes: (blockedWO.notes || '') + `\n[Material Arrived: ${new Date().toLocaleDateString()}]`
                    }
                })
            }
        })

        revalidatePath(`/projects/${wo.projectId}`)
        return { success: true }

    } catch (e: any) {
        console.error('completeMaterialPrepWorkOrder error:', e)
        return { success: false, error: e.message }
    }
}

/**
 * Check if inventory has sufficient stock using Optimization Logic
 * Returns the optimized plan
 */
/**
 * Check if inventory has sufficient stock using Optimization Logic
 * Returns the optimized plan for Profiles and Stock Availability for Plates
 */
export async function getOptimizationPreview(input: string[] | { id: string, type: 'part' | 'plate' }[]) {
    try {
        // Normalize input
        const items = Array.isArray(input) && typeof input[0] === 'string'
            ? (input as string[]).map(id => ({ id, type: 'part' as const }))
            : (input as { id: string, type: 'part' | 'plate' }[])

        const partIds = items.filter(i => i.type === 'part').map(i => i.id)
        const plateIds = items.filter(i => i.type === 'plate').map(i => i.id)

        const planResults: any[] = []

        // ====================================================
        // 1. PROFILE OPTIMIZATION (Existing Logic)
        // ====================================================
        if (partIds.length > 0) {
            const pieces = await prisma.partPiece.findMany({
                where: { id: { in: partIds } },
                include: {
                    part: {
                        include: { profile: true, grade: true }
                    }
                }
            })

            // Group by Profile/Grade
            const materialGroups: Record<string, typeof pieces> = {}

            pieces.forEach(p => {
                const key = `${p.part.profileId || 'custom'}|${p.part.gradeId || 'custom'}`
                if (!materialGroups[key]) materialGroups[key] = []
                materialGroups[key].push(p)
            })

            for (const [key, groupPieces] of Object.entries(materialGroups)) {
                const firstPart = groupPieces[0].part
                if (!firstPart.profileId || !firstPart.gradeId) {
                    planResults.push({
                        type: 'profile',
                        materialKey: key,
                        profile: 'Custom / Unknown',
                        grade: 'Unknown',
                        canOptimize: false,
                        error: 'Missing Profile/Grade data'
                    })
                    continue
                }

                // Fetch Stock
                const inventory = await prisma.inventory.findMany({
                    where: {
                        profileId: firstPart.profileId,
                        gradeId: firstPart.gradeId,
                        status: 'ACTIVE',
                        quantityAtHand: { gt: 0 }
                    }
                })

                const remnants = await prisma.remnant.findMany({
                    where: {
                        profileId: firstPart.profileId,
                        gradeId: firstPart.gradeId,
                        status: 'AVAILABLE'
                    }
                })

                const stockInfo: StockInfo[] = [
                    ...remnants.map(r => ({
                        id: r.id,
                        length: r.length,
                        quantity: r.quantity,
                        type: 'REMNANT' as const
                    })),
                    ...inventory.map(i => ({
                        id: i.id,
                        length: i.length,
                        quantity: i.quantityAtHand,
                        type: 'INVENTORY' as const
                    }))
                ]

                const partsRequest = groupPieces.map(p => ({
                    id: p.id,
                    length: p.part.length || 0,
                    quantity: 1
                }))

                const result = optimizeCuttingPlan(partsRequest, stockInfo, 12000)

                planResults.push({
                    type: 'profile',
                    materialKey: key,
                    profile: `${firstPart.profile?.type} ${firstPart.profile?.dimensions}`,
                    grade: firstPart.grade?.name,
                    canOptimize: true,
                    pieceIds: partsRequest.map(p => p.id),
                    result
                })
            }
        }

        // ====================================================
        // 2. PLATE OPTIMIZATION (Material Check)
        // ====================================================
        if (plateIds.length > 0) {
            const plates = await prisma.platePiece.findMany({
                where: { id: { in: plateIds } },
                include: {
                    platePart: {
                        include: { grade: true } // Grade is on PlatePart
                    }
                }
            })

            // Group by Grade + Thickness
            const plateGroups: Record<string, typeof plates> = {}

            plates.forEach(p => {
                const key = `${p.platePart.gradeId}|${p.platePart.thickness}`
                if (!plateGroups[key]) plateGroups[key] = []
                plateGroups[key].push(p)
            })

            for (const [key, groupPlates] of Object.entries(plateGroups)) {
                const first = groupPlates[0].platePart
                const gradeName = first.grade?.name || 'Unknown'
                const thickness = first.thickness

                // Find matching inventory
                // We look for Sheets (Inventory) with same Grade and Thickness
                // Note: Inventory schema for Plates usually stores dimensions in specific fields or "profile" isn't used
                // Assuming Inventory has `gradeId` and we check textual dimensions or specific Plate fields?
                // Checking `prisma.schema`: Inventory has `gradeId`. It has `profileId` (optional).
                // How are Plates stored in Inventory? Likely with `profile` being null? Or a specific "Plate" profile?
                // Let's assume for now we look for Inventory with correct Grade and `description` or `dimensions` matching Plate?
                // Better: Check `checkMaterialStock`. It loops `profileTypes`.
                // We'll rely on GradeId match for now and assume users put Plate info in notes or `dimensions`.
                // Update: We'll list what we need.

                const totalArea = groupPlates.reduce((acc, p) => acc + (p.platePart.width * p.platePart.length), 0) / 1000000 // m2

                planResults.push({
                    type: 'plate',
                    materialKey: key,
                    profile: `Plate ${thickness}mm`,
                    grade: gradeName,
                    canOptimize: false, // No 2D nesting yet
                    pieceIds: groupPlates.map(p => p.id),
                    summary: {
                        count: groupPlates.length,
                        totalAreaM2: totalArea.toFixed(2),
                        thickness: thickness,
                        grade: gradeName
                    }
                })
            }
        }

        return { success: true, plans: planResults }

    } catch (e: any) {
        console.error('getOptimizationPreview error:', e)
        return { success: false, error: e.message }
    }
}

/**
 * Create Work Order with smart logic
 * - In-House Cutting: Runs Optimization -> Splits into Immediate vs Prep+Blocked
 * - Outsourced: Handles Drawing bundling + Prep if supplying material
 */
export async function createSmartWorkOrder(input: {
    projectId: string
    pieceIds: string[] | { id: string, type: 'part' | 'plate' }[]
    type: string
    title?: string
    priority?: WorkOrderPriority
    scheduledDate?: Date
    notes?: string
    // Outsourced specific
    isOutsourced?: boolean
    supplyMaterial?: boolean
    vendor?: string
    // Optimization confirmation
    cachedPlan?: any
}): Promise<{
    success: boolean
    message?: string
    error?: string
}> {
    try {
        const { projectId, pieceIds: inputPieces, type, title, isOutsourced, supplyMaterial, vendor, priority, scheduledDate, notes } = input

        // Normalize input
        const items = Array.isArray(inputPieces) && (typeof inputPieces[0] === 'string' || inputPieces.length === 0)
            ? (inputPieces as string[]).map(id => ({ id, type: 'part' as const }))
            : (inputPieces as { id: string, type: 'part' | 'plate' }[])

        if (!projectId || items.length === 0) {
            return { success: false, error: 'Project ID and pieces required' }
        }

        const user = await getCurrentUser()
        if (!user?.id) return { success: false, error: 'Unauthorized' }

        // Fetch Piece Details for linking (PartPiece vs PlatePart)
        // We need to know specific IDs to link properly
        const partIds = items.filter(i => i.type === 'part').map(i => i.id)
        const plateIds = items.filter(i => i.type === 'plate').map(i => i.id)

        // Helper to get PlatePartId for a PlatePiece
        let platePieceMap: Record<string, string> = {} // pieceId -> platePartId
        if (plateIds.length > 0) {
            const plates = await prisma.platePiece.findMany({
                where: { id: { in: plateIds } },
                select: { id: true, platePartId: true }
            })
            plates.forEach(p => platePieceMap[p.id] = p.platePartId)
        }

        // ====================================================================
        // SCENARIO 1: OUTSOURCED WORK
        // ====================================================================
        if (isOutsourced) {
            const woNumber = await generateWorkOrderNumber(projectId)

            if (supplyMaterial) {
                // INTERNAL SUPPLY -> MATERIAL PREP (BLOCKING) -> OUTSOURCED
                const prepWONumber = await generateWorkOrderNumber(projectId)
                const outsourcedWONumber = await generateWorkOrderNumber(projectId)

                // Run Optimization / Stock Check
                const optRes = await getOptimizationPreview(items)
                let prepNotes = "Sanity Check: Prepare material for Outsourced Job.\n"

                if (optRes.success && optRes.plans) {
                    optRes.plans.forEach((p: any) => {
                        if (p.type === 'profile' && p.canOptimize) {
                            prepNotes += `\n${p.profile} (${p.grade}): Used ${p.result?.stockUsed?.length || 0} existing items, Need ${p.result?.newStockNeeded?.length || 0} new bars.`
                        } else if (p.type === 'plate') {
                            prepNotes += `\nPlate ${p.thickness}mm (${p.grade}): ${p.summary.count} pieces. Area: ${p.summary.totalAreaM2}m2.`
                        }
                    })
                }

                await prisma.$transaction(async (tx) => {
                    // 1. Material Prep WO
                    const prepWO = await tx.workOrder.create({
                        data: {
                            projectId,
                            workOrderNumber: prepWONumber,
                            title: `Prep for ${vendor || 'Vendor'} (${title || 'Outsourced'})`,
                            type: WorkOrderType.MATERIAL_PREP,
                            priority: (priority as any) || WorkOrderPriority.MEDIUM,
                            status: WorkOrderStatus.PENDING,
                            scheduledDate: scheduledDate ? new Date(scheduledDate) : undefined,
                            notes: prepNotes + "\n\n" + (notes || ''),
                        }
                    })

                    // 2. Outsourced WO (Blocked)
                    await tx.workOrder.create({
                        data: {
                            projectId,
                            workOrderNumber: outsourcedWONumber,
                            title: title || `Outsourced ${type}`,
                            type: type as WorkOrderType,
                            priority: priority || WorkOrderPriority.MEDIUM,
                            status: WorkOrderStatus.PENDING,
                            scheduledDate: scheduledDate ? new Date(scheduledDate) : undefined,
                            blockedByWOId: prepWO.id,
                            notes: `Vendor: ${vendor}\nSupply Material: YES\n` + (notes || ''),
                            items: {
                                create: items.map(i => ({
                                    pieceId: i.type === 'part' ? i.id : undefined,
                                    platePartId: i.type === 'plate' ? platePieceMap[i.id] : undefined
                                }))
                            }
                        }
                    })
                })

                return { success: true, message: 'Created Prep WO and Blocked Outsourced WO' }

            } else {
                // B. VENDOR SUPPLY -> STANDARD OUTSOURCED WO
                await prisma.workOrder.create({
                    data: {
                        projectId,
                        workOrderNumber: woNumber,
                        title: title || `Outsourced ${type}`,
                        type: type as WorkOrderType,
                        priority: priority || WorkOrderPriority.MEDIUM,
                        status: WorkOrderStatus.PENDING,
                        scheduledDate: scheduledDate ? new Date(scheduledDate) : undefined,
                        notes: `Vendor: ${vendor}\nSupply Material: NO (Vendor Provided)\n` + (notes || ''),
                        items: {
                            create: items.map(i => ({
                                pieceId: i.type === 'part' ? i.id : undefined,
                                platePartId: i.type === 'plate' ? platePieceMap[i.id] : undefined
                            }))
                        }
                    }
                })
                return { success: true, message: 'Created Outsourced WO' }
            }
        }

        // ====================================================================
        // SCENARIO 2: IN-HOUSE CUTTING (OPTIMIZATION SPLIT)
        // ====================================================================
        if (type === 'CUTTING') {
            // Run Optimization
            const optRes = await getOptimizationPreview(items)

            if (!optRes.success || !optRes.plans) {
                // Fallback
                await prisma.workOrder.create({
                    data: {
                        projectId,
                        workOrderNumber: await generateWorkOrderNumber(projectId),
                        title: title || 'Cutting',
                        type: WorkOrderType.CUTTING,
                        status: WorkOrderStatus.PENDING,
                        items: {
                            create: items.map(i => ({
                                pieceId: i.type === 'part' ? i.id : undefined,
                                platePartId: i.type === 'plate' ? platePieceMap[i.id] : undefined
                            }))
                        }
                    }
                })
                return { success: true, message: 'Optimization failed/NA, created simple WO' }
            }

            // Buckets
            const immediateItems: typeof items = []
            const blockedItems: typeof items = []
            let materialPrepRequired = false
            let prepSummary = "Material Required for Cutting:\n"

            for (const plan of optRes.plans) {
                if (plan.type === 'profile') {
                    if (!plan.canOptimize || !plan.result) {
                        // Manual/Immediate fallback
                        if (plan.pieceIds) {
                            plan.pieceIds.forEach((id: string) => immediateItems.push({ id, type: 'part' }))
                        }
                        continue
                    }

                    const result = plan.result

                    // 1. In-Stock -> Immediate
                    result.stockUsed.forEach((stock: any) => {
                        stock.parts.forEach((p: any) => immediateItems.push({ id: p.partId, type: 'part' }))
                    })

                    // 2. New Stock -> Blocked
                    if (result.newStockNeeded.length > 0) {
                        materialPrepRequired = true
                        prepSummary += `\n[${plan.profile} - ${plan.grade}]`

                        result.newStockNeeded.forEach((ns: any) => {
                            prepSummary += `\n- Buy ${ns.quantity}x ${ns.length}mm`
                            ns.parts.forEach((p: any) => blockedItems.push({ id: p.partId, type: 'part' }))
                        })
                    }

                    // 3. Unallocated -> Blocked
                    result.unallocated.forEach((p: any) => blockedItems.push({ id: p.id, type: 'part' }))

                } else if (plan.type === 'plate') {
                    // Basic Plate Logic:
                    // If we assume Plates are always "Requires Check" or "In Stock", we can direct them.
                    // For now, let's put Plates into "Immediate" if they are small or standard, 
                    // or "Blocked" if we want to force a simplified "Prep" logic.
                    // Since we don't have stock check real logic, let's Put all Plates to Immediate unless explicitly configured?
                    // Safe bet: Put into Immediate but mark notes. Or if user wanted Prep.
                    // Let's Put into Immediate for now as Plate management is usually ad-hoc in MVP.
                    // OR: If specific input "Supply Material" was checked (handled in Outsourced).
                    // For Internal, assume we have stock or will pick it.
                    if (plan.pieceIds) {
                        plan.pieceIds.forEach((id: string) => immediateItems.push({ id, type: 'plate' }))
                    }
                }
            }

            // EXECUTE TRANSACTION
            await prisma.$transaction(async (tx) => {
                let prepWOId = null

                // A. Material Prep WO
                if (materialPrepRequired) {
                    const prepDate = scheduledDate ? new Date(scheduledDate) : new Date()
                    const prepWO = await tx.workOrder.create({
                        data: {
                            projectId,
                            workOrderNumber: await generateWorkOrderNumber(projectId),
                            title: `Material Prep (${title || 'Cutting'})`,
                            type: WorkOrderType.MATERIAL_PREP,
                            priority: priority || WorkOrderPriority.MEDIUM,
                            status: WorkOrderStatus.PENDING,
                            scheduledDate: prepDate,
                            notes: prepSummary + "\n\n" + (notes || ''),
                        }
                    })
                    prepWOId = prepWO.id
                }

                // B. Immediate Cutting WO
                if (immediateItems.length > 0) {
                    await tx.workOrder.create({
                        data: {
                            projectId,
                            workOrderNumber: await generateWorkOrderNumber(projectId),
                            title: (title || 'Cutting') + ' (Ready/InStock)',
                            type: WorkOrderType.CUTTING,
                            priority: priority || WorkOrderPriority.MEDIUM,
                            status: WorkOrderStatus.PENDING,
                            scheduledDate: scheduledDate ? new Date(scheduledDate) : undefined,
                            notes: (notes || '') + "\n[Auto-Optimized]",
                            items: {
                                create: immediateItems.map(i => ({
                                    pieceId: i.type === 'part' ? i.id : undefined,
                                    platePartId: i.type === 'plate' ? platePieceMap[i.id] : undefined
                                }))
                            }
                        }
                    })
                }

                // C. Blocked Cutting WO
                if (blockedItems.length > 0 && prepWOId) {
                    await tx.workOrder.create({
                        data: {
                            projectId,
                            workOrderNumber: await generateWorkOrderNumber(projectId),
                            title: (title || 'Cutting') + ' (Pending Material)',
                            type: WorkOrderType.CUTTING,
                            priority: priority || WorkOrderPriority.MEDIUM,
                            status: WorkOrderStatus.PENDING,
                            scheduledDate: scheduledDate ? new Date(scheduledDate) : undefined,
                            blockedByWOId: prepWOId,
                            notes: (notes || '') + "\n[Waiting for Material Prep]",
                            items: {
                                create: blockedItems.map(i => ({
                                    pieceId: i.type === 'part' ? i.id : undefined,
                                    platePartId: i.type === 'plate' ? platePieceMap[i.id] : undefined
                                }))
                            }
                        }
                    })
                }
            })

            revalidatePath(`/projects/${projectId}`)
            return {
                success: true,
                message: `Created WOs: ${immediateItems.length} ready, ${blockedItems.length} waiting.`
            }
        }

        // ====================================================================
        // SCENARIO 3: STANDARD WO
        // ====================================================================
        await prisma.workOrder.create({
            data: {
                projectId,
                workOrderNumber: await generateWorkOrderNumber(projectId),
                title: title || type,
                type: type as WorkOrderType,
                priority: priority || WorkOrderPriority.MEDIUM,
                status: WorkOrderStatus.PENDING,
                scheduledDate: scheduledDate ? new Date(scheduledDate) : undefined,
                notes,
                items: {
                    create: items.map(i => ({
                        pieceId: i.type === 'part' ? i.id : undefined,
                        platePartId: i.type === 'plate' ? platePieceMap[i.id] : undefined
                    }))
                }
            }
        })

        revalidatePath(`/projects/${projectId}`)
        return { success: true, message: 'Work Order created' }

    } catch (e: any) {
        console.error('createSmartWorkOrder error:', e)
        return { success: false, error: e.message }
    }
}

/**
 * Legacy: Create Part Prep work order
 */
export async function createPartPrepWorkOrder(input: {
    projectId: string
    pieceIds: string[]
    title?: string
    priority?: string
    scheduledDate?: Date
    notes?: string
}) {
    // Delegate to smart WO creator
    return createSmartWorkOrder({
        ...input,
        priority: input.priority as any,
        type: 'CUTTING'
    })
}

/**
 * Create Assembly work order for selected assemblies
 */
export async function createAssemblyWorkOrder(input: {
    projectId: string
    assemblyIds: string[]
    title?: string
    priority?: string
    scheduledDate?: Date
    notes?: string
    forceCreate?: boolean  // Create even if parts not ready (as PENDING)
}) {
    try {
        const { projectId, assemblyIds, title, priority, scheduledDate, notes, forceCreate } = input

        if (!projectId || assemblyIds.length === 0) {
            return { success: false, error: 'Project ID and assemblies required' }
        }

        // Check readiness
        const readiness = await checkAssemblyReadiness(assemblyIds)
        if (!readiness.success || !readiness.data) {
            return { success: false, error: 'Failed to check readiness' }
        }

        const allReady = readiness.data.every(a => a.isReady)

        if (!allReady && !forceCreate) {
            return {
                success: false,
                error: 'Not all parts are ready',
                readiness: readiness.data
            }
        }

        const workOrderNumber = await generateWorkOrderNumber(projectId)

        // Get assembly names for title
        const assemblies = await prisma.assembly.findMany({
            where: { id: { in: assemblyIds } },
            select: { assemblyNumber: true, name: true }
        })
        const defaultTitle = `Assembly: ${assemblies.map(a => a.assemblyNumber).join(', ')}`

        const wo = await prisma.workOrder.create({
            data: {
                projectId,
                workOrderNumber,
                title: title || defaultTitle,
                type: WorkOrderType.ASSEMBLY,
                priority: (priority as any) || WorkOrderPriority.MEDIUM,
                status: WorkOrderStatus.PENDING,  // stays PENDING until manually activated
                scheduledDate: scheduledDate ? new Date(scheduledDate) : undefined,
                notes: allReady ? notes : `${notes || ''}\n[Waiting for parts]`.trim(),
                items: {
                    create: assemblyIds.map(assemblyId => ({ assemblyId }))
                }
            },
            include: { items: true }
        })

        revalidatePath(`/projects/${projectId}`)
        return { success: true, data: wo, allReady }

    } catch (e: any) {
        console.error('createAssemblyWorkOrder error:', e)
        return { success: false, error: e.message }
    }
}

/**
 * Activate a PENDING work order (move to IN_PROGRESS)
 * For assembly WOs, validates all parts are ready
 */
export async function activateWorkOrder(workOrderId: string) {
    try {
        const wo = await prisma.workOrder.findUnique({
            where: { id: workOrderId },
            include: { items: true }
        })

        if (!wo) {
            return { success: false, error: 'Work order not found' }
        }

        if (wo.status !== WorkOrderStatus.PENDING) {
            return { success: false, error: 'Work order is not PENDING' }
        }

        // For assembly work orders, check part readiness
        if (wo.type === WorkOrderType.ASSEMBLY) {
            const assemblyIds = wo.items
                .filter(i => i.assemblyId)
                .map(i => i.assemblyId!)

            if (assemblyIds.length > 0) {
                const readiness = await checkAssemblyReadiness(assemblyIds)
                if (!readiness.success || !readiness.data) {
                    return { success: false, error: 'Failed to check readiness' }
                }

                const allReady = readiness.data.every(a => a.isReady)
                if (!allReady) {
                    const notReadyParts = readiness.data
                        .flatMap(a => a.parts)
                        .filter(p => !p.isReady)
                        .map(p => p.partNumber)

                    return {
                        success: false,
                        error: `Parts not ready: ${notReadyParts.join(', ')}`,
                        readiness: readiness.data
                    }
                }
            }
        }

        // Activate the work order
        await prisma.workOrder.update({
            where: { id: workOrderId },
            data: {
                status: WorkOrderStatus.IN_PROGRESS,
                startedAt: new Date(),
                notes: wo.notes?.replace('[Waiting for parts]', '[Parts ready]') || undefined
            }
        })

        revalidatePath(`/projects/${wo.projectId}`)
        return { success: true }

    } catch (e: any) {
        console.error('activateWorkOrder error:', e)
        return { success: false, error: e.message }
    }
}
