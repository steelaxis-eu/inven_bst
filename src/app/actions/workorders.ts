'use server'

import prisma from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { getCurrentUser } from '@/lib/auth'

// ============================================================================
// WORK ORDER CRUD
// ============================================================================

export interface CreateWorkOrderInput {
    projectId: string
    title: string
    type: string        // CUTTING, FABRICATION, WELDING, PAINTING, ASSEMBLY
    description?: string
    priority?: string   // LOW, MEDIUM, HIGH, URGENT
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
                priority: rest.priority || 'MEDIUM',
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
    status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'
) {
    try {
        const updateData: any = { status }

        if (status === 'IN_PROGRESS') {
            updateData.startedAt = new Date()
        } else if (status === 'COMPLETED') {
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
    status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED',
    options?: { needsMachining?: boolean }
) {
    try {
        const updateData: any = { status }

        if (status === 'COMPLETED') {
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
        if (status === 'COMPLETED' && item.pieceId && item.workOrder.type === 'CUTTING') {
            // Store the machining flag on the piece (we'll use notes for now)
            if (options?.needsMachining) {
                await prisma.partPiece.update({
                    where: { id: item.pieceId },
                    data: {
                        status: 'CUT',
                        cutAt: new Date(),
                        // We'll track this in the part notes or create immediate WO
                    }
                })
            } else {
                await prisma.partPiece.update({
                    where: { id: item.pieceId },
                    data: {
                        status: 'CUT',
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

        if (wo.type !== 'CUTTING') {
            return { success: false, error: 'This is only for CUTTING work orders' }
        }

        const allPieceIds = wo.items.filter(i => i.pieceId).map(i => i.pieceId!)
        const directToWelding = allPieceIds.filter(id => !machinedPieceIds.includes(id))

        // Complete the cutting WO
        await prisma.$transaction(async (tx) => {
            await tx.workOrder.update({
                where: { id: workOrderId },
                data: { status: 'COMPLETED', completedAt: new Date() }
            })

            await tx.workOrderItem.updateMany({
                where: { workOrderId, status: { not: 'COMPLETED' } },
                data: { status: 'COMPLETED', completedAt: new Date() }
            })

            // Update all pieces to CUT status
            await tx.partPiece.updateMany({
                where: { id: { in: allPieceIds } },
                data: { status: 'CUT', cutAt: new Date() }
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
                    type: 'MACHINING',
                    priority: wo.priority,
                    status: 'PENDING',
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
                    type: 'WELDING',
                    priority: wo.priority,
                    status: 'PENDING',
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

        const pieceIds = wo.items.filter(i => i.pieceId).map(i => i.pieceId!)

        await prisma.$transaction(async (tx) => {
            // Mark work order as completed
            await tx.workOrder.update({
                where: { id: workOrderId },
                data: { status: 'COMPLETED', completedAt: new Date() }
            })

            // Mark all items as completed
            await tx.workOrderItem.updateMany({
                where: { workOrderId, status: { not: 'COMPLETED' } },
                data: { status: 'COMPLETED', completedAt: new Date() }
            })

            // Update piece statuses based on work order type
            if (pieceIds.length > 0) {
                const now = new Date()
                const statusField: Record<string, any> = {}

                switch (wo.type) {
                    case 'MATERIAL_PREP':
                        // Material is now available - no piece status change
                        break
                    case 'CUTTING':
                        statusField.status = 'CUT'
                        statusField.cutAt = now
                        break
                    case 'MACHINING':
                        statusField.status = 'FABRICATED'
                        statusField.fabricatedAt = now
                        break
                    case 'FABRICATION':
                        statusField.status = 'FABRICATED'
                        statusField.fabricatedAt = now
                        break
                    case 'WELDING':
                        statusField.status = 'WELDED'
                        statusField.weldedAt = now
                        break
                    case 'COATING':
                        statusField.status = 'PAINTED'
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
                where: { blockedByWOId: workOrderId, status: 'PENDING' },
                data: {
                    blockedByWOId: null
                }
            })
        })

        // Auto-create follow-up WO based on type
        // Note: WELDING WO is created at assembly level when all parts are ready
        // Only WELDING→COATING is auto-created
        let followUpWO = null

        if (wo.type === 'WELDING' && pieceIds.length > 0) {
            // Auto-create COATING WO after WELDING completes
            const woNumber = await generateWorkOrderNumber(wo.projectId)
            followUpWO = await prisma.workOrder.create({
                data: {
                    projectId: wo.projectId,
                    workOrderNumber: woNumber,
                    title: `Coating (from ${wo.workOrderNumber})`,
                    type: 'COATING',
                    priority: wo.priority,
                    status: 'PENDING',
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

        if (!['PENDING', 'CANCELLED'].includes(wo.status)) {
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
                const ready = pieces.filter(p => p.status === 'READY').length
                const inProgress = pieces.filter(p =>
                    ['CUT', 'FABRICATED', 'WELDED', 'PAINTED'].includes(p.status)
                ).length
                const notStarted = pieces.filter(p => p.status === 'NOT_STARTED').length

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
                status: 'AVAILABLE'
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

        if (!wo || wo.type !== 'MATERIAL_PREP') {
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
                        status: 'ACTIVE',
                        createdBy: 'Material Prep WO',
                        modifiedBy: 'Material Prep WO'
                    }
                })
            }

            // 2. Complete the WO
            await tx.workOrder.update({
                where: { id: workOrderId },
                data: { status: 'COMPLETED', completedAt: new Date() }
            })

            await tx.workOrderItem.updateMany({
                where: { workOrderId },
                data: { status: 'COMPLETED', completedAt: new Date() }
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
 * Create Work Order with smart stock checking
 * - If CUTTING and no stock: Creates MATERIAL_PREP first, then CUTTING blocked by it
 * - Otherwise creates the requested WO type
 */
export async function createSmartWorkOrder(input: {
    projectId: string
    pieceIds: string[]
    type: 'MATERIAL_PREP' | 'CUTTING' | 'MACHINING' | 'FABRICATION' | 'WELDING' | 'PAINTING'
    title?: string
    priority?: string
    scheduledDate?: Date
    notes?: string
}): Promise<{
    success: boolean
    data?: { mainWO: any; prepWO?: any }
    needsMaterialPrep?: boolean
    error?: string
}> {
    try {
        const { projectId, pieceIds, type, title, priority, scheduledDate, notes } = input

        if (!projectId || pieceIds.length === 0) {
            return { success: false, error: 'Project ID and pieces required' }
        }

        // For CUTTING, check stock first and OPTIMIZE
        if (type === 'CUTTING') {
            const stockCheck = await checkMaterialStock(pieceIds)
            if (!stockCheck.success) {
                return { success: false, error: stockCheck.error }
            }

            const { inStock, needsMaterial } = stockCheck.data!
            let createdMainWO = null
            let createdPrepWO = null

            // 1. Create Active Cutting WO for "In Stock" pieces (Optimization: Cut straight away)
            if (inStock.length > 0) {
                const workOrderNumber = await generateWorkOrderNumber(projectId)

                // Add suffix if we are splitting
                const titleSuffix = needsMaterial.length > 0 ? ' (Batch 1 - In Stock)' : ''

                createdMainWO = await prisma.workOrder.create({
                    data: {
                        projectId,
                        workOrderNumber,
                        title: (title || 'Cutting') + titleSuffix,
                        type: 'CUTTING',
                        priority: priority || 'MEDIUM',
                        status: 'PENDING', // Active immediately!
                        scheduledDate: scheduledDate ? new Date(scheduledDate) : undefined,
                        notes: notes,
                        items: {
                            create: inStock.map(m => ({ pieceId: m.pieceId }))
                        }
                    },
                    include: { items: true }
                })
            }

            // 2. Create Material Prep + Blocked Cutting WO for "Needs Material" pieces
            if (needsMaterial.length > 0) {
                const prepWONumber = await generateWorkOrderNumber(projectId)
                const blockedWONumber = await generateWorkOrderNumber(projectId)

                // Create MATERIAL_PREP WO
                createdPrepWO = await prisma.workOrder.create({
                    data: {
                        projectId,
                        workOrderNumber: prepWONumber,
                        title: `Material Prep: ${[...new Set(needsMaterial.map(m => m.profileType))].join(', ')}`,
                        type: 'MATERIAL_PREP',
                        priority: priority || 'MEDIUM',
                        status: 'PENDING',
                        scheduledDate: scheduledDate ? new Date(scheduledDate) : undefined,
                        notes: `Profiles needed:\n${[...new Set(needsMaterial.map(m => `${m.profileType} ${m.dimensions}`))].join('\n')}`,
                        items: {
                            create: needsMaterial.map(m => ({ pieceId: m.pieceId }))
                        }
                    }
                })

                // Create Cutting WO blocked by Prep WO
                await prisma.workOrder.create({
                    data: {
                        projectId,
                        workOrderNumber: blockedWONumber,
                        title: (title || 'Cutting') + ' (Batch 2 - Pending Material)',
                        type: 'CUTTING',
                        priority: priority || 'MEDIUM',
                        status: 'PENDING',
                        blockedByWOId: createdPrepWO.id,
                        scheduledDate: scheduledDate ? new Date(scheduledDate) : undefined,
                        notes: `[Waiting for material - ${createdPrepWO.workOrderNumber}]\n${notes || ''}`.trim(),
                        items: {
                            create: needsMaterial.map(m => ({ pieceId: m.pieceId }))
                        }
                    }
                })
            }

            revalidatePath(`/projects/${projectId}`)
            return {
                success: true,
                data: { mainWO: createdMainWO, prepWO: createdPrepWO },
                needsMaterialPrep: needsMaterial.length > 0
            }
        }

        // Default behavior for other types (or if no stock check logic needed)
        const workOrderNumber = await generateWorkOrderNumber(projectId)
        const wo = await prisma.workOrder.create({
            data: {
                projectId,
                workOrderNumber,
                title: title || type,
                type,
                priority: priority || 'MEDIUM',
                status: 'PENDING',
                scheduledDate: scheduledDate ? new Date(scheduledDate) : undefined,
                notes,
                items: {
                    create: pieceIds.map(pieceId => ({ pieceId }))
                }
            },
            include: { items: true }
        })

        revalidatePath(`/projects/${projectId}`)
        return { success: true, data: { mainWO: wo } }

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
                type: 'ASSEMBLY',
                priority: priority || 'MEDIUM',
                status: allReady ? 'PENDING' : 'PENDING',  // stays PENDING until manually activated
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

        if (wo.status !== 'PENDING') {
            return { success: false, error: 'Work order is not PENDING' }
        }

        // For assembly work orders, check part readiness
        if (wo.type === 'ASSEMBLY') {
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
                status: 'IN_PROGRESS',
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
