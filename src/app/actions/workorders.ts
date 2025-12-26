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
 */
export async function updateWorkOrderItemStatus(
    itemId: string,
    status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED'
) {
    try {
        const updateData: any = { status }

        if (status === 'COMPLETED') {
            updateData.completedAt = new Date()
        }

        await prisma.workOrderItem.update({
            where: { id: itemId },
            data: updateData
        })

        return { success: true }

    } catch (e: any) {
        console.error('updateWorkOrderItemStatus error:', e)
        return { success: false, error: e.message }
    }
}

/**
 * Complete work order and update all piece statuses
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
            const pieceIds = wo.items.filter(i => i.pieceId).map(i => i.pieceId!)

            if (pieceIds.length > 0) {
                const now = new Date()
                const statusField: Record<string, any> = {}

                switch (wo.type) {
                    case 'CUTTING':
                        statusField.status = 'CUT'
                        statusField.cutAt = now
                        break
                    case 'FABRICATION':
                        statusField.status = 'FABRICATED'
                        statusField.fabricatedAt = now
                        break
                    case 'WELDING':
                        statusField.status = 'WELDED'
                        statusField.weldedAt = now
                        break
                    case 'PAINTING':
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
        })

        revalidatePath(`/projects/${wo.projectId}`)
        return { success: true }

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
 * Create Part Prep work order (CUTTING type) for pieces that need fabrication
 */
export async function createPartPrepWorkOrder(input: {
    projectId: string
    pieceIds: string[]
    title?: string
    priority?: string
    scheduledDate?: Date
    notes?: string
}) {
    try {
        const { projectId, pieceIds, title, priority, scheduledDate, notes } = input

        if (!projectId || pieceIds.length === 0) {
            return { success: false, error: 'Project ID and pieces required' }
        }

        const workOrderNumber = await generateWorkOrderNumber(projectId)

        const wo = await prisma.workOrder.create({
            data: {
                projectId,
                workOrderNumber,
                title: title || 'Part Preparation',
                type: 'CUTTING',
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
        return { success: true, data: wo }

    } catch (e: any) {
        console.error('createPartPrepWorkOrder error:', e)
        return { success: false, error: e.message }
    }
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
