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
