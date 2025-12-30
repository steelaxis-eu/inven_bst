'use server'

import prisma from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

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
        const { projectId, partNumber, quantity, unitWeight, thickness, width, length, gradeId, ...rest } = input

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

        const part = await prisma.platePart.create({
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

        revalidatePath(`/projects/${projectId}`)
        return { success: true, data: part }

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
            }
        }
    })
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
    status: 'PENDING' | 'ORDERED' | 'IN_PRODUCTION' | 'RECEIVED' | 'QC_PASSED',
    additionalData?: {
        poNumber?: string
        expectedDate?: Date
        receivedQty?: number
    }
) {
    try {
        const updateData: any = { status }

        switch (status) {
            case 'ORDERED':
                updateData.orderedAt = new Date()
                if (additionalData?.poNumber) updateData.poNumber = additionalData.poNumber
                if (additionalData?.expectedDate) updateData.expectedDate = new Date(additionalData.expectedDate)
                break
            case 'RECEIVED':
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

        if (part.status !== 'PENDING') {
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
