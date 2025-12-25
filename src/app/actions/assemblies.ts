'use server'

import prisma from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

// ============================================================================
// ASSEMBLY CRUD
// ============================================================================

export interface CreateAssemblyInput {
    projectId: string
    assemblyNumber: string
    name: string
    description?: string
    parentId?: string
    sequence?: number
    scheduledDate?: Date
    notes?: string
}

/**
 * Create a new assembly
 */
export async function createAssembly(input: CreateAssemblyInput) {
    try {
        const { projectId, assemblyNumber, name, ...rest } = input

        if (!projectId || !assemblyNumber || !name) {
            return { success: false, error: 'Missing required fields' }
        }

        const assembly = await prisma.assembly.create({
            data: {
                projectId,
                assemblyNumber,
                name,
                ...rest
            }
        })

        revalidatePath(`/projects/${projectId}`)
        return { success: true, data: assembly }

    } catch (e: any) {
        if (e.code === 'P2002') {
            return { success: false, error: 'Assembly number already exists in this project' }
        }
        console.error('createAssembly error:', e)
        return { success: false, error: e.message }
    }
}

/**
 * Get all assemblies for a project (hierarchical)
 */
export async function getProjectAssemblies(projectId: string) {
    const assemblies = await prisma.assembly.findMany({
        where: { projectId },
        include: {
            parent: true,
            children: true,
            assemblyParts: {
                include: {
                    part: {
                        include: {
                            profile: true,
                            pieces: true
                        }
                    }
                }
            },
            deliveryItems: {
                include: {
                    deliverySchedule: true
                }
            }
        },
        orderBy: [
            { sequence: 'asc' },
            { assemblyNumber: 'asc' }
        ]
    })

    return assemblies
}

/**
 * Get a single assembly with all details
 */
export async function getAssembly(assemblyId: string) {
    return await prisma.assembly.findUnique({
        where: { id: assemblyId },
        include: {
            parent: true,
            children: {
                include: {
                    assemblyParts: {
                        include: {
                            part: { include: { pieces: true } }
                        }
                    }
                }
            },
            assemblyParts: {
                include: {
                    part: {
                        include: {
                            profile: true,
                            grade: true,
                            pieces: true
                        }
                    }
                }
            }
        }
    })
}

/**
 * Update assembly details
 */
export async function updateAssembly(
    assemblyId: string,
    data: Partial<Omit<CreateAssemblyInput, 'projectId'>>
) {
    try {
        const assembly = await prisma.assembly.update({
            where: { id: assemblyId },
            data
        })

        revalidatePath(`/projects/${assembly.projectId}`)
        return { success: true, data: assembly }

    } catch (e: any) {
        console.error('updateAssembly error:', e)
        return { success: false, error: e.message }
    }
}

/**
 * Update assembly status
 */
export async function updateAssemblyStatus(
    assemblyId: string,
    status: 'NOT_STARTED' | 'IN_PROGRESS' | 'ASSEMBLED' | 'QC_PASSED' | 'SHIPPED'
) {
    try {
        const updateData: any = { status }

        if (status === 'SHIPPED') {
            updateData.shippedAt = new Date()
        }

        const assembly = await prisma.assembly.update({
            where: { id: assemblyId },
            data: updateData
        })

        revalidatePath(`/projects/${assembly.projectId}`)
        return { success: true }

    } catch (e: any) {
        console.error('updateAssemblyStatus error:', e)
        return { success: false, error: e.message }
    }
}

/**
 * Delete an assembly (only if no parts assigned and no sub-assemblies)
 */
export async function deleteAssembly(assemblyId: string) {
    try {
        const assembly = await prisma.assembly.findUnique({
            where: { id: assemblyId },
            include: {
                children: true,
                assemblyParts: true
            }
        })

        if (!assembly) {
            return { success: false, error: 'Assembly not found' }
        }

        if (assembly.children.length > 0) {
            return { success: false, error: 'Cannot delete assembly with sub-assemblies' }
        }

        if (assembly.assemblyParts.length > 0) {
            return { success: false, error: 'Cannot delete assembly with parts assigned' }
        }

        await prisma.assembly.delete({ where: { id: assemblyId } })

        revalidatePath(`/projects/${assembly.projectId}`)
        return { success: true }

    } catch (e: any) {
        console.error('deleteAssembly error:', e)
        return { success: false, error: e.message }
    }
}

// ============================================================================
// ASSEMBLY PARTS (Junction)
// ============================================================================

/**
 * Add a part to an assembly
 */
export async function addPartToAssembly(
    assemblyId: string,
    partId: string,
    quantityInAssembly: number = 1,
    notes?: string
) {
    try {
        // Validate that part and assembly belong to same project
        const [assembly, part] = await Promise.all([
            prisma.assembly.findUnique({ where: { id: assemblyId } }),
            prisma.part.findUnique({ where: { id: partId } })
        ])

        if (!assembly || !part) {
            return { success: false, error: 'Assembly or part not found' }
        }

        if (assembly.projectId !== part.projectId) {
            return { success: false, error: 'Part and assembly must belong to the same project' }
        }

        await prisma.assemblyPart.create({
            data: {
                assemblyId,
                partId,
                quantityInAssembly,
                notes
            }
        })

        revalidatePath(`/projects/${assembly.projectId}`)
        return { success: true }

    } catch (e: any) {
        if (e.code === 'P2002') {
            return { success: false, error: 'Part is already in this assembly' }
        }
        console.error('addPartToAssembly error:', e)
        return { success: false, error: e.message }
    }
}

/**
 * Remove a part from an assembly
 */
export async function removePartFromAssembly(assemblyId: string, partId: string) {
    try {
        const assembly = await prisma.assembly.findUnique({ where: { id: assemblyId } })

        await prisma.assemblyPart.delete({
            where: {
                assemblyId_partId: { assemblyId, partId }
            }
        })

        if (assembly) {
            revalidatePath(`/projects/${assembly.projectId}`)
        }
        return { success: true }

    } catch (e: any) {
        console.error('removePartFromAssembly error:', e)
        return { success: false, error: e.message }
    }
}

/**
 * Update quantity of a part in an assembly
 */
export async function updateAssemblyPartQuantity(
    assemblyId: string,
    partId: string,
    newQuantity: number
) {
    try {
        await prisma.assemblyPart.update({
            where: {
                assemblyId_partId: { assemblyId, partId }
            },
            data: { quantityInAssembly: newQuantity }
        })

        return { success: true }

    } catch (e: any) {
        console.error('updateAssemblyPartQuantity error:', e)
        return { success: false, error: e.message }
    }
}

// ============================================================================
// ASSEMBLY PROGRESS CALCULATIONS
// ============================================================================

/**
 * Calculate progress for an assembly based on its parts' pieces
 */
export async function getAssemblyProgress(assemblyId: string) {
    const assembly = await prisma.assembly.findUnique({
        where: { id: assemblyId },
        include: {
            assemblyParts: {
                include: {
                    part: {
                        include: {
                            pieces: true
                        }
                    }
                }
            }
        }
    })

    if (!assembly) {
        return null
    }

    let totalPiecesNeeded = 0
    let totalPiecesReady = 0
    let totalWeightNeeded = 0
    let totalWeightReady = 0

    for (const ap of assembly.assemblyParts) {
        const part = ap.part
        const piecesNeeded = ap.quantityInAssembly
        const unitWeight = part.unitWeight || 0

        // Count ready pieces for this part
        const readyPieces = part.pieces.filter(p => p.status === 'READY').length
        const availableForAssembly = Math.min(readyPieces, piecesNeeded)

        totalPiecesNeeded += piecesNeeded
        totalPiecesReady += availableForAssembly
        totalWeightNeeded += piecesNeeded * unitWeight
        totalWeightReady += availableForAssembly * unitWeight
    }

    return {
        assemblyId,
        totalPiecesNeeded,
        totalPiecesReady,
        totalWeightNeeded,
        totalWeightReady,
        percentByCount: totalPiecesNeeded > 0
            ? Math.round((totalPiecesReady / totalPiecesNeeded) * 100)
            : 0,
        percentByWeight: totalWeightNeeded > 0
            ? Math.round((totalWeightReady / totalWeightNeeded) * 100)
            : 0,
        isComplete: totalPiecesReady >= totalPiecesNeeded
    }
}

/**
 * Get progress for all assemblies in a project
 */
export async function getProjectAssemblyProgress(projectId: string) {
    const assemblies = await prisma.assembly.findMany({
        where: { projectId },
        include: {
            assemblyParts: {
                include: {
                    part: {
                        include: {
                            pieces: true
                        }
                    }
                }
            }
        }
    })

    const progressList = assemblies.map(assembly => {
        let totalPiecesNeeded = 0
        let totalPiecesReady = 0
        let totalWeight = 0

        for (const ap of assembly.assemblyParts) {
            const part = ap.part
            const piecesNeeded = ap.quantityInAssembly
            const readyPieces = part.pieces.filter(p => p.status === 'READY').length
            const availableForAssembly = Math.min(readyPieces, piecesNeeded)

            totalPiecesNeeded += piecesNeeded
            totalPiecesReady += availableForAssembly
            totalWeight += piecesNeeded * (part.unitWeight || 0)
        }

        return {
            id: assembly.id,
            assemblyNumber: assembly.assemblyNumber,
            name: assembly.name,
            status: assembly.status,
            scheduledDate: assembly.scheduledDate,
            totalPieces: totalPiecesNeeded,
            readyPieces: totalPiecesReady,
            weight: totalWeight,
            percentComplete: totalPiecesNeeded > 0
                ? Math.round((totalPiecesReady / totalPiecesNeeded) * 100)
                : 0
        }
    })

    return progressList
}
