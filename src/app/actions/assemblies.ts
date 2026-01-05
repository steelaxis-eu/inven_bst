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
    quantity?: number
}

/**
 * Create a new assembly
 */
export async function createAssembly(input: CreateAssemblyInput) {
    try {
        const { projectId, assemblyNumber, name, quantity = 1, ...rest } = input

        if (!projectId || !assemblyNumber || !name) {
            return { success: false, error: 'Missing required fields' }
        }

        const result = await prisma.$transaction(async (tx) => {
            // Create Assembly
            const assembly = await tx.assembly.create({
                data: {
                    projectId,
                    assemblyNumber,
                    name,
                    quantity,
                    ...rest
                }
            })

            // Create Pieces (Instances)
            if (quantity > 0) {
                const pieces = Array.from({ length: quantity }, (_, i) => ({
                    assemblyId: assembly.id,
                    pieceNumber: i + 1,
                    status: 'PENDING'
                }))
                await tx.assemblyPiece.createMany({ data: pieces })
            }

            return assembly
        })

        revalidatePath(`/projects/${projectId}`)
        return { success: true, data: result }

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
            pieces: {
                orderBy: { pieceNumber: 'asc' }
            },
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
            plateAssemblyParts: {
                include: {
                    platePart: true
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
            pieces: {
                orderBy: { pieceNumber: 'asc' },
                include: { childPieces: true }
            },
            children: {
                include: {
                    assemblyParts: {
                        include: {
                            part: { include: { pieces: true } }
                        }
                    },
                    plateAssemblyParts: {
                        include: {
                            platePart: true
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
            },
            plateAssemblyParts: {
                include: {
                    platePart: true
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
                assemblyParts: true,
                plateAssemblyParts: true
            }
        })

        if (!assembly) {
            return { success: false, error: 'Assembly not found' }
        }

        if (assembly.children.length > 0) {
            return { success: false, error: 'Cannot delete assembly with sub-assemblies' }
        }

        if (assembly.assemblyParts.length > 0 || assembly.plateAssemblyParts.length > 0) {
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
 * Add a PLATE part to an assembly
 */
export async function addPlatePartToAssembly(
    assemblyId: string,
    platePartId: string,
    quantityInAssembly: number = 1,
    notes?: string
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
            return { success: false, error: 'Part and assembly must belong to the same project' }
        }

        await prisma.plateAssemblyPart.create({
            data: {
                assemblyId,
                platePartId,
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
        console.error('addPlatePartToAssembly error:', e)
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
 * Remove a PLATE part from an assembly
 */
export async function removePlatePartFromAssembly(assemblyId: string, platePartId: string) {
    try {
        const assembly = await prisma.assembly.findUnique({ where: { id: assemblyId } })

        await prisma.plateAssemblyPart.delete({
            where: {
                assemblyId_platePartId: { assemblyId, platePartId }
            }
        })

        if (assembly) {
            revalidatePath(`/projects/${assembly.projectId}`)
        }
        return { success: true }

    } catch (e: any) {
        console.error('removePlatePartFromAssembly error:', e)
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
            },
            plateAssemblyParts: {
                include: {
                    platePart: true
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

    // PROFILES
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

    // PLATES
    for (const pap of assembly.plateAssemblyParts) {
        const part = pap.platePart
        const piecesNeeded = pap.quantityInAssembly
        const unitWeight = part.unitWeight || 0

        // Plate is ready if RECEIVED or QC_PASSED
        const isReady = part.status === 'RECEIVED' || part.status === 'QC_PASSED'
        const availableForAssembly = isReady ? piecesNeeded : 0 // Plates are batch managed usually, but simplifed here for now. 
        // Actually PlatePart has receivedQty. Let's use that if available, or just boolean status for now as singular items?
        // PlatePart is quantity based. 'receivedQty'
        const readyCount = part.receivedQty || 0
        const actuallyReady = Math.min(readyCount, piecesNeeded)

        totalPiecesNeeded += piecesNeeded
        totalPiecesReady += actuallyReady
        totalWeightNeeded += piecesNeeded * unitWeight
        totalWeightReady += actuallyReady * unitWeight
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
            },
            plateAssemblyParts: {
                include: {
                    platePart: true
                }
            }
        }
    })

    const progressList = assemblies.map(assembly => {
        let totalPiecesNeeded = 0
        let totalPiecesReady = 0
        let totalWeight = 0

        // Profiles
        for (const ap of assembly.assemblyParts) {
            const part = ap.part
            const piecesNeeded = ap.quantityInAssembly
            const readyPieces = part.pieces.filter(p => p.status === 'READY').length
            const availableForAssembly = Math.min(readyPieces, piecesNeeded)

            totalPiecesNeeded += piecesNeeded
            totalPiecesReady += availableForAssembly
            totalWeight += piecesNeeded * (part.unitWeight || 0)
        }

        // Plates
        for (const pap of assembly.plateAssemblyParts) {
            const part = pap.platePart
            const piecesNeeded = pap.quantityInAssembly
            // Use receivedQty for readiness
            const readyCount = part.receivedQty || 0
            const availableForAssembly = Math.min(readyCount, piecesNeeded)

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

