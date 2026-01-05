'use server'

import prisma from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { DeliveryStatus, AssemblyStatus, PartPieceStatus } from '@prisma/client'

// ============================================================================
// DELIVERY SCHEDULE CRUD
// ============================================================================

export interface CreateDeliveryScheduleInput {
    projectId: string
    name: string
    scheduledDate: Date
    notes?: string
}

/**
 * Create a new delivery schedule
 */
export async function createDeliverySchedule(input: CreateDeliveryScheduleInput) {
    try {
        const { projectId, name, scheduledDate, notes } = input

        if (!projectId || !name || !scheduledDate) {
            return { success: false, error: 'Missing required fields' }
        }

        const schedule = await prisma.deliverySchedule.create({
            data: {
                projectId,
                name,
                scheduledDate: new Date(scheduledDate),
                notes
            }
        })

        revalidatePath(`/projects/${projectId}`)
        return { success: true, data: schedule }

    } catch (e: any) {
        console.error('createDeliverySchedule error:', e)
        return { success: false, error: e.message }
    }
}

/**
 * Get all delivery schedules for a project
 */
export async function getProjectDeliverySchedules(projectId: string) {
    return await prisma.deliverySchedule.findMany({
        where: { projectId },
        include: {
            items: {
                include: {
                    assembly: true
                }
            }
        },
        orderBy: { scheduledDate: 'asc' }
    })
}

/**
 * Get a single delivery schedule with details
 */
export async function getDeliverySchedule(scheduleId: string) {
    return await prisma.deliverySchedule.findUnique({
        where: { id: scheduleId },
        include: {
            items: {
                include: {
                    assembly: {
                        include: {
                            assemblyParts: {
                                include: {
                                    part: {
                                        include: { pieces: true }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    })
}

/**
 * Update delivery schedule
 */
export async function updateDeliverySchedule(
    scheduleId: string,
    data: Partial<Omit<CreateDeliveryScheduleInput, 'projectId'>>
) {
    try {
        const schedule = await prisma.deliverySchedule.update({
            where: { id: scheduleId },
            data: {
                ...data,
                scheduledDate: data.scheduledDate ? new Date(data.scheduledDate) : undefined
            }
        })

        revalidatePath(`/projects/${schedule.projectId}`)
        return { success: true, data: schedule }

    } catch (e: any) {
        console.error('updateDeliverySchedule error:', e)
        return { success: false, error: e.message }
    }
}

/**
 * Update delivery schedule status
 */
export async function updateDeliveryStatus(
    scheduleId: string,
    status: DeliveryStatus
) {
    try {
        const updateData: any = { status }

        if (status === DeliveryStatus.SHIPPED) {
            updateData.shippedAt = new Date()
        } else if (status === DeliveryStatus.DELIVERED) {
            updateData.deliveredAt = new Date()
        }

        const schedule = await prisma.deliverySchedule.update({
            where: { id: scheduleId },
            data: updateData
        })

        // Also update associated assemblies
        if (status === DeliveryStatus.SHIPPED) {
            const items = await prisma.deliveryItem.findMany({
                where: { deliveryScheduleId: scheduleId }
            })

            await prisma.assembly.updateMany({
                where: { id: { in: items.map(i => i.assemblyId) } },
                data: { status: AssemblyStatus.SHIPPED, shippedAt: new Date() }
            })
        }

        revalidatePath(`/projects/${schedule.projectId}`)
        return { success: true }

    } catch (e: any) {
        console.error('updateDeliveryStatus error:', e)
        return { success: false, error: e.message }
    }
}

/**
 * Delete a delivery schedule
 */
export async function deleteDeliverySchedule(scheduleId: string) {
    try {
        const schedule = await prisma.deliverySchedule.findUnique({
            where: { id: scheduleId }
        })

        if (!schedule) {
            return { success: false, error: 'Schedule not found' }
        }

        if (schedule.status !== DeliveryStatus.PENDING) {
            return { success: false, error: 'Cannot delete shipped or delivered schedule' }
        }

        await prisma.deliverySchedule.delete({ where: { id: scheduleId } })

        revalidatePath(`/projects/${schedule.projectId}`)
        return { success: true }

    } catch (e: any) {
        console.error('deleteDeliverySchedule error:', e)
        return { success: false, error: e.message }
    }
}

// ============================================================================
// DELIVERY ITEMS (Which assemblies in which delivery)
// ============================================================================

/**
 * Add an assembly to a delivery schedule
 */
export async function addAssemblyToDelivery(scheduleId: string, assemblyId: string) {
    try {
        // Validate same project
        const [schedule, assembly] = await Promise.all([
            prisma.deliverySchedule.findUnique({ where: { id: scheduleId } }),
            prisma.assembly.findUnique({ where: { id: assemblyId } })
        ])

        if (!schedule || !assembly) {
            return { success: false, error: 'Schedule or assembly not found' }
        }

        if (schedule.projectId !== assembly.projectId) {
            return { success: false, error: 'Assembly and schedule must belong to same project' }
        }

        await prisma.deliveryItem.create({
            data: {
                deliveryScheduleId: scheduleId,
                assemblyId
            }
        })

        revalidatePath(`/projects/${schedule.projectId}`)
        return { success: true }

    } catch (e: any) {
        if (e.code === 'P2002') {
            return { success: false, error: 'Assembly is already in this delivery' }
        }
        console.error('addAssemblyToDelivery error:', e)
        return { success: false, error: e.message }
    }
}

/**
 * Remove an assembly from a delivery schedule
 */
export async function removeAssemblyFromDelivery(scheduleId: string, assemblyId: string) {
    try {
        await prisma.deliveryItem.delete({
            where: {
                deliveryScheduleId_assemblyId: { deliveryScheduleId: scheduleId, assemblyId }
            }
        })

        return { success: true }

    } catch (e: any) {
        console.error('removeAssemblyFromDelivery error:', e)
        return { success: false, error: e.message }
    }
}

// ============================================================================
// DELIVERY PROGRESS & READINESS
// ============================================================================

/**
 * Check if all assemblies in a delivery are ready
 */
export async function getDeliveryReadiness(scheduleId: string) {
    const schedule = await prisma.deliverySchedule.findUnique({
        where: { id: scheduleId },
        include: {
            items: {
                include: {
                    assembly: {
                        include: {
                            assemblyParts: {
                                include: {
                                    part: {
                                        include: { pieces: true }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    })

    if (!schedule) {
        return null
    }

    const assemblyReadiness = schedule.items.map(item => {
        const assembly = item.assembly
        let totalPiecesNeeded = 0
        let totalPiecesReady = 0

        for (const ap of assembly.assemblyParts) {
            const piecesNeeded = ap.quantityInAssembly
            const readyPieces = ap.part.pieces.filter(p => p.status === PartPieceStatus.READY).length
            const available = Math.min(readyPieces, piecesNeeded)

            totalPiecesNeeded += piecesNeeded
            totalPiecesReady += available
        }

        return {
            assemblyId: assembly.id,
            assemblyNumber: assembly.assemblyNumber,
            name: assembly.name,
            status: assembly.status,
            totalPieces: totalPiecesNeeded,
            readyPieces: totalPiecesReady,
            isReady: totalPiecesReady >= totalPiecesNeeded,
            percentComplete: totalPiecesNeeded > 0
                ? Math.round((totalPiecesReady / totalPiecesNeeded) * 100)
                : 100
        }
    })

    const allReady = assemblyReadiness.every(a => a.isReady)
    const overallPercent = assemblyReadiness.length > 0
        ? Math.round(assemblyReadiness.reduce((sum, a) => sum + a.percentComplete, 0) / assemblyReadiness.length)
        : 100

    return {
        scheduleId,
        name: schedule.name,
        scheduledDate: schedule.scheduledDate,
        status: schedule.status,
        assemblies: assemblyReadiness,
        overallReadiness: overallPercent,
        isReadyToShip: allReady
    }
}

/**
 * Get upcoming deliveries with readiness status
 */
export async function getUpcomingDeliveries(projectId: string, daysAhead: number = 30) {
    const futureDate = new Date()
    futureDate.setDate(futureDate.getDate() + daysAhead)

    const schedules = await prisma.deliverySchedule.findMany({
        where: {
            projectId,
            status: DeliveryStatus.PENDING,
            scheduledDate: { lte: futureDate }
        },
        include: {
            items: {
                include: {
                    assembly: {
                        include: {
                            assemblyParts: {
                                include: {
                                    part: {
                                        include: { pieces: true }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        },
        orderBy: { scheduledDate: 'asc' }
    })

    return schedules.map(schedule => {
        let totalPieces = 0
        let readyPieces = 0

        schedule.items.forEach(item => {
            item.assembly.assemblyParts.forEach(ap => {
                const needed = ap.quantityInAssembly
                const ready = ap.part.pieces.filter(p => p.status === PartPieceStatus.READY).length
                totalPieces += needed
                readyPieces += Math.min(ready, needed)
            })
        })

        const daysUntil = Math.ceil(
            (new Date(schedule.scheduledDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        )

        return {
            id: schedule.id,
            name: schedule.name,
            scheduledDate: schedule.scheduledDate,
            daysUntil,
            assemblyCount: schedule.items.length,
            totalPieces,
            readyPieces,
            percentReady: totalPieces > 0 ? Math.round((readyPieces / totalPieces) * 100) : 100,
            isOverdue: daysUntil < 0,
            isReadyToShip: readyPieces >= totalPieces
        }
    })
}
